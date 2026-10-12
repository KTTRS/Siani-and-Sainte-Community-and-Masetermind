/**
 * ElevenLabs TTS Provider
 * Handles text-to-speech using ElevenLabs API with streaming
 *
 * Siani's voice: Young, casual, expressive - like texting your best friend
 * NOT polished, NOT professional, NOT robotic
 */

import type { ISynthesisProvider, SynthesisRequest, SynthesisResult } from "./types";
import { getVoiceConfig } from "./config";

// Global endpoint for better routing (routes to nearest region)
const API_BASE = "https://api.elevenlabs.io";

/**
 * Status codes that indicate the configured voice / model / key is broken in
 * a way that won't fix itself. Hitting any of these once flips the provider
 * permanently off for the session so we don't keep paying latency on every
 * request just to fall back to OpenAI.
 *   401 / 403 — bad / revoked API key
 *   404       — voice id doesn't exist (or isn't on this account)
 *   422       — invalid voice + model combo
 */
const FATAL_STATUSES = new Set([401, 403, 404, 422]);

export class ElevenLabsSynthesisProvider implements ISynthesisProvider {
  private apiKey: string;
  private voiceId: string;
  private model: string;
  private permanentlyDisabled: boolean = false;
  private lastError: string | null = null;

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || "";
    const cfg = getVoiceConfig();
    this.voiceId = cfg.tts.voice;
    this.model = cfg.tts.model;
    if (this.apiKey) {
      console.log(
        `[ElevenLabs] voice=${this.voiceId} model=${this.model}`
      );
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey && !this.permanentlyDisabled;
  }

  getVoiceId(): string {
    return this.voiceId;
  }

  getModel(): string {
    return this.model;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  isPermanentlyDisabled(): boolean {
    return this.permanentlyDisabled;
  }

  /**
   * Lightweight existence check on the configured voice. Used by
   * /api/voice/health so we surface a real "voice not found" instead of a
   * silent fallback. Marks provider permanently disabled on a fatal status.
   */
  async probeVoice(): Promise<{ ok: boolean; status?: number; error?: string }> {
    if (!this.apiKey) return { ok: false, error: "missing ELEVENLABS_API_KEY" };
    try {
      const r = await fetch(`${API_BASE}/v1/voices/${this.voiceId}`, {
        method: "GET",
        headers: { "xi-api-key": this.apiKey, Accept: "application/json" },
      });
      if (r.ok) return { ok: true, status: r.status };
      const body = await r.text().catch(() => "");
      const err = `${r.status} ${body.slice(0, 160)}`;
      this.lastError = err;
      if (FATAL_STATUSES.has(r.status)) {
        this.permanentlyDisabled = true;
        console.warn(
          `[ElevenLabs] probe failed (${r.status}) — provider disabled for session`
        );
      }
      return { ok: false, status: r.status, error: err };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.lastError = err;
      return { ok: false, error: err };
    }
  }

  /**
   * Open the streaming TTS endpoint. Returns the raw fetch Response so the
   * caller can pipe `response.body` straight to the HTTP client (no server
   * buffering). On a fatal status the provider is disabled for the session
   * and the caller is expected to fall back to OpenAI.
   */
  async openStream(request: SynthesisRequest): Promise<Response> {
    if (!this.isAvailable()) {
      throw new Error("ElevenLabs provider not available");
    }
    const response = await fetch(
      `${API_BASE}/v1/text-to-speech/${this.voiceId}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey,
        },
        body: JSON.stringify({
          text: request.text,
          model_id: this.model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: false,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      this.lastError = `${response.status} ${errorText.slice(0, 160)}`;
      console.error(
        `[ElevenLabs] stream error ${response.status}:`,
        errorText.slice(0, 200)
      );
      if (FATAL_STATUSES.has(response.status)) {
        this.permanentlyDisabled = true;
        console.warn(
          `[ElevenLabs] fatal status ${response.status} — provider disabled for session`
        );
      }
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    return response;
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const response = await this.openStream(request);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const audioBuffer = Buffer.alloc(totalLength);
    let offset = 0;
    for (const c of chunks) {
      audioBuffer.set(c, offset);
      offset += c.length;
    }
    return { audioBuffer, contentType: "audio/mpeg" };
  }
}
