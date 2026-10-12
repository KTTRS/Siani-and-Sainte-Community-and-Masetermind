import { Router, Request, Response } from 'express';
import { db } from '../db';
import { membershipKeys, users, eventCheckins, events } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { createRateLimiter } from '../middleware/rateLimit';

// Dedicated strict limiter for the membership verify endpoint to prevent
// serial-number enumeration. Kept tighter than the general auth limiter.
const verifyRateLimiter = createRateLimiter({ windowMs: 900000, maxRequests: 20 }); // 20/15min per IP

const router = Router();

const JWT_SECRET = process.env.SESSION_SECRET || 'sainte-membership-secret';

// Generate a new access token for QR code
function generateAccessToken(userId: string, membershipId: string): string {
  return jwt.sign(
    { 
      userId, 
      membershipId,
      type: 'membership_access',
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Verify an access token from QR code
function verifyAccessToken(token: string): { userId: string; membershipId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'membership_access') return null;
    return { userId: decoded.userId, membershipId: decoded.membershipId };
  } catch {
    return null;
  }
}

// Get current user's membership card
router.get('/card', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get membership key
    const [membership] = await db
      .select()
      .from(membershipKeys)
      .where(eq(membershipKeys.userId, userId))
      .limit(1);

    if (!membership) {
      return res.status(404).json({ error: 'No membership found', hasMembership: false });
    }

    if (!membership.isActive) {
      return res.status(403).json({ 
        error: 'Membership suspended', 
        reason: membership.suspendedReason,
        hasMembership: true,
        isActive: false 
      });
    }

    // Check if token needs refresh (expires in less than 7 days)
    const tokenExpiry = new Date(membership.tokenExpiresAt);
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    let accessToken = membership.accessToken;
    let tokenExpiresAt = membership.tokenExpiresAt;

    if (tokenExpiry < sevenDaysFromNow) {
      // Refresh the token
      accessToken = generateAccessToken(userId, membership.id);
      tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      await db
        .update(membershipKeys)
        .set({ 
          accessToken, 
          tokenExpiresAt,
          updatedAt: new Date()
        })
        .where(eq(membershipKeys.id, membership.id));
    }

    // Get user info for display
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    res.json({
      hasMembership: true,
      isActive: true,
      card: {
        serialNumber: membership.serialNumber,
        memberSince: membership.memberSince,
        tier: membership.tier,
        cardDesign: membership.cardDesign,
        totalCheckins: membership.totalCheckins,
        lastUsedAt: membership.lastUsedAt,
      },
      member: {
        displayName: user?.displayName || 'Member',
        username: user?.username,
        credBalance: user?.credBalance || 0,
        level: user?.level || 1,
        avatarUrl: user?.avatarUrl,
      },
      qrData: {
        token: accessToken,
        expiresAt: tokenExpiresAt,
      },
    });
  } catch (error: any) {
    console.error('Error fetching membership card:', error);
    res.status(500).json({ error: 'Failed to fetch membership' });
  }
});

