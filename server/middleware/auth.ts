import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface AuthUser {
  id: string;
  email: string;
  authUserId: string;
  userType: string;
  username: string;
  displayName: string | null;
  xp: number;
  level: number;
  currentStreak: number;
  isVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      accessToken?: string;
    }
  }
}

export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Look up the user's engagement profile from the users table
    const userProfiles = await db.select().from(users).where(eq(users.authUserId, user.id));
    
    if (userProfiles.length === 0) {
      // User hasn't completed sync - this is OK for the /api/auth/sync endpoint
      // Allow the request to proceed with minimal auth info
      req.authUser = {
        id: '',
        email: user.email || '',
        authUserId: user.id,
        userType: user.user_metadata?.user_type || 'member',
        username: '',
        displayName: null,
        xp: 0,
        level: 1,
        currentStreak: 0,
        isVerified: false,
      };
      req.accessToken = token;
      return next();
    }

    const userProfile = userProfiles[0];
    
    req.authUser = {
      id: userProfile.id,
      email: userProfile.email || user.email || '',
      authUserId: user.id,
      userType: userProfile.userType || 'member',
      username: userProfile.username,
      displayName: userProfile.displayName,
      xp: userProfile.xp,
      level: userProfile.level,
      currentStreak: userProfile.currentStreak,
      isVerified: userProfile.isVerified || false,
    };
    req.accessToken = token;
    
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Token verification failed' });
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export function requireProfile(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser || !req.authUser.id) {
    return res.status(401).json({ error: 'Profile sync required. Please complete registration.' });
  }
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!allowedRoles.includes(req.authUser.userType)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!error && user) {
      // Look up user's engagement profile
      const userProfiles = await db.select().from(users).where(eq(users.authUserId, user.id));
      
      if (userProfiles.length > 0) {
        const userProfile = userProfiles[0];
        req.authUser = {
          id: userProfile.id,
          email: userProfile.email || user.email || '',
          authUserId: user.id,
          userType: userProfile.userType || 'member',
          username: userProfile.username,
          displayName: userProfile.displayName,
          xp: userProfile.xp,
          level: userProfile.level,
          currentStreak: userProfile.currentStreak,
          isVerified: userProfile.isVerified || false,
        };
      } else {
        req.authUser = {
          id: '',
          email: user.email || '',
          authUserId: user.id,
          userType: user.user_metadata?.user_type || 'member',
          username: '',
          displayName: null,
          xp: 0,
          level: 1,
          currentStreak: 0,
          isVerified: false,
        };
      }
      req.accessToken = token;
    }
  } catch (error) {
    console.error('Optional auth failed:', error);
  }
  
  next();
}

export { supabase };
