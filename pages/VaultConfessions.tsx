import React, { useState, useCallback, useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { fadeUp, SPRING, EASE, prefersReducedMotion } from "@/lib/motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { 
  useVaultConfessions, 
  useCreateConfession, 
  useReactToConfession 
} from "@/hooks/useNightShift";
import { Icons3D, Icon3DImage } from "@/lib/icons3d";
import { Clay3DCard, GlowBadge } from "@/lib/layouts";
import { hapticLight, hapticMedium, hapticSuccess } from "@/lib/haptics";
import { playCommit } from "@/lib/useSound";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EditorialLoading, EditorialEmpty } from "@/components/Editorial";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Loader2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import heroImg from "@assets/generated_images/sainte_tunnel_crimson.png";

const confessionSchema = z.object({
  content: z.string().min(10, "Your confession must be at least 10 characters"),
  isAnonymous: z.boolean().default(true),
  mood: z.string().optional(),
});

type ConfessionFormData = z.infer<typeof confessionSchema>;

interface Confession {
  id: string;
  content: string;
  isAnonymous: boolean;
  displayName?: string;
  mood?: string;
  createdAt: string;
  reactions: {
    fire: number;
    heart: number;
    strength: number;
  };
  userReactions?: string[];
}

const MOODS = [
  { value: "vulnerable", label: "Vulnerable" },
  { value: "hopeful", label: "Hopeful" },
  { value: "angry", label: "Angry" },
  { value: "scared", label: "Scared" },
  { value: "grateful", label: "Grateful" },
  { value: "confused", label: "Confused" },
];

function generateSerial(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let serial = "";
  for (let i = 0; i < 6; i++) {
    serial += chars[Math.floor(Math.random() * chars.length)];
  }
  return serial;
}

function ConfessionSkeleton() {
  return (
    <div className="matte-3d p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full bg-smoke" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-24 bg-smoke" />
          <Skeleton className="h-3 w-16 bg-smoke" />
        </div>
      </div>
      <Skeleton className="h-20 w-full bg-smoke" />
      <div className="flex gap-4">
        <Skeleton className="h-8 w-16 bg-smoke rounded-full" />
        <Skeleton className="h-8 w-16 bg-smoke rounded-full" />
        <Skeleton className="h-8 w-16 bg-smoke rounded-full" />
      </div>
    </div>
  );
}

const ConfessionCard = React.forwardRef<HTMLDivElement, { 
  confession: Confession; 
  onReact: (reaction: string) => void;
  index: number;
}>(function ConfessionCard({ 
  confession, 
  onReact,
  index 
}, ref) {
  const timeAgo = formatDistanceToNow(new Date(confession.createdAt), { addSuffix: false });
  const serialNumber = `SN-VAULT-${confession.id.slice(0, 6).toUpperCase()}`;
  const hasUserReacted = confession.userReactions && confession.userReactions.length > 0;

  const reactions = [
    { 
      type: "fire", 
      icon: <img src={Icons3D.fire} alt="" className="w-5 h-5 object-contain" />,
      count: confession.reactions?.fire || 0,
      label: "Fire",
      hasReacted: confession.userReactions?.includes("fire")
    },
    { 
      type: "heart", 
      icon: <img src={Icons3D.heart} alt="" className="w-5 h-5 object-contain" />,
      count: confession.reactions?.heart || 0,
      label: "Heart",
      hasReacted: confession.userReactions?.includes("heart")
    },
    { 
      type: "strength", 
      icon: <img src={Icons3D.medal} alt="" className="w-5 h-5 object-contain" />,
      count: confession.reactions?.strength || 0,
      label: "Strength",
      hasReacted: confession.userReactions?.includes("strength")
    },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      data-testid={`card-confession-${confession.id}`}
    >
      <Clay3DCard className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-graphite border border-smoke flex items-center justify-center">
              {confession.isAnonymous ? (
                <Icon3DImage icon="vault" size={16} />
              ) : (
                <Icon3DImage icon="user" size={16} />
              )}
            </div>
            <div>
              <p className="font-condensed text-sm text-white tracking-wide">
                {confession.isAnonymous ? "ANONYMOUS" : confession.displayName || "Member"}
              </p>
              <p className="text-xs text-muted flex items-center gap-1">
                <Clock className="w-3 h-3" />
                dropped {timeAgo} ago
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {confession.mood && (
              <GlowBadge variant="crimson">
                {confession.mood}
              </GlowBadge>
            )}
            <span className="serial-tape text-[9px]">{serialNumber}</span>
          </div>
        </div>

        <p className="text-silver leading-relaxed text-[15px]">
          {confession.content}
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-smoke/30">
          <div className="flex gap-2">
            {reactions.map((reaction) => (
              <ReactPing
                key={reaction.type}
                onClick={() => onReact(reaction.type)}
                hasReacted={!!reaction.hasReacted}
                count={reaction.count}
                testId={`button-react-${reaction.type}-${confession.id}`}
              >
                {reaction.icon}
              </ReactPing>
            ))}
          </div>
          <span className="text-[10px] text-muted font-condensed tracking-wider">
            ONLY VISIBLE FOR 24 HOURS
          </span>
        </div>
      </Clay3DCard>
    </motion.div>
  );
});

