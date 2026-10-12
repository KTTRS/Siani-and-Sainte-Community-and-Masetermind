import { Router, Request, Response } from "express";
import { db } from "../db";
import { sql, desc, eq, and, gte, lte } from "drizzle-orm";
import { users, credTransactions, vaultConfessions, dropRsvps } from "@shared/schema";
import { verifyToken, optionalAuth } from "../middleware/auth";

const router = Router();

type SqlResult = { rows: any[] };
const asRows = (result: any): any[] => Array.isArray(result) ? result : result.rows || [];

interface HeatRanking {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  cred: number;
  rank: number;
  previousRank: number | null;
  movement: "up" | "down" | "same" | "new";
  movementAmount: number;
  weeklyCredEarned: number;
  level: number;
  currentStreak: number;
  isWatching: boolean;
}

interface LeaderboardResponse {
  rankings: HeatRanking[];
  userRank: HeatRanking | null;
  totalMembers: number;
  periodStart: string;
  periodEnd: string;
}

router.get("/rankings", optionalAuth, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.authUser?.id;
    const period = (req.query.period as string) || "weekly";
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = parseInt(req.query.offset as string) || 0;

    const now = new Date();
    let periodStart: Date;
    let periodEnd = now;

    if (period === "daily") {
      periodStart = new Date(now);
      periodStart.setHours(0, 0, 0, 0);
    } else if (period === "weekly") {
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - now.getDay());
      periodStart.setHours(0, 0, 0, 0);
    } else {
      periodStart = new Date(now);
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
    }

    const weeklyCredQuery = await db
      .select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        credBalance: users.credBalance,
        level: users.level,
        currentStreak: users.currentStreak,
        weeklyCredEarned: sql<number>`COALESCE(SUM(CASE WHEN ${credTransactions.createdAt} >= ${periodStart.toISOString()} THEN ${credTransactions.amount} ELSE 0 END), 0)`.as("weekly_cred"),
      })
      .from(users)
      .leftJoin(credTransactions, eq(users.id, credTransactions.userId))
      .where(eq(users.userType, "member"))
      .groupBy(users.id, users.username, users.displayName, users.avatarUrl, users.credBalance, users.level, users.currentStreak)
      .orderBy(desc(users.credBalance), desc(users.currentStreak))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.userType, "member"));

    const watchersForUser = currentUserId
      ? await db.execute(
          sql`SELECT watched_user_id FROM profile_watchers WHERE watcher_user_id = ${currentUserId}`
        )
      : { rows: [] };

    const watchedIds = new Set(
      (asRows(watchersForUser) as Array<{ watched_user_id: string }>).map(r => r.watched_user_id)
    );

    const previousRankings = await getPreviousRankings(periodStart);

    const rankings: HeatRanking[] = weeklyCredQuery.map((user, index) => {
      const currentRank = offset + index + 1;
      const prevRank = previousRankings.get(user.userId);
      
      let movement: "up" | "down" | "same" | "new" = "new";
      let movementAmount = 0;

      if (prevRank !== undefined) {
        if (prevRank > currentRank) {
          movement = "up";
          movementAmount = prevRank - currentRank;
        } else if (prevRank < currentRank) {
          movement = "down";
          movementAmount = currentRank - prevRank;
        } else {
          movement = "same";
        }
      }

      return {
        userId: user.userId,
        username: user.username || `member_${user.userId.slice(0, 6)}`,
        displayName: user.displayName || user.username || "Anonymous Member",
        avatarUrl: user.avatarUrl || null,
        cred: user.credBalance || 0,
        rank: currentRank,
        previousRank: prevRank ?? null,
        movement,
        movementAmount,
        weeklyCredEarned: Number(user.weeklyCredEarned) || 0,
        level: user.level || 1,
        currentStreak: user.currentStreak || 0,
        isWatching: watchedIds.has(user.userId),
      };
    });

    let userRank: HeatRanking | null = null;
    if (currentUserId) {
      const existingInList = rankings.find(r => r.userId === currentUserId);
      if (existingInList) {
        userRank = existingInList;
      } else {
        const userRankResult = await db.execute(sql`
          WITH ranked_users AS (
            SELECT 
              id,
              username,
              display_name,
              avatar_url,
              cred_balance as cred,
              level,
              current_streak,
              ROW_NUMBER() OVER (ORDER BY cred_balance DESC) as rank
            FROM users
            WHERE user_type = 'member' AND cred_balance > 0
          )
          SELECT * FROM ranked_users WHERE id = ${currentUserId}
        `);

        const userRankRows = asRows(userRankResult);
        if (userRankRows.length > 0) {
          const row = userRankRows[0] as any;
          const prevRank = previousRankings.get(currentUserId);
          const currentRankNum = Number(row.rank);
          
          let movement: "up" | "down" | "same" | "new" = "new";
          let movementAmount = 0;

          if (prevRank !== undefined) {
            if (prevRank > currentRankNum) {
              movement = "up";
              movementAmount = prevRank - currentRankNum;
            } else if (prevRank < currentRankNum) {
              movement = "down";
              movementAmount = currentRankNum - prevRank;
            } else {
              movement = "same";
            }
          }

          userRank = {
            userId: row.id,
            username: row.username || `member_${row.id.slice(0, 6)}`,
            displayName: row.display_name || row.username || "Anonymous Member",
            avatarUrl: row.avatar_url || null,
            cred: row.cred || 0,
            rank: currentRankNum,
            previousRank: prevRank ?? null,
            movement,
            movementAmount,
            weeklyCredEarned: 0,
            level: row.level || 1,
            currentStreak: row.current_streak || 0,
            isWatching: false,
          };
        }
      }
    }

    const response: LeaderboardResponse = {
      rankings,
      userRank,
      totalMembers: Number(totalResult?.count) || 0,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error("Get heat rankings error:", error);
    res.status(500).json({ error: "Failed to get rankings" });
  }
});

