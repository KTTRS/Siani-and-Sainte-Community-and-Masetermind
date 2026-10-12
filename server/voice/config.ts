/**
 * Voice Configuration Module
 * Manages provider settings for STT (Speech-to-Text) and TTS (Text-to-Speech)
 */

export type TTSProvider = "elevenlabs" | "openai";
export type STTProvider = "whisper" | "elevenlabs";

export interface VoiceConfig {
  stt: {
    provider: STTProvider;
    enabled: boolean;
  };
  tts: {
    provider: TTSProvider;
    enabled: boolean;
    voice: string;
    model: string;
    optimizeLatency: boolean;
  };
}

export function getVoiceConfig(): VoiceConfig {
  const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY;
  const hasOpenAIKey = !!(process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY);

  return {
    stt: {
      provider: "whisper",
      enabled: hasOpenAIKey,
    },
    tts: {
      provider: hasElevenLabsKey ? "elevenlabs" : "openai",
      enabled: hasElevenLabsKey || hasOpenAIKey,
      voice: process.env.ELEVENLABS_VOICE_ID || "PT4nqlKZfc06VW1BuClj", // Angela - raw, relatable, real
      model: "eleven_flash_v2_5",
      optimizeLatency: true,
    },
  };
}

export function validateVoiceConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!process.env.OPENAI_API_KEY && !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    errors.push("OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY is required for speech-to-text (Whisper)");
  }
  
  if (!process.env.ELEVENLABS_API_KEY && !process.env.OPENAI_API_KEY && !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    errors.push("Either ELEVENLABS_API_KEY or OPENAI_API_KEY is required for text-to-speech");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