// T106 — Vault react button with lime ping halo + tap haptic + count tick.
// The radial pulse and count-tick both honor prefers-reduced-motion: we skip
// the ping render and the scale animation when the user opts out of motion.
function ReactPing({
  onClick,
  hasReacted,
  count,
  testId,
  children,
}: {
  onClick: () => void;
  hasReacted: boolean;
  count: number;
  testId: string;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const [pingKey, setPingKey] = useState(0);
  const [showPing, setShowPing] = useState(false);
  const [tickKey, setTickKey] = useState(0);
  const prevCountRef = useRef(count);
  useEffect(() => {
    if (count !== prevCountRef.current) {
      prevCountRef.current = count;
      setTickKey((k) => k + 1);
    }
  }, [count]);
  const handle = useCallback(() => {
    haptic("tap");
    if (!reduceMotion) {
      setPingKey((k) => k + 1);
      setShowPing(true);
    }
    onClick();
  }, [onClick, reduceMotion]);
  return (
    <button
      type="button"
      onClick={handle}
      className={`gel-capsule gap-1.5 ${hasReacted ? "gel-capsule--active" : ""}`}
      data-testid={testId}
    >
      {children}
      {count > 0 && (
        <motion.span
          key={tickKey}
          initial={reduceMotion ? false : { scale: 1 }}
          animate={reduceMotion ? undefined : { scale: [1, 1.35, 1], color: ["#FAFAFA", "#9BFF6A", "#FAFAFA"] }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="text-xs font-condensed tabular-nums"
        >
          {count}
        </motion.span>
      )}
      {showPing && !reduceMotion && (
        <span
          key={pingKey}
          className="lime-ping"
          aria-hidden
          onAnimationEnd={() => setShowPing(false)}
        />
      )}
    </button>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="matte-3d p-8 text-center space-y-4"
    >
      <div className="w-16 h-16 mx-auto rounded-full bg-graphite border border-smoke flex items-center justify-center">
        <Icon3DImage icon="vault" size={32} />
      </div>
      <h3 className="font-display text-xl text-white">The Vault Awaits Your Truth</h3>
      <p className="text-silver text-sm max-w-xs mx-auto">
        Be the first to drop. Your confessions are protected in the vault.
      </p>
      <p className="text-[10px] text-muted font-condensed tracking-wider">
        ONLY VISIBLE FOR 24 HOURS
      </p>
    </motion.div>
  );
}

export default function VaultConfessions() {
  const { profile } = useAuth();
  const userId = profile?.id;
  
  const { data: vaultData, isLoading, isError, error } = useVaultConfessions();
  const rawConfessions = Array.isArray(vaultData) ? vaultData : (vaultData?.confessions ?? []);
  const confessions: Confession[] = rawConfessions.map((c: any) => ({
    ...c,
    reactions: c.reactions || {
      fire: c.fireCount ?? 0,
      heart: c.heartCount ?? 0,
      strength: c.strengthCount ?? 0,
    },
  }));
  const createConfession = useCreateConfession();
  const reactToConfession = useReactToConfession();

  const anonymousCount = confessions.filter((c: Confession) => c.isAnonymous).length;

  const form = useForm<ConfessionFormData>({
    resolver: zodResolver(confessionSchema),
    defaultValues: {
      content: "",
      isAnonymous: true,
      mood: undefined,
    },
  });

  const onSubmit = async (data: ConfessionFormData) => {
    hapticMedium();
    try {
      await createConfession.mutateAsync({
        content: data.content,
        isAnonymous: data.isAnonymous,
      });
      hapticSuccess();
      void playCommit();
      form.reset();
    } catch (error) {
      if (import.meta.env.DEV) console.error("Failed to create confession:", error);
    }
  };

  const handleReaction = async (confessionId: string, reaction: string) => {
    try {
      await reactToConfession.mutateAsync({ confessionId, reaction });
    } catch (error) {
      if (import.meta.env.DEV) console.error("Failed to react:", error);
    }
  };

  return (
    <div className="flex flex-col min-h-full app-ground pb-24" data-testid="page-vault-confessions">
      <header 
        className="relative px-6 pt-16 pb-10 overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(12,23,18,0.3) 0%, rgba(12,23,18,0.85) 60%, rgba(12,23,18,1) 100%), url(${heroImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-crimson/10 via-black to-black opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(199,255,62,0.15),transparent)]" />
        {/* Vault unlock — deeper void floor reveal. Animates in on mount
            to mark the vault opening onto a darker room than the rest of
            the app, then settles. Reduced-motion: instant. */}
        <motion.div
          className="of-vault-deep-void"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: prefersReducedMotion() ? 0 : 1.1,
            ease: [0.22, 1, 0.36, 1],
            delay: prefersReducedMotion() ? 0 : 0.18,
          }}
          aria-hidden
        />
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center space-y-4"
        >
          <span className="serial-tape">SN-VAULT-{generateSerial()}</span>
          
          <div className="flex justify-center mb-4">
            <span className="icon-halo icon-halo--lg">
              <Icon3DImage icon="heart" size={64} />
            </span>
          </div>
          
          <h1 className="text-broken-display text-5xl md:text-6xl text-white tracking-tighter">
            <span className="status-exclusive">THE VAULT</span>
          </h1>
          
          <p className="font-condensed text-xs tracking-[0.2em] text-silver uppercase">
            Anonymous Confessions • Protected Space
          </p>
          
          <div className="flex justify-center gap-4 pt-2">
            <span className="gel-capsule">
              <span className="icon-halo"><Icon3DImage icon="vault" size={12} /></span>
              <span className="font-stats tabular-nums">{confessions.length}</span>
              <span>confessions shared tonight</span>
            </span>
          </div>
        </motion.div>
      </header>

      <div className="px-6 space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <Clay3DCard variant="crimson" className="p-5 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-crimson/20 border border-crimson/40 flex items-center justify-center">
                      <Icon3DImage icon="vault" size={16} />
                    </div>
                    <span className="font-condensed text-xs tracking-[0.15em] text-silver uppercase">
                      What's on your mind?
                    </span>
                  </div>
                  {anonymousCount > 0 && (
                    <span className="text-[10px] text-muted font-condensed tracking-wider">
                      Join {anonymousCount} anonymous voices
                    </span>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Share something you've been holding onto..."
                          className="min-h-[100px] bg-graphite/50 border-smoke/50 text-white placeholder:text-muted resize-none focus:border-crimson/50"
                          data-testid="input-confession-content"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap items-center gap-4">
                  <FormField
                    control={form.control}
                    name="isAnonymous"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-anonymous"
                          />
                        </FormControl>
                        <FormLabel className="font-condensed text-xs text-silver tracking-wide cursor-pointer">
                          {field.value ? "ANONYMOUS" : "SHOW NAME"}
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mood"
                    render={({ field }) => (
                      <FormItem className="flex-1 min-w-[140px]">
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger 
                              className="bg-graphite/50 border-smoke/50 text-silver h-9"
                              data-testid="select-mood"
                            >
                              <SelectValue placeholder="Mood (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-charcoal border-smoke">
                            {MOODS.map((mood) => (
                              <SelectItem 
                                key={mood.value} 
                                value={mood.value}
                                className="text-silver hover:text-white"
                              >
                                <span className="premium-chip text-[10px] py-1 px-2">
                                  {mood.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={createConfession.isPending || !form.formState.isValid}
                  className="w-full bg-crimson hover:bg-crimson-light text-white font-condensed tracking-wider"
                  data-testid="button-submit-confession"
                >
                  {createConfession.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      DROPPING...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      DROP INTO THE VAULT
                    </>
                  )}
                </Button>
              </Clay3DCard>
            </form>
          </Form>
        </motion.section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-condensed text-xs tracking-[0.2em] text-silver uppercase">
              The Feed
            </h2>
            <span className="text-xs text-muted tabular-nums">
              {confessions.length} drop{confessions.length !== 1 ? "s" : ""} tonight
            </span>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {isError ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="matte-3d p-8 text-center space-y-4"
                  data-testid="error-vault-confessions"
                >
                  <div className="w-16 h-16 mx-auto rounded-full bg-graphite border border-smoke flex items-center justify-center">
                    <Icon3DImage icon="vault" size={32} />
                  </div>
                  <h3 className="font-display text-xl text-white">Failed to load confessions</h3>
                  <p className="text-silver text-sm max-w-xs mx-auto">
                    {error instanceof Error ? error.message : "Something went wrong. Please try again later."}
                  </p>
                </motion.div>
              ) : isLoading ? (
                <EditorialLoading
                  serial="SAINTE / VLT / —"
                  label="loading"
                  testId="loading-vault"
                />
              ) : confessions.length === 0 ? (
                <EditorialEmpty
                  serial="SAINTE / VLT / 00"
                  label="vault is quiet — drop the first"
                  testId="empty-vault"
                />
              ) : (
                confessions.map((confession: Confession, index: number) => (
                  <ConfessionCard
                    key={confession.id}
                    confession={confession}
                    onReact={(reaction) => handleReaction(confession.id, reaction)}
                    index={index}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </div>
  );
}
