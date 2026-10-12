import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { haptic } from "@/lib/haptics";
import {
  ChevronRight,
  Plus,
  Send,
  Radio,
  Sparkles,
  HandHeart,
  X,
  UserPlus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MASTERMIND_ROLES,
  MASTERMIND_PATHWAYS,
  type MastermindPostKind,
  type MastermindResponseKind,
} from "@shared/schema";

type Seat = {
  id: string;
  role: string;
  memberUserId: string | null;
  reason: string | null;
  strength: string | null;
  positionIndex: number;
  contributionScore: number;
  gravity: string;
  lastInteractionAt: string | null;
  memberUsername: string | null;
  memberDisplayName: string | null;
  memberAvatarUrl: string | null;
};

type Post = {
  id: string;
  kind: MastermindPostKind;
  body: string;
  points: number;
  createdAt: string;
  authorUserId: string;
  targetUserId: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
};

type Response = {
  id: string;
  postId: string;
  kind: MastermindResponseKind;
  body: string | null;
  points: number;
  createdAt: string;
  responderUserId: string;
  responderUsername: string | null;
  responderDisplayName: string | null;
  responderAvatarUrl: string | null;
};

type Circle = {
  id: string;
  ownerUserId: string;
  trajectory: string | null;
  constraintNow: string | null;
  successDef: string | null;
  pathway: string;
  momentumScore: number;
  chemistry: string;
};

type CircleData = {
  circle: Circle;
  seats: Seat[];
  posts: Post[];
  responses: Response[];
};

const ROLE_LABEL: Record<string, string> = {
  builder: "Builder",
  connector: "Connector",
  strategist: "Strategist",
  operator: "Operator",
  mentor: "Mentor",
  opportunity_spotter: "Opportunity Spotter",
  creative_thinker: "Creative Thinker",
  pattern_breaker: "Pattern Breaker",
  closer: "Closer",
};

const PATHWAY_LABEL: Record<string, string> = {
  tech: "Tech",
  entrepreneurship: "Entrepreneurship",
  trades: "Trades",
  small_business: "Small Business",
  creative: "Creative",
  career_growth: "Career Growth",
  education: "Education",
  financial: "Financial",
  community: "Community",
  career_change: "Career Change",
};

const KIND_LABEL: Record<MastermindPostKind, string> = {
  signal: "SIGNAL",
  exchange: "EXCHANGE",
  activate: "ACTIVATE",
};

const KIND_BLURB: Record<MastermindPostKind, string> = {
  signal: "Share movement. Real progress only.",
  exchange: "Offer something — an intro, an insight, a resource.",
  activate: "Name what you want to move. The orbit responds.",
};

const RESPONSE_LABEL: Record<MastermindResponseKind, string> = {
  intro: "Offer intro",
  insight: "Share insight",
  resource: "Send resource",
  encourage: "Encourage",
  volunteer: "Volunteer time",
};

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function chemistryLabel(c: string) {
  return c === "electric" ? "Electric" : c === "strong" ? "Strong" : c === "steady" ? "Steady" : "Forming";
}

function gravityLabel(g: string) {
  return g === "high" ? "High gravity" : g === "rising" ? "Rising" : "Quiet power";
}

// Orbit math — distribute seats at varying angles and ring radii so the
// orbit reads as a living scatter, not a clock face. Each seat is pinned
// to one of the inner / mid / outer rings based on its position index.
const RING_RADII = [54, 84, 114, 144, 170, 192];
const HIGHLIGHT_RING = 3; // 4th ring from the center is the lime "path" ring

function seatRingIndex(positionIndex: number) {
  // Cycle: inner, mid, outer, mid, inner... gives a non-uniform scatter.
  const cycle = [2, 4, 3, 1, 5, 2, 4, 1, 3];
  return cycle[positionIndex % cycle.length];
}

function seatAngle(positionIndex: number, total: number) {
  // Hash the index to a stable but uneven angle so seats don't align.
  const golden = 2.39996323; // golden angle in radians
  return positionIndex * golden + (total % 7) * 0.31;
}

