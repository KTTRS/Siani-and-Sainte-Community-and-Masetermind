import { Router, Request, Response } from "express";
import { db } from "../db";
import { pushTokens, notificationPreferences, notificationLog, users } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { verifyToken } from "../middleware/auth";

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

const router = Router();

// All routes require authentication
router.use(verifyToken);

// Register push token
router.post("/token", async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { token, platform = "ios", deviceId } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Push token is required" });
    }

    // Check if token already exists
    const existing = await db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.token, token))
      .limit(1);

    if (existing.length > 0) {
      // Update existing token
      await db
        .update(pushTokens)
        .set({
          userId,
          platform,
          deviceId,
          isActive: true,
          lastUsedAt: new Date(),
        })
        .where(eq(pushTokens.token, token));

      return res.json({ success: true, message: "Push token updated" });
    }

    // Create new token
    await db.insert(pushTokens).values({
      userId,
      token,
      platform,
      deviceId,
      isActive: true,
      lastUsedAt: new Date(),
    });

    res.json({ success: true, message: "Push token registered" });
  } catch (error) {
    console.error("Error registering push token:", error);
    res.status(500).json({ error: "Failed to register push token" });
  }
});

// Deactivate push token (requires authenticated user and token ownership)
router.delete("/token", async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Push token is required" });
    }

    // Verify token belongs to the authenticated user before deactivating
    const existingToken = await db
      .select()
      .from(pushTokens)
      .where(and(eq(pushTokens.token, token), eq(pushTokens.userId, userId)))
      .limit(1);

    if (existingToken.length === 0) {
      return res.status(404).json({ error: "Token not found or not owned by user" });
    }

    await db
      .update(pushTokens)
      .set({ isActive: false })
      .where(and(eq(pushTokens.token, token), eq(pushTokens.userId, userId)));

    res.json({ success: true, message: "Push token deactivated" });
  } catch (error) {
    console.error("Error deactivating push token:", error);
    res.status(500).json({ error: "Failed to deactivate push token" });
  }
});

// Get notification preferences
router.get("/preferences", async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const prefs = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (prefs.length === 0) {
      // Create default preferences
      const defaultPrefs = await db
        .insert(notificationPreferences)
        .values({ userId })
        .returning();

      return res.json({ preferences: defaultPrefs[0] });
    }

    res.json({ preferences: prefs[0] });
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    res.status(500).json({ error: "Failed to fetch notification preferences" });
  }
});

// Update notification preferences
router.patch("/preferences", async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const updates = req.body;

    // Ensure preferences exist
    const existing = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (existing.length === 0) {
      const newPrefs = await db
        .insert(notificationPreferences)
        .values({ userId, ...updates })
        .returning();

      return res.json({ preferences: newPrefs[0] });
    }

    const updated = await db
      .update(notificationPreferences)
      .set({ ...updates })
      .where(eq(notificationPreferences.userId, userId))
      .returning();

    res.json({ preferences: updated[0] });
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    res.status(500).json({ error: "Failed to update notification preferences" });
  }
});

// Get notification history
router.get("/history", async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const notifications = await db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.userId, userId))
      .orderBy(sql`created_at DESC`)
      .limit(limit)
      .offset(offset);

    res.json({ notifications, hasMore: notifications.length === limit });
  } catch (error) {
    console.error("Error fetching notification history:", error);
    res.status(500).json({ error: "Failed to fetch notification history" });
  }
});

