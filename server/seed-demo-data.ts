import { db } from './db';
import { 
  users, 
  goals, 
  moves, 
  credTransactions 
} from '@shared/schema';
import { sql } from 'drizzle-orm';

const STOCK_IMAGES_BASE = '/attached_assets/stock_images';

const AVATAR_IMAGES = {
  marcus: `${STOCK_IMAGES_BASE}/professional_black_m_3e06c141.jpg`,
  tasha: `${STOCK_IMAGES_BASE}/confident_woman_entr_1d2be2a2.jpg`,
  dre: `${STOCK_IMAGES_BASE}/professional_black_m_9195792f.jpg`,
  maya: `${STOCK_IMAGES_BASE}/professional_headsho_29836af5.jpg`,
  keisha: `${STOCK_IMAGES_BASE}/professional_headsho_bc6dd9a5.jpg`,
  jay: `${STOCK_IMAGES_BASE}/professional_headsho_6a6ac3dc.jpg`,
  demoUser: `${STOCK_IMAGES_BASE}/professional_headsho_7bbe2959.jpg`,
  katy: `${STOCK_IMAGES_BASE}/confident_woman_entr_cd1e1ff1.jpg`,
  zero: `${STOCK_IMAGES_BASE}/silhouette_person_ba_5d235c3e.jpg`,
};

