// Twilio Integration - Uses Replit Connectors for authentication
import twilio from 'twilio';

interface TwilioCredentials {
  accountSid: string;
  apiKey: string;
  apiKeySecret: string;
  phoneNumber: string;
}

let cachedCredentials: TwilioCredentials | null = null;
let credentialsExpiry: number = 0;

async function getCredentials(): Promise<TwilioCredentials> {
  // Return cached credentials if still valid (cache for 5 minutes)
  if (cachedCredentials && Date.now() < credentialsExpiry) {
    return cachedCredentials;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Twilio: Replit connector environment not available');
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=twilio`,
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  const data = await response.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings?.settings?.account_sid || 
      !connectionSettings?.settings?.api_key || 
      !connectionSettings?.settings?.api_key_secret) {
    throw new Error('Twilio: Connection not configured');
  }

  cachedCredentials = {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number || ''
  };
  credentialsExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes

  return cachedCredentials;
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  return twilio(apiKey, apiKeySecret, { accountSid });
}

export async function getTwilioFromPhoneNumber(): Promise<string> {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

export async function sendSMS(to: string, body: string): Promise<string | null> {
  try {
    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    
    if (!fromNumber) {
      console.warn('Twilio: No phone number configured');
      return null;
    }

    const message = await client.messages.create({
      body,
      from: fromNumber,
      to
    });

    return message.sid;
  } catch (error) {
    console.error('Twilio: Failed to send SMS', error);
    return null;
  }
}

export async function sendWhatsApp(to: string, body: string): Promise<string | null> {
  try {
    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    
    if (!fromNumber) {
      console.warn('Twilio: No phone number configured');
      return null;
    }

    const message = await client.messages.create({
      body,
      from: `whatsapp:${fromNumber}`,
      to: `whatsapp:${to}`
    });

    return message.sid;
  } catch (error) {
    console.error('Twilio: Failed to send WhatsApp message', error);
    return null;
  }
}

export async function isTwilioConfigured(): Promise<boolean> {
  try {
    await getCredentials();
    return true;
  } catch {
    return false;
  }
}

// Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  if (!phone.startsWith('+')) {
    return `+${digits}`;
  }
  
  return phone;
}

// Send exclusive invite code via SMS
export async function sendInviteCodeSMS(
  phone: string, 
  code: string, 
  name?: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const greeting = name ? `${name}, ` : '';
  const message = `${greeting}You've been selected.

Your SAINTE access code: ${code}

This code expires in 48 hours. Use it to claim your membership.

Reply STOP to opt out.`;

  const formattedPhone = formatPhoneNumber(phone);
  const sid = await sendSMS(formattedPhone, message);
  
  if (sid) {
    return { success: true, sid };
  }
  return { success: false, error: 'Failed to send SMS' };
}

// Send event reminder via SMS
export async function sendEventReminderSMS(
  phone: string,
  eventTitle: string,
  eventTime: string,
  memberName?: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const greeting = memberName ? `${memberName}, ` : '';
  const message = `${greeting}Reminder: ${eventTitle} is tonight at ${eventTime}.

Have your SAINTE card ready for check-in.

See you there.`;

  const formattedPhone = formatPhoneNumber(phone);
  const sid = await sendSMS(formattedPhone, message);
  
  if (sid) {
    return { success: true, sid };
  }
  return { success: false, error: 'Failed to send SMS' };
}

// Send membership card activation SMS
export async function sendMembershipActivatedSMS(
  phone: string,
  serialNumber: string,
  memberName?: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const greeting = memberName ? `Welcome, ${memberName}.` : 'Welcome.';
  const message = `${greeting}

Your SAINTE membership is now active.
Card: ${serialNumber}

Open the app to view your exclusive access card.

This is your key to the circle.`;

  const formattedPhone = formatPhoneNumber(phone);
  const sid = await sendSMS(formattedPhone, message);
  
  if (sid) {
    return { success: true, sid };
  }
  return { success: false, error: 'Failed to send SMS' };
}
