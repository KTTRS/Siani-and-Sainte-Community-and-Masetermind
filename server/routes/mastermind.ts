import { Router, Request, Response } from "express";
import { db } from "../db";
import { sql, eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import {
  users,
  mastermindCircles,
  mastermindSeats,
  mastermindPosts,
  mastermindResponses,
  MASTERMIND_ROLES,
  MASTERMIND_PATHWAYS,
  MASTERMIND_POST_KINDS,
  MASTERMIND_RESPONSE_KINDS,
  MASTERMIND_POST_POINTS,
  MASTERMIND_RESPONSE_POINTS,
  type MastermindRole,
  type MastermindPathway,
} from "@shared/schema";
import { verifyToken } from "../middleware/auth";

const router = Router();

const DEFAULT_SEAT_ROLES: MastermindRole[] = [
  "connector",
  "strategist",
  "operator",
  "mentor",
  "opportunity_spotter",
  "builder",
];

function chemistryFor(score: number): string {
  if (score >= 400) return "electric";
  if (score >= 200) return "strong";
  if (score >= 60) return "steady";
  return "forming";
}

function gravityFor(score: number): string {
  if (score >= 120) return "high";
  if (score >= 40) return "rising";
  return "quiet";
}

async function getOrCreateCircle(userId: string) {
  const [existing] = await db
    .select()
    .from(mastermindCircles)
    .where(eq(mastermindCircles.ownerUserId, userId));
  if (existing) return existing;

  const [created] = await db
    .insert(mastermindCircles)
    .values({ ownerUserId: userId, pathway: "entrepreneurship" })
    .returning();

  await db.insert(mastermindSeats).values(
    DEFAULT_SEAT_ROLES.map((role, i) => ({
      circleId: created.id,
      role,
      positionIndex: i,
    }))
  );

  return created;
}

async function recomputeMomentum(circleId: string) {
  const [postSum] = await db
    .select({ total: sql<number>`COALESCE(SUM(${mastermindPosts.points}), 0)` })
    .from(mastermindPosts)
    .where(eq(mastermindPosts.circleId, circleId));
  const [respSum] = await db
    .select({ total: sql<number>`COALESCE(SUM(${mastermindResponses.points}), 0)` })
    .from(mastermindResponses)
    .innerJoin(mastermindPosts, eq(mastermindPosts.id, mastermindResponses.postId))
    .where(eq(mastermindPosts.circleId, circleId));

  const total = Number(postSum?.total ?? 0) + Number(respSum?.total ?? 0);
  await db
    .update(mastermindCircles)
    .set({ momentumScore: total, chemistry: chemistryFor(total), updatedAt: new Date() })
    .where(eq(mastermindCircles.id, circleId));
  return total;
}

async function bumpSeatContribution(
  circleId: string,
  memberUserId: string | null,
  delta: number
) {
  if (!memberUserId) return;
  const [seat] = await db
    .select()
    .from(mastermindSeats)
    .where(
      and(
        eq(mastermindSeats.circleId, circleId),
        eq(mastermindSeats.memberUserId, memberUserId)
      )
    );
  if (!seat) return;
  const newScore = (seat.contributionScore ?? 0) + delta;
  await db
    .update(mastermindSeats)
    .set({
      contributionScore: newScore,
      gravity: gravityFor(newScore),
      lastInteractionAt: new Date(),
    })
    .where(eq(mastermindSeats.id, seat.id));
}

router.get("/", verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const circle = await getOrCreateCircle(userId);

    const seats = await db
      .select({
        id: mastermindSeats.id,
        role: mastermindSeats.role,
        memberUserId: mastermindSeats.memberUserId,
        reason: mastermindSeats.reason,
        strength: mastermindSeats.strength,
        positionIndex: mastermindSeats.positionIndex,
        contributionScore: mastermindSeats.contributionScore,
        gravity: mastermindSeats.gravity,
        lastInteractionAt: mastermindSeats.lastInteractionAt,
        memberUsername: users.username,
        memberDisplayName: users.displayName,
        memberAvatarUrl: users.avatarUrl,
      })
      .from(mastermindSeats)
      .leftJoin(users, eq(mastermindSeats.memberUserId, users.id))
      .where(eq(mastermindSeats.circleId, circle.id))
      .orderBy(mastermindSeats.positionIndex);

    const posts = await db
      .select({
        id: mastermindPosts.id,
        kind: mastermindPosts.kind,
        body: mastermindPosts.body,
        points: mastermindPosts.points,
        createdAt: mastermindPosts.createdAt,
        authorUserId: mastermindPosts.authorUserId,
        targetUserId: mastermindPosts.targetUserId,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
        authorAvatarUrl: users.avatarUrl,
      })
      .from(mastermindPosts)
      .leftJoin(users, eq(mastermindPosts.authorUserId, users.id))
      .where(eq(mastermindPosts.circleId, circle.id))
      .orderBy(desc(mastermindPosts.createdAt))
      .limit(40);

    const postIds = posts.map((p) => p.id);
    let responses: any[] = [];
    if (postIds.length > 0) {
      responses = await db
        .select({
          id: mastermindResponses.id,
          postId: mastermindResponses.postId,
          kind: mastermindResponses.kind,
          body: mastermindResponses.body,
          points: mastermindResponses.points,
          createdAt: mastermindResponses.createdAt,
          responderUserId: mastermindResponses.responderUserId,
          responderUsername: users.username,
          responderDisplayName: users.displayName,
          responderAvatarUrl: users.avatarUrl,
        })
        .from(mastermindResponses)
        .leftJoin(users, eq(mastermindResponses.responderUserId, users.id))
        .where(sql`${mastermindResponses.postId} = ANY(${postIds})`)
        .orderBy(desc(mastermindResponses.createdAt));
    }

    res.json({ circle, seats, posts, responses });
  } catch (err) {
    console.error("Mastermind GET error:", err);
    res.status(500).json({ error: "Failed to load mastermind" });
  }
});

