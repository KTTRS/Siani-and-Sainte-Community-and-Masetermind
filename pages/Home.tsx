import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { SEO, PAGE_SEO } from "@/components/SEO";
import { useToast } from "@/hooks/use-toast";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import { useGamification } from "@/hooks/useGamification";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { haptic } from "@/lib/haptics";
import { prefersReducedMotion } from "@/lib/motion";
import { useCelebration } from "@/lib/celebrations";
import { useAnimatedNumber, usePrevious } from "@/lib/useAnimatedNumber";
import { playTick, playArrival } from "@/lib/useSound";
import { Icon3DImage } from "@/lib/icons3d";
import { EditorialLoading, EditorialEmpty } from "@/components/Editorial";
import homeBg from "@assets/stock_images/luxury_members_club__b0d34984.jpg";
import sianiPortrait from "@assets/siani-portrait_1764187902757.jpg";

// 7-day Nexus activity strip — 7 dots (oldest → today),
// lit for active days, dim for missed; today pulses. Quiet watermark.
function NexusStrip({ userId }: { userId: string }) {
  const { data } = useQuery<{ days: { date: string; active: boolean; isToday: boolean }[] }>({
    queryKey: ["/api/gamification/nexus", userId],
    enabled: !!userId,
  });
  const days = data?.days ?? [];
  if (!days.length) return null;
  return (
    <div className="qh-nexus" data-testid="strip-nexus" aria-label="Activity over the last 7 days">
      {days.map((d) => (
        <span
          key={d.date}
          className={`qh-nexus-dot ${d.active ? 'is-active' : ''} ${d.isToday ? 'is-today' : ''}`}
          aria-label={`${d.date}${d.active ? ' active' : ' missed'}`}
          data-testid={`dot-nexus-${d.date}`}
        />
      ))}
    </div>
  );
}

const LAST_SEEN_KEY = (uid: string) => `sainte_last_seen_${uid}`;
const FIRST_OPEN_KEY = (uid: string) => `sainte_first_open_${uid}`;
const SECOND_OPEN_KEY = (uid: string) => `sainte_second_open_${uid}`;
const SECOND_REWARD_KEY = (uid: string) => `sainte_second_reward_${uid}`;
const STREAK_SAVE_ACK_KEY = (uid: string) => `sainte_streak_save_ack_${uid}`;
const ARRIVAL_SOUND_KEY = 'sainte_arrival_sound_session';
const todayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};