function seatPosition(positionIndex: number, total: number) {
  const r = RING_RADII[seatRingIndex(positionIndex)];
  const a = seatAngle(positionIndex, total);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

export default function Mastermind() {
  const { toast } = useToast();
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeKind, setComposeKind] = useState<MastermindPostKind>("signal");
  const [composeBody, setComposeBody] = useState("");
  const [feedFilter, setFeedFilter] = useState<MastermindPostKind | "all">("all");
  const [trajectoryOpen, setTrajectoryOpen] = useState(false);
  const [trajectoryDraft, setTrajectoryDraft] = useState({
    trajectory: "",
    constraintNow: "",
    successDef: "",
    pathway: "entrepreneurship",
  });
  const [inviteHandle, setInviteHandle] = useState("");
  const [inviteReason, setInviteReason] = useState("");
  const [inviteStrength, setInviteStrength] = useState("");
  const [addSeatRole, setAddSeatRole] = useState<string>("connector");
  const [respondPostId, setRespondPostId] = useState<string | null>(null);
  const [respondKind, setRespondKind] = useState<MastermindResponseKind>("insight");
  const [respondBody, setRespondBody] = useState("");

  const { data, isLoading } = useQuery<CircleData>({ queryKey: ["/api/mastermind"] });

  const trajectoryMutation = useMutation({
    mutationFn: async (payload: typeof trajectoryDraft) =>
      apiRequest("PATCH", "/api/mastermind/trajectory", payload),
    onSuccess: () => {
      haptic("success");
      queryClient.invalidateQueries({ queryKey: ["/api/mastermind"] });
      setTrajectoryOpen(false);
      toast({ title: "Trajectory locked" });
    },
    onError: () => toast({ title: "Could not save", variant: "destructive" }),
  });

  const addSeatMutation = useMutation({
    mutationFn: async (role: string) => apiRequest("POST", "/api/mastermind/seats", { role }),
    onSuccess: () => {
      haptic("soft");
      queryClient.invalidateQueries({ queryKey: ["/api/mastermind"] });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (vars: { seatId: string; memberUsername: string; reason: string; strength: string }) =>
      apiRequest("POST", `/api/mastermind/seats/${vars.seatId}/invite`, {
        memberUsername: vars.memberUsername,
        reason: vars.reason || undefined,
        strength: vars.strength || undefined,
      }),
    onSuccess: () => {
      haptic("rise");
      queryClient.invalidateQueries({ queryKey: ["/api/mastermind"] });
      setSelectedSeat(null);
      setInviteHandle("");
      setInviteReason("");
      setInviteStrength("");
      toast({ title: "Seat filled" });
    },
    onError: () => toast({ title: "Member not found", variant: "destructive" }),
  });

  const vacateMutation = useMutation({
    mutationFn: async (seatId: string) =>
      apiRequest("DELETE", `/api/mastermind/seats/${seatId}?mode=vacate`),
    onSuccess: () => {
      haptic("tap");
      queryClient.invalidateQueries({ queryKey: ["/api/mastermind"] });
      setSelectedSeat(null);
    },
  });

  const removeSeatMutation = useMutation({
    mutationFn: async (seatId: string) => apiRequest("DELETE", `/api/mastermind/seats/${seatId}`),
    onSuccess: () => {
      haptic("tap");
      queryClient.invalidateQueries({ queryKey: ["/api/mastermind"] });
      setSelectedSeat(null);
    },
  });

  const postMutation = useMutation({
    mutationFn: async (vars: { kind: MastermindPostKind; body: string }) =>
      apiRequest("POST", "/api/mastermind/posts", vars),
    onSuccess: () => {
      haptic("commit" as any);
      queryClient.invalidateQueries({ queryKey: ["/api/mastermind"] });
      setComposeOpen(false);
      setComposeBody("");
      toast({ title: "Sent to the orbit" });
    },
  });

  const respondMutation = useMutation({
    mutationFn: async (vars: { postId: string; kind: MastermindResponseKind; body?: string }) =>
      apiRequest("POST", `/api/mastermind/posts/${vars.postId}/respond`, {
        kind: vars.kind,
        body: vars.body,
      }),
    onSuccess: () => {
      haptic("success");
      queryClient.invalidateQueries({ queryKey: ["/api/mastermind"] });
      setRespondPostId(null);
      setRespondBody("");
      toast({ title: "Value delivered" });
    },
  });

  const circle = data?.circle;
  const seats = data?.seats ?? [];
  const posts = data?.posts ?? [];
  const responses = data?.responses ?? [];

  const filteredPosts = useMemo(
    () => (feedFilter === "all" ? posts : posts.filter((p) => p.kind === feedFilter)),
    [posts, feedFilter]
  );

  const responsesByPost = useMemo(() => {
    const map = new Map<string, Response[]>();
    for (const r of responses) {
      const arr = map.get(r.postId) ?? [];
      arr.push(r);
      map.set(r.postId, arr);
    }
    return map;
  }, [responses]);

  const totalSeats = seats.length;
  const filledSeats = seats.filter((s) => s.memberUserId).length;

  return (
    <>
      <SEO title="Orbit · SAINTE" description="Your private mastermind orbit." />
      <div className="min-h-screen app-ground pb-32" data-testid="page-mastermind">
        {/* Hero — eyebrow / wordmark / tagline */}
        <header className="px-5 pt-14 pb-6 text-center">
          <p className="text-lime-core text-[11px] tracking-[0.42em] uppercase" data-testid="text-eyebrow">
            SAINTE
          </p>
          <h1
            className="text-fog-100 text-5xl sm:text-6xl tracking-[0.04em] uppercase mt-3"
            style={{ fontFamily: "Chillax, 'Neue Haas Grotesk', Inter, sans-serif", fontWeight: 500 }}
            data-testid="text-mastermind-title"
          >
            MASTERMIND
          </h1>
          <div className="mx-auto mt-3 w-10 h-px bg-mint-300/40" />
          <p className="text-mint-300/80 text-sm mt-3 tracking-[0.06em]" data-testid="text-tagline">
            your circle. your path.
          </p>
          {circle && (
            <div className="mt-5 inline-flex items-center gap-3 text-fog-200/60 text-[10px] tracking-[0.24em] uppercase">
              <span data-testid="text-momentum">{circle.momentumScore} momentum</span>
              <span className="text-mint-300/40">·</span>
              <span>{chemistryLabel(circle.chemistry)}</span>
              <span className="text-mint-300/40">·</span>
              <span>{PATHWAY_LABEL[circle.pathway] ?? "Pathway"}</span>
            </div>
          )}
        </header>

        {/* Orbit canvas */}
        <section className="relative mx-auto" style={{ width: 360, height: 440 }}>
          <OrbitCanvas
            seats={seats}
            onSeatTap={(s) => {
              haptic("tap");
              setSelectedSeat(s);
            }}
            filledCount={filledSeats}
            totalCount={totalSeats}
          />
        </section>

        <div className="px-5 mt-2 flex items-center justify-center gap-3">
          <p className="text-fog-200/60 text-[11px] tracking-[0.2em] uppercase">
            {filledSeats}/{totalSeats} seats filled
          </p>
          {totalSeats < 9 && (
            <div className="flex items-center gap-2">
              <Select value={addSeatRole} onValueChange={setAddSeatRole}>
                <SelectTrigger className="h-9 bg-everglade-800 border-everglade-700 text-fog-100 text-xs" data-testid="select-add-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-everglade-900 border-everglade-700">
                  {MASTERMIND_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="border-everglade-700 text-fog-100"
                onClick={() => addSeatMutation.mutate(addSeatRole)}
                data-testid="button-add-seat"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Seat
              </Button>
            </div>
          )}
        </div>

        {/* Trajectory */}
        <section className="px-5 mt-8">
          <Card
            className="bg-everglade-800 border-everglade-700 p-5 hover-elevate cursor-pointer"
            onClick={() => {
              setTrajectoryDraft({
                trajectory: circle?.trajectory ?? "",
                constraintNow: circle?.constraintNow ?? "",
                successDef: circle?.successDef ?? "",
                pathway: circle?.pathway ?? "entrepreneurship",
              });
              setTrajectoryOpen(true);
            }}
            data-testid="card-trajectory"
          >
            <div className="flex items-center justify-between">
              <p className="text-fog-200/60 text-[10px] tracking-[0.28em] uppercase">Trajectory</p>
              <ChevronRight className="w-4 h-4 text-fog-200/60" />
            </div>
            <p className="text-fog-100 text-base mt-2">
              {circle?.trajectory || "Define the direction you're moving in."}
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <p className="text-fog-200/60 text-[10px] tracking-[0.24em] uppercase">Constraint</p>
                <p className="text-fog-100 text-sm mt-1">{circle?.constraintNow || "—"}</p>
              </div>
              <div>
                <p className="text-fog-200/60 text-[10px] tracking-[0.24em] uppercase">Success looks like</p>
                <p className="text-fog-100 text-sm mt-1">{circle?.successDef || "—"}</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Feed */}
        <section className="px-5 mt-8">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <FilterChip active={feedFilter === "all"} onClick={() => setFeedFilter("all")} label="All" testId="chip-all" />
              <FilterChip active={feedFilter === "signal"} onClick={() => setFeedFilter("signal")} label="Signal" testId="chip-signal" />
              <FilterChip active={feedFilter === "exchange"} onClick={() => setFeedFilter("exchange")} label="Exchange" testId="chip-exchange" />
              <FilterChip active={feedFilter === "activate"} onClick={() => setFeedFilter("activate")} label="Activate" testId="chip-activate" />
            </div>
            <Button
              size="sm"
              onClick={() => {
                setComposeKind(feedFilter === "all" ? "signal" : feedFilter);
                setComposeOpen(true);
              }}
              data-testid="button-compose"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Post
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {isLoading && <p className="text-fog-200/60 text-sm">Loading orbit…</p>}
            {!isLoading && filteredPosts.length === 0 && (
              <Card className="bg-everglade-800 border-everglade-700 p-6">
                <p className="text-fog-200/70 text-sm">
                  Nothing in the orbit yet. Drop a signal, offer an exchange, or activate the circle.
                </p>
              </Card>
            )}
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                responses={responsesByPost.get(post.id) ?? []}
                onRespond={(kind) => {
                  setRespondPostId(post.id);
                  setRespondKind(kind);
                  setRespondBody("");
                }}
              />
            ))}
          </div>
        </section>

        {/* Seat detail sheet */}
        <Sheet open={!!selectedSeat} onOpenChange={(o) => !o && setSelectedSeat(null)}>
          <SheetContent side="bottom" className="bg-everglade-900 border-everglade-700 max-h-[85vh] overflow-y-auto">
            {selectedSeat && (
              <>
                <SheetHeader>
                  <SheetTitle className="text-fog-100">
                    {selectedSeat.memberUserId ? selectedSeat.memberDisplayName || selectedSeat.memberUsername : ROLE_LABEL[selectedSeat.role]}
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="border-everglade-700 text-fog-100">
                      {ROLE_LABEL[selectedSeat.role] ?? selectedSeat.role}
                    </Badge>
                    {selectedSeat.memberUserId && (
                      <Badge variant="outline" className="border-everglade-700 text-mint-300">
                        {gravityLabel(selectedSeat.gravity)}
                      </Badge>
                    )}
                  </div>

                  {selectedSeat.memberUserId ? (
                    <>
                      <div>
                        <p className="text-fog-200/60 text-[10px] tracking-[0.24em] uppercase">Why they're in your orbit</p>
                        <p className="text-fog-100 text-sm mt-1">{selectedSeat.reason || "—"}</p>
                      </div>
                      <div>
                        <p className="text-fog-200/60 text-[10px] tracking-[0.24em] uppercase">Strength they bring</p>
                        <p className="text-fog-100 text-sm mt-1">{selectedSeat.strength || "—"}</p>
                      </div>
                      <div>
                        <p className="text-fog-200/60 text-[10px] tracking-[0.24em] uppercase">Contribution</p>
                        <p className="text-fog-100 text-2xl font-semibold tabular-nums mt-1">
                          {selectedSeat.contributionScore}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-everglade-700 text-fog-100"
                          onClick={() => vacateMutation.mutate(selectedSeat.id)}
                          data-testid="button-vacate-seat"
                        >
                          Vacate seat
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-everglade-700 text-fog-100"
                          onClick={() => removeSeatMutation.mutate(selectedSeat.id)}
                          data-testid="button-remove-seat"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-fog-200/70 text-sm">
                        Invite someone to hold this seat. Quality over count — pick someone who
                        will materially move your trajectory and who you can move in return.
                      </p>
                      <div className="space-y-2">
                        <label className="text-fog-200/60 text-[10px] tracking-[0.24em] uppercase">Member handle</label>
                        <Input
                          value={inviteHandle}
                          onChange={(e) => setInviteHandle(e.target.value)}
                          placeholder="@username"
                          className="bg-everglade-800 border-everglade-700 text-fog-100"
                          data-testid="input-invite-handle"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-fog-200/60 text-[10px] tracking-[0.24em] uppercase">Why they matter</label>
                        <Textarea
                          value={inviteReason}
                          onChange={(e) => setInviteReason(e.target.value)}
                          placeholder="They push your thinking on…"
                          className="bg-everglade-800 border-everglade-700 text-fog-100 min-h-[72px]"
                          data-testid="input-invite-reason"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-fog-200/60 text-[10px] tracking-[0.24em] uppercase">Strength they bring</label>
                        <Input
                          value={inviteStrength}
                          onChange={(e) => setInviteStrength(e.target.value)}
                          placeholder="Distribution, pattern-breaking, capital…"
                          className="bg-everglade-800 border-everglade-700 text-fog-100"
                          data-testid="input-invite-strength"
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={!inviteHandle.trim() || inviteMutation.isPending}
                        onClick={() =>
                          inviteMutation.mutate({
                            seatId: selectedSeat.id,
                            memberUsername: inviteHandle.trim(),
                            reason: inviteReason,
                            strength: inviteStrength,
                          })
                        }
                        data-testid="button-confirm-invite"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Seat them
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-everglade-700 text-fog-100"
                        onClick={() => removeSeatMutation.mutate(selectedSeat.id)}
                        data-testid="button-delete-empty-seat"
                      >
                        Delete this seat
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Compose sheet */}
        <Sheet open={composeOpen} onOpenChange={setComposeOpen}>
          <SheetContent side="bottom" className="bg-everglade-900 border-everglade-700">
            <SheetHeader>
              <SheetTitle className="text-fog-100">New post</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(["signal", "exchange", "activate"] as MastermindPostKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setComposeKind(k)}
                    className={`p-3 rounded-md border text-left hover-elevate ${
                      composeKind === k
                        ? "border-mint-300 bg-everglade-800"
                        : "border-everglade-700 bg-everglade-800/50"
                    }`}
                    data-testid={`button-kind-${k}`}
                  >
                    <p className="text-fog-100 text-[11px] tracking-[0.18em] uppercase">{KIND_LABEL[k]}</p>
                  </button>
                ))}
              </div>
              <p className="text-fog-200/70 text-xs">{KIND_BLURB[composeKind]}</p>
              <Textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder={
                  composeKind === "signal"
                    ? "Closed first enterprise pilot…"
                    : composeKind === "exchange"
                    ? "Sharing a pricing framework that broke us into enterprise…"
                    : "Pressure-test our enterprise pricing model with anyone who's scaled B2B."
                }
                className="bg-everglade-800 border-everglade-700 text-fog-100 min-h-[140px]"
                data-testid="input-compose-body"
              />
              <Button
                className="w-full"
                disabled={!composeBody.trim() || postMutation.isPending}
                onClick={() => postMutation.mutate({ kind: composeKind, body: composeBody.trim() })}
                data-testid="button-submit-post"
              >
                <Send className="w-4 h-4 mr-2" />
                Send to orbit
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Trajectory edit sheet */}
        <Sheet open={trajectoryOpen} onOpenChange={setTrajectoryOpen}>
          <SheetContent side="bottom" className="bg-everglade-900 border-everglade-700">
            <SheetHeader>
              <SheetTitle className="text-fog-100">Lock the trajectory</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-fog-200/60 text-[10px] tracking-[0.24em] uppercase">12-month direction</label>
                <Textarea
                  value={trajectoryDraft.trajectory}
                  onChange={(e) => setTrajectoryDraft({ ...trajectoryDraft, trajectory: e.target.value })}
                  className="bg-everglade-800 border-everglade-700 text-fog-100 min-h-[72px]"
                  data-testid="input-trajectory"
                />
              </div>
              <div className="space-y-2">
                <label className="text-fog-200/60 text-[10px] tracking-[0.24em] uppercase">Current constraint</label>
                <Input
                  value={trajectoryDraft.constraintNow}
                  onChange={(e) => setTrajectoryDraft({ ...trajectoryDraft, constraintNow: e.target.value })}
                  className="bg-everglade-800 border-everglade-700 text-fog-100"
                  data-testid="input-constraint"
                />
              </div>
              <div className="space-y-2">
                <label className="text-fog-200/60 text-[10px] tracking-[0.24em] uppercase">What success looks like</label>
                <Input
                  value={trajectoryDraft.successDef}
                  onChange={(e) => setTrajectoryDraft({ ...trajectoryDraft, successDef: e.target.value })}
                  className="bg-everglade-800 border-everglade-700 text-fog-100"
                  data-testid="input-success"
                />
              </div>
              <div className="space-y-2">
                <label className="text-fog-200/60 text-[10px] tracking-[0.24em] uppercase">Pathway</label>
                <Select
                  value={trajectoryDraft.pathway}
                  onValueChange={(v) => setTrajectoryDraft({ ...trajectoryDraft, pathway: v })}
                >
                  <SelectTrigger className="bg-everglade-800 border-everglade-700 text-fog-100" data-testid="select-pathway">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-everglade-900 border-everglade-700">
                    {MASTERMIND_PATHWAYS.map((p) => (
                      <SelectItem key={p} value={p}>{PATHWAY_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={trajectoryMutation.isPending}
                onClick={() => trajectoryMutation.mutate(trajectoryDraft)}
                data-testid="button-save-trajectory"
              >
                Lock it in
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Respond sheet */}
        <Sheet open={!!respondPostId} onOpenChange={(o) => !o && setRespondPostId(null)}>
          <SheetContent side="bottom" className="bg-everglade-900 border-everglade-700">
            <SheetHeader>
              <SheetTitle className="text-fog-100">{RESPONSE_LABEL[respondKind]}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(RESPONSE_LABEL) as MastermindResponseKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRespondKind(k)}
                    className={`p-2 rounded-md border text-left hover-elevate ${
                      respondKind === k
                        ? "border-mint-300 bg-everglade-800"
                        : "border-everglade-700 bg-everglade-800/50"
                    }`}
                    data-testid={`button-response-${k}`}
                  >
                    <p className="text-fog-100 text-xs">{RESPONSE_LABEL[k]}</p>
                  </button>
                ))}
              </div>
              <Textarea
                value={respondBody}
                onChange={(e) => setRespondBody(e.target.value)}
                placeholder="Optional detail…"
                className="bg-everglade-800 border-everglade-700 text-fog-100 min-h-[100px]"
                data-testid="input-response-body"
              />
              <Button
                className="w-full"
                disabled={respondMutation.isPending}
                onClick={() =>
                  respondPostId &&
                  respondMutation.mutate({
                    postId: respondPostId,
                    kind: respondKind,
                    body: respondBody.trim() || undefined,
                  })
                }
                data-testid="button-submit-response"
              >
                Deliver
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-8 rounded-md border text-[11px] tracking-[0.18em] uppercase hover-elevate ${
        active
          ? "border-mint-300 bg-everglade-800 text-fog-100"
          : "border-everglade-700 bg-everglade-900 text-fog-200/70"
      }`}
      data-testid={testId}
    >
      {label}
    </button>
  );
}

function OrbitCanvas({
  seats,
  onSeatTap,
}: {
  seats: Seat[];
  onSeatTap: (s: Seat) => void;
  filledCount: number;
  totalCount: number;
}) {
  const W = 360;
  const H = 440;
  const cx = W / 2;
  const cy = H / 2;

  return (
    <div className="absolute inset-0">
      {/* Concentric ring field. Background gradient + 6 hairline rings,
          one highlighted as the active "path". */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0">
        <defs>
          <radialGradient id="orbit-bg" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#1a3326" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#12221A" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#0C1712" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="orbit-glow" cx="50%" cy="50%" r="30%">
            <stop offset="0%" stopColor="#C7FF3E" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#C7FF3E" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={Math.min(W, H) / 2} fill="url(#orbit-bg)" />
        <circle cx={cx} cy={cy} r={120} fill="url(#orbit-glow)" />

        {RING_RADII.map((r, i) => {
          const isHighlight = i === HIGHLIGHT_RING;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={isHighlight ? "rgba(199,255,62,0.55)" : "rgba(217,251,217,0.10)"}
              strokeWidth={isHighlight ? 1.25 : 1}
            />
          );
        })}
      </svg>

      {/* User center — large, soft lime ring, gentle breathing */}
      <div
        className="absolute"
        style={{ left: cx - 40, top: cy - 40, width: 80, height: 80 }}
      >
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="w-full h-full rounded-full overflow-hidden ring-2 ring-lime-core/45"
          style={{ boxShadow: "0 0 0 6px rgba(199,255,62,0.06)" }}
        >
          <Avatar className="w-full h-full">
            <AvatarFallback className="bg-everglade-700 text-fog-100 text-xs tracking-[0.18em]">
              YOU
            </AvatarFallback>
          </Avatar>
        </motion.div>
      </div>

      {/* Seat bubbles — pure photo avatars, no labels, ring-bound positions */}
      {seats.map((seat, idx) => {
        const { x, y } = seatPosition(idx, seats.length);
        const isFilled = !!seat.memberUserId;
        const size = 44;
        return (
          <button
            key={seat.id}
            type="button"
            onClick={() => onSeatTap(seat)}
            className="absolute group focus:outline-none"
            style={{
              left: cx + x - size / 2,
              top: cy + y - size / 2,
              width: size,
              height: size,
            }}
            data-testid={`seat-${seat.role}-${idx}`}
            aria-label={`${ROLE_LABEL[seat.role] ?? seat.role} seat`}
          >
            <div
              className={`w-full h-full rounded-full overflow-hidden transition-transform group-active:scale-95 ${
                isFilled
                  ? "ring-1 ring-lime-core/40"
                  : "ring-1 ring-dashed ring-mint-300/30 bg-everglade-900/80"
              }`}
              style={
                isFilled
                  ? { boxShadow: "0 0 0 3px rgba(199,255,62,0.05)" }
                  : undefined
              }
            >
              {isFilled ? (
                <Avatar className="w-full h-full">
                  {seat.memberAvatarUrl && <AvatarImage src={seat.memberAvatarUrl} alt="" />}
                  <AvatarFallback className="bg-everglade-700 text-fog-100 text-[10px]">
                    {(seat.memberDisplayName || seat.memberUsername || "?")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5 text-mint-300/60" />
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PostCard({
  post,
  responses,
  onRespond,
}: {
  post: Post;
  responses: Response[];
  onRespond: (kind: MastermindResponseKind) => void;
}) {
  const kindIcon =
    post.kind === "signal" ? <Radio className="w-3.5 h-3.5" /> : post.kind === "exchange" ? <HandHeart className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />;

  return (
    <Card className="bg-everglade-800 border-everglade-700 p-4" data-testid={`post-${post.id}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Avatar className="w-8 h-8">
            {post.authorAvatarUrl && <AvatarImage src={post.authorAvatarUrl} alt="" />}
            <AvatarFallback className="bg-everglade-700 text-fog-100 text-[10px]">
              {(post.authorDisplayName || post.authorUsername || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-fog-100 text-sm font-medium">
              {post.authorDisplayName || post.authorUsername || "Member"}
            </p>
            <p className="text-fog-200/60 text-[10px] tracking-[0.18em] uppercase">{timeAgo(post.createdAt)}</p>
          </div>
        </div>
        <Badge variant="outline" className="border-everglade-700 text-fog-100 gap-1">
          {kindIcon}
          {KIND_LABEL[post.kind]}
        </Badge>
      </div>
      <p className="text-fog-100 text-sm mt-3 whitespace-pre-wrap">{post.body}</p>

      {responses.length > 0 && (
        <div className="mt-3 pt-3 border-t border-everglade-700 space-y-2">
          {responses.map((r) => (
            <div key={r.id} className="flex items-start gap-2">
              <Avatar className="w-6 h-6">
                {r.responderAvatarUrl && <AvatarImage src={r.responderAvatarUrl} alt="" />}
                <AvatarFallback className="bg-everglade-700 text-fog-100 text-[9px]">
                  {(r.responderDisplayName || r.responderUsername || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-fog-200/80 text-xs">
                  <span className="text-fog-100 font-medium">
                    {r.responderDisplayName || r.responderUsername || "Member"}
                  </span>{" "}
                  · {RESPONSE_LABEL[r.kind]}
                </p>
                {r.body && <p className="text-fog-100 text-sm mt-0.5">{r.body}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {(Object.keys(RESPONSE_LABEL) as MastermindResponseKind[]).slice(0, 4).map((k) => (
          <Button
            key={k}
            variant="outline"
            size="sm"
            className="border-everglade-700 text-fog-100 h-8"
            onClick={() => onRespond(k)}
            data-testid={`button-respond-${k}-${post.id}`}
          >
            {RESPONSE_LABEL[k]}
          </Button>
        ))}
      </div>
    </Card>
  );
}