router.post("/watch/:userId", verifyToken, async (req: Request, res: Response) => {
  try {
    const watcherId = req.authUser?.id;
    const { userId: watchedId } = req.params;

    if (!watcherId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (watcherId === watchedId) {
      return res.status(400).json({ error: "Cannot watch yourself" });
    }

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, watchedId));

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const existing = await db.execute(
      sql`SELECT id FROM profile_watchers WHERE watcher_user_id = ${watcherId} AND watched_user_id = ${watchedId}`
    );

    if (asRows(existing).length > 0) {
      await db.execute(
        sql`DELETE FROM profile_watchers WHERE watcher_user_id = ${watcherId} AND watched_user_id = ${watchedId}`
      );
      res.json({ watching: false, message: "Stopped watching" });
    } else {
      await db.execute(
        sql`INSERT INTO profile_watchers (watcher_user_id, watched_user_id) VALUES (${watcherId}, ${watchedId})`
      );
      res.json({ watching: true, message: "Now watching" });
    }
  } catch (error) {
    console.error("Toggle watch error:", error);
    res.status(500).json({ error: "Failed to toggle watch" });
  }
});

router.get("/watchers", verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const watchersResult = await db.execute(sql`
      SELECT 
        pw.watcher_user_id as id,
        u.username,
        u.display_name,
        u.cred,
        u.level,
        pw.created_at
      FROM profile_watchers pw
      JOIN users u ON u.id = pw.watcher_user_id
      WHERE pw.watched_user_id = ${userId}
      ORDER BY pw.created_at DESC
      LIMIT 50
    `);

    const watchingResult = await db.execute(sql`
      SELECT 
        pw.watched_user_id as id,
        u.username,
        u.display_name,
        u.cred,
        u.level,
        pw.created_at
      FROM profile_watchers pw
      JOIN users u ON u.id = pw.watched_user_id
      WHERE pw.watcher_user_id = ${userId}
      ORDER BY pw.created_at DESC
      LIMIT 50
    `);

    const watchersRows = asRows(watchersResult);
    const watchingRows = asRows(watchingResult);
    res.json({
      watchers: watchersRows,
      watcherCount: watchersRows.length,
      watching: watchingRows,
      watchingCount: watchingRows.length,
    });
  } catch (error) {
    console.error("Get watchers error:", error);
    res.status(500).json({ error: "Failed to get watchers" });
  }
});

