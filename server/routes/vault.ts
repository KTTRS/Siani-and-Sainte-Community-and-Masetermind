import { Router } from "express";
import { randomBytes } from "crypto";
import { storage } from "../storage";
import { VAULT_CRED_REWARDS } from "@shared/schema";
import { verifyToken } from "../middleware/auth";
import { z } from "zod";

// Generate a stable opaque per-confession label. Anonymous confessions
// expose this instead of any user identifier so authors stay unattributable
// even at the database layer.
function generateAuthorHandle(): string {
  return randomBytes(6).toString("hex");
}

const router = Router();

const createConfessionSchema = z.object({
  content: z.string().min(1, "Content is required").max(2000, "Content too long"),
  isAnonymous: z.boolean().default(true),
  displayName: z.string().optional(),
  category: z.enum(["truth", "struggle", "win", "question", "confession"]).default("truth"),
  mood: z.enum(["raw", "hopeful", "heavy", "relieved", "uncertain", "grateful"]).optional(),
  audioUrl: z.string().optional(),
  audioDuration: z.number().optional(),
});

const reactSchema = z.object({
  reactionType: z.enum(["fire", "strength", "heart", "real"]),
  action: z.enum(["add", "remove"]).default("add"),
});

router.get("/feed", verifyToken, async (req, res) => {
  try {
    const userId = req.authUser?.id ?? null;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const category = (req.query.category as string) || undefined;

    const result = await storage.getVaultFeedPublic({ userId, limit, offset, category });
    res.json(result);
  } catch (error) {
    console.error("Vault feed error:", error);
    res.status(500).json({ error: "Failed to fetch vault feed" });
  }
});

router.get("/spotlights", verifyToken, async (_req, res) => {
  try {
    const spotlights = await storage.getVaultSpotlightsPublic();
    res.json({ spotlights });
  } catch (error) {
    console.error("Vault spotlights error:", error);
    res.status(500).json({ error: "Failed to fetch spotlights" });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const parsed = createConfessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

    const { content, isAnonymous, displayName, category, mood, audioUrl, audioDuration } = parsed.data;

    const { confession, bonusCredReward } = await storage.createVaultConfessionForUser({
      userId,
      content,
      isAnonymous,
      authorHandle: isAnonymous ? generateAuthorHandle() : null,
      displayName,
      category,
      mood,
      audioUrl,
      audioDuration,
    });

    const totalCredEarned = VAULT_CRED_REWARDS.POST_CONFESSION + bonusCredReward;
    await storage.awardCred({
      userId,
      amount: totalCredEarned,
      reason: "vault_confession",
      sourceType: "confession",
      sourceId: confession.id,
    });

    res.json({
      success: true,
      confession: {
        id: confession.id,
        content: confession.content,
        isAnonymous: confession.isAnonymous,
        category: confession.category,
        mood: confession.mood,
        createdAt: confession.createdAt,
      },
      credEarned: totalCredEarned,
      bonusAwarded: bonusCredReward > 0,
    });
  } catch (error) {
    console.error("Create confession error:", error);
    res.status(500).json({ error: "Failed to create confession" });
  }
});

router.post("/:confessionId/react", verifyToken, async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const { confessionId } = req.params;
    const parsed = reactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

    const { reactionType, action } = parsed.data;
    const result = await storage.applyVaultReaction({ userId, confessionId, reactionType, action });

    if (!result.ok && result.action === "not_found") {
      return res.status(404).json({ error: "Confession not found" });
    }

    if (result.action === "added" && result.authorIdToReward) {
      await storage.awardCred({
        userId: result.authorIdToReward,
        amount: VAULT_CRED_REWARDS.RECEIVE_REACTION,
        reason: "vault_reaction_received",
        sourceType: "reaction",
        sourceId: `${confessionId}-${userId}-${reactionType}`,
      });
    }

    res.json({ success: true, action: result.action, reactionType: result.reactionType });
  } catch (error) {
    console.error("React to confession error:", error);
    res.status(500).json({ error: "Failed to react" });
  }
});

router.get("/mine", verifyToken, async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    // Anonymous confessions have user_id=NULL by design and are
    // intentionally not retrievable as "mine" — that is the cost of
    // genuine anonymity.
    const confessions = await storage.getMyVaultConfessions(userId);
    res.json({ confessions });
  } catch (error) {
    console.error("Get my confessions error:", error);
    res.status(500).json({ error: "Failed to fetch confessions" });
  }
});

router.get("/:confessionId", verifyToken, async (req, res) => {
  try {
    const { confessionId } = req.params;
    const userId = req.authUser?.id ?? null;

    const confession = await storage.getVaultConfessionPublic(confessionId, userId);
    if (!confession) return res.status(404).json({ error: "Confession not found" });

    res.json({ confession });
  } catch (error) {
    console.error("Get confession error:", error);
    res.status(500).json({ error: "Failed to fetch confession" });
  }
});

export default router;
