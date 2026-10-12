import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useParams } from "wouter";
import { SEO } from "@/components/SEO";
import { 
  ArrowLeft, 
  Send,
  Loader2,
  Phone,
  MoreVertical,
  Check,
  CheckCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface Message {
  id: string;
  senderId: string;
  senderType: "member" | "provider";
  content: string;
  createdAt: string;
  isRead: boolean;
}

interface CrewMember {
  id: string;
  name: string;
  role: string;
  organization: string;
  avatarUrl?: string;
  isAvailable: boolean;
  phone?: string;
}

export default function CrewChat() {
  const params = useParams<{ crewId: string }>();
  const crewId = params.crewId;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { profile, session } = useAuth();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: crewMember, isLoading: isLoadingCrew } = useQuery<CrewMember>({
    queryKey: ["/api/crew", crewId],
    queryFn: async () => {
      const response = await fetch(`/api/crew/${crewId}`, {
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to load crew member");
      }
      return response.json();
    },
    enabled: !!session?.access_token && !!crewId,
  });

  const { data: messages, isLoading: isLoadingMessages, error: messagesError } = useQuery<Message[]>({
    queryKey: ["/api/crew", crewId, "messages"],
    queryFn: async () => {
      const response = await fetch(`/api/crew/${crewId}/messages`, {
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to load messages");
      }
      return response.json();
    },
    enabled: !!session?.access_token && !!crewId,
    refetchInterval: 5000,
    retry: 2,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/crew/${crewId}/messages`, { content });
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/crew", crewId, "messages"] });
    },
    onError: () => {
      toast({
        title: "Failed to send",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (message.trim() && !sendMutation.isPending) {
      sendMutation.mutate(message.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";

    msgs.forEach((msg) => {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msg.createdAt, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  if (isLoadingCrew) {
    return (
      <div className="page-container app-ground flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-crimson" />
      </div>
    );
  }

  return (
    <div className="page-container app-ground flex flex-col h-screen">
      <SEO 
        title={`Chat with ${crewMember?.name || "Crew"} | SAINTE`}
        description="Direct message with your care team"
      />
      
      <motion.header 
        className="sticky top-0 z-20 px-4 py-3 bg-everglade-950/95 backdrop-blur-sm border-b border-[hsl(var(--rim))]"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/concierge")}
            className="text-silver hover:text-white"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative">
              <Avatar className="w-10 h-10 border-2 border-smoke">
                <AvatarImage src={crewMember?.avatarUrl} />
                <AvatarFallback className="bg-charcoal text-silver font-bold text-sm">
                  {crewMember?.name?.split(" ").map(n => n[0]).join("") || "?"}
                </AvatarFallback>
              </Avatar>
              {crewMember?.isAvailable && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-black" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-white truncate">{crewMember?.name}</p>
              <p className="text-xs text-silver truncate">{crewMember?.role} · {crewMember?.organization}</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-silver hover:text-white"
            onClick={() => {
              if (crewMember?.phone) {
                window.location.href = `tel:${crewMember.phone}`;
              } else {
                toast({ 
                  title: `Call ${crewMember?.name || "Team Member"}`,
                  description: "Phone number not available. Please send a message instead."
                });
              }
            }}
            data-testid="button-call"
          >
            <Phone className="w-5 h-5" />
          </Button>
        </div>
      </motion.header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messagesError ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-12 h-12 rounded-full bg-charcoal flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-crimson" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Unable to load messages</h3>
            <p className="text-sm text-silver mb-4">
              There was a problem connecting. Please try again.
            </p>
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/crew", crewId, "messages"] })}
              className="text-crimson border-crimson hover:bg-crimson/10"
            >
              Retry
            </Button>
          </div>
        ) : isLoadingMessages ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <Skeleton className={`h-16 ${i % 2 === 0 ? "w-2/3" : "w-3/4"} bg-charcoal rounded-2xl`} />
              </div>
            ))}
          </div>
        ) : messages && messages.length > 0 ? (
          <AnimatePresence>
            {groupMessagesByDate(messages).map((group, groupIndex) => (
              <div key={groupIndex}>
                <div className="flex justify-center my-4">
                  <span className="text-[11px] text-steel bg-charcoal/50 px-3 py-1 rounded-full">
                    {formatDate(group.date)}
                  </span>
                </div>
                {group.messages.map((msg, index) => {
                  const isMine = msg.senderType === "member";
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex mb-3 ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[80%] ${isMine ? "order-1" : "order-2"}`}>
                        <div
                          className={`px-4 py-2.5 rounded-2xl ${
                            isMine
                              ? "bg-crimson text-white rounded-br-md"
                              : "bg-charcoal text-white rounded-bl-md"
                          }`}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                          <span className="text-[10px] text-steel">{formatTime(msg.createdAt)}</span>
                          {isMine && (
                            msg.isRead ? (
                              <CheckCheck className="w-3 h-3 text-crimson" />
                            ) : (
                              <Check className="w-3 h-3 text-steel" />
                            )
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <Avatar className="w-20 h-20 border-4 border-smoke mb-4">
              <AvatarImage src={crewMember?.avatarUrl} />
              <AvatarFallback className="bg-charcoal text-silver font-bold text-xl">
                {crewMember?.name?.split(" ").map(n => n[0]).join("") || "?"}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-lg font-bold text-white mb-2">Start a conversation</h3>
            <p className="text-sm text-silver">
              Send a message to {crewMember?.name}. They typically respond within 24 hours.
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="sticky bottom-0 p-4 app-ground border-t border-[hsl(var(--rim))]">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-charcoal rounded-2xl px-4 py-2">
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              className="w-full bg-transparent text-white placeholder-steel text-sm resize-none outline-none min-h-[24px] max-h-[120px]"
              rows={1}
              data-testid="input-message"
            />
          </div>
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
            className="w-10 h-10 rounded-full bg-crimson hover:bg-crimson-deep disabled:opacity-50"
            data-testid="button-send"
          >
            {sendMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
