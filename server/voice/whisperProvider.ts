/**
 * OpenAI Whisper Transcription Provider
 * Handles speech-to-text using OpenAI's Whisper model
 */

import type { ITranscriptionProvider, TranscriptionResult } from "./types";
import { getOpenAIClient, isOpenAIConfigured } from "../integrations/openai";

export class WhisperTranscriptionProvider implements ITranscriptionProvider {
  private get openai() {
    return getOpenAIClient();
  }

  isAvailable(): boolean {
    return isOpenAIConfigured();
  }

  async probe(): Promise<{ ok: boolean; status?: number; error?: string }> {
    if (!this.isAvailable()) {
      return { ok: false, error: "missing OPENAI_API_KEY" };
    }
    try {
      await this.openai.models.list();
      return { ok: true };
    } catch (err) {
      const e = err as { status?: number; response?: { status?: number; statusText?: string }; message?: string };
      return {
        ok: false,
        status: e.status ?? e.response?.status,
        error: e.message || e.response?.statusText || "probe failed",
      };
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    filename: string = "audio.webm",
    mimeType: string = "audio/webm"
  ): Promise<TranscriptionResult> {
    if (!this.isAvailable()) {
      throw new Error("Whisper provider not available: missing OPENAI_API_KEY");
    }

    // Validate audio buffer
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error("Empty audio buffer received");
    }

    if (audioBuffer.length < 100) {
      throw new Error("Audio buffer too small - likely no audio captured");
    }

    console.log(`[Whisper] Transcribing: ${audioBuffer.length} bytes, type: ${mimeType}, filename: ${filename}`);

    // Normalize MIME type for Whisper (it's picky about formats)
    // Whisper supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
    let normalizedMimeType = mimeType.split(';')[0].trim(); // Remove codecs parameter
    let normalizedFilename = filename;
    
    // Map MIME types to correct filenames - Whisper is very picky
    if (normalizedMimeType.includes('mp4') || normalizedMimeType === 'audio/mp4') {
      normalizedMimeType = 'audio/mp4';
      normalizedFilename = 'audio.mp4';
    } else if (normalizedMimeType.includes('webm')) {
      normalizedMimeType = 'audio/webm';
      normalizedFilename = 'audio.webm';
    } else if (normalizedMimeType === 'audio/ogg') {
      console.warn('[Whisper] OGG format not directly supported, treating as webm');
      normalizedMimeType = 'audio/webm';
      normalizedFilename = 'audio.webm';
    } else if (normalizedMimeType.includes('m4a')) {
      normalizedMimeType = 'audio/m4a';
      normalizedFilename = 'audio.m4a';
    }

    console.log(`[Whisper] Normalized: ${normalizedFilename} (${normalizedMimeType})`);

    // Try transcription with retry on decode failure
    const attemptTranscription = async (fname: string, mime: string): Promise<TranscriptionResult> => {
      const file = new File([audioBuffer], fname, { type: mime });

      const transcription = await this.openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        response_format: "verbose_json",
        language: "en",
      });

      // Analyze prosody from transcription
      const prosody = this.analyzeProsody(transcription.text, transcription.duration);

      return {
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
        prosody,
      };
    };

    try {
      return await attemptTranscription(normalizedFilename, normalizedMimeType);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // If decode failed, retry with different format
      if (errorMessage.includes('could not be decoded') || errorMessage.includes('format is not supported')) {
        console.warn('[Whisper] Decode failed, retrying with m4a format...');
        
        try {
          // Try as m4a (iOS often produces m4a disguised as mp4)
          return await attemptTranscription('audio.m4a', 'audio/m4a');
        } catch (retryError) {
          console.error('[Whisper] Retry also failed:', retryError);
        }
      }
      
      console.error("Whisper transcription error:", error);
      throw new Error("Failed to transcribe audio");
    }
  }

  private analyzeProsody(
    text: string,
    duration?: number
  ): TranscriptionResult["prosody"] {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const actualDuration = duration || wordCount * 0.4;
    const wordsPerSecond = actualDuration > 0 ? wordCount / actualDuration : 2.5;

    // Estimate pace
    let estimatedPace: "slow" | "normal" | "fast" = "normal";
    if (wordsPerSecond < 2) estimatedPace = "slow";
    else if (wordsPerSecond > 3.5) estimatedPace = "fast";

    // Estimate energy from text patterns
    const textLower = text.toLowerCase();
    let estimatedEnergy: "low" | "medium" | "high" = "medium";
    const excitedPatterns = /!|\?!|amazing|incredible|yes!|oh my|wow|can't believe|so excited/i;
    const lowEnergyPatterns = /tired|exhausted|don't know|whatever|i guess|hmm|ugh/i;

    if (excitedPatterns.test(textLower)) estimatedEnergy = "high";
    else if (lowEnergyPatterns.test(textLower)) estimatedEnergy = "low";

    // Estimate tone
    let estimatedTone: "calm" | "neutral" | "tense" | "excited" = "neutral";
    const tensePatterns = /angry|frustrated|pissed|furious|stressed|worried|scared|anxious/i;
    const calmPatterns = /okay|alright|fine|good|peaceful|calm|relaxed/i;
    const excitedTonePatterns = /amazing|awesome|excited|happy|great|love|pumped/i;

    if (tensePatterns.test(textLower)) estimatedTone = "tense";
    else if (excitedTonePatterns.test(textLower)) estimatedTone = "excited";
    else if (calmPatterns.test(textLower)) estimatedTone = "calm";

    return {
      estimatedPace,
      estimatedEnergy,
      estimatedTone,
    };
  }
}
