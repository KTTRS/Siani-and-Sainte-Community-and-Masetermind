import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { dataLake } from './dataLake';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  if (!supabaseUrl) console.warn('SUPABASE_URL not set. Realtime features will be disabled.');
  if (!supabaseKey) console.warn('No Supabase API key found. Realtime features will be disabled.');
}

export const supabase: SupabaseClient | null = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export interface EventPayload {
  type: string;
  userId?: string;
  data: Record<string, any>;
  timestamp: Date;
}

export class EventBus {
  private channel: RealtimeChannel | null = null;
  private channelName: string = 'sainte-events';
  private listeners: Map<string, ((payload: EventPayload) => void)[]> = new Map();
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  async connect(channelName: string = 'sainte-events') {
    if (!supabase) {
      console.warn('EventBus: Supabase not configured, running in offline mode');
      return;
    }

    if (this.isConnecting) return;
    this.isConnecting = true;
    this.channelName = channelName;

    try {
      this.channel = supabase.channel(channelName);
      
      this.channel.on('broadcast', { event: '*' }, (payload) => {
        const eventType = payload.event;
        const handlers = this.listeners.get(eventType) || [];
        handlers.forEach(handler => handler(payload.payload as EventPayload));
      });

      await this.channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`EventBus: Connected to channel ${channelName}`);
          this.reconnectAttempts = 0;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.handleDisconnect();
        }
      });
    } catch (error) {
      console.warn('EventBus: Connection failed', error);
      this.handleDisconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  private async handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`EventBus: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.channel = null;
        this.connect(this.channelName);
      }, delay);
    } else {
      console.warn('EventBus: Max reconnect attempts reached, running in degraded mode');
    }
  }

  async publish(event: string, payload: Omit<EventPayload, 'timestamp'>): Promise<void> {
    const fullPayload: EventPayload = {
      ...payload,
      timestamp: new Date()
    };

    // Fire LOCAL subscribers synchronously. Supabase's broadcast channel does
    // not echo a sender's own messages back to that sender by default, so
    // without this any in-process consumer (e.g. the realtime broadcaster
    // bridge, audit logger, care-team router) would never see events that
    // this same node published. Handlers are user code — isolate failures
    // so one bad listener can't take down the publish path.
    const handlers = this.listeners.get(event) || [];
    for (const handler of handlers) {
      try {
        handler(fullPayload);
      } catch (err) {
        console.warn(`EventBus: local handler for ${event} threw`, err);
      }
    }

    if (!this.channel) {
      return;
    }

    try {
      await this.channel.send({
        type: 'broadcast',
        event,
        payload: fullPayload
      });
    } catch (error) {
    }
  }

  subscribe(event: string, handler: (payload: EventPayload) => void) {
    const handlers = this.listeners.get(event) || [];
    handlers.push(handler);
    this.listeners.set(event, handlers);

    return () => {
      const currentHandlers = this.listeners.get(event) || [];
      this.listeners.set(event, currentHandlers.filter(h => h !== handler));
    };
  }

  async disconnect() {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
  }
}

export const eventBus = new EventBus();

export async function initializeServices() {
  await Promise.all([
    eventBus.connect('sainte-events'),
    dataLake.ensureBucket()
  ]);
}

export { dataLake };

export const EventTypes = {
  VOICE_SESSION_START: 'voice.session.start',
  VOICE_SESSION_END: 'voice.session.end',
  VOICE_TRANSCRIPTION: 'voice.transcription',
  SIANI_RESPONSE: 'siani.response',
  GOAL_CREATED: 'goal.created',
  GOAL_COMPLETED: 'goal.completed',
  BADGE_EARNED: 'badge.earned',
  CRISIS_SIGNAL: 'crisis.signal',
  USER_CHECKIN: 'user.checkin',
  DROP_RSVP: 'drop.rsvp',
  SPOTLIGHT_CREATED: 'spotlight.created',
  CHW_MESSAGE: 'chw.message',
  PROVIDER_ALERT: 'provider.alert',
  REFERRAL_UPDATE: 'referral.update',
  NEED_DETECTED: 'need.detected'
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];