// Get membership stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [membership] = await db
      .select()
      .from(membershipKeys)
      .where(eq(membershipKeys.userId, userId))
      .limit(1);

    if (!membership) {
      return res.status(404).json({ error: 'No membership found' });
    }

    // Get recent check-ins
    const recentCheckins = await db
      .select({
        id: eventCheckins.id,
        checkedInAt: eventCheckins.checkedInAt,
        credAwarded: eventCheckins.credAwarded,
        eventTitle: events.title,
        eventVenue: events.venue,
      })
      .from(eventCheckins)
      .leftJoin(events, eq(eventCheckins.eventId, events.id))
      .where(eq(eventCheckins.userId, userId))
      .orderBy(desc(eventCheckins.checkedInAt))
      .limit(10);

    res.json({
      totalCheckins: membership.totalCheckins,
      tier: membership.tier,
      memberSince: membership.memberSince,
      recentCheckins,
    });
  } catch (error: any) {
    console.error('Error fetching membership stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Verify a membership QR code or serial number (for event check-in)
// Restricted to staff roles (chw, admin) to prevent serial-number enumeration
// by ordinary members. Also rate-limited per-IP to further slow brute-force.
router.post('/verify', verifyRateLimiter, async (req: Request, res: Response) => {
  const callerRole = (req as any).authUser?.userType;
  if (callerRole !== 'admin' && callerRole !== 'chw') {
    return res.status(403).json({ error: 'Staff access required' });
  }
  try {
    const { token, serialNumber, eventId } = req.body;

    if (!token && !serialNumber) {
      return res.status(400).json({ error: 'Token or serial number required' });
    }

    let membership;
    let userId;

    // Try to verify as JWT token first
    if (token) {
      const decoded = verifyAccessToken(token);
      if (decoded) {
        // Get membership by decoded token
        const [membershipByToken] = await db
          .select()
          .from(membershipKeys)
          .where(
            and(
              eq(membershipKeys.id, decoded.membershipId),
              eq(membershipKeys.userId, decoded.userId)
            )
          )
          .limit(1);
        
        if (membershipByToken) {
          membership = membershipByToken;
          userId = decoded.userId;
        }
      }
    }

    // If no valid token, try lookup by serial number
    if (!membership && (serialNumber || token)) {
      const lookupSerial = serialNumber || token;
      const [membershipBySerial] = await db
        .select()
        .from(membershipKeys)
        .where(eq(membershipKeys.serialNumber, lookupSerial.toUpperCase()))
        .limit(1);
      
      if (membershipBySerial) {
        membership = membershipBySerial;
        userId = membershipBySerial.userId;
      }
    }

    if (!membership || !userId) {
      return res.status(400).json({ error: 'Invalid code or membership not found', valid: false });
    }

    if (!membership.isActive) {
      return res.status(403).json({ 
        error: 'Membership suspended', 
        valid: false,
        reason: membership.suspendedReason 
      });
    }

    // Get user info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Check event requirements if eventId provided
    let eventInfo = null;
    let meetsRequirements = true;
    let requirementMessage = null;

    if (eventId) {
      const [event] = await db
        .select()
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);

      if (event) {
        eventInfo = {
          id: event.id,
          title: event.title,
          venue: event.venue,
        };

        // Check tier requirement
        const tierOrder = ['member', 'vip', 'icon', 'founder'];
        const userTierIndex = tierOrder.indexOf(membership.tier);
        const requiredTierIndex = tierOrder.indexOf(event.minimumTier || 'member');
        
        if (userTierIndex < requiredTierIndex) {
          meetsRequirements = false;
          requirementMessage = `Requires ${event.minimumTier} tier or higher`;
        }

        // Check CRED requirement
        if (event.minimumCred && (user?.credBalance || 0) < event.minimumCred) {
          meetsRequirements = false;
          requirementMessage = `Requires ${event.minimumCred} CRED minimum`;
        }

        // Check if already checked in
        const existingCheckin = await db
          .select()
          .from(eventCheckins)
          .where(
            and(
              eq(eventCheckins.eventId, eventId),
              eq(eventCheckins.userId, userId)
            )
          )
          .limit(1);

        if (existingCheckin.length > 0) {
          return res.json({
            valid: true,
            alreadyCheckedIn: true,
            checkinTime: existingCheckin[0].checkedInAt,
            member: {
              id: user?.id,
              displayName: user?.displayName || 'Member',
              username: user?.username,
              avatarUrl: user?.avatarUrl,
              tier: membership.tier,
              serialNumber: membership.serialNumber,
            },
            event: eventInfo,
          });
        }
      }
    }

    res.json({
      valid: true,
      meetsRequirements,
      requirementMessage,
      member: {
        id: user?.id,
        displayName: user?.displayName || 'Member',
        username: user?.username,
        avatarUrl: user?.avatarUrl,
        credBalance: user?.credBalance,
        tier: membership.tier,
        serialNumber: membership.serialNumber,
        totalCheckins: membership.totalCheckins,
      },
      event: eventInfo,
    });
  } catch (error: any) {
    console.error('Error verifying membership:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Self-service membership creation removed.
// Memberships are issued exclusively through the invite claim flow at
// POST /api/invites/claim, which requires a valid, active invite code.
// This route was removed to enforce the invite-only membership gate.

// Upgrade membership tier (admin only)
router.post('/:id/upgrade', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user is admin
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { tier, cardDesign } = req.body;
    const membershipId = req.params.id;

    const validTiers = ['member', 'vip', 'icon', 'founder'];
    const validDesigns = ['obsidian', 'chrome', 'crimson', 'gold'];

    const updates: any = { updatedAt: new Date() };
    
    if (tier && validTiers.includes(tier)) {
      updates.tier = tier;
    }
    if (cardDesign && validDesigns.includes(cardDesign)) {
      updates.cardDesign = cardDesign;
    }

    const [updated] = await db
      .update(membershipKeys)
      .set(updates)
      .where(eq(membershipKeys.id, membershipId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    res.json({ success: true, membership: updated });
  } catch (error: any) {
    console.error('Error upgrading membership:', error);
    res.status(500).json({ error: 'Failed to upgrade' });
  }
});

export default router;
