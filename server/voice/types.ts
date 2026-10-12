/**
 * Voice Provider Type Definitions
 */

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  prosody?: {
    estimatedPace: "slow" | "normal" | "fast";
    estimatedEnergy: "low" | "medium" | "high";
    estimatedTone: "calm" | "neutral" | "tense" | "excited";
  };
}

export interface SynthesisRequest {
  text: string;
  emotionalContext?: {
    mood: string;
    arousalLevel: number;
    shouldBeGentle: boolean;
  };
}

export interface SynthesisResult {
  audioBuffer: Buffer;
  contentType: string;
}

export interface ITranscriptionProvider {
  transcribe(audioBuffer: Buffer, filename: string, mimeType: string): Promise<TranscriptionResult>;
  isAvailable(): boolean;
  /**
   * Active liveness check — actually round-trips the upstream API to
   * verify the key works and the service is reachable, instead of just
   * reporting whether the env var is set. Used by /api/voice/health.
   */
  probe?(): Promise<{ ok: boolean; status?: number; error?: string }>;
}

export interface ISynthesisProvider {
  synthesize(request: SynthesisRequest): Promise<SynthesisResult>;
  isAvailable(): boolean;
}