// Mark notification as read
router.post("/read/:notificationId", async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { notificationId } = req.params;

    await db
      .update(notificationLog)
      .set({ status: "read", readAt: new Date() })
      .where(
        and(
          eq(notificationLog.id, notificationId),
          eq(notificationLog.userId, userId)
        )
      );

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// Helper function to get or create notification preferences
async function getOrCreatePreferences(userId: string) {
  const existingPrefs = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  if (existingPrefs.length > 0) {
    return existingPrefs[0];
  }

  // Create default preferences for the user
  const [newPrefs] = await db
    .insert(notificationPreferences)
    .values({ userId })
    .returning();

  return newPrefs;
}

// Check if currently in quiet hours
function isInQuietHours(prefs: { quietHoursEnabled: boolean | null; quietHoursStart: string | null; quietHoursEnd: string | null }): boolean {
  if (!prefs.quietHoursEnabled) return false;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = (prefs.quietHoursStart || "22:00").split(":").map(Number);
  const [endHour, endMinute] = (prefs.quietHoursEnd || "08:00").split(":").map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  return startTime < endTime
    ? currentTime >= startTime && currentTime < endTime
    : currentTime >= startTime || currentTime < endTime;
}

// Expo push notification sender utility
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  notificationType: string,
  data?: Record<string, string>,
  contentId?: string,
  contentType?: string
): Promise<{ success: boolean; notificationId?: string; error?: string; deferred?: boolean }> {
  try {
    // Always get or create preferences to ensure consistent behavior
    const userPrefs = await getOrCreatePreferences(userId);

    // Map notification types to preference keys
    type PrefKey = 'newDrops' | 'carePings' | 'streakWarnings' | 'spotlightAlerts' | 'vaultReactions' | 'checkInReminders' | 'credMilestones';
    const typeMap: Record<string, PrefKey> = {
      drop: "newDrops",
      care_ping: "carePings",
      streak: "streakWarnings",
      spotlight: "spotlightAlerts",
      reaction: "vaultReactions",
      checkin: "checkInReminders",
      cred: "credMilestones",
    };

    // Check if user has disabled this notification type
    const prefKey = typeMap[notificationType];
    if (prefKey && userPrefs[prefKey] === false) {
      return { success: false, error: "Notification type disabled by user" };
    }

    // Check quiet hours - log the notification as deferred instead of dropping
    if (isInQuietHours(userPrefs)) {
      // Log notification as pending for later delivery
      const [logged] = await db
        .insert(notificationLog)
        .values({
          userId,
          title,
          body,
          notificationType,
          status: "pending",
          contentId,
          contentType,
        })
        .returning();

      return {
        success: false,
        notificationId: logged.id,
        error: "User in quiet hours - notification deferred",
        deferred: true,
      };
    }

    // Get user's active push tokens
    const tokens = await db
      .select()
      .from(pushTokens)
      .where(
        and(
          eq(pushTokens.userId, userId),
          eq(pushTokens.isActive, true)
        )
      );

    if (tokens.length === 0) {
      return { success: false, error: "No active push tokens" };
    }

    // Log the notification
    const [logged] = await db
      .insert(notificationLog)
      .values({
        userId,
        title,
        body,
        notificationType,
        status: "pending",
        contentId,
        contentType,
      })
      .returning();

    // Send via Expo Push API
    const messages = tokens.map((t) => ({
      to: t.token,
      sound: "default" as const,
      title,
      body,
      data: { ...data, notificationId: logged.id },
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    const tickets = result.data as ExpoPushTicket[];

    // Update notification status based on tickets
    const anySuccess = tickets.some((t) => t.status === "ok");
    const firstReceipt = tickets.find((t) => t.id)?.id;

    await db
      .update(notificationLog)
      .set({
        status: anySuccess ? "sent" : "failed",
        expoReceiptId: firstReceipt,
        sentAt: anySuccess ? new Date() : null,
      })
      .where(eq(notificationLog.id, logged.id));

    // Update last used time on successful tokens
    const successfulTokens = tokens.filter((_, i) => tickets[i]?.status === "ok");
    if (successfulTokens.length > 0) {
      const tokenIds = successfulTokens.map((t) => t.id);
      await db
        .update(pushTokens)
        .set({ lastUsedAt: new Date() })
        .where(inArray(pushTokens.id, tokenIds));
    }

    // Mark failed tokens as inactive
    const failedTokens = tokens.filter((_, i) => {
      const ticket = tickets[i];
      return ticket?.status === "error" && 
        ticket.details?.error === "DeviceNotRegistered";
    });

    if (failedTokens.length > 0) {
      const tokenIds = failedTokens.map((t) => t.id);
      await db
        .update(pushTokens)
        .set({ isActive: false })
        .where(inArray(pushTokens.id, tokenIds));
    }

    return { success: anySuccess, notificationId: logged.id };
  } catch (error) {
    console.error("Error sending push notification:", error);
    return { success: false, error: "Failed to send notification" };
  }
}

// Notification trigger functions
export async function notifyNewDrop(
  userId: string,
  dropTitle: string,
  dropId: string
) {
  return sendPushNotification(
    userId,
    "New Drop Available",
    `"${dropTitle}" just dropped. Lock it in before it's gone.`,
    "drop",
    { screen: "Drop", dropId },
    dropId,
    "drop"
  );
}

export async function notifyCarePing(
  userId: string,
  senderName: string,
  messagePreview: string,
  messageId: string
) {
  return sendPushNotification(
    userId,
    `${senderName} sent you a message`,
    messagePreview.length > 50 ? messagePreview.slice(0, 47) + "..." : messagePreview,
    "care_ping",
    { screen: "HQ", messageId },
    messageId,
    "message"
  );
}

export async function notifyStreakWarning(userId: string, currentStreak: number) {
  return sendPushNotification(
    userId,
    "Streak Alert",
    `Your ${currentStreak}-day streak is about to expire. Check in now to keep it alive.`,
    "streak",
    { screen: "Home" }
  );
}

export async function notifySpotlight(
  userId: string,
  confessionId: string,
  bonusCred: number
) {
  return sendPushNotification(
    userId,
    "You're in the Spotlight",
    `Your confession was selected! You earned ${bonusCred} bonus CRED.`,
    "spotlight",
    { screen: "Vault", confessionId },
    confessionId,
    "confession"
  );
}

export async function notifyVaultReaction(
  userId: string,
  reactionType: string,
  confessionId: string
) {
  const reactionNames: Record<string, string> = {
    fire: "fire",
    strength: "strength",
    heart: "love",
    real: "real talk",
  };
  const reactionName = reactionNames[reactionType] || "a reaction";

  return sendPushNotification(
    userId,
    "New Reaction",
    `Someone showed ${reactionName} on your confession.`,
    "reaction",
    { screen: "Vault", confessionId },
    confessionId,
    "confession"
  );
}

export async function notifyCheckInReminder(userId: string) {
  return sendPushNotification(
    userId,
    "Night Shift Check-In",
    "How are you feeling tonight? Take a moment to check in with Siani.",
    "checkin",
    { screen: "Home" }
  );
}

export async function notifyCredMilestone(
  userId: string,
  newLevel: number,
  totalCred: number
) {
  return sendPushNotification(
    userId,
    `Level ${newLevel} Unlocked!`,
    `You hit ${totalCred.toLocaleString()} CRED. New status, new access.`,
    "cred",
    { screen: "Profile" }
  );
}

// Process deferred notifications (call via cron job or scheduled worker)
export async function processDeferredNotifications(): Promise<{ processed: number; sent: number; skipped: number }> {
  let processed = 0;
  let sent = 0;
  let skipped = 0;

  try {
    // Get all pending notifications
    const pendingNotifications = await db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.status, "pending"))
      .limit(100);

    for (const notification of pendingNotifications) {
      processed++;

      // Get user preferences
      const userPrefs = await getOrCreatePreferences(notification.userId);

      // Skip if still in quiet hours
      if (isInQuietHours(userPrefs)) {
        skipped++;
        continue;
      }

      // Get user's active push tokens
      const tokens = await db
        .select()
        .from(pushTokens)
        .where(
          and(
            eq(pushTokens.userId, notification.userId),
            eq(pushTokens.isActive, true)
          )
        );

      if (tokens.length === 0) {
        // No tokens, mark as failed
        await db
          .update(notificationLog)
          .set({ status: "failed" })
          .where(eq(notificationLog.id, notification.id));
        continue;
      }

      // Send the notification
      const messages = tokens.map((t) => ({
        to: t.token,
        sound: "default" as const,
        title: notification.title,
        body: notification.body,
        data: { notificationId: notification.id },
      }));

      try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messages),
        });

        const result = await response.json();
        const tickets = result.data as ExpoPushTicket[];
        const anySuccess = tickets.some((t) => t.status === "ok");
        const firstReceipt = tickets.find((t) => t.id)?.id;

        await db
          .update(notificationLog)
          .set({
            status: anySuccess ? "sent" : "failed",
            expoReceiptId: firstReceipt,
            sentAt: anySuccess ? new Date() : null,
          })
          .where(eq(notificationLog.id, notification.id));

        if (anySuccess) sent++;
      } catch {
        await db
          .update(notificationLog)
          .set({ status: "failed" })
          .where(eq(notificationLog.id, notification.id));
      }
    }
  } catch (error) {
    console.error("Error processing deferred notifications:", error);
  }

  return { processed, sent, skipped };
}

// Internal API endpoint to trigger deferred notification processing
router.post("/process-deferred", async (req: Request, res: Response) => {
  const userId = req.authUser?.id;
  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  // Only allow admin users to trigger this
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user.length === 0 || user[0].userType !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const result = await processDeferredNotifications();
  res.json({ success: true, ...result });
});

export default router;
