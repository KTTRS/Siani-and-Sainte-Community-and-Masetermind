import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type VoiceState = 
  | "idle"           // Not recording
  | "listening"      // Recording user voice
  | "processing"     // Sending to API
  | "thinking"       // Waiting for Siani response
  | "speaking";      // Playing Siani's voice

export interface VoiceResponse {
  transcript: string;
  response: string;
  conversationId: string;
  attunementMode: string;
  safetyTier: string;
  audioUrl: string;
}

export interface UseVoiceCaptureOptions {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (text: string) => void;
  onResponse?: (response: VoiceResponse) => void;
  onError?: (error: string) => void;
  userId?: string;
  conversationId?: string;
}

export interface VoiceCapabilities {
  isSupported: boolean;
  hasMediaRecorder: boolean;
  supportedMimeTypes: string[];
  isIOS: boolean;
  isSafari: boolean;
  isMobile: boolean;
}

function detectCapabilities(): VoiceCapabilities {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (navigator.maxTouchPoints > 1);
  
  const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
  const supportedMimeTypes: string[] = [];
  
  if (hasMediaRecorder) {
    const typesToCheck = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];
    
    for (const type of typesToCheck) {
      try {
        if (MediaRecorder.isTypeSupported(type)) {
          supportedMimeTypes.push(type);
        }
      } catch {
        // Type not supported
      }
    }
  }
  
  const isSupported = hasMediaRecorder && 
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function';
  
  return {
    isSupported,
    hasMediaRecorder,
    supportedMimeTypes,
    isIOS,
    isSafari,
    isMobile
  };
}

function getBestMimeType(capabilities: VoiceCapabilities): string {
  if (capabilities.isIOS || (capabilities.isSafari && capabilities.isMobile)) {
    if (capabilities.supportedMimeTypes.includes('audio/mp4')) {
      return 'audio/mp4';
    }
    if (capabilities.supportedMimeTypes.includes('audio/mp4;codecs=mp4a.40.2')) {
      return 'audio/mp4;codecs=mp4a.40.2';
    }
  }
  
  const preferredTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus'
  ];
  
  for (const type of preferredTypes) {
    if (capabilities.supportedMimeTypes.includes(type)) {
      return type;
    }
  }
  
  return capabilities.supportedMimeTypes[0] || 'audio/webm';
}