export async function seedDemoData() {
  console.log('Seeding demo data...');

  try {
    // ============================================
    // 1. DEMO MEMBER PROFILES
    // ============================================

    // Update existing demo-user
    await db.execute(sql`
      UPDATE users 
      SET avatar_url = ${AVATAR_IMAGES.demoUser},
          cred_balance = 150,
          level = 3,
          current_streak = 7,
          longest_streak = 12,
          display_name = 'Demo User',
          bio = 'Building a better life, one move at a time.',
          xp = 450
      WHERE username = 'demo-user'
    `);

    // Update existing katy
    await db.execute(sql`
      UPDATE users 
      SET avatar_url = ${AVATAR_IMAGES.katy},
          cred_balance = 85,
          level = 2,
          current_streak = 3,
          longest_streak = 8,
          display_name = 'Katy',
          bio = 'Mom of 2. Figuring it out.',
          xp = 220
      WHERE username = 'katy'
    `);

    // Create new members with upsert pattern
    const newMembers = [
      {
        username: 'marcus_313',
        displayName: 'Marcus',
        avatarUrl: AVATAR_IMAGES.marcus,
        bio: 'Detroit creative. Building something real.',
        credBalance: 420,
        level: 5,
        currentStreak: 14,
        longestStreak: 21,
        xp: 1250,
        userType: 'member',
        isVerified: true,
      },
      {
        username: 'tasha_hustle',
        displayName: 'Tasha',
        avatarUrl: AVATAR_IMAGES.tasha,
        bio: 'Single mom. Entrepreneur in the making.',
        credBalance: 280,
        level: 4,
        currentStreak: 9,
        longestStreak: 15,
        xp: 820,
        userType: 'member',
        isVerified: false,
      },
      {
        username: 'dre_recovery',
        displayName: 'Dre',
        avatarUrl: AVATAR_IMAGES.dre,
        bio: 'In recovery. One day at a time.',
        credBalance: 195,
        level: 3,
        currentStreak: 12,
        longestStreak: 12,
        xp: 580,
        userType: 'member',
        isVerified: false,
      },
      {
        username: 'maya_chw',
        displayName: 'Maya',
        avatarUrl: AVATAR_IMAGES.maya,
        bio: 'Community health worker. Here to help.',
        credBalance: 165,
        level: 3,
        currentStreak: 5,
        longestStreak: 18,
        xp: 490,
        userType: 'chw',
        isVerified: true,
      },
      {
        username: 'keisha_mom',
        displayName: 'Keisha',
        avatarUrl: AVATAR_IMAGES.keisha,
        bio: 'Caregiver for my mama. Just trying.',
        credBalance: 75,
        level: 2,
        currentStreak: 2,
        longestStreak: 6,
        xp: 180,
        userType: 'member',
        isVerified: false,
      },
      {
        username: 'jay_newstart',
        displayName: 'Jay',
        avatarUrl: AVATAR_IMAGES.jay,
        bio: 'New here. Ready to start fresh.',
        credBalance: 15,
        level: 1,
        currentStreak: 1,
        longestStreak: 1,
        xp: 25,
        userType: 'member',
        isVerified: false,
      },
      {
        username: 'zero_cred_member',
        displayName: 'New Member',
        avatarUrl: AVATAR_IMAGES.zero,
        bio: 'Just joined today.',
        credBalance: 0,
        level: 1,
        currentStreak: 0,
        longestStreak: 0,
        xp: 0,
        userType: 'member',
        isVerified: false,
      },
    ];

    for (const member of newMembers) {
      await db.insert(users).values(member).onConflictDoUpdate({
        target: users.username,
        set: {
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          bio: member.bio,
          credBalance: member.credBalance,
          level: member.level,
          currentStreak: member.currentStreak,
          longestStreak: member.longestStreak,
          xp: member.xp,
          userType: member.userType,
          isVerified: member.isVerified,
        },
      });
    }

    console.log('Created/updated demo member profiles');

    // Get user IDs for further seeding
    const allUsers = await db.select().from(users);
    const userMap = new Map(allUsers.map(u => [u.username, u.id]));

    const marcusId = userMap.get('marcus_313');
    const tashaId = userMap.get('tasha_hustle');
    const dreId = userMap.get('dre_recovery');
    const mayaId = userMap.get('maya_chw');
    const keishaId = userMap.get('keisha_mom');
    const jayId = userMap.get('jay_newstart');
    const demoUserId = userMap.get('demo-user');

    // ============================================
    // 2. VAULT CONFESSIONS
    // ============================================

    const confessions = [
      {
        userId: dreId || marcusId!,
        content: "I finally got approved for housing after 8 months of trying. I cried in the parking lot.",
        category: 'win',
        mood: 'hopeful',
        fireCount: 47,
        strengthCount: 89,
        heartCount: 23,
        realCount: 12,
        totalReactions: 171,
        isAnonymous: true,
        status: 'active',
        baseCredReward: 5,
      },
      {
        userId: tashaId || marcusId!,
        content: "Some days I don't know if I can keep doing this alone. But I keep going for my kids.",
        category: 'struggle',
        mood: 'heavy',
        fireCount: 34,
        strengthCount: 112,
        heartCount: 45,
        realCount: 67,
        totalReactions: 258,
        isAnonymous: true,
        status: 'active',
        baseCredReward: 5,
      },
      {
        userId: keishaId || marcusId!,
        content: "I paid my first month of rent without borrowing. First time in 3 years.",
        category: 'win',
        mood: 'relieved',
        fireCount: 56,
        strengthCount: 34,
        heartCount: 78,
        realCount: 23,
        totalReactions: 191,
        isAnonymous: true,
        status: 'active',
        baseCredReward: 5,
      },
      {
        userId: mayaId || marcusId!,
        content: "The anxiety is worse at night. Anyone else feel like they're pretending during the day?",
        category: 'truth',
        mood: 'uncertain',
        fireCount: 12,
        strengthCount: 67,
        heartCount: 89,
        realCount: 145,
        totalReactions: 313,
        isAnonymous: true,
        status: 'active',
        baseCredReward: 5,
      },
      {
        userId: jayId || marcusId!,
        content: "My caseworker actually listened today. Small thing but it meant everything.",
        category: 'truth',
        mood: 'grateful',
        fireCount: 23,
        strengthCount: 45,
        heartCount: 112,
        realCount: 34,
        totalReactions: 214,
        isAnonymous: true,
        status: 'active',
        baseCredReward: 5,
      },
      {
        userId: dreId || marcusId!,
        content: "I relapsed last week but I'm back here. Day 4.",
        category: 'confession',
        mood: 'raw',
        fireCount: 78,
        strengthCount: 234,
        heartCount: 156,
        realCount: 189,
        totalReactions: 657,
        isAnonymous: true,
        isSpotlighted: true,
        spotlightedAt: new Date(),
        spotlightBonus: 25,
        status: 'active',
        baseCredReward: 5,
      },
      {
        userId: marcusId || demoUserId!,
        content: "Got the job offer. $18/hr with benefits. I never thought I'd be here.",
        category: 'win',
        mood: 'hopeful',
        fireCount: 167,
        strengthCount: 89,
        heartCount: 134,
        realCount: 56,
        totalReactions: 446,
        isAnonymous: true,
        status: 'active',
        baseCredReward: 5,
      },
    ];

    // Use raw SQL for vault confessions to avoid Drizzle schema mismatch
    for (const confession of confessions) {
      if (confession.userId) {
        const spotlightedAtStr = confession.spotlightedAt ? confession.spotlightedAt.toISOString() : null;
        await db.execute(sql`
          INSERT INTO vault_confessions (
            user_id, content, category, mood, 
            fire_count, strength_count, heart_count, real_count, total_reactions,
            is_anonymous, is_spotlighted, spotlighted_at, spotlight_bonus, 
            status, base_cred_reward
          ) VALUES (
            ${confession.userId}, ${confession.content}, ${confession.category}, ${confession.mood},
            ${confession.fireCount}, ${confession.strengthCount}, ${confession.heartCount}, ${confession.realCount}, ${confession.totalReactions},
            ${confession.isAnonymous}, ${confession.isSpotlighted || false}, ${spotlightedAtStr}, ${confession.spotlightBonus || 0},
            ${confession.status}, ${confession.baseCredReward}
          ) ON CONFLICT DO NOTHING
        `);
      }
    }

    console.log('Created vault confessions');

    // ============================================
    // 3. GOALS AND MOVES
    // ============================================

    // Demo user goals
    if (demoUserId) {
      // Goal 1: Secure stable housing
      const [housingGoal] = await db.insert(goals).values({
        userId: demoUserId,
        title: 'Secure stable housing',
        description: 'Find and secure stable housing within 3 months',
        category: 'housing',
        isCompleted: false,
        xpReward: 100,
      }).onConflictDoNothing().returning();

      if (housingGoal) {
        await db.insert(moves).values([
          {
            userId: demoUserId,
            goalId: housingGoal.id,
            title: 'Complete housing application',
            isCompleted: true,
            completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            xpReward: 15,
          },
          {
            userId: demoUserId,
            goalId: housingGoal.id,
            title: 'Gather required documents',
            isCompleted: true,
            completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            xpReward: 15,
          },
          {
            userId: demoUserId,
            goalId: housingGoal.id,
            title: 'Schedule housing interview',
            isCompleted: false,
            xpReward: 15,
          },
        ]).onConflictDoNothing();
      }

      // Goal 2: Build emergency fund
      const [fundGoal] = await db.insert(goals).values({
        userId: demoUserId,
        title: 'Build emergency fund',
        description: 'Save $500 for emergencies',
        category: 'financial',
        isCompleted: false,
        xpReward: 75,
      }).onConflictDoNothing().returning();

      if (fundGoal) {
        await db.insert(moves).values([
          {
            userId: demoUserId,
            goalId: fundGoal.id,
            title: 'Open savings account',
            isCompleted: true,
            completedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            xpReward: 15,
          },
          {
            userId: demoUserId,
            goalId: fundGoal.id,
            title: 'Set up automatic transfer $25/week',
            isCompleted: false,
            xpReward: 15,
          },
          {
            userId: demoUserId,
            goalId: fundGoal.id,
            title: 'Track expenses for 2 weeks',
            isCompleted: false,
            xpReward: 15,
          },
        ]).onConflictDoNothing();
      }
    }

    // Marcus goals
    if (marcusId) {
      // Goal: Launch creative business
      const [businessGoal] = await db.insert(goals).values({
        userId: marcusId,
        title: 'Launch creative business',
        description: 'Start my graphic design freelance business',
        category: 'employment',
        isCompleted: true,
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        xpReward: 150,
      }).onConflictDoNothing().returning();

      if (businessGoal) {
        await db.insert(moves).values([
          {
            userId: marcusId,
            goalId: businessGoal.id,
            title: 'Create portfolio website',
            isCompleted: true,
            completedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
            xpReward: 20,
          },
          {
            userId: marcusId,
            goalId: businessGoal.id,
            title: 'Set up business LLC',
            isCompleted: true,
            completedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            xpReward: 20,
          },
          {
            userId: marcusId,
            goalId: businessGoal.id,
            title: 'Land first paying client',
            isCompleted: true,
            completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            xpReward: 25,
          },
          {
            userId: marcusId,
            goalId: businessGoal.id,
            title: 'Get business bank account',
            isCompleted: true,
            completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            xpReward: 15,
          },
        ]).onConflictDoNothing();
      }

      // Goal: Mental health routine
      const [mentalGoal] = await db.insert(goals).values({
        userId: marcusId,
        title: 'Mental health routine',
        description: 'Build a sustainable self-care routine',
        category: 'mental_health',
        isCompleted: false,
        xpReward: 100,
      }).onConflictDoNothing().returning();

      if (mentalGoal) {
        await db.insert(moves).values([
          {
            userId: marcusId,
            goalId: mentalGoal.id,
            title: 'Morning meditation - 10 mins daily',
            isCompleted: true,
            completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            xpReward: 15,
          },
          {
            userId: marcusId,
            goalId: mentalGoal.id,
            title: 'Join therapy session',
            isCompleted: true,
            completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            xpReward: 20,
          },
          {
            userId: marcusId,
            goalId: mentalGoal.id,
            title: 'Journal 3x per week',
            isCompleted: true,
            completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            xpReward: 15,
          },
          {
            userId: marcusId,
            goalId: mentalGoal.id,
            title: 'Set boundaries with toxic people',
            isCompleted: false,
            xpReward: 20,
          },
        ]).onConflictDoNothing();
      }
    }

    // Tasha goals
    if (tashaId) {
      // Goal: Childcare solution
      const [childcareGoal] = await db.insert(goals).values({
        userId: tashaId,
        title: 'Childcare solution',
        description: 'Find reliable and affordable childcare',
        category: 'childcare',
        isCompleted: false,
        xpReward: 100,
      }).onConflictDoNothing().returning();

      if (childcareGoal) {
        await db.insert(moves).values([
          {
            userId: tashaId,
            goalId: childcareGoal.id,
            title: 'Apply for childcare subsidy',
            isCompleted: true,
            completedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
            xpReward: 20,
          },
          {
            userId: tashaId,
            goalId: childcareGoal.id,
            title: 'Visit 3 daycares in the area',
            isCompleted: true,
            completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            xpReward: 15,
          },
          {
            userId: tashaId,
            goalId: childcareGoal.id,
            title: 'Complete enrollment paperwork',
            isCompleted: false,
            xpReward: 15,
          },
        ]).onConflictDoNothing();
      }
    }

    console.log('Created goals and moves');

    // ============================================
    // 4. CRED TRANSACTIONS
    // ============================================

    const now = new Date();
    const transactions = [];

    // Demo user transactions
    if (demoUserId) {
      transactions.push(
        { userId: demoUserId, amount: 10, reason: 'Daily check-in', sourceType: 'checkin', idempotencyKey: `demo-checkin-${now.toISOString().slice(0,10)}` },
        { userId: demoUserId, amount: 50, reason: 'Completed housing goal move', sourceType: 'action', idempotencyKey: `demo-move-housing-1` },
        { userId: demoUserId, amount: 25, reason: 'Helped a circle member', sourceType: 'circle', idempotencyKey: `demo-circle-1` },
        { userId: demoUserId, amount: 15, reason: 'Badge earned: Week Warrior', sourceType: 'badge', idempotencyKey: `demo-badge-1` },
        { userId: demoUserId, amount: 5, reason: 'Vault confession posted', sourceType: 'checkin', idempotencyKey: `demo-vault-1` },
      );
    }

    // Marcus transactions
    if (marcusId) {
      transactions.push(
        { userId: marcusId, amount: 50, reason: 'Goal completed: Launch creative business', sourceType: 'action', idempotencyKey: `marcus-goal-1` },
        { userId: marcusId, amount: 25, reason: 'Referral accepted', sourceType: 'referral', idempotencyKey: `marcus-ref-1` },
        { userId: marcusId, amount: 25, reason: 'Referral accepted', sourceType: 'referral', idempotencyKey: `marcus-ref-2` },
        { userId: marcusId, amount: 15, reason: 'Badge earned: 14-Day Heat', sourceType: 'badge', idempotencyKey: `marcus-badge-1` },
        { userId: marcusId, amount: 10, reason: 'Daily check-in', sourceType: 'checkin', idempotencyKey: `marcus-checkin-1` },
        { userId: marcusId, amount: 10, reason: 'Daily check-in', sourceType: 'checkin', idempotencyKey: `marcus-checkin-2` },
      );
    }

    // Tasha transactions
    if (tashaId) {
      transactions.push(
        { userId: tashaId, amount: 50, reason: 'Completed childcare move', sourceType: 'action', idempotencyKey: `tasha-move-1` },
        { userId: tashaId, amount: 25, reason: 'Helped a circle member', sourceType: 'circle', idempotencyKey: `tasha-circle-1` },
        { userId: tashaId, amount: 10, reason: 'Daily check-in', sourceType: 'checkin', idempotencyKey: `tasha-checkin-1` },
        { userId: tashaId, amount: 15, reason: 'Badge earned: First Bag', sourceType: 'badge', idempotencyKey: `tasha-badge-1` },
      );
    }

    // Dre transactions
    if (dreId) {
      transactions.push(
        { userId: dreId, amount: 25, reason: 'Vault confession spotlighted', sourceType: 'checkin', idempotencyKey: `dre-spotlight-1` },
        { userId: dreId, amount: 10, reason: 'Daily check-in', sourceType: 'checkin', idempotencyKey: `dre-checkin-1` },
        { userId: dreId, amount: 15, reason: 'Badge earned: 12-Day Streak', sourceType: 'badge', idempotencyKey: `dre-badge-1` },
      );
    }

    // Maya transactions
    if (mayaId) {
      transactions.push(
        { userId: mayaId, amount: 25, reason: 'Helped a circle member', sourceType: 'circle', idempotencyKey: `maya-circle-1` },
        { userId: mayaId, amount: 25, reason: 'Helped a circle member', sourceType: 'circle', idempotencyKey: `maya-circle-2` },
        { userId: mayaId, amount: 10, reason: 'Daily check-in', sourceType: 'checkin', idempotencyKey: `maya-checkin-1` },
      );
    }

    // Jay transactions
    if (jayId) {
      transactions.push(
        { userId: jayId, amount: 10, reason: 'First check-in', sourceType: 'checkin', idempotencyKey: `jay-checkin-1` },
        { userId: jayId, amount: 5, reason: 'Profile completed', sourceType: 'action', idempotencyKey: `jay-profile-1` },
      );
    }

    for (const tx of transactions) {
      await db.insert(credTransactions).values(tx).onConflictDoNothing();
    }

    console.log('Created CRED transactions');

    console.log('Demo data seeding complete!');
    return true;
  } catch (error: any) {
    console.error('Failed to seed demo data:', error.message);
    return false;
  }
}
