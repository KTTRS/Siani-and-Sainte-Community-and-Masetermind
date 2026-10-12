import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, SPRING, EASE, DURATION } from "@/lib/motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SEO, PAGE_SEO } from "@/components/SEO";
import { useToast } from "@/hooks/use-toast";
import { 
  Phone, 
  ChevronRight, 
  Clock, 
  CheckCircle2,
  Mic,
  ArrowLeft,
  Play,
  Pause,
  StopCircle,
  Loader2,
  ArrowUpRight,
  Users
} from "lucide-react";
import { Icons3D } from "@/lib/icons3d";

import heroImg from "@assets/generated_images/sainte_rooftop_night.png";
import professionalHeadshot1 from "@assets/stock_images/professional_headsho_29836af5.jpg";
import professionalHeadshot2 from "@assets/stock_images/professional_headsho_6a6ac3dc.jpg";
import professionalHeadshot3 from "@assets/stock_images/professional_headsho_7bbe2959.jpg";
import professionalBlack1 from "@assets/stock_images/professional_black_m_3e06c141.jpg";
import confidentWoman from "@assets/stock_images/confident_woman_entr_1d2be2a2.jpg";
import flatLayImg from "@assets/generated_images/sainte_flatlay_clean.png";
import clubImg from "@assets/generated_images/sainte_club_clean.png";

const TEAM_AVATARS = [professionalHeadshot1, professionalHeadshot2, professionalHeadshot3, professionalBlack1, confidentWoman];
const CONNECTION_IMAGES = [clubImg, flatLayImg, professionalBlack1, confidentWoman];

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface HQThread {
  id: string;
  caregiverName: string;
  caregiverRole: string;
  caregiverAvatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  priority: "normal" | "high" | "urgent";
  status: "open" | "snoozed" | "closed";
  isVerified: boolean;
}

interface VoiceMessage {
  id: string;
  senderId: "user" | "agent";
  kind: string;
  content: string | null;
  audioUrl: string | null;
  duration: number;
  transcript: string | null;
  createdAt: string;
  isRead: boolean;
}

interface Connection {
  id: string;
  resourceName: string;
  category: string;
  state: string;
  dueDate?: string;
  reward: number;
  notes?: string;
}

function getTimeAgo(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getConnectionStateLabel(state: string): string {
  switch (state) {
    case "proposed": return "PROPOSED";
    case "offered": return "OFFERED";
    case "accepted": return "ACCEPTED";
    case "scheduled": return "SCHEDULED";
    case "in_progress": return "IN PROGRESS";
    case "completed": return "COMPLETED";
    default: return state.toUpperCase();
  }
}

function StatCard({ 
  label, 
  value, 
  iconKey,
  accent = false 
}: { 
  label: string; 
  value: string | number; 
  iconKey: keyof typeof Icons3D;
  accent?: boolean;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className={`flex items-center gap-3 mb-2 ${accent ? "text-earth-2" : "text-earth-4"}`}>
        <img src={Icons3D[iconKey]} alt="" aria-hidden className="w-5 h-5 object-contain" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))' }} />
        <span className="font-condensed text-[11px] tracking-[0.15em]">{label}</span>
      </div>
      <p className="font-stats text-3xl tracking-tight text-earth-1 tabular-nums">
        {value}
      </p>
    </div>
  );
}