export default function Home() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { profile, isLoading: isAuthLoading } = useAuth();
  const { celebrate } = useCelebration();
  const userId = profile?.id ?? "";

  const { stats, statsError, checkIn } = useGamification(userId);
  // Server-injected fields (not in the hook's typed surface yet).
  const streakSavedAtIso = (stats as any)?.streakSavedAt as string | null | undefined;

  // T14 — Quiet recovery-quest surface. Fetches the active quest (if any)
  // on mount and on cache invalidation, so the card appears once the
  // streak engine opens one after a missed day with no freeze available.
  type RecoveryQuestResp = {
    hasActiveQuest: boolean;
    quest: {
      id: string;
      questDescription: string;
      brokenStreak: number;
      expiresAt: string;
    } | null;
  };
  const { data: recoveryData } = useQuery<RecoveryQuestResp>({
    queryKey: ["/api/users", userId, "recovery-quest"],
    enabled: !!userId,
  });
  const activeQuest = recoveryData?.hasActiveQuest ? recoveryData.quest : null;
  const handleOpenQuest = () => {
    haptic('tap');
    navigate('/bag');
  };

  // Minimal shape — only the timestamp fields the drop-dot needs.
  type FeedItem = { id?: string; createdAt?: string; scheduledFor?: string };
  const { data: drops = [] } = useQuery<FeedItem[]>({
    queryKey: ["/api/drops"],
    enabled: !!userId,
  });
  const { data: signals = [] } = useQuery<FeedItem[]>({
    queryKey: ["/api/signals"],
    enabled: !!userId,
  });

  const {
    error, audioLevel, toggle,
    isListening, isProcessing, isThinking, isSpeaking, isIdle,
    permissionStatus,
  } = useVoiceCapture({
    userId,
    onResponse: () => {},
    onError: (err) => toast({ variant: "destructive", description: err }),
  });

  const [pingKey, setPingKey] = useState(0);

  // Permission prompt
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  useEffect(() => { if (permissionStatus === "denied") setShowPermissionPrompt(true); }, [permissionStatus]);
  // Errors are toasted by the onError callback above — do not add a second.

  // Home arrival cue — soft tone, once per browser session, only when
  // sound is on AND the AudioContext is already unlocked (which happens
  // when the user toggled sound on via a real gesture). We only mark
  // the session as "fired" if playback actually succeeded, so a visit
  // that couldn't play (suspended context, hidden tab, sound off) still
  // gets the cue on the next eligible Home mount this session.
  const arrivalFiredRef = useRef(false);
  useEffect(() => {
    if (!userId) return;
    if (arrivalFiredRef.current) return;
    let already: string | null = null;
    try { already = sessionStorage.getItem(ARRIVAL_SOUND_KEY); } catch {}
    if (already === '1') { arrivalFiredRef.current = true; return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const ok = await playArrival();
      if (cancelled) return;
      if (ok) {
        arrivalFiredRef.current = true;
        try { sessionStorage.setItem(ARRIVAL_SOUND_KEY, '1'); } catch {}
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [userId]);

  // First-open-of-day silent reward — once per calendar day per user.
  // Ref guard makes this Strict-Mode-safe; we only persist the date AFTER
  // the reward actually fires, so a remount before the timeout doesn't
  // silently consume the reward.
  const firstOpenFiredRef = useRef(false);
  useEffect(() => {
    if (!userId) return;
    if (firstOpenFiredRef.current) return;
    const key = FIRST_OPEN_KEY(userId);
    const last = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    const today = todayKey();
    if (last === today) return;
    const t = setTimeout(async () => {
      if (firstOpenFiredRef.current) return;
      firstOpenFiredRef.current = true;
      // Visual/haptic ping always fires — feels alive even offline.
      haptic('rise');
      setPingKey((k) => k + 1);
      // Only persist the daily marker after the mutation actually succeeds,
      // so a transient failure doesn't silently consume the user's reward.
      try {
        await checkIn();
        try { localStorage.setItem(key, today); } catch {}
      } catch {
        // leave the key unset; the next mount today will retry.
        firstOpenFiredRef.current = false;
      }
    }, 800);
    return () => clearTimeout(t);
  }, [userId, checkIn]);

  // CRED roll-up + ping when it ticks. Skip the first non-undefined value
  // so the initial stats load (undefined → real number) doesn't false-fire.
  // `silentNextCredRef` lets the surprise-micro-reward path (T102) bump
  // the balance without firing flash/haptic — the user discovers it later.
  const credTarget = stats?.credBalance ?? 0;
  const credAnimated = useAnimatedNumber(credTarget);
  const prevCred = usePrevious(credTarget);
  const credBaselineSetRef = useRef(false);
  const silentNextCredRef = useRef(false);
  const [credFlash, setCredFlash] = useState(0);
  // "LUCKY +5" chip key bump.
  const [luckyChip, setLuckyChip] = useState(0);
  useEffect(() => {
    if (stats === undefined) return;
    if (!credBaselineSetRef.current) {
      credBaselineSetRef.current = true;
      return;
    }
    if (prevCred !== undefined && credTarget > prevCred) {
      if (silentNextCredRef.current) {
        silentNextCredRef.current = false;
        return;
      }
      setCredFlash((k) => k + 1);
      haptic('success');
      playTick();
    }
  }, [stats, credTarget, prevCred]);

  // Surprise micro-CRED on second open, 1-in-7.
  // Never fires on first open of a day; never twice in the same day. Goes
  // through the existing action endpoint but suppresses the UI flash so the
  // reward is silent — the balance just nudges up.
  const secondRewardCheckedRef = useRef(false);
  useEffect(() => {
    if (!userId) return;
    if (secondRewardCheckedRef.current) return;
    secondRewardCheckedRef.current = true;
    const today = todayKey();
    let firstOpenDay: string | null = null;
    let secondOpenDay: string | null = null;
    let alreadyRewarded: string | null = null;
    try {
      firstOpenDay = localStorage.getItem(FIRST_OPEN_KEY(userId));
      secondOpenDay = localStorage.getItem(SECOND_OPEN_KEY(userId));
      alreadyRewarded = localStorage.getItem(SECOND_REWARD_KEY(userId));
    } catch {}
    // Only count as a "second open" once first-open has happened today.
    if (firstOpenDay !== today) return;
    if (secondOpenDay === today) {
      // Already a second open today; silently roll once and persist outcome.
      if (alreadyRewarded === today) return;
      // Mark rolled-but-missed so we never roll again today.
      try { localStorage.setItem(SECOND_REWARD_KEY(userId), `miss-${today}`); } catch {}
      return;
    }
    // First time this mount counts as second open today.
    try { localStorage.setItem(SECOND_OPEN_KEY(userId), today); } catch {}
    if (alreadyRewarded === today) return;
    // Hit-or-miss is decided server-side. On a hit we surface a quiet
    // "LUCKY +5" chip next to the CRED row (low-noise, ~2s) and let the
    // existing CRED flash + success haptic play. On a miss / failure we
    // do nothing — no flash, no chip.
    (async () => {
      try {
        const res = await apiRequest("POST", "/api/gamification/lucky-drop", {
          userId,
        });
        const data = (await res.json()) as { awarded: boolean; credAwarded: number };
        if (!data.awarded) {
          try { localStorage.setItem(SECOND_REWARD_KEY(userId), `miss-${today}`); } catch {}
          return;
        }
        try { localStorage.setItem(SECOND_REWARD_KEY(userId), today); } catch {}
        // Subtle "rise" haptic = the surprise moment, distinct from the
        // 'success' that fires on every CRED tick. Skipped under reduced motion.
        if (!prefersReducedMotion()) haptic('rise');
        setLuckyChip((k) => k + 1);
        // Quiet celebration variant.
        // text overlay) so the moment registers as "you won something"
        // without a hard interrupt. Reduced-motion skips confetti.
        // Auto-confetti removed.
        // the HUD already broadcasts the surprise; full-screen overlays
        // hijack the home moment. Silent ember celebration only fires on
        // the explicit user-driven moments (drop unlock, level-up).
        queryClient.invalidateQueries({ queryKey: ["/api/gamification", userId] });
        queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "stats"] });
      } catch {
        // swallow; next mount today is gated by SECOND_OPEN_KEY anyway.
      }
    })();
  }, [userId]);

  // T103 — Streak save cyan pulse. If the server auto-saved a 7+ day
  // streak from breaking, render a single cyan ring around the flame on
  // the first Home mount that observes it, then ack so it never repeats.
  const [streakSavePulseKey, setStreakSavePulseKey] = useState(0);
  useEffect(() => {
    if (!userId || !streakSavedAtIso) return;
    let ack: string | null = null;
    try { ack = localStorage.getItem(STREAK_SAVE_ACK_KEY(userId)); } catch {}
    if (ack === streakSavedAtIso) return;
    setStreakSavePulseKey((k) => k + 1);
    try { localStorage.setItem(STREAK_SAVE_ACK_KEY(userId), streakSavedAtIso); } catch {}
  }, [userId, streakSavedAtIso]);

  // Drop dot — pulses if there's anything newer than last-seen
  const newestTs = useMemo(() => {
    const all: FeedItem[] = [...drops, ...signals];
    let max = 0;
    for (const x of all) {
      const t = Date.parse(x.createdAt ?? x.scheduledFor ?? '') || 0;
      if (t > max) max = t;
    }
    return max;
  }, [drops, signals]);
  const [hasNew, setHasNew] = useState(false);
  useEffect(() => {
    if (!userId || !newestTs) return;
    const last = typeof localStorage !== 'undefined' ? Number(localStorage.getItem(LAST_SEEN_KEY(userId)) ?? 0) : 0;
    setHasNew(newestTs > last);
  }, [userId, newestTs]);
  // T101 — Card-flip reveal on drop-dot tap. 380ms 3D flip overlay,
  // haptic ladder (rise on flip-start, success on settle), then navigate.
  // Reduced motion bypasses the overlay.
  const [flipTo, setFlipTo] = useState<null | '/drop' | '/signal'>(null);
  const handleDropDot = useCallback(() => {
    if (!userId) return;
    try { localStorage.setItem(LAST_SEEN_KEY(userId), String(Date.now())); } catch {}
    setHasNew(false);
    const dest: '/drop' | '/signal' | null =
      (drops?.length ?? 0) > 0 ? '/drop' :
      (signals?.length ?? 0) > 0 ? '/signal' :
      null;
    if (!dest) { haptic('tap'); return; }
    if (prefersReducedMotion()) {
      haptic('click');
      navigate(dest);
      return;
    }
    haptic('rise');
    setFlipTo(dest);
    window.setTimeout(() => { haptic('success'); navigate(dest); }, 380);
  }, [userId, drops, signals, navigate]);

  const handleOrbTap = useCallback(() => { haptic('click'); toggle(); }, [toggle]);

  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center of-bg px-6" data-testid="loading-home">
        <div className="w-full max-w-sm">
          <EditorialLoading
            serial="SAINTE / HOME / —"
            label="loading"
            testId="loading-home-editorial"
          />
        </div>
      </div>
    );
  }
  if (statsError) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center of-bg gap-3 px-6" data-testid="error-home">
        <div className="w-full max-w-sm">
          <EditorialEmpty
            serial="SAINTE / HOME / ERR"
            label="something went wrong"
          />
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/gamification", userId] })}
          className="text-xs text-[#ECE4D2] underline"
          data-testid="button-retry-home"
        >try again</button>
      </div>
    );
  }

  const stateLabel =
    isListening ? "listening" :
    isProcessing || isThinking ? "thinking" :
    isSpeaking ? "speaking" :
    "siani";

  const streak = stats?.currentStreak ?? 0;
  const level = stats?.level ?? 1;
  const isCold = streak === 0;

  return (
    <div className="quiet-home" data-testid="home-quiet">
      <SEO {...PAGE_SEO.home} />

      {/* Single warehouse-interior backdrop, dim. Wash gradient handled in CSS. */}
      <div className="qh-bg" aria-hidden="true">
        <img src={homeBg} alt="" />
        {/* Depth signature: deeper warm key pool + far horizon line. Both
            track the locked key-light vector so the hero reads as a real
            room, not a panel. Pointer-events disabled. */}
        <div className="of-hero-key-pool" />
        <div className="of-hero-horizon" />
      </div>

      {/* HUD: tappable streak (→ /bag) and CRED (→ /profile) pills. */}
      <button
        type="button"
        className={`qh-hud qh-hud-left qh-tap ${isCold ? 'is-cold' : ''}`}
        data-testid="button-hud-streak"
        aria-label={`Streak: ${streak} days. View bag.`}
        onClick={() => navigate('/bag')}
      >
        <span className="qh-flame-wrap">
          <Icon3DImage icon="fire" size={32} className="qh-flame" />
          <AnimatePresence>
            {streakSavePulseKey > 0 && (
              <motion.span
                key={`streak-save-${streakSavePulseKey}`}
                className="qh-streak-save-ring"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: [0, 0.9, 0], scale: [0.6, 1.8, 2.6] }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
                data-testid="pulse-streak-save"
              />
            )}
          </AnimatePresence>
        </span>
        <span className="qh-streak-num" data-testid="text-streak">{streak}</span>
        <span className="qh-eyebrow">streak</span>
      </button>
      <button
        type="button"
        className="qh-hud qh-hud-right qh-tap"
        data-testid="button-hud-cred"
        aria-label={`CRED balance: ${credAnimated}. View profile.`}
        onClick={() => navigate('/profile')}
      >
        <div className="qh-cred-row">
          <AnimatePresence>
            <motion.span
              key={`flash-${credFlash}`}
              className="qh-cred-halo"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 0.7, 0], scale: [0.6, 1.6, 2.2] }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
            />
          </AnimatePresence>
          <span className="qh-cred-num" data-testid="text-cred">{credAnimated}</span>
          <span className="qh-eyebrow">cred</span>
          {/* "LUCKY +5" chip
              for ~1.8s when the surprise micro-reward fires. Low-noise on
              purpose; reduced-motion collapses the entry/exit. */}
          <AnimatePresence>
            {luckyChip > 0 && (
              <motion.span
                key={`lucky-${luckyChip}`}
                className="qh-lucky-chip"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: prefersReducedMotion() ? 0 : 0.32, ease: "easeOut" }}
                onAnimationComplete={() => {
                  setTimeout(() => setLuckyChip(0), 1500);
                }}
                data-testid="chip-lucky"
              >
                LUCKY +5
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <span className="qh-lvl" data-testid="text-level">lv {String(level).padStart(2, '0')}</span>
      </button>

      {/* 7-day Nexus activity strip
          watermark; today pulses lime, past active days glow lime, missed
          days are faint cream. No animation under reduced-motion. */}
      <NexusStrip userId={userId} />

      {/* T14 — Recovery quest card. Quiet cyan-keyed surface that auto-
          appears when the streak engine opens a 24h recovery window. The
          card stays out of the way (top-center watermark band) and offers
          a single "complete" path; tapping the body navigates to the bag
          where the move lives. */}
      <AnimatePresence>
        {activeQuest && (
          <motion.div
            key={`recovery-${activeQuest.id}`}
            className="qh-recovery-card"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: prefersReducedMotion() ? 0 : 0.32, ease: "easeOut" }}
            data-testid="card-recovery-quest"
          >
            <button
              type="button"
              className="qh-recovery-body"
              onClick={handleOpenQuest}
              data-testid="button-recovery-open"
            >
              <span className="qh-recovery-label">RECOVERY · 24H</span>
              <span className="qh-recovery-text">{activeQuest.questDescription}</span>
              <span className="qh-recovery-meta" data-testid="text-recovery-streak">
                {activeQuest.brokenStreak}-day streak at stake
              </span>
            </button>
            <span
              className="qh-recovery-action"
              data-testid="text-recovery-cta"
              aria-hidden="true"
            >
              OPEN
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daily-drop dot — bottom-left, pulses if there's something new since last visit */}
      <button
        type="button"
        className={`qh-drop-dot ${hasNew ? 'is-new' : ''}`}
        onClick={handleDropDot}
        aria-label={hasNew ? "Open the latest drop" : "No new drops"}
        data-testid="button-drop-dot"
      >
        <span className="qh-drop-core" />
      </button>

      {/* Photo-change ping — barely-there flash bottom-left edge */}
      <AnimatePresence>
        <motion.span
          key={pingKey}
          className="qh-ping"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1.6, 2.4] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
        />
      </AnimatePresence>

      {/* Permission prompt — quiet */}
      <AnimatePresence>
        {showPermissionPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="qa-permission"
          >
            <p>Microphone access needed to talk to Siani.</p>
            <button
              onClick={() => setShowPermissionPrompt(false)}
              data-testid="button-dismiss-permission"
            >dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap to start, tap again to send. */}
      <motion.button
        type="button"
        className={`qh-siani ${isListening ? 'is-listening' : ''} ${isSpeaking ? 'is-speaking' : ''} ${(isProcessing||isThinking) ? 'is-thinking' : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1.2 }}
        onClick={handleOrbTap}
        data-testid="button-siani-pill"
        aria-label="Talk to Siani"
      >
        <span
          className="qh-siani-orb"
          style={{
            backgroundImage: `url(${sianiPortrait})`,
            transform: `scale(${1 + (isListening ? audioLevel * 0.35 : 0)})`,
          }}
        />
        <span className="qh-siani-label" data-testid="text-siani-state">{stateLabel}</span>
      </motion.button>

      {/* T101 — 3D card-flip reveal overlay between Home and the drop. */}
      <AnimatePresence>
        {flipTo && (
          <motion.div
            key="qh-flip"
            className="qh-flip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            data-testid="overlay-drop-flip"
          >
            <motion.div
              className="qh-flip-card"
              initial={{ rotateY: 90 }}
              animate={{ rotateY: 0 }}
              exit={{ rotateY: -90 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
