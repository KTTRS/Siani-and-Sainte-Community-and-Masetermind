/**
 * OpenAI TTS Provider (Fallback)
 * Handles text-to-speech using OpenAI's TTS API
 */

import type { ISynthesisProvider, SynthesisRequest, SynthesisResult } from "./types";
import { getOpenAIClient, isOpenAIConfigured } from "../integrations/openai";

export class OpenAITTSProvider implements ISynthesisProvider {
  private get openai() {
    return getOpenAIClient();
  }

  isAvailable(): boolean {
    return isOpenAIConfigured();
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    if (!this.isAvailable()) {
      throw new Error("OpenAI TTS provider not available: missing OPENAI_API_KEY");
    }

    try {
      // Select voice based on emotional context
      let voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "nova";
      let speed = 1.0;

      if (request.emotionalContext) {
        if (request.emotionalContext.shouldBeGentle || request.emotionalContext.arousalLevel < 30) {
          voice = "nova"; // Warm and gentle
          speed = 0.9;
        } else if (request.emotionalContext.arousalLevel > 70) {
          voice = "onyx"; // More energetic
          speed = 1.05;
        }
      }

      speed = Math.max(0.25, Math.min(4.0, speed));

      const response = await this.openai.audio.speech.create({
        model: "tts-1",
        voice,
        input: request.text,
        speed,
        response_format: "mp3",
      });

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      return {
        audioBuffer,
        contentType: "audio/mpeg",
      };
    } catch (error) {
      console.error("OpenAI TTS error:", error);
      throw new Error("Failed to synthesize speech");
    }
  }
}