const trajectorySchema = z.object({
  trajectory: z.string().max(280).optional().nullable(),
  constraintNow: z.string().max(280).optional().nullable(),
  successDef: z.string().max(280).optional().nullable(),
  pathway: z.enum(MASTERMIND_PATHWAYS).optional(),
});

router.patch("/trajectory", verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const parsed = trajectorySchema.parse(req.body);
    const circle = await getOrCreateCircle(userId);
    const [updated] = await db
      .update(mastermindCircles)
      .set({
        ...(parsed.trajectory !== undefined ? { trajectory: parsed.trajectory } : {}),
        ...(parsed.constraintNow !== undefined ? { constraintNow: parsed.constraintNow } : {}),
        ...(parsed.successDef !== undefined ? { successDef: parsed.successDef } : {}),
        ...(parsed.pathway ? { pathway: parsed.pathway } : {}),
        updatedAt: new Date(),
      })
      .where(eq(mastermindCircles.id, circle.id))
      .returning();
    res.json({ circle: updated });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
    console.error("Mastermind trajectory error:", err);
    res.status(500).json({ error: "Failed to update trajectory" });
  }
});

const addSeatSchema = z.object({ role: z.enum(MASTERMIND_ROLES) });

router.post("/seats", verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { role } = addSeatSchema.parse(req.body);
    const circle = await getOrCreateCircle(userId);

    const existing = await db
      .select({ count: sql<number>`count(*)` })
      .from(mastermindSeats)
      .where(eq(mastermindSeats.circleId, circle.id));
    const current = Number(existing[0]?.count ?? 0);
    if (current >= 9) return res.status(400).json({ error: "Circle is full (max 9 seats)" });

    const [seat] = await db
      .insert(mastermindSeats)
      .values({ circleId: circle.id, role, positionIndex: current })
      .returning();
    res.json({ seat });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
    console.error("Mastermind addSeat error:", err);
    res.status(500).json({ error: "Failed to add seat" });
  }
});

const inviteSchema = z.object({
  memberUsername: z.string().min(1).max(64),
  reason: z.string().max(280).optional(),
  strength: z.string().max(140).optional(),
});

router.post("/seats/:seatId/invite", verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { seatId } = req.params;
    const { memberUsername, reason, strength } = inviteSchema.parse(req.body);

    const circle = await getOrCreateCircle(userId);
    const [seat] = await db
      .select()
      .from(mastermindSeats)
      .where(and(eq(mastermindSeats.id, seatId), eq(mastermindSeats.circleId, circle.id)));
    if (!seat) return res.status(404).json({ error: "Seat not found" });

    const [member] = await db
      .select()
      .from(users)
      .where(eq(users.username, memberUsername.replace(/^@/, "")));
    if (!member) return res.status(404).json({ error: "Member not found" });
    if (member.id === userId) return res.status(400).json({ error: "You cannot seat yourself" });

    const [updated] = await db
      .update(mastermindSeats)
      .set({
        memberUserId: member.id,
        reason: reason ?? seat.reason,
        strength: strength ?? seat.strength,
        lastInteractionAt: new Date(),
      })
      .where(eq(mastermindSeats.id, seatId))
      .returning();

    res.json({ seat: updated, member: { id: member.id, username: member.username, displayName: member.displayName, avatarUrl: member.avatarUrl } });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
    console.error("Mastermind invite error:", err);
    res.status(500).json({ error: "Failed to fill seat" });
  }
});

