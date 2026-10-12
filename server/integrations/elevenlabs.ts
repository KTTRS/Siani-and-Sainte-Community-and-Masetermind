// ElevenLabs Integration for premium text-to-speech
// Docs: https://elevenlabs.io/docs/api-reference

interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
}

interface VoiceSettings {
  stability: number;        // 0-1, higher = more consistent
  similarity_boost: number; // 0-1, higher = more similar to original voice
  style?: number;           // 0-1, style exaggeration (v2 models only)
  use_speaker_boost?: boolean;
}

interface GenerationOptions {
  model_id?: string;
  voice_settings?: VoiceSettings;
  output_format?: 'mp3_44100_128' | 'mp3_44100_192' | 'pcm_16000' | 'pcm_22050' | 'pcm_24000' | 'pcm_44100';
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.5,
  use_speaker_boost: true
};

class ElevenLabs {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  
  // SAINTE's default voice - warm, empathetic female voice for Siani
  private defaultVoiceId = 'EXAVITQu4vr4xnSDxMaL'; // "Sarah" - warm and conversational

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || null;

    if (this.apiKey) {
      console.log('ElevenLabs: Configured');
    } else {
      console.warn('ElevenLabs: Not configured (set ELEVENLABS_API_KEY)');
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': this.apiKey!
    };
  }

  async textToSpeech(
    text: string,
    voiceId?: string,
    options?: GenerationOptions
  ): Promise<ArrayBuffer | null> {
    if (!this.isConfigured()) {
      console.warn('ElevenLabs: Not configured, cannot generate speech');
      return null;
    }

    const voice = voiceId || this.defaultVoiceId;
    const model = options?.model_id || 'eleven_turbo_v2_5';
    const outputFormat = options?.output_format || 'mp3_44100_128';

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voice}?output_format=${outputFormat}`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            text,
            model_id: model,
            voice_settings: options?.voice_settings || DEFAULT_VOICE_SETTINGS
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('ElevenLabs: TTS failed', error);
        return null;
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('ElevenLabs: TTS request failed', error);
      return null;
    }
  }

  async textToSpeechStream(
    text: string,
    voiceId?: string,
    options?: GenerationOptions
  ): Promise<ReadableStream<Uint8Array> | null> {
    if (!this.isConfigured()) return null;

    const voice = voiceId || this.defaultVoiceId;
    const model = options?.model_id || 'eleven_turbo_v2_5';

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voice}/stream`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            text,
            model_id: model,
            voice_settings: options?.voice_settings || DEFAULT_VOICE_SETTINGS
          })
        }
      );

      if (!response.ok || !response.body) {
        return null;
      }

      return response.body;
    } catch (error) {
      console.error('ElevenLabs: Stream TTS failed', error);
      return null;
    }
  }

  async getVoices(): Promise<Voice[]> {
    if (!this.isConfigured()) return [];

    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'Accept': 'application/json',
          'xi-api-key': this.apiKey!
        }
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('ElevenLabs: Failed to get voices', error);
      return [];
    }
  }

  async getVoice(voiceId: string): Promise<Voice | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
        headers: {
          'Accept': 'application/json',
          'xi-api-key': this.apiKey!
        }
      });

      if (!response.ok) return null;

      return await response.json();
    } catch (error) {
      console.error('ElevenLabs: Failed to get voice', error);
      return null;
    }
  }

  async getSubscriptionInfo(): Promise<{ character_count: number; character_limit: number } | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(`${this.baseUrl}/user/subscription`, {
        headers: {
          'Accept': 'application/json',
          'xi-api-key': this.apiKey!
        }
      });

      if (!response.ok) return null;

      return await response.json();
    } catch (error) {
      console.error('ElevenLabs: Failed to get subscription info', error);
      return null;
    }
  }

  setDefaultVoice(voiceId: string) {
    this.defaultVoiceId = voiceId;
  }

  getDefaultVoiceId(): string {
    return this.defaultVoiceId;
  }
}

export const elevenLabs = new ElevenLabs();
export default elevenLabs;

// Voice presets for SAINTE
export const SainteVoices = {
  SIANI: 'EXAVITQu4vr4xnSDxMaL',      // Sarah - warm, empathetic (default for Siani)
  SIANI_ALT: 'pFZP5JQG7iQjIQuC4Bku',  // Lily - soft, nurturing alternative
  NARRATOR: 'onwK4e9ZLuTAKqWW03F9',   // Daniel - for announcements/narration
} as const;

// Emotion-aware voice settings
export const EmotionSettings: Record<string, VoiceSettings> = {
  calm: { stability: 0.7, similarity_boost: 0.75, style: 0.3 },
  empathetic: { stability: 0.5, similarity_boost: 0.8, style: 0.5 },
  encouraging: { stability: 0.4, similarity_boost: 0.75, style: 0.6 },
  serious: { stability: 0.8, similarity_boost: 0.7, style: 0.2 },
  warm: { stability: 0.5, similarity_boost: 0.85, style: 0.5 },
};