router.get("/stats/:userId", verifyToken, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.authUser?.id;

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weeklyCredResult = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(credTransactions)
      .where(
        and(
          eq(credTransactions.userId, userId),
          gte(credTransactions.createdAt, weekStart)
        )
      );

    const confessionCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(vaultConfessions)
      .where(eq(vaultConfessions.userId, userId));

    const dropCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(dropRsvps)
      .where(eq(dropRsvps.userId, userId));

    const watcherCountResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM profile_watchers WHERE watched_user_id = ${userId}`
    );

    let isWatching = false;
    if (currentUserId && currentUserId !== userId) {
      const watchCheck = await db.execute(
        sql`SELECT id FROM profile_watchers WHERE watcher_user_id = ${currentUserId} AND watched_user_id = ${userId}`
      );
      isWatching = asRows(watchCheck).length > 0;
    }

    res.json({
      userId: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.displayName,
      cred: targetUser.credBalance || 0,
      level: targetUser.level || 1,
      currentStreak: targetUser.currentStreak || 0,
      longestStreak: targetUser.longestStreak || 0,
      weeklyCredEarned: Number(weeklyCredResult[0]?.total) || 0,
      confessionCount: Number(confessionCountResult[0]?.count) || 0,
      dropCount: Number(dropCountResult[0]?.count) || 0,
      watcherCount: Number((asRows(watcherCountResult)[0] as any)?.count) || 0,
      isWatching,
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({ error: "Failed to get user stats" });
  }
});

router.get("/movers", verifyToken, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.authUser?.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const biggestMoversResult = await db.execute(sql`
      WITH daily_cred AS (
        SELECT 
          user_id,
          SUM(amount) as daily_earned
        FROM cred_transactions
        WHERE created_at >= ${yesterday.toISOString()}
        GROUP BY user_id
        ORDER BY daily_earned DESC
        LIMIT ${limit}
      )
      SELECT 
        u.id,
        u.username,
        u.display_name,
        u.cred_balance,
        u.level,
        dc.daily_earned
      FROM daily_cred dc
      JOIN users u ON u.id = dc.user_id
      WHERE u.user_type = 'member'
      ORDER BY dc.daily_earned DESC
    `);

    const movers = (asRows(biggestMoversResult) as any[]).map((row, index) => ({
      userId: row.id,
      username: row.username || `member_${row.id.slice(0, 6)}`,
      displayName: row.display_name || row.username || "Anonymous Member",
      cred: row.cred_balance || 0,
      level: row.level || 1,
      dailyCredEarned: Number(row.daily_earned) || 0,
      rank: index + 1,
    }));

    res.json({
      movers,
      period: "24h",
      updatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Get movers error:", error);
    res.status(500).json({ error: "Failed to get movers" });
  }
});

async function getPreviousRankings(currentPeriodStart: Date): Promise<Map<string, number>> {
  const rankings = new Map<string, number>();
  
  try {
    const previousPeriodResult = await db.execute(sql`
      SELECT user_id, rank 
      FROM heat_rankings 
      WHERE period_start < ${currentPeriodStart.toISOString()}
      ORDER BY period_start DESC, rank ASC
      LIMIT 100
    `);

    (asRows(previousPeriodResult) as Array<{ user_id: string; rank: number }>).forEach(row => {
      if (!rankings.has(row.user_id)) {
        rankings.set(row.user_id, row.rank);
      }
    });
  } catch (error) {
    console.log("No previous rankings found, treating all as new");
  }

  return rankings;
}

export default router;