export function useVoiceCapture(options: UseVoiceCaptureOptions = {}) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<string>("");
  const [currentResponse, setCurrentResponse] = useState<string>("");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [conversationId, setConversationId] = useState<string | null>(options.conversationId || null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [capabilities] = useState<VoiceCapabilities>(() => detectCapabilities());
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm');
  const isVisibleRef = useRef<boolean>(true);
  const audioContextResumedRef = useRef<boolean>(false);
  // In-flight TTS request — abort on barge-in (user taps orb mid-speech).
  const ttsAbortRef = useRef<AbortController | null>(null);
  // Monotonic turn id — bumped on every startListening + every barge-in.
  // sendVoiceToAPI captures its value on entry and bails out at every
  // await boundary if a newer turn has started, so a stale prior turn
  // can't race a fresh one into request generation or playback.
  const turnIdRef = useRef(0);
  // Mirror of `state` in a ref so callbacks (toggle, startListening guards)
  // can read the freshest value without depending on the captured closure
  // value. Without this, tapping the orb during thinking/processing/speaking
  // races against React's batched setState and the restart silently no-ops.
  const stateRef = useRef<VoiceState>("idle");
  // MediaSource lifecycle (true streaming playback, where supported)
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);

  const updateState = useCallback((newState: VoiceState) => {
    stateRef.current = newState;
    setState(newState);
    options.onStateChange?.(newState);
  }, [options.onStateChange]);

  const resumeAudioContext = useCallback(async () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
        audioContextResumedRef.current = true;
      } catch (err) {
        if (import.meta.env.DEV) console.error("Failed to resume AudioContext:", err);
      }
    }
  }, []);

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      } catch (err) {
        if (import.meta.env.DEV) console.error("Failed to create AudioContext:", err);
        return null;
      }
    }
    
    if (audioContextRef.current.state === 'suspended') {
      await resumeAudioContext();
    }
    
    return audioContextRef.current;
  }, [resumeAudioContext]);

  const checkPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
          
          result.onchange = () => {
            setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
          };
          
          return result.state !== 'denied';
        } catch {
          // Firefox doesn't support microphone permission query
        }
      }
      return true;
    } catch {
      return true;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: capabilities.isMobile ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 44100 },
          channelCount: { ideal: 1 }
        } : {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setPermissionStatus('granted');
      return stream;
    } catch (err) {
      const error = err as Error;
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionStatus('denied');
        const message = capabilities.isMobile 
          ? "Microphone access denied. Please enable it in your browser settings and reload the page."
          : "Microphone access denied. Please allow microphone permissions.";
        setError(message);
        options.onError?.(message);
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setError("No microphone found. Please connect a microphone.");
        options.onError?.("No microphone found");
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setError("Microphone is in use by another application.");
        options.onError?.("Microphone busy");
      } else if (error.name === 'OverconstrainedError') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setPermissionStatus('granted');
        return stream;
      } else {
        setError(`Microphone error: ${error.message}`);
        options.onError?.(error.message);
      }
      
      return null;
    }
  }, [capabilities.isMobile, options]);

  const startAudioLevelMonitoring = useCallback(async (stream: MediaStream) => {
    try {
      const context = await ensureAudioContext();
      if (!context) return;
      
      analyserRef.current = context.createAnalyser();
      const source = context.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (analyserRef.current && state === "listening" && isVisibleRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
          setAudioLevel(average / 255);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        }
      };

      updateLevel();
    } catch (err) {
      if (import.meta.env.DEV) console.error("Audio analysis error:", err);
    }
  }, [state, ensureAudioContext]);

  const stopAudioLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const cleanupRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Already stopped
      }
    }
    mediaRecorderRef.current = null;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    stopAudioLevelMonitoring();
    audioChunksRef.current = [];
  }, [stopAudioLevelMonitoring]);

  const startListening = useCallback(async () => {
    if (!capabilities.isSupported) {
      const message = "Voice recording is not supported in this browser.";
      setError(message);
      options.onError?.(message);
      return;
    }

    // Prevent starting new recording while processing or thinking. We read
    // from the ref here so a freshly-set "idle" by toggle() is visible
    // synchronously — otherwise barge-in racing against React's batching
    // would re-block the mic the user is trying to engage.
    const liveState = stateRef.current;
    if (liveState === "processing" || liveState === "thinking") {
      if (import.meta.env.DEV) console.log("[Voice] Cannot start - still processing previous recording");
      return;
    }

    if (isAudioPlaying || liveState === "speaking") {
      stopSpeaking();
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    try {
      setError(null);
      // Ensure clean state before starting
      audioChunksRef.current = [];
      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        } catch { /* ignore */ }
        mediaRecorderRef.current = null;
      }

      const canRequest = await checkPermission();
      if (!canRequest) {
        setError("Microphone permission is blocked. Please enable it in your browser settings.");
        options.onError?.("Permission blocked");
        return;
      }

      const stream = await requestPermission();
      if (!stream) {
        updateState("idle");
        return;
      }

      streamRef.current = stream;
      
      await ensureAudioContext();
      startAudioLevelMonitoring(stream);

      mimeTypeRef.current = getBestMimeType(capabilities);

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });
      } catch {
        try {
          mediaRecorder = new MediaRecorder(stream);
          mimeTypeRef.current = mediaRecorder.mimeType || 'audio/webm';
        } catch (e) {
          const msg = "Failed to start recording. Your browser may not support audio recording.";
          setError(msg);
          options.onError?.(msg);
          cleanupRecording();
          updateState("idle");
          return;
        }
      }
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        if (import.meta.env.DEV) console.error("MediaRecorder error:", event);
        setError("Recording error occurred");
        cleanupRecording();
        updateState("idle");
      };

      mediaRecorder.onstop = async () => {
        stopAudioLevelMonitoring();
        
        // Capture the current chunks before clearing
        const chunks = [...audioChunksRef.current];
        const mimeType = mimeTypeRef.current;
        
        // Clear refs immediately to prevent stale data on next recording
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        
        if (chunks.length === 0) {
          const msg = "No audio captured";
          setError(msg);
          options.onError?.(msg);
          updateState("idle");
          return;
        }

        const audioBlob = new Blob(chunks, { type: mimeType });
        
        // Validate blob has actual audio data
        if (audioBlob.size < 100) {
          const msg = "Hold a bit longer to record";
          setError(msg);
          options.onError?.(msg);
          updateState("idle");
          return;
        }

        if (import.meta.env.DEV) console.log(`[Voice] Sending audio: ${audioBlob.size} bytes, type: ${mimeType}`);
        await sendVoiceToAPI(audioBlob, mimeType);
      };

      // MP4 containers CANNOT use timeslices - fragmented MP4 corrupts when reassembled
      // WebM/OGG handle fragmentation fine, so use timeslices for those
      const isMp4 = mimeTypeRef.current.includes('mp4');
      if (isMp4) {
        // Record MP4 as single blob - no timeslice
        mediaRecorder.start();
        if (import.meta.env.DEV) console.log("[Voice] Recording MP4 without timeslice (single blob)");
      } else {
        // WebM/OGG can use timeslices for responsive capture
        mediaRecorder.start(100);
        if (import.meta.env.DEV) console.log("[Voice] Recording with 100ms timeslice");
      }
      updateState("listening");
    } catch (err) {
      if (import.meta.env.DEV) console.error("Microphone access error:", err);
      const message = err instanceof Error ? err.message : "Could not access microphone";
      setError(message);
      updateState("idle");
      options.onError?.(message);
    }
  }, [
    state,
    capabilities, 
    isAudioPlaying, 
    checkPermission, 
    requestPermission, 
    ensureAudioContext,
    startAudioLevelMonitoring, 
    stopAudioLevelMonitoring, 
    cleanupRecording,
    updateState, 
    options
  ]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      updateState("processing");
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    stopAudioLevelMonitoring();
  }, [stopAudioLevelMonitoring, updateState]);

  const sendVoiceToAPI = useCallback(async (audioBlob: Blob, mimeType: string) => {
    const myTurn = turnIdRef.current;
    const isStale = () => turnIdRef.current !== myTurn;
    // Abort any prior in-flight TTS + install our controller BEFORE any
    // await — closes the barge-in race where a tap during processing
    // would find no controller to cancel.
    if (ttsAbortRef.current) {
      try { ttsAbortRef.current.abort(); } catch {}
    }
    const ctrl = new AbortController();
    ttsAbortRef.current = ctrl;
    try {
      updateState("thinking");

      const url = new URL("/api/voice/chat", window.location.origin);
      url.searchParams.set("userId", options.userId || "demo-user");
      if (conversationId) {
        url.searchParams.set("conversationId", conversationId);
      }

      let authHeader: Record<string, string> = {};
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          authHeader = { "Authorization": `Bearer ${session.access_token}` };
        }
      } catch {}

      if (isStale()) { try { ctrl.abort(); } catch {} return; }

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": mimeType,
          ...authHeader,
        },
        body: audioBlob,
        signal: ctrl.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to process voice");
      }

      const transcript = decodeURIComponent(response.headers.get("X-Transcript") || "");
      const responseText = decodeURIComponent(response.headers.get("X-Response") || "");
      const newConversationId = response.headers.get("X-Conversation-Id") || "";
      const attunementMode = response.headers.get("X-Attunement-Mode") || "mirror";
      const safetyTier = response.headers.get("X-Safety-Tier") || "T0_stable";

      setCurrentTranscript(transcript);
      setCurrentResponse(responseText);
      if (newConversationId) {
        setConversationId(newConversationId);
      }

      options.onTranscript?.(transcript);

      // True streaming playback path: pipe response.body chunks straight
      // into a MediaSource so the <audio> element starts playing on the
      // first appended buffer (~hundreds of ms after request), instead of
      // waiting for the entire MP3 to download. Safari's MSE doesn't
      // support audio/mpeg, so we fall back to a buffered blob there.
      const ttsProvider = response.headers.get("X-TTS-Provider") || "";
      const ctType =
        response.headers.get("Content-Type") || (ttsProvider === "openai" ? "audio/mpeg" : "audio/mpeg");

      const MSE: typeof MediaSource | undefined =
        typeof window !== "undefined" && "MediaSource" in window
          ? window.MediaSource
          : undefined;
      const canMSE =
        !!MSE &&
        MSE.isTypeSupported?.("audio/mpeg") &&
        !capabilities.isIOS && !capabilities.isSafari;

      const reader = response.body?.getReader();
      const collectedChunks: Uint8Array[] = [];
      let firstByteSeen = false;

      const voiceResponse: VoiceResponse = {
        transcript,
        response: responseText,
        conversationId: newConversationId,
        attunementMode,
        safetyTier,
        audioUrl: "",
      };

      if (reader && canMSE) {
        // ---------- Streaming (MediaSource) ----------
        const mediaSource = new MediaSource();
        mediaSourceRef.current = mediaSource;
        const objectUrl = URL.createObjectURL(mediaSource);
        voiceResponse.audioUrl = objectUrl;

        const audio = new Audio();
        audio.src = objectUrl;
        audio.preload = "auto";
        audioElementRef.current = audio;

        // Mirror playAudio()'s onerror so an MSE decoder/network failure
        // never leaves the orb stuck in "speaking".
        audio.onerror = (e) => {
          if (import.meta.env.DEV) console.error("MSE audio error:", e);
          try { URL.revokeObjectURL(objectUrl); } catch {}
          setIsAudioPlaying(false);
          updateState("idle");
          audioElementRef.current = null;
          mediaSourceRef.current = null;
          sourceBufferRef.current = null;
        };

        const sbReady = new Promise<SourceBuffer>((resolveSb, rejectSb) => {
          mediaSource.addEventListener(
            "sourceopen",
            () => {
              try {
                const sb = mediaSource.addSourceBuffer("audio/mpeg");
                sourceBufferRef.current = sb;
                resolveSb(sb);
              } catch (e) {
                rejectSb(e);
              }
            },
            { once: true }
          );
        });

        const appendQueue: Uint8Array[] = [];
        let pumpDone = false;
        const pumpToBuffer = async (sb: SourceBuffer) => {
          while (appendQueue.length || !pumpDone) {
            if (sb.updating) {
              await new Promise<void>((r) =>
                sb.addEventListener("updateend", () => r(), { once: true })
              );
              continue;
            }
            const next = appendQueue.shift();
            if (next) {
              try { sb.appendBuffer(next); } catch (e) {
                if ((e as Error)?.name === "QuotaExceededError") {
                  await new Promise((r) => setTimeout(r, 30));
                  appendQueue.unshift(next);
                  continue;
                }
                throw e;
              }
            } else if (!pumpDone) {
              await new Promise((r) => setTimeout(r, 10));
            }
          }
          if (!sb.updating) {
            try { mediaSource.endOfStream(); } catch {}
          } else {
            sb.addEventListener("updateend", () => {
              try { mediaSource.endOfStream(); } catch {}
            }, { once: true });
          }
        };

        try {
          const sb = await sbReady;
          const consumer = pumpToBuffer(sb);
          options.onResponse?.(voiceResponse);
          // Start playback as soon as we have appended *anything*.
          let started = false;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              if (!firstByteSeen) {
                firstByteSeen = true;
                // Pre-audible cue: flip the orb to "speaking" ~200ms
                // before the first audible byte so the visual transition
                // never trails the sound.
                updateState("speaking");
              }
              appendQueue.push(value);
              if (!started) {
                started = true;
                await new Promise((r) => setTimeout(r, 200));
                audio.play().catch(() => {});
                setIsAudioPlaying(true);
                audio.onended = () => {
                  setIsAudioPlaying(false);
                  updateState("idle");
                  try { URL.revokeObjectURL(objectUrl); } catch {}
                  audioElementRef.current = null;
                  mediaSourceRef.current = null;
                  sourceBufferRef.current = null;
                };
              }
            }
          }
          pumpDone = true;
          await consumer;
        } catch (streamErr) {
          if ((streamErr as Error)?.name === "AbortError") {
            try { audio.pause(); } catch {}
            ttsAbortRef.current = null;
            updateState("idle");
            return;
          }
          if (import.meta.env.DEV) console.error("MSE pump error:", streamErr);
          // Stream broke mid-flight — drop back to idle and surface error.
          try { audio.pause(); } catch {}
          try { URL.revokeObjectURL(objectUrl); } catch {}
          setIsAudioPlaying(false);
          audioElementRef.current = null;
          mediaSourceRef.current = null;
          sourceBufferRef.current = null;
          const message =
            streamErr instanceof Error ? streamErr.message : "Voice stream failed";
          setError(message);
          options.onError?.(message);
          updateState("idle");
        }
        ttsAbortRef.current = null;
        return;
      }

      // ---------- Fallback (blob) for Safari / iOS ----------
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              if (!firstByteSeen) {
                firstByteSeen = true;
                updateState("speaking");
              }
              collectedChunks.push(value);
            }
          }
        } catch (streamErr) {
          if ((streamErr as Error)?.name === "AbortError") return;
          throw streamErr;
        }
      }
      ttsAbortRef.current = null;

      const totalLen = collectedChunks.reduce((acc, c) => acc + c.length, 0);
      if (totalLen === 0) {
        updateState("idle");
        return;
      }
      const audioBlob2 = new Blob(collectedChunks as BlobPart[], { type: ctType });
      const audioUrl = URL.createObjectURL(audioBlob2);
      voiceResponse.audioUrl = audioUrl;
      options.onResponse?.(voiceResponse);
      await playAudio(audioUrl);
    } catch (err) {
      // Aborted = intentional barge-in — silently return to idle.
      if ((err as Error)?.name === "AbortError") {
        ttsAbortRef.current = null;
        updateState("idle");
        return;
      }
      if (import.meta.env.DEV) console.error("Voice API error:", err);
      const message = err instanceof Error ? err.message : "Failed to process voice";
      setError(message);
      options.onError?.(message);
      updateState("idle");
    }
  }, [conversationId, options, updateState]);

  const playAudio = useCallback(async (audioUrl: string) => {
    return new Promise<void>(async (resolve) => {
      updateState("speaking");
      setIsAudioPlaying(true);
      
      await ensureAudioContext();
      
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;

      if (capabilities.isIOS || capabilities.isSafari) {
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');
      }

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsAudioPlaying(false);
        updateState("idle");
        audioElementRef.current = null;
        resolve();
      };

      audio.onerror = (e) => {
        if (import.meta.env.DEV) console.error("Audio error:", e);
        URL.revokeObjectURL(audioUrl);
        setError("Failed to play audio");
        setIsAudioPlaying(false);
        updateState("idle");
        audioElementRef.current = null;
        resolve();
      };

      audio.onpause = () => {
        if (audio.currentTime < audio.duration) {
          setIsAudioPlaying(false);
        }
      };

      audio.onplay = () => {
        setIsAudioPlaying(true);
      };

      try {
        await audio.play();
      } catch (err) {
        if (import.meta.env.DEV) console.error("Audio playback error:", err);
        
        if (capabilities.isIOS || capabilities.isMobile) {
          setError("Tap to play audio response");
          
          const playOnInteraction = async () => {
            try {
              await audio.play();
              document.removeEventListener('touchstart', playOnInteraction);
              document.removeEventListener('click', playOnInteraction);
            } catch {
              // Still can't play
            }
          };
          
          document.addEventListener('touchstart', playOnInteraction, { once: true });
          document.addEventListener('click', playOnInteraction, { once: true });
        } else {
          setError("Failed to play audio");
          setIsAudioPlaying(false);
          updateState("idle");
          resolve();
        }
      }
    });
  }, [updateState, ensureAudioContext, capabilities]);

  const stopSpeaking = useCallback(() => {
    // Cancel any in-flight TTS download too, otherwise we'll keep streaming
    // bytes the user no longer wants to hear (barge-in).
    if (ttsAbortRef.current) {
      try { ttsAbortRef.current.abort(); } catch {}
      ttsAbortRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      try { audioElementRef.current.currentTime = 0; } catch {}
      if (audioElementRef.current.src) {
        try { URL.revokeObjectURL(audioElementRef.current.src); } catch {}
      }
      audioElementRef.current = null;
    }
    // Tear down any open MediaSource so the next turn starts fresh.
    if (mediaSourceRef.current && mediaSourceRef.current.readyState === "open") {
      try { mediaSourceRef.current.endOfStream(); } catch {}
    }
    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
    setIsAudioPlaying(false);
    updateState("idle");
  }, [updateState]);

  const toggle = useCallback(() => {
    switch (state) {
      case "idle":
        turnIdRef.current += 1;
        startListening();
        break;
      case "listening":
        stopListening();
        break;
      case "thinking":
      case "processing":
        turnIdRef.current += 1;
        if (ttsAbortRef.current) {
          try { ttsAbortRef.current.abort(); } catch {}
          ttsAbortRef.current = null;
        }
        updateState("idle");
        setTimeout(() => { startListening(); }, 50);
        break;
      case "speaking":
        turnIdRef.current += 1;
        stopSpeaking();
        setTimeout(() => { startListening(); }, 50);
        break;
      default:
        break;
    }
  }, [state, startListening, stopListening, stopSpeaking, updateState]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    toggle();
  }, [toggle]);

  const handleUserInteraction = useCallback(async () => {
    if (!audioContextResumedRef.current) {
      await ensureAudioContext();
    }
  }, [ensureAudioContext]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
      
      if (!isVisibleRef.current) {
        if (state === "listening") {
          stopListening();
          setError("Recording stopped - app was backgrounded");
        }
        
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      }
    };

    const handlePageHide = () => {
      cleanupRecording();
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
    };

    const handleBeforeUnload = () => {
      cleanupRecording();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state, stopListening, cleanupRecording]);

  useEffect(() => {
    const handleInteraction = () => {
      handleUserInteraction();
    };

    if (capabilities.isIOS || capabilities.isMobile) {
      document.addEventListener('touchstart', handleInteraction, { once: true, passive: true });
      document.addEventListener('click', handleInteraction, { once: true, passive: true });
    }

    return () => {
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('click', handleInteraction);
    };
  }, [capabilities.isIOS, capabilities.isMobile, handleUserInteraction]);

  useEffect(() => {
    return () => {
      cleanupRecording();
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        if (audioElementRef.current.src) {
          URL.revokeObjectURL(audioElementRef.current.src);
        }
        audioElementRef.current = null;
      }
    };
  }, [cleanupRecording]);

  return {
    state,
    error,
    audioLevel,
    currentTranscript,
    currentResponse,
    conversationId,
    capabilities,
    permissionStatus,
    isAudioPlaying,
    toggle,
    startListening,
    stopListening,
    stopSpeaking,
    handleTouchStart,
    handleUserInteraction,
    isListening: state === "listening",
    isProcessing: state === "processing",
    isThinking: state === "thinking",
    isSpeaking: state === "speaking",
    isIdle: state === "idle",
    isSupported: capabilities.isSupported,
  };
}
