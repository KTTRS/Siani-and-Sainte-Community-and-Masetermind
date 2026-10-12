import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  events, eventRsvps, eventCheckins, membershipKeys, users, 
  credTransactions, CRED_REWARDS
} from '@shared/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';

const router = Router();

// Get upcoming events
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser?.id;
    const status = req.query.status as string || 'upcoming';
    const limit = parseInt(req.query.limit as string) || 20;

    const eventsList = await db
      .select()
      .from(events)
      .where(eq(events.status, status))
      .orderBy(events.startsAt)
      .limit(limit);

    // If user is authenticated, add RSVP status
    if (userId) {
      const enrichedEvents = await Promise.all(
        eventsList.map(async (event) => {
          const [rsvp] = await db
            .select()
            .from(eventRsvps)
            .where(
              and(
                eq(eventRsvps.eventId, event.id),
                eq(eventRsvps.userId, userId)
              )
            )
            .limit(1);

          return {
            ...event,
            userRsvp: rsvp || null,
          };
        })
      );
      return res.json({ events: enrichedEvents });
    }

    res.json({ events: eventsList });
  } catch (error: any) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Staff event list for door check-in (MUST be before /:id routes)
router.get('/staff/list', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify staff access
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !['admin', 'chw', 'icon'].includes(user.userType)) {
      return res.status(403).json({ error: 'Staff access required' });
    }

    // Get today's events and upcoming events within next 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const eventsList = await db
      .select({
        id: events.id,
        name: events.title,
        date: events.startsAt,
        venue: events.venue,
        capacity: events.maxCapacity,
        checkedInCount: events.checkinCount,
      })
      .from(events)
      .where(
        and(
          gte(events.startsAt, today),
          lte(events.startsAt, nextWeek)
        )
      )
      .orderBy(events.startsAt);

    res.json(eventsList);
  } catch (error: any) {
    console.error('Error fetching staff events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser?.id;
    const eventId = req.params.id;

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    let userRsvp = null;
    let userCheckin = null;

    if (userId) {
      const [rsvp] = await db
        .select()
        .from(eventRsvps)
        .where(
          and(
            eq(eventRsvps.eventId, eventId),
            eq(eventRsvps.userId, userId)
          )
        )
        .limit(1);
      userRsvp = rsvp;

      const [checkin] = await db
        .select()
        .from(eventCheckins)
        .where(
          and(
            eq(eventCheckins.eventId, eventId),
            eq(eventCheckins.userId, userId)
          )
        )
        .limit(1);
      userCheckin = checkin;
    }

    res.json({ 
      event, 
      userRsvp, 
      userCheckin,
      spotsRemaining: event.maxCapacity 
        ? Math.max(0, event.maxCapacity - (event.rsvpCount || 0))
        : null
    });
  } catch (error: any) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// RSVP to an event
router.post('/:id/rsvp', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const eventId = req.params.id;
    const { guestCount, guestNames } = req.body;

    // Get event
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if already RSVP'd
    const [existingRsvp] = await db
      .select()
      .from(eventRsvps)
      .where(
        and(
          eq(eventRsvps.eventId, eventId),
          eq(eventRsvps.userId, userId)
        )
      )
      .limit(1);

    if (existingRsvp) {
      return res.json({ 
        success: true, 
        message: "You're already on the list",
        rsvp: existingRsvp 
      });
    }

    // Check capacity
    if (event.maxCapacity && (event.rsvpCount || 0) >= event.maxCapacity) {
      // Add to waitlist
      const [rsvp] = await db
        .insert(eventRsvps)
        .values({
          eventId,
          userId,
          status: 'waitlist',
          guestCount: guestCount || 0,
          guestNames: guestNames || null,
        })
        .returning();

      return res.json({ 
        success: true, 
        message: "You're on the waitlist",
        rsvp,
        waitlist: true 
      });
    }

    // Check membership requirements
    if (event.requiresMembership) {
      const [membership] = await db
        .select()
        .from(membershipKeys)
        .where(eq(membershipKeys.userId, userId))
        .limit(1);

      if (!membership || !membership.isActive) {
        return res.status(403).json({ 
          error: 'Active membership required for this event',
          requiresMembership: true 
        });
      }

      // Check tier
      const tierOrder = ['member', 'vip', 'icon', 'founder'];
      const userTierIndex = tierOrder.indexOf(membership.tier);
      const requiredTierIndex = tierOrder.indexOf(event.minimumTier || 'member');

      if (userTierIndex < requiredTierIndex) {
        return res.status(403).json({ 
          error: `${event.minimumTier} tier or higher required`,
          requiresTier: event.minimumTier 
        });
      }

      // Check CRED
      if (event.minimumCred) {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if ((user?.credBalance || 0) < event.minimumCred) {
          return res.status(403).json({ 
            error: `${event.minimumCred} CRED required`,
            requiresCred: event.minimumCred,
            userCred: user?.credBalance || 0
          });
        }
      }
    }

    // Create RSVP
    const [rsvp] = await db
      .insert(eventRsvps)
      .values({
        eventId,
        userId,
        status: 'confirmed',
        guestCount: guestCount || 0,
        guestNames: guestNames || null,
      })
      .returning();

    // Update RSVP count
    await db
      .update(events)
      .set({ rsvpCount: (event.rsvpCount || 0) + 1 + (guestCount || 0) })
      .where(eq(events.id, eventId));

    res.json({ 
      success: true, 
      message: "You're on the list",
      rsvp 
    });
  } catch (error: any) {
    console.error('Error creating RSVP:', error);
    res.status(500).json({ error: 'Failed to RSVP' });
  }
});

