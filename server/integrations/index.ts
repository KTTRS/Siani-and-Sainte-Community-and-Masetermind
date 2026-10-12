// SAINTE Integrations - Central export for all third-party services
// LLM: OpenAI (see ./openai). Voice: ElevenLabs (see ./elevenlabs).

// Twilio - SMS and Voice (via Replit Connector)
export { 
  getTwilioClient, 
  getTwilioFromPhoneNumber, 
  sendSMS, 
  sendWhatsApp,
  isTwilioConfigured 
} from './twilio';

// ElevenLabs - Premium Text-to-Speech
export { 
  elevenLabs, 
  SainteVoices, 
  EmotionSettings 
} from './elevenlabs';

// Customer.io - Email and messaging campaigns
export { customerIO } from './customerio';

// Segment - Analytics tracking
export { 
  segment, 
  SainteEvents, 
  trackSainteEvent,
  type SainteEvent 
} from './segment';

// Data Lake (Supabase Storage-backed)
export { dataLake, type DataLakeProvider } from '../dataLake';
