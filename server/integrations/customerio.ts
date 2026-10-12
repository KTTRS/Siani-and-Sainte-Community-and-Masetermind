// Customer.io Integration for email and messaging campaigns
// Docs: https://customer.io/docs/api/

interface CustomerIOConfig {
  siteId: string;
  apiKey: string;
  trackApiKey?: string;
}

interface CustomerAttributes {
  email?: string;
  phone?: string;
  [key: string]: any;
}

interface EventData {
  name: string;
  data?: Record<string, any>;
}

class CustomerIO {
  private siteId: string | null = null;
  private apiKey: string | null = null;
  private trackApiKey: string | null = null;
  private baseUrl = 'https://track.customer.io/api/v1';
  private apiBaseUrl = 'https://api.customer.io/v1';

  constructor() {
    this.siteId = process.env.CUSTOMERIO_SITE_ID || null;
    this.apiKey = process.env.CUSTOMERIO_API_KEY || null;
    this.trackApiKey = process.env.CUSTOMERIO_TRACK_API_KEY || null;

    if (this.siteId && this.apiKey) {
      console.log('CustomerIO: Configured');
    } else {
      console.warn('CustomerIO: Not configured (set CUSTOMERIO_SITE_ID and CUSTOMERIO_API_KEY)');
    }
  }

  isConfigured(): boolean {
    return !!(this.siteId && this.apiKey);
  }

  private getTrackAuth(): string {
    return Buffer.from(`${this.siteId}:${this.apiKey}`).toString('base64');
  }

  private getApiAuth(): string {
    return Buffer.from(`${this.trackApiKey || this.apiKey}:`).toString('base64');
  }

  async identify(userId: string, attributes: CustomerAttributes): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const response = await fetch(`${this.baseUrl}/customers/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${this.getTrackAuth()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(attributes)
      });

      return response.ok;
    } catch (error) {
      console.error('CustomerIO: Failed to identify user', error);
      return false;
    }
  }

  async track(userId: string, event: EventData): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const response = await fetch(`${this.baseUrl}/customers/${userId}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.getTrackAuth()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: event.name,
          data: event.data || {}
        })
      });

      return response.ok;
    } catch (error) {
      console.error('CustomerIO: Failed to track event', error);
      return false;
    }
  }

  async deleteUser(userId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const response = await fetch(`${this.baseUrl}/customers/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${this.getTrackAuth()}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('CustomerIO: Failed to delete user', error);
      return false;
    }
  }

  async sendTransactionalEmail(
    transactionalMessageId: string,
    to: string,
    identifiers: { id?: string; email?: string },
    messageData?: Record<string, any>
  ): Promise<string | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(`${this.apiBaseUrl}/send/email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.trackApiKey || this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transactional_message_id: transactionalMessageId,
          to,
          identifiers,
          message_data: messageData || {}
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.delivery_id;
      }
      return null;
    } catch (error) {
      console.error('CustomerIO: Failed to send transactional email', error);
      return null;
    }
  }

  async addToSegment(userId: string, segmentId: number): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const response = await fetch(`${this.baseUrl}/segments/${segmentId}/add_customers`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.getTrackAuth()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: [userId]
        })
      });

      return response.ok;
    } catch (error) {
      console.error('CustomerIO: Failed to add user to segment', error);
      return false;
    }
  }

  async removeFromSegment(userId: string, segmentId: number): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const response = await fetch(`${this.baseUrl}/segments/${segmentId}/remove_customers`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.getTrackAuth()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: [userId]
        })
      });

      return response.ok;
    } catch (error) {
      console.error('CustomerIO: Failed to remove user from segment', error);
      return false;
    }
  }
}

export const customerIO = new CustomerIO();
export default customerIO;
