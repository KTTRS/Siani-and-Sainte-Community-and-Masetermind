/**
 * Voice Service Orchestrator
 * Manages the voice pipeline: STT → Siani → TTS
 */

import { WhisperTranscriptionProvider } from "./whisperProvider";
import { ElevenLabsSynthesisProvider } from "./elevenlabsProvider";
import { OpenAITTSProvider } from "./openaiTTSProvider";
import { getVoiceConfig, validateVoiceConfig } from "./config";
import type { 
  ITranscriptionProvider, 
  ISynthesisProvider, 
  TranscriptionResult, 
  SynthesisResult,
  SynthesisRequest 
} from "./types";
import { generateSianiResponse } from "../siani";
import { isOpenAIConfigured } from "../integrations/openai";
import type { ProsodyAnalysis } from "../engines/types";

// Unicode emoji + pictograph ranges — TTS happily reads these as "smiling
// face emoji" so we have to nuke them before synthesis. Uses alternation
// of surrogate-pair ranges + BMP ranges so we don't depend on ES2018
// regex unicode-property escapes (`/u` + `\u{...}`).
const EMOJI_RE = new RegExp(
  [
    "\\uD83C[\\uDF00-\\uDFFF]",     // misc symbols & pictographs (U+1F300–1F3FF)
    "\\uD83D[\\uDC00-\\uDFFF]",     // emoticons / transport / symbols (U+1F400–1F7FF)
    "\\uD83E[\\uDD00-\\uDFFF]",     // supplemental symbols (U+1F900–1FAFF)
    "[\\u2600-\\u27BF]",            // misc symbols + dingbats
    "[\\u2300-\\u23FF]",            // misc technical
    "[\\u2B00-\\u2BFF]",            // arrows
    "\\uFE0F",                       // VS-16 emoji presentation
    "\\u200D",                       // ZWJ
  ].join("|"),
  "g"
);

/**
 * Sanitize text for speech synthesis. Voice mode is its own register —
 * Siani should sound like a friend on the phone, not a chat log being
 * read aloud. We strip:
 *   • markdown / formatting (bold, italics, headers, lists, code, links)
 *   • emoji + pictographs (TTS reads these literally)
 *   • "Resource:" / "Source:" / "Note:" header lines
 *   • parentheticals (asides aren't said out loud)
 *   • crutch filler like "I'm here for you" / "I hear you" stacked at the end
 *   • bare URLs (TTS reads them character-by-character)
 */
