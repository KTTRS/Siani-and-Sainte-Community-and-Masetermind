import { Readable } from "stream";
import { getOpenAIClient } from "./integrations/openai";

const openai = getOpenAIClient();

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

export interface TTSRequest {
  text: string;
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  speed?: number;
  emotionalContext?: {
    mood: string;
    arousalLevel: number;
    shouldBeGentle: boolean;
  };
}

export interface TTSResult {
  audioBuffer: Buffer;
  contentType: string;
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string = "audio.webm",
  mimeType: string = "audio/webm"
): Promise<TranscriptionResult> {
  try {
    const file = new File([audioBuffer], filename, { type: mimeType });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      language: "en",
    });

    const wordCount = transcription.text.split(/\s+/).filter(Boolean).length;
    const duration = transcription.duration || (wordCount * 0.4);
    const wordsPerSecond = duration > 0 ? wordCount / duration : 2.5;
    
    let estimatedPace: "slow" | "normal" | "fast" = "normal";
    if (wordsPerSecond < 2) estimatedPace = "slow";
    else if (wordsPerSecond > 3.5) estimatedPace = "fast";

    const textLower = transcription.text.toLowerCase();
    
    let estimatedEnergy: "low" | "medium" | "high" = "medium";
    const excitedPatterns = /!|\?!|amazing|incredible|yes!|oh my|wow|can't believe|so excited/i;
    const lowEnergyPatterns = /tired|exhausted|don't know|whatever|i guess|hmm|ugh/i;
    
    if (excitedPatterns.test(textLower)) estimatedEnergy = "high";
    else if (lowEnergyPatterns.test(textLower)) estimatedEnergy = "low";

    let estimatedTone: "calm" | "neutral" | "tense" | "excited" = "neutral";
    const tensePatterns = /angry|frustrated|pissed|furious|stressed|worried|scared|anxious/i;
    const calmPatterns = /okay|alright|fine|good|peaceful|calm|relaxed/i;
    const excitedTonePatterns = /amazing|awesome|excited|happy|great|love|pumped/i;
    
    if (tensePatterns.test(textLower)) estimatedTone = "tense";
    else if (excitedTonePatterns.test(textLower)) estimatedTone = "excited";
    else if (calmPatterns.test(textLower)) estimatedTone = "calm";

    return {
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
      prosody: {
        estimatedPace,
        estimatedEnergy,
        estimatedTone,
      },
    };
  } catch (error) {
    console.error("Whisper transcription error:", error);
    throw new Error("Failed to transcribe audio");
  }
}

export async function synthesizeSpeech(request: TTSRequest): Promise<TTSResult> {
  try {
    let voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = request.voice || "nova";
    
    if (request.emotionalContext) {
      if (request.emotionalContext.shouldBeGentle || request.emotionalContext.arousalLevel < 30) {
        voice = "nova";
      } else if (request.emotionalContext.arousalLevel > 70) {
        voice = "onyx";
      }
    }

    let speed = request.speed || 1.0;
    if (request.emotionalContext) {
      if (request.emotionalContext.shouldBeGentle) {
        speed = 0.9;
      } else if (request.emotionalContext.arousalLevel > 70) {
        speed = 1.05;
      }
    }
    speed = Math.max(0.25, Math.min(4.0, speed));

    const response = await openai.audio.speech.create({
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
    console.error("TTS synthesis error:", error);
    throw new Error("Failed to synthesize speech");
  }
}

export function selectVoiceForContext(emotionalState?: { mood?: string; arousalLevel?: number }): "nova" | "onyx" | "shimmer" {
  if (!emotionalState) return "nova";
  
  if (emotionalState.arousalLevel && emotionalState.arousalLevel < 30) {
    return "nova";
  }
  
  if (emotionalState.mood === "excited" || emotionalState.mood === "encouraging") {
    return "shimmer";
  }
  
  if (emotionalState.mood === "grounded" || emotionalState.mood === "direct") {
    return "onyx";
  }
  
  return "nova";
}
