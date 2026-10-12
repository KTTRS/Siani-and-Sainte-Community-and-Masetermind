import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { SEO } from "@/components/SEO";
import { 
  ArrowLeft, 
  Phone,
  MessageCircle,
  Clock,
  ChevronRight,
  Headphones,
  Heart,
  Shield,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Icons3D } from "@/lib/icons3d";

interface CrewMember {
  id: string;
  name: string;
  role: string;
  organization: string;
  avatarUrl?: string;
  isAvailable: boolean;
  lastActive?: string;
  specialties: string[];
}

interface SupportOption {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  action: string;
  urgent?: boolean;
}

export default function ConciergeLine() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { profile, session } = useAuth();
  const [selectedCrew, setSelectedCrew] = useState<string | null>(null);

  const { data: crewMembers, isLoading: isLoadingCrew } = useQuery<CrewMember[]>({
    queryKey: ["/api/crew"],
    queryFn: async () => {
      const response = await fetch("/api/crew", {
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
        },
      });
      if (!response.ok) {
        return [];
      }
      return response.json();
    },
    enabled: !!session?.access_token,
  });

  const supportOptions: SupportOption[] = [
    {
      id: "crisis",
      icon: Icons3D.heart,
      title: "Crisis Support",
      subtitle: "24/7 immediate help",
      action: "call",
      urgent: true,
    },
    {
      id: "siani",
      icon: Icons3D.star,
      title: "Talk to Siani",
      subtitle: "Your AI companion",
      action: "chat",
    },
    {
      id: "resources",
      icon: Icons3D.community,
      title: "Browse Resources",
      subtitle: "Find local support",
      action: "navigate",
    },
  ];

  const handleCrewMessage = (crewId: string) => {
    const member = crewMembers?.find(m => m.id === crewId);
    if (member) {
      toast({
        title: `Message to ${member.name}`,
        description: "Opening conversation...",
      });
      navigate(`/crew/${crewId}/chat`);
    }
  };

  const handleSupportAction = (option: SupportOption) => {
    switch (option.action) {
      case "call":
        toast({
          title: "Crisis Line",
          description: "Connecting to 988 Suicide & Crisis Lifeline...",
        });
        window.location.href = "tel:988";
        break;
      case "chat":
        navigate("/");
        break;
      case "navigate":
        navigate("/resources");
        break;
    }
  };

  const demoCrewMembers: CrewMember[] = [
    {
      id: "crew-1",
      name: "Marcus Johnson",
      role: "Care Navigator",
      organization: "Detroit Health Connect",
      avatarUrl: "https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&w=200",
      isAvailable: true,
      specialties: ["Housing", "Benefits"],
    },
    {
      id: "crew-2",
      name: "Keisha Williams",
      role: "Community Health Worker",
      organization: "Neighborhood Services",
      avatarUrl: "https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg?auto=compress&w=200",
      isAvailable: true,
      lastActive: "2 hours ago",
      specialties: ["Mental Health", "Family Support"],
    },
    {
      id: "crew-3",
      name: "Andre Thompson",
      role: "Case Manager",
      organization: "Wayne County Services",
      avatarUrl: "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&w=200",
      isAvailable: false,
      lastActive: "Yesterday",
      specialties: ["Employment", "Legal Aid"],
    },
  ];

  const displayCrew = crewMembers?.length ? crewMembers : demoCrewMembers;

  return (
    <div className="page-container app-ground">
      <SEO 
        title="Concierge Line | SAINTE"
        description="Direct access to your support team"
      />
      <div className="page-content">
        <motion.header 
          className="sticky top-0 z-20 px-fluid py-4 bg-everglade-950/90 backdrop-blur-sm border-b border-[hsl(var(--rim))]"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/profile")}
              className="text-silver hover:text-white"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-fluid-title font-black text-white">Concierge Line</h1>
              <p className="text-fluid-caption text-silver">Direct access to your team</p>
            </div>
          </div>
        </motion.header>

        <div className="px-fluid py-6 space-y-8">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="matte-3d-crimson p-5 rounded-2xl relative overflow-hidden">
              <div className="absolute -top-3 left-4">
                <Badge className="badge-crimson font-condensed text-[10px] px-3 py-1 flex items-center gap-1.5">
                  <Headphones className="w-3 h-3" />
                  <span className="tracking-wide">YOUR CREW</span>
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 pt-4">
                <div className="w-14 h-14 rounded-full bg-crimson-subtle flex items-center justify-center">
                  <img src={Icons3D.community} alt="" className="w-9 h-9 object-contain" />
                </div>
                <div className="flex-1">
                  <h2 className="text-fluid-h3 font-black text-white">Real People. Real Help.</h2>
                  <p className="text-fluid-body text-silver">
                    Your crew is here for you - case managers, navigators, and coordinators from your connected organizations.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <p className="section-header mb-4">Quick Support</p>
            
            <div className="space-y-2">
              {supportOptions.map((option, index) => (
                <motion.div
                  key={option.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.05 }}
                >
                  <div
                    className={`list-item-3d p-4 rounded-xl cursor-pointer ${
                      option.urgent ? "border border-crimson/30" : ""
                    }`}
                    onClick={() => handleSupportAction(option)}
                    data-testid={`button-support-${option.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`icon-capsule w-11 h-11 rounded-xl flex items-center justify-center ${
                        option.urgent ? "bg-crimson/20" : ""
                      }`}>
                        <img src={option.icon} alt="" className="w-7 h-7 object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-fluid-body font-bold ${
                          option.urgent ? "text-crimson" : "text-white"
                        }`}>{option.title}</p>
                        <p className="text-fluid-caption text-silver">{option.subtitle}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-silver" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <p className="section-header">Your Crew</p>
                <p className="text-fluid-caption text-silver mt-1">
                  People from organizations you're connected to
                </p>
              </div>
            </div>
            
            {isLoadingCrew ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24 bg-charcoal rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {displayCrew.map((member, index) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                  >
                    <div
                      className="list-item-3d p-4 rounded-xl cursor-pointer"
                      onClick={() => handleCrewMessage(member.id)}
                      data-testid={`card-crew-${member.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="w-12 h-12 border-2 border-smoke">
                            <AvatarImage src={member.avatarUrl} />
                            <AvatarFallback className="bg-charcoal text-silver font-bold">
                              {member.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-charcoal ${
                            member.isAvailable ? "bg-green-500" : "bg-steel"
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-fluid-body font-bold text-white">{member.name}</p>
                            {member.isAvailable && (
                              <span className="text-[10px] text-green-400 font-bold">ONLINE</span>
                            )}
                          </div>
                          <p className="text-fluid-caption text-silver">{member.role}</p>
                          <p className="text-fluid-caption text-steel">{member.organization}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-10 h-10 rounded-full bg-charcoal hover:bg-crimson/20"
                          data-testid={`button-message-${member.id}`}
                        >
                          <MessageCircle className="w-5 h-5 text-silver" />
                        </Button>
                      </div>
                      
                      {member.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pl-15">
                          {member.specialties.map(specialty => (
                            <span
                              key={specialty}
                              className="text-[10px] px-2 py-1 rounded-full bg-smoke/50 text-silver font-medium"
                            >
                              {specialty}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {displayCrew.length === 0 && (
                  <div className="matte-3d p-8 rounded-2xl text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-charcoal flex items-center justify-center">
                      <img src={Icons3D.community} alt="" className="w-10 h-10 object-contain opacity-50" />
                    </div>
                    <h3 className="text-fluid-body font-bold text-white mb-2">No Crew Yet</h3>
                    <p className="text-fluid-caption text-silver mb-4">
                      When you connect with organizations through referrals, their team members will appear here.
                    </p>
                    <Button
                      onClick={() => navigate("/resources")}
                      className="btn-crimson touch-target"
                      data-testid="button-find-resources"
                    >
                      Browse Resources
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="pb-8"
          >
            <div className="matte-3d p-5 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="icon-capsule w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-silver" />
                </div>
                <div>
                  <h3 className="text-fluid-body font-bold text-white mb-1">Response Times</h3>
                  <p className="text-fluid-caption text-silver">
                    Most crew members respond within 24 hours during business days. For urgent needs, use the Crisis Support option above.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