// Cancel RSVP
router.delete('/:id/rsvp', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const eventId = req.params.id;

    const [rsvp] = await db
      .select()
      .from(eventRsvps)
      .where(
        and(
          eq(eventRsvps.eventId, eventId),
          eq(eventRsvps.userId, userId)
        )
      )
      .limit(1);

    if (!rsvp) {
      return res.status(404).json({ error: 'RSVP not found' });
    }

    await db
      .update(eventRsvps)
      .set({ status: 'cancelled' })
      .where(eq(eventRsvps.id, rsvp.id));

    // Update RSVP count
    await db
      .update(events)
      .set({ 
        rsvpCount: sql`GREATEST(0, ${events.rsvpCount} - 1 - ${rsvp.guestCount || 0})` 
      })
      .where(eq(events.id, eventId));

    res.json({ success: true, message: 'RSVP cancelled' });
  } catch (error: any) {
    console.error('Error cancelling RSVP:', error);
    res.status(500).json({ error: 'Failed to cancel RSVP' });
  }
});

// Check in to event (staff scanner)
router.post('/:id/checkin', async (req: Request, res: Response) => {
  try {
    const staffUserId = (req as any).authUser?.id;
    if (!staffUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify staff is admin or CHW or icon
    const [staffUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, staffUserId))
      .limit(1);

    if (!staffUser || !['admin', 'chw', 'icon'].includes(staffUser.userType)) {
      return res.status(403).json({ error: 'Staff access required' });
    }

    const eventId = req.params.id;
    let { userId, token, membershipKeyId, method, guestCount, notes, latitude, longitude } = req.body;

    // If token provided, decode it to get userId
    if (token && !userId) {
      const jwt = await import('jsonwebtoken');
      const JWT_SECRET = process.env.SESSION_SECRET || 'sainte-membership-secret';
      
      try {
        const decoded = jwt.default.verify(token, JWT_SECRET) as any;
        if (decoded.type === 'membership_access') {
          userId = decoded.userId;
          membershipKeyId = decoded.membershipId;
        }
      } catch (tokenError) {
        return res.status(400).json({ error: 'Invalid or expired QR code', valid: false });
      }
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID or valid token required' });
    }

    // Get event
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check for duplicate check-in
    const [existingCheckin] = await db
      .select()
      .from(eventCheckins)
      .where(
        and(
          eq(eventCheckins.eventId, eventId),
          eq(eventCheckins.userId, userId)
        )
      )
      .limit(1);

    if (existingCheckin) {
      return res.json({ 
        success: true, 
        message: 'Already checked in',
        checkin: existingCheckin,
        duplicate: true 
      });
    }

    // Award CRED for check-in
    const credReward = event.checkinCredReward || 50;
    
    await db.insert(credTransactions).values({
      userId,
      amount: credReward,
      reason: 'event_checkin',
      sourceType: 'event',
      sourceId: eventId,
      idempotencyKey: `event_checkin_${eventId}_${userId}`,
    });

    await db
      .update(users)
      .set({ 
        credBalance: sql`${users.credBalance} + ${credReward}`,
        lastCredEarnedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Create check-in record
    const [checkin] = await db
      .insert(eventCheckins)
      .values({
        eventId,
        userId,
        membershipKeyId: membershipKeyId || null,
        checkedInBy: staffUserId,
        method: method || 'qr_scan',
        latitude: latitude || null,
        longitude: longitude || null,
        credAwarded: credReward,
        guestCount: guestCount || 0,
        notes: notes || null,
      })
      .returning();

    // Update membership last used
    if (membershipKeyId) {
      await db
        .update(membershipKeys)
        .set({ 
          lastUsedAt: new Date(),
          totalCheckins: sql`${membershipKeys.totalCheckins} + 1`
        })
        .where(eq(membershipKeys.id, membershipKeyId));
    }

    // Update event check-in count
    await db
      .update(events)
      .set({ checkinCount: sql`${events.checkinCount} + 1 + ${guestCount || 0}` })
      .where(eq(events.id, eventId));

    // Get user info and membership for response
    const [checkedInUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Get membership details for the confirmation panel
    const [membershipInfo] = await db
      .select({
        tier: membershipKeys.tier,
        serialNumber: membershipKeys.serialNumber,
      })
      .from(membershipKeys)
      .where(eq(membershipKeys.userId, userId))
      .limit(1);

    res.json({ 
      success: true, 
      message: `Welcome, ${checkedInUser?.displayName || 'Member'}!`,
      checkin,
      credAwarded: credReward,
      member: {
        displayName: checkedInUser?.displayName,
        username: checkedInUser?.username,
        avatarUrl: checkedInUser?.avatarUrl,
        tier: membershipInfo?.tier || 'member',
        serialNumber: membershipInfo?.serialNumber || '',
      }
    });
  } catch (error: any) {
    console.error('Error checking in:', error);
    res.status(500).json({ error: 'Check-in failed' });
  }
});

// Get event attendees (staff only)
router.get('/:id/attendees', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify staff
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !['admin', 'chw'].includes(user.userType)) {
      return res.status(403).json({ error: 'Staff access required' });
    }

    const eventId = req.params.id;

    // Get all RSVPs with user info
    const rsvps = await db
      .select({
        rsvp: eventRsvps,
        user: {
          id: users.id,
          displayName: users.displayName,
          username: users.username,
          avatarUrl: users.avatarUrl,
        },
        membership: {
          tier: membershipKeys.tier,
          serialNumber: membershipKeys.serialNumber,
        },
        checkin: eventCheckins,
      })
      .from(eventRsvps)
      .leftJoin(users, eq(eventRsvps.userId, users.id))
      .leftJoin(membershipKeys, eq(eventRsvps.userId, membershipKeys.userId))
      .leftJoin(
        eventCheckins, 
        and(
          eq(eventCheckins.eventId, eventId),
          eq(eventCheckins.userId, eventRsvps.userId)
        )
      )
      .where(eq(eventRsvps.eventId, eventId))
      .orderBy(desc(eventRsvps.createdAt));

    // Get check-in stats
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    res.json({ 
      attendees: rsvps.map(r => ({
        ...r.rsvp,
        user: r.user,
        membership: r.membership,
        checkedIn: !!r.checkin,
        checkinTime: r.checkin?.checkedInAt,
      })),
      stats: {
        totalRsvp: event?.rsvpCount || 0,
        totalCheckedIn: event?.checkinCount || 0,
        capacity: event?.maxCapacity,
      }
    });
  } catch (error: any) {
    console.error('Error fetching attendees:', error);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

// Create event (admin only)
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify admin
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      title, description, venue, address, city, state,
      startsAt, endsAt, doorsOpenAt, maxCapacity,
      requiresMembership, minimumTier, minimumCred,
      coverImageUrl, checkinCredReward
    } = req.body;

    if (!title || !startsAt) {
      return res.status(400).json({ error: 'Title and start time required' });
    }

    const [event] = await db
      .insert(events)
      .values({
        title,
        description: description || null,
        venue: venue || null,
        address: address || null,
        city: city || null,
        state: state || null,
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : null,
        doorsOpenAt: doorsOpenAt ? new Date(doorsOpenAt) : null,
        maxCapacity: maxCapacity || null,
        requiresMembership: requiresMembership !== false,
        minimumTier: minimumTier || 'member',
        minimumCred: minimumCred || 0,
        coverImageUrl: coverImageUrl || null,
        status: 'upcoming',
        checkinCredReward: checkinCredReward || 50,
        createdBy: userId,
      })
      .returning();

    res.json({ success: true, event });
  } catch (error: any) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

export default router;
