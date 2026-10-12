// Twilio Segment Integration for analytics tracking
// Docs: https://segment.com/docs/connections/sources/catalog/libraries/server/node/

interface SegmentConfig {
  writeKey: string;
}

interface UserTraits {
  email?: string;
  phone?: string;
  name?: string;
  username?: string;
  [key: string]: any;
}

interface TrackProperties {
  [key: string]: any;
}

interface PageProperties {
  name?: string;
  category?: string;
  [key: string]: any;
}

class SegmentAnalytics {
  private writeKey: string | null = null;
  private baseUrl = 'https://api.segment.io/v1';

  constructor() {
    this.writeKey = process.env.SEGMENT_WRITE_KEY || null;

    if (this.writeKey) {
      console.log('Segment: Configured');
    } else {
      console.warn('Segment: Not configured (set SEGMENT_WRITE_KEY)');
    }
  }

  isConfigured(): boolean {
    return !!this.writeKey;
  }

  private getAuth(): string {
    return Buffer.from(`${this.writeKey}:`).toString('base64');
  }

  private async send(endpoint: string, payload: Record<string, any>): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.getAuth()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...payload,
          timestamp: new Date().toISOString(),
          context: {
            library: {
              name: 'sainte-server',
              version: '1.0.0'
            }
          }
        })
      });

      return response.ok;
    } catch (error) {
      console.error(`Segment: Failed to send ${endpoint}`, error);
      return false;
    }
  }

  async identify(userId: string, traits?: UserTraits, anonymousId?: string): Promise<boolean> {
    return this.send('identify', {
      userId,
      anonymousId,
      traits: traits || {}
    });
  }

  async track(userId: string, event: string, properties?: TrackProperties, anonymousId?: string): Promise<boolean> {
    return this.send('track', {
      userId,
      anonymousId,
      event,
      properties: properties || {}
    });
  }

  async page(userId: string, properties?: PageProperties, anonymousId?: string): Promise<boolean> {
    return this.send('page', {
      userId,
      anonymousId,
      name: properties?.name,
      category: properties?.category,
      properties: properties || {}
    });
  }

  async group(userId: string, groupId: string, traits?: Record<string, any>): Promise<boolean> {
    return this.send('group', {
      userId,
      groupId,
      traits: traits || {}
    });
  }

  async alias(previousId: string, userId: string): Promise<boolean> {
    return this.send('alias', {
      previousId,
      userId
    });
  }

  async screen(userId: string, name: string, properties?: Record<string, any>): Promise<boolean> {
    return this.send('screen', {
      userId,
      name,
      properties: properties || {}
    });
  }

  async batch(messages: Array<{
    type: 'identify' | 'track' | 'page' | 'group' | 'alias' | 'screen';
    userId?: string;
    anonymousId?: string;
    [key: string]: any;
  }>): Promise<boolean> {
    return this.send('batch', {
      batch: messages.map(msg => ({
        ...msg,
        timestamp: new Date().toISOString()
      }))
    });
  }
}

export const segment = new SegmentAnalytics();
export default segment;

// SAINTE-specific event tracking helpers
export const SainteEvents = {
  // Voice interactions
  VOICE_SESSION_START: 'Voice Session Started',
  VOICE_SESSION_END: 'Voice Session Ended',
  SIANI_RESPONSE: 'Siani Response Received',
  
  // Goals / Moves
  GOAL_CREATED: 'Goal Created',
  GOAL_COMPLETED: 'Goal Completed',
  GOAL_PROGRESS: 'Goal Progress Updated',
  
  // Engagement
  XP_EARNED: 'XP Earned',
  LEVEL_UP: 'Level Up',
  BADGE_EARNED: 'Badge Earned',
  STREAK_UPDATED: 'Streak Updated',
  
  // The Flow
  DROP_VIEWED: 'Drop Viewed',
  DROP_RSVP: 'Drop RSVP',
  SPOTLIGHT_VIEWED: 'Spotlight Viewed',
  ENERGY_REACTION: 'Energy Reaction Given',
  
  // Care
  CHW_MESSAGE_SENT: 'CHW Message Sent',
  CHW_MESSAGE_RECEIVED: 'CHW Message Received',
  
  // Onboarding
  SIGNUP_STARTED: 'Signup Started',
  SIGNUP_COMPLETED: 'Signup Completed',
  PROFILE_COMPLETED: 'Profile Completed',
  
  // App usage
  APP_OPENED: 'App Opened',
  APP_BACKGROUNDED: 'App Backgrounded',
  PWA_INSTALLED: 'PWA Installed'
} as const;

export type SainteEvent = typeof SainteEvents[keyof typeof SainteEvents];

export async function trackSainteEvent(
  userId: string, 
  event: SainteEvent, 
  properties?: TrackProperties
): Promise<boolean> {
  return segment.track(userId, event, {
    ...properties,
    app: 'sainte',
    platform: 'web'
  });
}