function ConnectionCard({ connection, onClick, index = 0 }: { connection: Connection; onClick: () => void; index?: number }) {
  const isActive = connection.state === "in_progress" || connection.state === "accepted";
  const bgImage = CONNECTION_IMAGES[index % CONNECTION_IMAGES.length];
  
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25, ease: EASE.out }}
      onClick={onClick}
    >
      <Card 
        className="relative overflow-hidden border-smoke hover-elevate cursor-pointer group"
        data-testid={`card-connection-${connection.id}`}
      >
        <div className="absolute inset-0">
          <img 
            src={bgImage} 
            alt="" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60" />
        </div>
        
        <div className="relative z-10 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <Badge 
              variant="outline" 
              className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
                isActive 
                  ? 'bg-crimson/20 text-white border-crimson/30' 
                  : 'bg-smoke/80 text-silver border-steel/60'
              }`}
              data-testid={`badge-connection-state-${connection.id}`}
            >
              {getConnectionStateLabel(connection.state)}
            </Badge>
            <ArrowUpRight className="w-4 h-4 text-white/60 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          
          <h3 className="font-display text-xl text-white mb-2 leading-tight" data-testid={`text-connection-name-${connection.id}`}>
            {connection.resourceName}
          </h3>
          
          <p className="text-base text-silver capitalize mb-6" data-testid={`text-connection-category-${connection.id}`}>
            {connection.category}
          </p>
          
          {connection.dueDate && (
            <div className="flex items-center gap-2 text-silver/80">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-medium" data-testid={`text-connection-due-${connection.id}`}>
                {Math.ceil((new Date(connection.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
              </span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function TeamMemberCard({ thread, onClick, index = 0 }: { thread: HQThread; onClick: () => void; index?: number }) {
  const fallbackAvatar = TEAM_AVATARS[index % TEAM_AVATARS.length];
  
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25, ease: EASE.out }}
      onClick={onClick}
    >
      <Card 
        className="card-3d p-8 border-smoke hover-elevate cursor-pointer"
        data-testid={`card-thread-${thread.id}`}
      >
        <div className="flex items-start gap-6">
          <div className="relative flex-shrink-0">
            <Avatar className="w-16 h-16 border-2 border-smoke">
              <AvatarImage src={thread.caregiverAvatar || fallbackAvatar} />
              <AvatarFallback className="bg-graphite text-earth-2 font-bold text-xl">
                {thread.caregiverName.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            {thread.isVerified && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center badge-crimson">
                <CheckCircle2 className="w-3 h-3 text-void" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h3 className="font-display text-xl text-earth-1 truncate" data-testid={`text-thread-name-${thread.id}`}>
                {thread.caregiverName}
              </h3>
              {thread.unreadCount > 0 && (
                <Badge 
                  className="font-bold text-xs px-2.5 py-1 badge-crimson"
                  data-testid={`badge-thread-unread-${thread.id}`}
                >
                  {thread.unreadCount}
                </Badge>
              )}
            </div>
            
            <p className="text-base text-earth-4 font-medium mb-3" data-testid={`text-thread-role-${thread.id}`}>
              {thread.caregiverRole}
            </p>
            
            <p className="text-base text-earth-3 truncate mb-3" data-testid={`text-thread-preview-${thread.id}`}>
              {thread.lastMessage}
            </p>
            
            <span className="text-sm text-earth-5" data-testid={`text-thread-time-${thread.id}`}>
              {getTimeAgo(thread.lastMessageTime)}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function SectionHeader({ 
  title, 
  subtitle,
  action 
}: { 
  title: string; 
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <h2 className="font-condensed text-xs text-earth-4 tracking-[0.2em] mb-1 uppercase">
          {title}
        </h2>
        {subtitle && (
          <p className="text-lg font-bold text-earth-2">{subtitle}</p>
        )}
      </div>
      {action && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-earth-4 hover:text-earth-1 -mr-2"
          onClick={action.onClick}
        >
          {action.label}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-12 px-12 md:px-16 lg:px-32 py-12">
      <div className="space-y-6">
        <Skeleton className="h-4 w-32 bg-smoke" />
        <Skeleton className="h-16 w-80 bg-smoke" />
      </div>
      <div className="flex gap-8 md:gap-12">
        <Skeleton className="h-20 w-24 bg-smoke rounded-lg" />
        <Skeleton className="h-20 w-24 bg-smoke rounded-lg" />
        <Skeleton className="h-20 w-24 bg-smoke rounded-lg" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-40 bg-smoke rounded-2xl" />
        <Skeleton className="h-32 bg-smoke rounded-2xl" />
      </div>
    </div>
  );
}

export default function HQ() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedThread, setSelectedThread] = useState<HQThread | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const { data: threads = [], isLoading: threadsLoading } = useQuery<HQThread[]>({
    queryKey: ['/api/care-team'],
  });

  const { data: connections = [], isLoading: connectionsLoading } = useQuery<Connection[]>({
    queryKey: ['/api/referrals'],
  });

  const isLoading = threadsLoading || connectionsLoading;

  if (selectedThread) {
    return (
      <ThreadView 
        thread={selectedThread} 
        onBack={() => setSelectedThread(null)}
        isRecording={isRecording}
        setIsRecording={setIsRecording}
      />
    );
  }

  const activeConnections = connections.filter(c => 
    c.state === "in_progress" || c.state === "accepted" || c.state === "scheduled"
  );
  const pendingConnections = connections.filter(c => 
    c.state === "proposed" || c.state === "offered"
  );

  return (
    <div className="flex flex-col min-h-full app-ground">
      <SEO {...PAGE_SEO.hq} />
      <div className="pb-20">
        {/* Hero Section with Background */}
        <div className="relative h-[45vh] min-h-[300px]">
          <div className="absolute inset-0">
            <img 
              src={heroImg} 
              alt="" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 hero-wash-strong" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
          </div>
          
          <header className="relative z-10 h-full flex flex-col justify-end px-fluid pb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={fadeUp()}
              className="space-y-2"
            >
              <p className="font-condensed text-fluid-label text-earth-4">
                Members Only
              </p>
              <h1 className="text-broken-display text-fluid-display text-earth-1">
                HQ
              </h1>
              <p className="text-fluid-body text-earth-3">
                Your private hub for connections and support.
              </p>
            </motion.div>
          </header>
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Stats Overview */}
            <section className="px-fluid py-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={fadeUp(0.1)}
                className="flex gap-6"
              >
                <StatCard 
                  label="Active" 
                  value={activeConnections.length} 
                  iconKey="zap"
                  accent
                />
                <StatCard 
                  label="Team" 
                  value={threads.length} 
                  iconKey="users"
                />
                <StatCard 
                  label="Pending" 
                  value={pendingConnections.length} 
                  iconKey="location"
                />
              </motion.div>
            </section>

            {/* Priority Access Card */}
            <section className="px-fluid py-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={fadeUp(0.15)}
              >
                <Card 
                  className="card-float-crimson p-4 border-smoke relative overflow-visible"
                  data-testid="card-priority-line"
                >
                  <div className="absolute -top-2 left-4">
                    <Badge 
                      className="font-bold text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 btn-lime"
                    >
                      Priority Access
                    </Badge>
                  </div>
                  
                  <div className="pt-5">
                    <h3 className="text-broken-display text-xl leading-normal text-earth-1 mb-1">
                      Direct Line
                    </h3>
                    <p className="text-fluid-caption text-earth-3 mb-4">
                      Connect instantly with your team. Available 24/7.
                    </p>
                    
                    <Button 
                      className="font-bold btn-lime touch-target w-full"
                      data-testid="button-priority-connect"
                      onClick={() => toast({ description: "Connecting you now... Please wait for a callback." })}
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Connect Now
                    </Button>
                  </div>
                </Card>
              </motion.div>
            </section>

            {/* Active Connections */}
            {activeConnections.length > 0 && (
              <section className="px-fluid py-3">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={fadeUp(0.2)}
                >
                  <SectionHeader 
                    title="In Progress" 
                    subtitle="Your Active Connections"
                  />
                  
                  <div className="space-y-3">
                    {activeConnections.map((connection, index) => (
                      <motion.div
                        key={connection.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 + index * 0.05 }}
                      >
                        <ConnectionCard 
                          connection={connection}
                          index={index}
                          onClick={() => toast({
                            title: connection.resourceName,
                            description: `Status: ${getConnectionStateLabel(connection.state)}. ${connection.notes || "Your connection is being processed."}`
                          })}
                        />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </section>
            )}

            {/* Your Team */}
            {threads.length > 0 && (
              <section className="px-fluid py-3">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={fadeUp(0.25)}
                >
                  <SectionHeader 
                    title="Your Team" 
                    subtitle="Direct Access"
                  />
                  
                  <div className="space-y-3">
                    {threads.map((thread, index) => (
                      <motion.div
                        key={thread.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                      >
                        <TeamMemberCard 
                          thread={thread}
                          index={index}
                          onClick={() => setSelectedThread(thread)} 
                        />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </section>
            )}

            {/* Pending Opportunities */}
            {pendingConnections.length > 0 && (
              <section className="px-fluid py-3">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={fadeUp(0.3)}
                >
                  <SectionHeader 
                    title="Opportunities" 
                    subtitle="Pending Review"
                  />
                  
                  <div className="space-y-3">
                    {pendingConnections.map((connection, index) => (
                      <motion.div
                        key={connection.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 + index * 0.05 }}
                      >
                        <ConnectionCard 
                          connection={connection}
                          index={index + activeConnections.length}
                          onClick={() => toast({
                            title: connection.resourceName,
                            description: `Status: ${getConnectionStateLabel(connection.state)}. ${connection.notes || "Awaiting review by our team."}`
                          })}
                        />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </section>
            )}

            {/* Membership & Resources Cards */}
            <section className="px-fluid py-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={fadeUp(0.35)}
              >
                <SectionHeader title="Your Access" subtitle="Membership & Resources" />
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.25 }}>
                    <Card 
                      className="p-5 border-smoke hover-elevate cursor-pointer group relative overflow-hidden"
                      onClick={() => setLocation("/membership")}
                      data-testid="card-membership-preview"
                    >
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-crimson/10 to-transparent rounded-bl-full" />
                      <div className="relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-graphite flex items-center justify-center mb-4">
                          <img src={Icons3D.wallet} alt="" aria-hidden className="w-6 h-6 object-contain" />
                        </div>
                        <h3 className="font-bold text-earth-1 text-sm mb-1">Membership</h3>
                        <p className="text-xs text-earth-4">View your card</p>
                        <div className="flex items-center gap-1 mt-3 text-earth-3 group-hover:text-earth-1 transition-colors">
                          <img src={Icons3D.crown} alt="" aria-hidden className="w-3.5 h-3.5 object-contain icon-shadow-subtle" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Active</span>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                  
                  <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.25 }}>
                    <Card 
                      className="p-5 border-smoke hover-elevate cursor-pointer group relative overflow-hidden"
                      onClick={() => setLocation("/resources")}
                      data-testid="card-browse-resources"
                    >
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-lime/10 to-transparent rounded-bl-full" />
                      <div className="relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-graphite flex items-center justify-center mb-4">
                          <img src={Icons3D.document} alt="" aria-hidden className="w-6 h-6 object-contain" />
                        </div>
                        <h3 className="font-bold text-earth-1 text-sm mb-1">Resources</h3>
                        <p className="text-xs text-earth-4">Browse all</p>
                        <div className="flex items-center gap-1 mt-3 text-earth-3 group-hover:text-earth-1 transition-colors">
                          <img src={Icons3D.map} alt="" aria-hidden className="w-3.5 h-3.5 object-contain icon-shadow-subtle" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Explore</span>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                </div>
              </motion.div>
            </section>

            {/* Quick Actions */}
            <section className="px-fluid py-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={fadeUp(0.4)}
              >
                <SectionHeader title="Quick Actions" />
                
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-between h-14 border-smoke bg-charcoal text-silver px-4"
                    data-testid="button-request-callback"
                    onClick={() => toast({ 
                      title: "Callback Requested", 
                      description: "A team member will call you within 24 hours." 
                    })}
                  >
                    <span className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-graphite flex items-center justify-center">
                        <Phone className="w-4 h-4 text-silver" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-white text-fluid-body">Request Callback</p>
                        <p className="text-fluid-label text-steel font-normal">Response within 24 hours</p>
                      </div>
                    </span>
                    <ChevronRight className="w-5 h-5 text-steel" />
                  </Button>
                </div>
              </motion.div>
            </section>

            {/* Empty State */}
            {threads.length === 0 && connections.length === 0 && (
              <section className="px-fluid py-3">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={fadeUp(0.2)}
                >
                  <Card className="p-6 border-smoke bg-charcoal text-center">
                    <div className="w-16 h-16 rounded-full bg-graphite flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-earth-4" />
                    </div>
                    <h3 className="text-broken-display text-fluid-title text-earth-1 mb-2">
                      Your Team is Being Assembled
                    </h3>
                    <p className="text-fluid-body text-earth-4">
                      We're connecting you with the right people.
                    </p>
                  </Card>
                </motion.div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ThreadView({ 
  thread, 
  onBack, 
  isRecording, 
  setIsRecording 
}: { 
  thread: HQThread; 
  onBack: () => void;
  isRecording: boolean;
  setIsRecording: (v: boolean) => void;
}) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const { data: messages = [], isLoading: messagesLoading } = useQuery<VoiceMessage[]>({
    queryKey: ['/api/care-messages', thread.id],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (duration: number) => {
      return apiRequest('POST', '/api/care-messages', {
        threadId: thread.id,
        duration,
        content: "Voice memo",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/care-messages', thread.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-team'] });
    },
  });

  const handleRecordToggle = () => {
    if (isRecording) {
      const duration = recordingDuration;
      setIsRecording(false);
      setRecordingDuration(0);
      
      if (duration > 0) {
        sendMessageMutation.mutate(duration);
      }
    } else {
      setIsRecording(true);
      const interval = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= 60) {
            clearInterval(interval);
            setIsRecording(false);
            sendMessageMutation.mutate(60);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col h-full app-ground">
      {/* Header */}
      <header className="px-4 py-4 border-b border-graphite">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack} 
            className="text-earth-3 -ml-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="relative flex-shrink-0">
            <Avatar className="w-12 h-12 border-2 border-smoke">
              <AvatarImage src={thread.caregiverAvatar} />
              <AvatarFallback className="bg-graphite text-earth-2 font-bold">
                {thread.caregiverName.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            {thread.isVerified && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center badge-crimson">
                <CheckCircle2 className="w-3 h-3 text-void" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-earth-1 truncate" data-testid="text-thread-header-name">
              {thread.caregiverName}
            </h2>
            <p className="text-sm text-earth-4" data-testid="text-thread-header-role">
              {thread.caregiverRole}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-8">
          {/* Voice Only Badge */}
          <div className="text-center mb-8">
            <Badge 
              variant="outline" 
              className="bg-charcoal text-earth-3 border-smoke font-medium text-xs uppercase tracking-[0.1em]"
              data-testid="badge-voice-only"
            >
              <Mic className="w-3 h-3 mr-2" />
              Voice Messages Only
            </Badge>
          </div>
          
          {/* Messages List */}
          <div className="space-y-6">
            {messagesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-earth-4 animate-spin" />
              </div>
            ) : messages.length > 0 ? (
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.senderId === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex items-center gap-4 rounded-2xl px-5 py-4 max-w-[85%] ${
                      msg.senderId === "user"
                        ? "btn-lime rounded-br-md"
                        : "bg-charcoal border border-smoke rounded-bl-md"
                    }`}
                    data-testid={`card-voice-message-${msg.id}`}
                  >
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setPlayingVoice(playingVoice === msg.id ? null : msg.id)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.senderId === "user" ? "bg-everglade-950/20" : "bg-graphite"
                      }`}
                      data-testid={`button-play-voice-${msg.id}`}
                    >
                      {playingVoice === msg.id ? (
                        <Pause className={`w-5 h-5 ${msg.senderId === "user" ? "text-void" : "text-earth-2"}`} />
                      ) : (
                        <Play className={`w-5 h-5 ${msg.senderId === "user" ? "text-void" : "text-earth-2"}`} />
                      )}
                    </motion.button>
                    
                    <div className="flex flex-col min-w-0">
                      <div className="flex gap-0.5">
                        {[...Array(16)].map((_, i) => (
                          <motion.div
                            key={i}
                            className={`w-1 rounded-full ${
                              msg.senderId === "user" ? "bg-everglade-950/30" : "bg-earth-4/40"
                            }`}
                            animate={playingVoice === msg.id ? {
                              height: [4, Math.random() * 20 + 4, 4]
                            } : { height: Math.random() * 14 + 4 }}
                            transition={playingVoice === msg.id ? {
                              duration: 0.3,
                              repeat: Infinity,
                              delay: i * 0.02
                            } : {}}
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-4 mt-2">
                        <span 
                          className={`text-xs font-medium ${
                            msg.senderId === "user" ? "text-void/70" : "text-earth-5"
                          }`}
                          data-testid={`text-voice-duration-${msg.id}`}
                        >
                          0:{msg.duration.toString().padStart(2, "0")}
                        </span>
                        <span 
                          className={`text-xs ${
                            msg.senderId === "user" ? "text-void/50" : "text-earth-5/60"
                          }`}
                          data-testid={`text-voice-time-${msg.id}`}
                        >
                          {getTimeAgo(msg.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-charcoal flex items-center justify-center mx-auto mb-4">
                  <Mic className="w-7 h-7 text-earth-4" />
                </div>
                <p className="text-earth-3 font-medium mb-1">No messages yet</p>
                <p className="text-earth-5 text-sm">Send a voice message to start the conversation</p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Recording Controls */}
      <div className="p-8 border-t border-graphite">
        <div className="flex flex-col items-center">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleRecordToggle}
            disabled={sendMessageMutation.isPending}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              isRecording 
                ? "bg-destructive shadow-lg" 
                : sendMessageMutation.isPending
                  ? "bg-smoke"
                  : "btn-lime shadow-depth-2"
            }`}
            data-testid="button-record-voice"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="w-8 h-8 text-earth-4 animate-spin" />
            ) : isRecording ? (
              <StopCircle className="w-8 h-8 text-white" />
            ) : (
              <Mic className="w-8 h-8 text-void" />
            )}
          </motion.button>
          
          <AnimatePresence mode="wait">
            {isRecording ? (
              <motion.div
                key="recording"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-5 flex flex-col items-center"
              >
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="w-2.5 h-2.5 rounded-full bg-destructive"
                  />
                  <span className="text-xl font-bold text-earth-1 tabular-nums" data-testid="text-recording-duration">
                    0:{recordingDuration.toString().padStart(2, "0")}
                  </span>
                </div>
                <p className="text-xs text-earth-5 mt-2 uppercase tracking-[0.1em]">
                  Tap to stop
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-5 text-center"
              >
                <p className="text-sm text-earth-4 uppercase tracking-[0.1em]">
                  Tap to record
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