function sanitizeForSpeech(text: string): string {
  let t = text
    // markdown emphasis
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    // markdown links → keep label, drop href
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // headers
    .replace(/^#{1,6}\s+/gm, "")
    // bullet / numbered lists
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // code blocks + inline code
    .replace(/```[^`]*```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    // emoji shortcodes (:smile:)
    .replace(/:[a-z_]+:/gi, "")
    // unicode emoji
    .replace(EMOJI_RE, "")
    // resource/source/note header lines (Siani sometimes prefixes refs)
    .replace(/^\s*(resource|source|note|ref|reference|link)s?\s*[:\-—]\s*.*$/gim, "")
    // parentheticals (asides aren't spoken)
    .replace(/\s*\([^)]{0,80}\)/g, "")
    .replace(/\s*\[[^\]]{0,80}\]/g, "")
    // bare URLs
    .replace(/https?:\/\/\S+/gi, "")
    // filler crutches at sentence boundaries
    .replace(/\b(i['']?m here for you|i hear you|i('| a)m listening)\b[\.,!?]*\s*/gi, "")
    // collapse whitespace
    .replace(/\n{2,}/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return t;
}

export interface VoiceChatRequest {
  audioBuffer: Buffer;
  filename: string;
  mimeType: string;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
}

export interface VoiceChatResult {
  transcript: string;
  sianiResponse: string;
  audioBuffer?: Buffer;
  audioContentType?: string;
  emotionalState?: {
    overallSentiment: number;
    arousalLevel: number;
    dominantEmotion?: string;
  };
  error?: string;
}

class VoiceService {
  private sttProvider: ITranscriptionProvider;
  private primaryTtsProvider: ISynthesisProvider;
  private secondaryTtsProvider: ISynthesisProvider;

  constructor() {
    // Initialize providers
    // ElevenLabs as primary TTS (better quality voice)
    // OpenAI TTS as fallback
    // OpenAI Whisper for STT (transcription)
    this.sttProvider = new WhisperTranscriptionProvider();
    this.primaryTtsProvider = new ElevenLabsSynthesisProvider();
    this.secondaryTtsProvider = new OpenAITTSProvider();
    
    console.log(`Voice TTS: ${this.primaryTtsProvider.isAvailable() ? 'ElevenLabs' : 'OpenAI'} (primary)`);
  }

  /**
   * Real, honest health probe — we actually call ElevenLabs (cheap GET on
   * the configured voice) and report which provider would actually serve
   * a TTS request right now, not just "is the env var set".
   */
  async checkHealth(): Promise<{
    ok: boolean;
    primaryProvider: string;
    fallbackProvider: string;
    voiceId?: string;
    stt: { available: boolean; reachable: boolean; provider: string; status?: number; error?: string };
    tts: {
      available: boolean;
      primary: string;
      effective: string;
      voiceId?: string;
      model?: string;
      elevenlabs: { configured: boolean; reachable: boolean; status?: number; error?: string };
      openai: { configured: boolean };
    };
    errors: string[];
  }> {
    const config = getVoiceConfig();
    const validation = validateVoiceConfig();
    const eleven = this.primaryTtsProvider as ElevenLabsSynthesisProvider;

    const elevenConfigured = !!process.env.ELEVENLABS_API_KEY;
    const openaiConfigured = isOpenAIConfigured();

    let elevenStatus: { reachable: boolean; status?: number; error?: string } = {
      reachable: false,
    };
    if (elevenConfigured && eleven.isAvailable()) {
      const probe = await eleven.probeVoice();
      elevenStatus = {
        reachable: probe.ok,
        status: probe.status,
        error: probe.error,
      };
    } else if (elevenConfigured) {
      elevenStatus = {
        reachable: false,
        error: eleven.getLastError() || "provider disabled this session",
      };
    }

    const elevenUsable = elevenConfigured && eleven.isAvailable() && elevenStatus.reachable;
    const ttsAvailable = elevenUsable || openaiConfigured;
    const effective = elevenUsable ? "elevenlabs" : openaiConfigured ? "openai" : "none";

    // Active STT probe (round-trips OpenAI), not just env-var presence.
    const sttConfigured = this.sttProvider.isAvailable();
    let sttProbe: { ok: boolean; status?: number; error?: string } = {
      ok: false,
      error: sttConfigured ? undefined : "missing OPENAI_API_KEY",
    };
    if (sttConfigured && this.sttProvider.probe) {
      sttProbe = await this.sttProvider.probe();
    } else if (sttConfigured) {
      sttProbe = { ok: true };
    }
    const sttUsable = sttConfigured && sttProbe.ok;

    const errors = [...validation.errors];
    if (sttConfigured && !sttProbe.ok && sttProbe.error) {
      errors.push(`STT probe failed: ${sttProbe.error}`);
    }
    if (elevenConfigured && !elevenUsable && elevenStatus.error) {
      errors.push(`ElevenLabs probe failed: ${elevenStatus.error}`);
    }

    return {
      ok: sttUsable && ttsAvailable,
      primaryProvider: elevenUsable ? "elevenlabs" : effective,
      fallbackProvider: openaiConfigured ? "openai" : "none",
      voiceId: eleven.getVoiceId(),
      stt: {
        available: sttUsable,
        reachable: sttProbe.ok,
        provider: config.stt.provider,
        status: sttProbe.status,
        error: sttProbe.error,
      },
      tts: {
        available: ttsAvailable,
        primary: config.tts.provider,
        effective,
        voiceId: eleven.getVoiceId(),
        model: eleven.getModel(),
        elevenlabs: { configured: elevenConfigured, ...elevenStatus },
        openai: { configured: openaiConfigured },
      },
      errors,
    };
  }

  /**
   * Open a streaming TTS response — primary provider first, OpenAI as
   * fallback if ElevenLabs is unavailable or returns a fatal error. The
   * returned object exposes either a Web ReadableStream (ElevenLabs, true
   * pipe-through) or a buffered Node Buffer (OpenAI, no native stream API).
   */
  async openSynthesisStream(
    request: SynthesisRequest
  ): Promise<
    | { provider: "elevenlabs"; stream: ReadableStream<Uint8Array>; contentType: string }
    | { provider: "openai"; audioBuffer: Buffer; contentType: string }
    | null
  > {
    const eleven = this.primaryTtsProvider as ElevenLabsSynthesisProvider;
    if (eleven.isAvailable()) {
      try {
        const r = await eleven.openStream(request);
        if (r.body) {
          return { provider: "elevenlabs", stream: r.body, contentType: "audio/mpeg" };
        }
      } catch (err) {
        console.error("ElevenLabs stream open failed, falling back to OpenAI:", err);
      }
    }
    if (this.secondaryTtsProvider.isAvailable()) {
      try {
        // OpenAI TTS reads SSML tags literally — strip the prosody wrapper
        // and break markers the caller speculatively inserted for
        // ElevenLabs before we hand the text off.
        const stripped: SynthesisRequest = {
          ...request,
          text: this.addSpeechProsody(request.text, "openai"),
        };
        const result = await this.secondaryTtsProvider.synthesize(stripped);
        return {
          provider: "openai",
          audioBuffer: result.audioBuffer,
          contentType: result.contentType,
        };
      } catch (err) {
        console.error("OpenAI TTS fallback failed:", err);
      }
    }
    return null;
  }

  async processVoiceChat(request: VoiceChatRequest): Promise<VoiceChatResult> {
    let transcript = "";
    let prosody: ProsodyAnalysis | undefined;

    // Step 1: Transcribe audio using Whisper
    try {
      if (!this.sttProvider.isAvailable()) {
        return {
          transcript: "",
          sianiResponse: "",
          error: "Speech-to-text not available. Please add OPENAI_API_KEY.",
        };
      }

      const transcription = await this.sttProvider.transcribe(
        request.audioBuffer,
        request.filename,
        request.mimeType
      );

      transcript = transcription.text;

      // Convert prosody to SIANI format
      if (transcription.prosody) {
        prosody = {
          pace: transcription.prosody.estimatedPace === "fast" ? "fast" :
                transcription.prosody.estimatedPace === "slow" ? "slow" : "normal",
          pitch: transcription.prosody.estimatedTone === "excited" ? "high" : 
                 transcription.prosody.estimatedTone === "calm" ? "low" : "normal",
          energy: transcription.prosody.estimatedEnergy === "high" ? "high" :
                  transcription.prosody.estimatedEnergy === "low" ? "low" : "normal",
          breathPattern: "normal",
          hesitationLevel: 30,
          emotionalLeakage: transcription.prosody.estimatedTone !== "neutral" 
            ? [transcription.prosody.estimatedTone] 
            : [],
          stressMarkers: transcription.prosody.estimatedTone === "tense" ? 60 : 20,
        };
      }

      if (!transcript.trim()) {
        return {
          transcript: "",
          sianiResponse: "I didn't catch that. Try again?",
          error: "No speech detected",
        };
      }
    } catch (error) {
      console.error("Transcription error:", error);
      return {
        transcript: "",
        sianiResponse: "",
        error: "Failed to transcribe audio. Please try again.",
      };
    }

    // Step 2: Generate SIANI response
    let sianiResult;
    try {
      sianiResult = await generateSianiResponse(
        transcript,
        request.conversationHistory || [],
        undefined,
        prosody
      );
    } catch (error) {
      console.error("SIANI response error:", error);
      return {
        transcript,
        sianiResponse: "Something went wrong on my end. What were you saying?",
        error: "Failed to generate response",
      };
    }

    // Step 3: Synthesize speech using ElevenLabs (or fallback)
    // IMPORTANT: Sanitize the response to remove any markdown/formatting before TTS
    const cleanedMessage = sanitizeForSpeech(sianiResult.message);
    
    let audioResult: SynthesisResult | undefined;
    const synthesisRequest: SynthesisRequest = {
      text: cleanedMessage,
      emotionalContext: sianiResult.emotionalState ? {
        mood: sianiResult.emotionalState.dominantEmotion || "neutral",
        arousalLevel: sianiResult.emotionalState.arousalLevel,
        shouldBeGentle: sianiResult.emotionalState.arousalLevel < 40 || 
                        sianiResult.attunementMode === "stabilize" ||
                        sianiResult.attunementMode === "contain",
      } : undefined,
    };

    // Try ElevenLabs first, fallback to OpenAI TTS on any failure
    if (this.primaryTtsProvider.isAvailable()) {
      try {
        audioResult = await this.primaryTtsProvider.synthesize(synthesisRequest);
        console.log("Audio synthesized via ElevenLabs");
      } catch (primaryError) {
        console.error("ElevenLabs TTS failed, trying OpenAI fallback:", primaryError);
        // Fallback to OpenAI TTS
        if (this.secondaryTtsProvider.isAvailable()) {
          try {
            audioResult = await this.secondaryTtsProvider.synthesize(synthesisRequest);
            console.log("Audio synthesized via OpenAI TTS (fallback)");
          } catch (fallbackError) {
            console.error("OpenAI TTS fallback also failed:", fallbackError);
          }
        }
      }
    } else if (this.secondaryTtsProvider.isAvailable()) {
      try {
        audioResult = await this.secondaryTtsProvider.synthesize(synthesisRequest);
        console.log("Audio synthesized via OpenAI TTS");
      } catch (error) {
        console.error("OpenAI TTS failed:", error);
      }
    }

    return {
      transcript,
      sianiResponse: sianiResult.message, // Return original for display (UI hidden anyway)
      audioBuffer: audioResult?.audioBuffer,
      audioContentType: audioResult?.contentType,
      emotionalState: sianiResult.emotionalState,
    };
  }

  /**
   * Standalone STT — used by /api/voice/chat so the route can run the same
   * runSianiTurn pipeline as text chat (memory, smartMatcher, referrals,
   * signals, escalations, goal extraction) instead of duplicating logic.
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ transcript: string; prosody?: ProsodyAnalysis; error?: string }> {
    if (!this.sttProvider.isAvailable()) {
      return {
        transcript: "",
        error: "Speech-to-text not available. Please add OPENAI_API_KEY.",
      };
    }
    try {
      const transcription = await this.sttProvider.transcribe(
        audioBuffer,
        filename,
        mimeType
      );
      let prosody: ProsodyAnalysis | undefined;
      if (transcription.prosody) {
        prosody = {
          pace:
            transcription.prosody.estimatedPace === "fast"
              ? "fast"
              : transcription.prosody.estimatedPace === "slow"
              ? "slow"
              : "normal",
          pitch:
            transcription.prosody.estimatedTone === "excited"
              ? "high"
              : transcription.prosody.estimatedTone === "calm"
              ? "low"
              : "normal",
          energy:
            transcription.prosody.estimatedEnergy === "high"
              ? "high"
              : transcription.prosody.estimatedEnergy === "low"
              ? "low"
              : "normal",
          breathPattern: "normal",
          hesitationLevel: 30,
          emotionalLeakage:
            transcription.prosody.estimatedTone !== "neutral"
              ? [transcription.prosody.estimatedTone]
              : [],
          stressMarkers:
            transcription.prosody.estimatedTone === "tense" ? 60 : 20,
        };
      }
      return { transcript: transcription.text, prosody };
    } catch (error) {
      console.error("Transcription error:", error);
      return {
        transcript: "",
        error: "Failed to transcribe audio. Please try again.",
      };
    }
  }

  /**
   * Sanitize text for speech (removes markdown that TTS would read literally).
   * Exposed publicly so the voice route can use the same cleaner.
   */
  sanitizeForSpeech(text: string): string {
    return sanitizeForSpeech(text);
  }

  /**
   * Add prosody hints for the active TTS provider. ElevenLabs
   * `eleven_flash_v2_5` honors a `<prosody rate="…" pitch="…">…</prosody>`
   * wrapper plus inline `<break time="…ms"/>` markers, which together give
   * Siani the slow cinematic pacing the brand calls for without a dedicated
   * voice-tuning pass.
   *
   * Rate/pitch are mapped from the active attunement mode so the wrapper
   * is meaningful, not decorative:
   *   - contain   → slowest, low pitch  (T2/T3, saturation, crisis)
   *   - stabilize → slow,    medium-low (grounding, shame buffer)
   *   - mirror    → medium,  medium     (default conversational)
   *   - activate  → medium,  medium-high (agency moves, bag celebrations)
   *
   * For OpenAI TTS we MUST strip every SSML tag — `tts-1` reads tag soup
   * literally ("prosody rate medium pitch medium…"), which is worse than
   * no pacing at all. Callers pass `mode` so the helper knows which
   * provider's audio is about to be generated.
   */
  addSpeechProsody(
    text: string,
    mode: "elevenlabs" | "openai" | "strip" = "strip",
    attunementMode?:
      | "mirror"
      | "stabilize"
      | "activate"
      | "elevate"
      | "challenge"
      | "contain"
  ): string {
    if (!text) return text;
    if (mode === "strip" || mode === "openai") {
      // Pull any speculative SSML out — keep natural punctuation intact.
      return text
        .replace(/<\/?prosody[^>]*>/gi, "")
        .replace(/<break\s+time="[^"]+"\s*\/?>/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    }

    // Inline breath breaks first — keeps regex anchors simple. Don't touch
    // URLs / markdown; sanitizeForSpeech already ran before us.
    const withBreaks = text
      .replace(/([.!?])\s+(?=["'\w])/g, '$1 <break time="350ms"/> ')
      .replace(/([,;:])\s+(?=\w)/g, '$1 <break time="180ms"/> ')
      .replace(/\n{2,}/g, ' <break time="600ms"/> ')
      .trim();

    // Outer prosody wrapper — the attunement mode is the pacing knob.
    const { rate, pitch } = this.prosodyForMode(attunementMode);
    return `<prosody rate="${rate}" pitch="${pitch}">${withBreaks}</prosody>`;
  }

  private prosodyForMode(
    mode?:
      | "mirror"
      | "stabilize"
      | "activate"
      | "elevate"
      | "challenge"
      | "contain"
  ): {
    rate: "x-slow" | "slow" | "medium" | "fast";
    pitch: "x-low" | "low" | "medium" | "high";
  } {
    // Map every attunement mode the engines can emit to a deliberate
    // rate/pitch combination — the wrapper is meaningless without coverage
    // for elevate / challenge as well.
    switch (mode) {
      case "contain":
        return { rate: "slow", pitch: "low" };
      case "stabilize":
        return { rate: "slow", pitch: "medium" };
      case "activate":
        return { rate: "medium", pitch: "medium" };
      case "elevate":
        return { rate: "medium", pitch: "high" };
      case "challenge":
        return { rate: "medium", pitch: "medium" };
      case "mirror":
      default:
        return { rate: "medium", pitch: "medium" };
    }
  }

  // Standalone TTS for text chat responses
  async synthesizeResponse(
    text: string,
    emotionalContext?: SynthesisRequest["emotionalContext"]
  ): Promise<SynthesisResult | null> {
    const request: SynthesisRequest = { text, emotionalContext };

    try {
      if (this.primaryTtsProvider.isAvailable()) {
        return await this.primaryTtsProvider.synthesize(request);
      } else if (this.secondaryTtsProvider.isAvailable()) {
        return await this.secondaryTtsProvider.synthesize(request);
      }
    } catch (error) {
      console.error("TTS error:", error);
    }

    return null;
  }
}

// Singleton instance
export const voiceService = new VoiceService();
