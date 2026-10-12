import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  inviteRequests, inviteCodes, membershipKeys, users,
  InsertInviteRequest, InsertMembershipKey
} from '@shared/schema';
import { eq, and, gt, desc } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import { sendInviteCodeSMS, sendMembershipActivatedSMS, isTwilioConfigured } from '../integrations/twilio';

const router = Router();

// Generate a unique 6-character invite code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Hash a code for secure storage
function hashCode(code: string): string {
  return createHash('sha256').update(code.toUpperCase()).digest('hex');
}

// Generate a membership serial number
function generateSerialNumber(): string {
  const year = new Date().getFullYear();
  const random = randomBytes(3).toString('hex').toUpperCase();
  return `STE-${year}-${random}`;
}

// Generate a secure access token for QR codes
function generateAccessToken(): string {
  return randomBytes(32).toString('base64url');
}

// ============================================
// PUBLIC ROUTES (No auth required)
// ============================================

// Submit an invite request (public endpoint)
router.post('/request', async (req: Request, res: Response) => {
  try {
    const { phone, email, name, source, sourceEventId, referredBy } = req.body;

    // Require at least phone or email
    if (!phone && !email) {
      return res.status(400).json({ error: 'Phone or email required' });
    }

    // Validate phone format (basic check)
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 10) {
        return res.status(400).json({ error: 'Invalid phone number' });
      }
    }

    // Check for duplicate pending requests
    const existingRequest = await db
      .select()
      .from(inviteRequests)
      .where(
        and(
          phone ? eq(inviteRequests.phone, phone) : eq(inviteRequests.email, email || ''),
          eq(inviteRequests.status, 'pending')
        )
      )
      .limit(1);

    if (existingRequest.length > 0) {
      // Never reveal whether a code exists or its value — doing so would let
      // an unauthenticated caller harvest active invite codes by re-submitting.
      return res.json({ 
        success: true, 
        message: "You're already on the list. We'll be in touch.",
        requestId: existingRequest[0].id 
      });
    }

    // Create the request
    const [request] = await db
      .insert(inviteRequests)
      .values({
        phone: phone || null,
        email: email || null,
        name: name || null,
        source: source || 'organic',
        sourceEventId: sourceEventId || null,
        referredBy: referredBy || null,
        status: 'pending',
        priority: source === 'event' ? 10 : 0, // Event signups get priority
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || null,
      })
      .returning();

    if (phone) {
      const twilioReady = await isTwilioConfigured();
      
      if (twilioReady) {
        // Attempt SMS delivery — failure is logged but never exposed to caller.
        const smsResult = await processInviteRequest(request.id);
        if (!smsResult.success) {
          console.warn('SMS delivery failed for invite request', request.id, smsResult.error);
        }
      } else {
        // Twilio not configured — code will be issued via admin approval flow.
        console.info('Twilio not configured; invite request queued for manual review', request.id);
      }
    }

    res.json({ 
      success: true, 
      message: "You're on the list. Watch for your invite.",
      requestId: request.id,
    });
  } catch (error: any) {
    console.error('Error creating invite request:', error);
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

// Verify an invite code (public - used during signup)
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code || code.length < 4) {
      return res.status(400).json({ error: 'Invalid code format' });
    }

    const codeHash = hashCode(code);

    const [inviteCode] = await db
      .select()
      .from(inviteCodes)
      .where(
        and(
          eq(inviteCodes.codeHash, codeHash),
          eq(inviteCodes.status, 'active'),
          gt(inviteCodes.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!inviteCode) {
      // Increment attempt count if code exists but is invalid
      const [existingCode] = await db
        .select()
        .from(inviteCodes)
        .where(eq(inviteCodes.codeHash, codeHash))
        .limit(1);

      if (existingCode) {
        await db
          .update(inviteCodes)
          .set({ attemptCount: (existingCode.attemptCount || 0) + 1 })
          .where(eq(inviteCodes.id, existingCode.id));

        if ((existingCode.attemptCount || 0) >= (existingCode.maxAttempts || 3)) {
          return res.status(400).json({ error: 'Code has been locked. Contact support.' });
        }

        if (existingCode.status === 'claimed') {
          return res.status(400).json({ error: 'This code has already been used' });
        }
        if (existingCode.status === 'expired' || new Date() > new Date(existingCode.expiresAt)) {
          return res.status(400).json({ error: 'This code has expired' });
        }
      }

      return res.status(400).json({ error: 'Invalid invite code' });
    }

    // Get associated request info
    let requestInfo = null;
    if (inviteCode.requestId) {
      const [request] = await db
        .select()
        .from(inviteRequests)
        .where(eq(inviteRequests.id, inviteCode.requestId))
        .limit(1);
      requestInfo = request;
    }

    res.json({
      valid: true,
      codeId: inviteCode.id,
      expiresAt: inviteCode.expiresAt,
      name: requestInfo?.name,
      phone: requestInfo?.phone,
      email: requestInfo?.email,
    });
  } catch (error: any) {
    console.error('Error verifying invite code:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

// ============================================
// AUTHENTICATED ROUTES
// ============================================

// Claim membership with a verified code (requires auth)
router.post('/claim', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { codeId } = req.body;

    if (!codeId) {
      return res.status(400).json({ error: 'Code ID required' });
    }

    // Get and validate the code
    const [inviteCode] = await db
      .select()
      .from(inviteCodes)
      .where(
        and(
          eq(inviteCodes.id, codeId),
          eq(inviteCodes.status, 'active'),
          gt(inviteCodes.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    // Check if user already has a membership
    const existingMembership = await db
      .select()
      .from(membershipKeys)
      .where(eq(membershipKeys.userId, userId))
      .limit(1);

    if (existingMembership.length > 0) {
      // Mark code as claimed anyway
      await db
        .update(inviteCodes)
        .set({ status: 'claimed', claimedAt: new Date(), claimedByUserId: userId })
        .where(eq(inviteCodes.id, codeId));

      return res.json({
        success: true,
        message: 'You already have a membership',
        membershipKey: existingMembership[0],
      });
    }

    // Create membership key
    const serialNumber = generateSerialNumber();
    const accessToken = generateAccessToken();
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const [membershipKey] = await db
      .insert(membershipKeys)
      .values({
        userId,
        serialNumber,
        accessToken,
        tokenExpiresAt,
        tier: 'member',
        cardDesign: 'obsidian',
      })
      .returning();

    // Mark code as claimed
    await db
      .update(inviteCodes)
      .set({ status: 'claimed', claimedAt: new Date(), claimedByUserId: userId })
      .where(eq(inviteCodes.id, codeId));

    // Update invite request status
    if (inviteCode.requestId) {
      await db
        .update(inviteRequests)
        .set({ status: 'claimed', processedAt: new Date() })
        .where(eq(inviteRequests.id, inviteCode.requestId));
    }

    // Get user info for SMS
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Send activation SMS if we have phone
    if (inviteCode.requestId) {
      const [request] = await db
        .select()
        .from(inviteRequests)
        .where(eq(inviteRequests.id, inviteCode.requestId))
        .limit(1);

      if (request?.phone) {
        await sendMembershipActivatedSMS(
          request.phone,
          serialNumber,
          user?.displayName || request.name || undefined
        );
      }
    }

    res.json({
      success: true,
      message: 'Welcome to SAINTE',
      membershipKey,
    });
  } catch (error: any) {
    console.error('Error claiming membership:', error);
    res.status(500).json({ error: 'Failed to claim membership' });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Process an invite request (approve and send code)
async function processInviteRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const [request] = await db
      .select()
      .from(inviteRequests)
      .where(eq(inviteRequests.id, requestId))
      .limit(1);

    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    if (!request.phone) {
      return { success: false, error: 'No phone number for SMS delivery' };
    }

    // Generate unique code
    let code = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db
        .select()
        .from(inviteCodes)
        .where(eq(inviteCodes.code, code))
        .limit(1);
      if (existing.length === 0) break;
      code = generateInviteCode();
      attempts++;
    }

    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Create invite code
    const [inviteCode] = await db
      .insert(inviteCodes)
      .values({
        requestId,
        code,
        codeHash,
        deliveryMethod: 'sms',
        expiresAt,
        status: 'active',
      })
      .returning();

    // Send SMS
    const result = await sendInviteCodeSMS(request.phone, code, request.name || undefined);

    if (result.success) {
      await db
        .update(inviteCodes)
        .set({ deliveredAt: new Date() })
        .where(eq(inviteCodes.id, inviteCode.id));

      await db
        .update(inviteRequests)
        .set({ status: 'code_sent', processedAt: new Date() })
        .where(eq(inviteRequests.id, requestId));

      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    console.error('Error processing invite request:', error);
    return { success: false, error: error.message };
  }
}

// Dev mode: Generate code without sending SMS (returns the code for testing)
async function processInviteRequestDevMode(requestId: string): Promise<string | undefined> {
  try {
    const [request] = await db
      .select()
      .from(inviteRequests)
      .where(eq(inviteRequests.id, requestId))
      .limit(1);

    if (!request) return undefined;

    // Generate unique code
    let code = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db
        .select()
        .from(inviteCodes)
        .where(eq(inviteCodes.code, code))
        .limit(1);
      if (existing.length === 0) break;
      code = generateInviteCode();
      attempts++;
    }

    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Create invite code
    await db
      .insert(inviteCodes)
      .values({
        requestId,
        code,
        codeHash,
        deliveryMethod: 'manual',
        expiresAt,
        status: 'active',
      });

    // Update request status
    await db
      .update(inviteRequests)
      .set({ status: 'code_sent', processedAt: new Date() })
      .where(eq(inviteRequests.id, requestId));

    return code;
  } catch (error: any) {
    console.error('Error in dev mode processing:', error);
    return undefined;
  }
}

// Admin: Approve and send invite (requires admin auth)
router.post('/approve/:id', async (req: Request, res: Response) => {
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

    const result = await processInviteRequest(req.params.id);

    if (result.success) {
      res.json({ success: true, message: 'Invite code sent' });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Error approving invite:', error);
    res.status(500).json({ error: 'Failed to approve invite' });
  }
});

// Admin: List pending invite requests
router.get('/requests', async (req: Request, res: Response) => {
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

    const status = req.query.status as string || 'pending';
    const limit = parseInt(req.query.limit as string) || 50;

    const requests = await db
      .select()
      .from(inviteRequests)
      .where(eq(inviteRequests.status, status))
      .orderBy(desc(inviteRequests.priority), desc(inviteRequests.createdAt))
      .limit(limit);

    res.json({ requests });
  } catch (error: any) {
    console.error('Error fetching invite requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Admin: Bulk approve pending invites
router.post('/bulk-approve', async (req: Request, res: Response) => {
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

    const { requestIds } = req.body;
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({ error: 'Request IDs required' });
    }

    const results = await Promise.all(
      requestIds.map(id => processInviteRequest(id))
    );

    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({ 
      success: true, 
      message: `Sent ${success} invites, ${failed} failed`,
      results 
    });
  } catch (error: any) {
    console.error('Error bulk approving invites:', error);
    res.status(500).json({ error: 'Failed to process invites' });
  }
});

export default router;