router.delete("/seats/:seatId", verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { seatId } = req.params;
    const circle = await getOrCreateCircle(userId);
    const [seat] = await db
      .select()
      .from(mastermindSeats)
      .where(and(eq(mastermindSeats.id, seatId), eq(mastermindSeats.circleId, circle.id)));
    if (!seat) return res.status(404).json({ error: "Seat not found" });

    if (req.query.mode === "vacate") {
      const [updated] = await db
        .update(mastermindSeats)
        .set({ memberUserId: null, reason: null, strength: null, contributionScore: 0, gravity: "quiet" })
        .where(eq(mastermindSeats.id, seatId))
        .returning();
      return res.json({ seat: updated });
    }

    await db.delete(mastermindSeats).where(eq(mastermindSeats.id, seatId));
    res.json({ ok: true });
  } catch (err) {
    console.error("Mastermind delete seat error:", err);
    res.status(500).json({ error: "Failed to remove seat" });
  }
});

const postSchema = z.object({
  kind: z.enum(MASTERMIND_POST_KINDS),
  body: z.string().min(1).max(1000),
  targetUserId: z.string().optional().nullable(),
});

router.post("/posts", verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const parsed = postSchema.parse(req.body);

    // Find which circles this post belongs to. For MVP: a user posts into
    // their own circle. (A future expansion can fan out to circles where
    // they hold a seat.)
    const circle = await getOrCreateCircle(userId);

    const points = MASTERMIND_POST_POINTS[parsed.kind];
    const [post] = await db
      .insert(mastermindPosts)
      .values({
        circleId: circle.id,
        authorUserId: userId,
        kind: parsed.kind,
        body: parsed.body,
        targetUserId: parsed.targetUserId ?? null,
        points,
      })
      .returning();

    // Exchange / Activate give credit to the author (the giver) inside any
    // circle they hold a seat in. For MVP we credit only the user's own
    // circle when the author also occupies one of their own seats — keep
    // simple, just bump if member seat exists.
    if (parsed.kind === "exchange") {
      await bumpSeatContribution(circle.id, userId, points);
    }

    const total = await recomputeMomentum(circle.id);
    res.json({ post, momentumScore: total });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
    console.error("Mastermind post error:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
});

const respondSchema = z.object({
  kind: z.enum(MASTERMIND_RESPONSE_KINDS),
  body: z.string().max(600).optional(),
});

router.post("/posts/:postId/respond", verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { postId } = req.params;
    const { kind, body } = respondSchema.parse(req.body);

    const [post] = await db.select().from(mastermindPosts).where(eq(mastermindPosts.id, postId));
    if (!post) return res.status(404).json({ error: "Post not found" });

    // Authorization: caller must own the circle or hold a seat in it.
    const [circle] = await db.select().from(mastermindCircles).where(eq(mastermindCircles.id, post.circleId));
    if (!circle) return res.status(404).json({ error: "Circle not found" });
    let authorized = circle.ownerUserId === userId;
    if (!authorized) {
      const [seat] = await db
        .select({ id: mastermindSeats.id })
        .from(mastermindSeats)
        .where(and(eq(mastermindSeats.circleId, post.circleId), eq(mastermindSeats.memberUserId, userId)));
      authorized = !!seat;
    }
    if (!authorized) return res.status(403).json({ error: "Not part of this circle" });

    const points = MASTERMIND_RESPONSE_POINTS[kind];
    const [resp] = await db
      .insert(mastermindResponses)
      .values({ postId, responderUserId: userId, kind, body: body ?? null, points })
      .returning();

    await bumpSeatContribution(post.circleId, userId, points);
    const total = await recomputeMomentum(post.circleId);
    res.json({ response: resp, momentumScore: total });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
    console.error("Mastermind respond error:", err);
    res.status(500).json({ error: "Failed to respond" });
  }
});

export default router;
