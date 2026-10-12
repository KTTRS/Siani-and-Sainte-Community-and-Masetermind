import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { SEO } from "@/components/SEO";
import { 
  ArrowLeft, 
  Camera,
  Check,
  Loader2,
  Bell,
  Moon,
  Globe,
  Volume2,
} from "lucide-react";
import { isSoundEnabled, setSoundEnabled, playChime } from "@/lib/useSound";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Icons3D } from "@/lib/icons3d";

interface ProfileUpdateData {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

export default function AccountSettings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { profile, refreshProfile, session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [bio, setBio] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  const [notifications, setNotifications] = useState({
    drops: true,
    signals: true,
    crew: true,
    reminders: true,
  });

  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileUpdateData) => {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update profile");
      return response.json();
    },
    onSuccess: async () => {
      await refreshProfile();
      toast({
        title: "Profile updated",
        description: "Your changes have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "avatar");

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const { url } = await response.json();
      await updateProfileMutation.mutateAsync({ avatarUrl: url });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a display name.",
        variant: "destructive",
      });
      return;
    }

    await updateProfileMutation.mutateAsync({ 
      displayName: displayName.trim(),
      bio: bio.trim() || undefined,
    });
  };

  const handleNotificationChange = (key: keyof typeof notifications, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
    toast({
      description: `${key.charAt(0).toUpperCase() + key.slice(1)} notifications ${value ? "enabled" : "disabled"}.`,
    });
  };

  return (
    <div className="page-container app-ground">
      <SEO 
        title="Account Settings | SAINTE"
        description="Manage your SAINTE account preferences"
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
              <h1 className="text-fluid-title font-black text-white">Account Settings</h1>
              <p className="text-fluid-caption text-silver">Manage your preferences</p>
            </div>
          </div>
        </motion.header>

        <div className="px-fluid py-6 space-y-8">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="section-header mb-4">Profile</p>
            
            <div className="matte-3d p-6 rounded-2xl space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="w-20 h-20 border-2 border-smoke">
                    <AvatarImage src={profile?.avatarUrl || ""} />
                    <AvatarFallback className="bg-charcoal text-silver text-2xl font-black">
                      {(profile?.displayName || "M").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={handleAvatarClick}
                    disabled={isUploading}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-crimson flex items-center justify-center border-2 border-black"
                    data-testid="button-change-avatar"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 text-white" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-fluid-body font-bold text-white">Profile Photo</p>
                  <p className="text-fluid-caption text-silver">Tap to change your photo</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-silver text-fluid-caption font-bold">
                    DISPLAY NAME
                  </Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="bg-charcoal border-smoke text-white placeholder:text-steel focus:border-crimson"
                    data-testid="input-display-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-silver text-fluid-caption font-bold">
                    BIO
                  </Label>
                  <Input
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="A little about yourself"
                    className="bg-charcoal border-smoke text-white placeholder:text-steel focus:border-crimson"
                    data-testid="input-bio"
                  />
                </div>

                <Button
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isPending}
                  className="w-full btn-crimson touch-target mt-4"
                  data-testid="button-save-profile"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <p className="section-header mb-4">Notifications</p>
            
            <div className="matte-3d rounded-2xl overflow-hidden">
              <div className="settings-row p-4 border-b border-smoke/30">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="icon-capsule w-10 h-10 rounded-xl flex items-center justify-center">
                      <img src={Icons3D.ticket} alt="" className="w-6 h-6 object-contain" />
                    </div>
                    <div>
                      <p className="text-fluid-body font-bold text-white">Drops</p>
                      <p className="text-fluid-caption text-silver">New exclusive opportunities</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.drops}
                    onCheckedChange={(v) => handleNotificationChange("drops", v)}
                    data-testid="switch-notifications-drops"
                  />
                </div>
              </div>

              <div className="settings-row p-4 border-b border-smoke/30">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="icon-capsule w-10 h-10 rounded-xl flex items-center justify-center">
                      <img src={Icons3D.zap} alt="" className="w-6 h-6 object-contain" />
                    </div>
                    <div>
                      <p className="text-fluid-body font-bold text-white">Signals</p>
                      <p className="text-fluid-caption text-silver">Community stories & intel</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.signals}
                    onCheckedChange={(v) => handleNotificationChange("signals", v)}
                    data-testid="switch-notifications-signals"
                  />
                </div>
              </div>

              <div className="settings-row p-4 border-b border-smoke/30">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="icon-capsule w-10 h-10 rounded-xl flex items-center justify-center">
                      <img src={Icons3D.community} alt="" className="w-6 h-6 object-contain" />
                    </div>
                    <div>
                      <p className="text-fluid-body font-bold text-white">Crew Messages</p>
                      <p className="text-fluid-caption text-silver">Messages from your team</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.crew}
                    onCheckedChange={(v) => handleNotificationChange("crew", v)}
                    data-testid="switch-notifications-crew"
                  />
                </div>
              </div>

              <div className="settings-row p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="icon-capsule w-10 h-10 rounded-xl flex items-center justify-center">
                      <Bell className="w-5 h-5 text-silver" />
                    </div>
                    <div>
                      <p className="text-fluid-body font-bold text-white">Reminders</p>
                      <p className="text-fluid-caption text-silver">Goal and move reminders</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.reminders}
                    onCheckedChange={(v) => handleNotificationChange("reminders", v)}
                    data-testid="switch-notifications-reminders"
                  />
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <p className="section-header mb-4">Preferences</p>
            
            <div className="matte-3d rounded-2xl overflow-hidden">
              <div className="settings-row p-4 border-b border-smoke/30">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="icon-capsule w-10 h-10 rounded-xl flex items-center justify-center">
                      <Moon className="w-5 h-5 text-silver" />
                    </div>
                    <div>
                      <p className="text-fluid-body font-bold text-white">Dark Mode</p>
                      <p className="text-fluid-caption text-silver">Always on for that night shift vibe</p>
                    </div>
                  </div>
                  <Switch checked={true} disabled data-testid="switch-dark-mode" />
                </div>
              </div>

              <div className="settings-row p-4 border-b border-smoke/30">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="icon-capsule w-10 h-10 rounded-xl flex items-center justify-center">
                      <Volume2 className="w-5 h-5 text-silver" />
                    </div>
                    <div>
                      <p className="text-fluid-body font-bold text-white">Sound</p>
                      <p className="text-fluid-caption text-silver">CRED tick + completion chime</p>
                    </div>
                  </div>
                  <Switch
                    checked={soundOn}
                    onCheckedChange={(v) => {
                      setSoundOn(v);
                      setSoundEnabled(v);
                      if (v) {
                        // Confirmation tone so the user hears what they enabled.
                        setTimeout(() => playChime(), 60);
                      }
                    }}
                    data-testid="switch-sound"
                  />
                </div>
              </div>

              <div className="settings-row p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="icon-capsule w-10 h-10 rounded-xl flex items-center justify-center">
                      <Globe className="w-5 h-5 text-silver" />
                    </div>
                    <div>
                      <p className="text-fluid-body font-bold text-white">Language</p>
                      <p className="text-fluid-caption text-silver">English (US)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
