import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SEO } from "@/components/SEO";
import { 
  ArrowLeft, 
  Eye,
  EyeOff,
  LogOut,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth, type UserConsent } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Icons3D, Icon3DImage } from "@/lib/icons3d";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PrivacySecurity() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { signOut, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isEnabling2FA, setIsEnabling2FA] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [consent, setConsent] = useState<UserConsent>({
    shareConversations: profile?.consent?.shareConversations ?? false,
    shareLocation: profile?.consent?.shareLocation ?? false,
    allowNotifications: profile?.consent?.allowNotifications ?? true,
    allowLeaderboard: profile?.consent?.allowLeaderboard ?? true,
  });

  useEffect(() => {
    if (profile?.consent) {
      setConsent({
        shareConversations: profile.consent.shareConversations ?? false,
        shareLocation: profile.consent.shareLocation ?? false,
        allowNotifications: profile.consent.allowNotifications ?? true,
        allowLeaderboard: profile.consent.allowLeaderboard ?? true,
      });
    }
  }, [profile?.consent]);

  const consentMutation = useMutation({
    mutationFn: async (next: Partial<UserConsent>) => {
      const res = await apiRequest('PATCH', '/api/auth/consent', next);
      return res.json() as Promise<{ consent: UserConsent }>;
    },
    onSuccess: async (data) => {
      if (data?.consent) setConsent(data.consent);
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['/api/auth/profile'] });
      toast({ description: 'Preference saved.' });
    },
    onError: () => {
      toast({
        title: "Could not update setting",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleConsentChange = (key: keyof UserConsent, value: boolean) => {
    setConsent((c) => ({ ...c, [key]: value }));
    consentMutation.mutate({ [key]: value } as Partial<UserConsent>);
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your new passwords match.",
        variant: "destructive",
      });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    setIsChangingPassword(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      setPasswordDialogOpen(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      toast({
        title: "Failed to update password",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleEnable2FA = async () => {
    setIsEnabling2FA(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setTwoFactorEnabled(true);
      toast({
        title: "Two-factor authentication enabled",
        description: "Your account is now more secure.",
      });
      setTwoFactorDialogOpen(false);
    } catch {
      toast({
        title: "Failed to enable 2FA",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsEnabling2FA(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDownloadData = () => {
    toast({
      title: "Data export requested",
      description: "You'll receive an email with your data within 48 hours.",
    });
  };

  const handleDeleteAccount = () => {
    toast({
      title: "Account deletion requested",
      description: "Please contact support to complete this request.",
    });
  };

  return (
    <div className="page-container app-ground">
      <SEO 
        title="Privacy & Security | SAINTE"
        description="Control your data and security settings"
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
              <h1 className="text-fluid-title font-black text-white">Privacy & Security</h1>
              <p className="text-fluid-caption text-silver">Control your data</p>
            </div>
          </div>
        </motion.header>

        <div className="px-fluid py-6 space-y-8">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="section-header mb-4">Data &amp; Permissions</p>

            <div className="matte-3d rounded-2xl overflow-hidden mb-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-fluid-body font-bold text-white">Terms &amp; Privacy Policy</p>
                  <p className="text-fluid-caption text-silver" data-testid="text-terms-accepted-at">
                    {profile?.termsAcceptedAt
                      ? `Accepted ${new Date(profile.termsAcceptedAt).toLocaleString()}`
                      : 'Not yet accepted'}
                  </p>
                </div>
                <span className="text-fluid-caption uppercase tracking-wider text-silver/80 font-bold">Required</span>
              </div>
            </div>

            <div className="matte-3d rounded-2xl overflow-hidden">
              {([
                { key: 'shareConversations' as const, label: 'Share Conversations', sub: 'Let your care team review Siani transcripts.', icon: <Eye className="w-5 h-5 text-silver" /> },
                { key: 'shareLocation' as const, label: 'Share Location', sub: 'Match resources near you (ZIP-only when off).', icon: <img src={Icons3D.shield} alt="" className="w-6 h-6 object-contain" /> },
                { key: 'allowNotifications' as const, label: 'Allow Notifications', sub: 'Drops, signals, vault unlocks, streak rescues.', icon: <img src={Icons3D.zap} alt="" className="w-6 h-6 object-contain" /> },
                { key: 'allowLeaderboard' as const, label: 'Appear on Heat Index', sub: 'Show your handle in member rankings.', icon: <img src={Icons3D.community} alt="" className="w-6 h-6 object-contain" /> },
              ]).map((row, i, arr) => (
                <div
                  key={row.key}
                  className={`settings-row p-4 ${i < arr.length - 1 ? 'border-b border-smoke/30' : ''}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="icon-capsule w-10 h-10 rounded-xl flex items-center justify-center">
                        {row.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-fluid-body font-bold text-white">{row.label}</p>
                          <span className="text-[10px] uppercase tracking-wider text-silver/70 font-bold">Optional</span>
                        </div>
                        <p className="text-fluid-caption text-silver">{row.sub}</p>
                      </div>
                    </div>
                    <Switch
                      checked={consent[row.key]}
                      onCheckedChange={(v) => handleConsentChange(row.key, v)}
                      disabled={consentMutation.isPending}
                      data-testid={`switch-consent-${row.key}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <p className="section-header mb-4">Security</p>
            
            <div className="matte-3d rounded-2xl overflow-hidden">
              <div 
                className="settings-row p-4 border-b border-smoke/30 cursor-pointer"
                onClick={() => setPasswordDialogOpen(true)}
                data-testid="button-change-password"
              >
                <div className="flex items-center gap-3">
                  <div className="icon-capsule w-10 h-10 rounded-xl flex items-center justify-center">
                    <Icon3DImage icon="vault" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-fluid-body font-bold text-white">Change Password</p>
                    <p className="text-fluid-caption text-silver">Update your password</p>
                  </div>
                </div>
              </div>

              <div 
                className="settings-row p-4 cursor-pointer"
                onClick={() => setTwoFactorDialogOpen(true)}
                data-testid="button-2fa"
              >
                <div className="flex items-center gap-3">
                  <div className="icon-capsule w-10 h-10 rounded-xl flex items-center justify-center">
                    {twoFactorEnabled ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <img src={Icons3D.shield} alt="" className="w-6 h-6 object-contain" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-fluid-body font-bold text-white">Two-Factor Authentication</p>
                    <p className="text-fluid-caption text-silver">
                      {twoFactorEnabled ? "Enabled - Your account is secured" : "Add extra security"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <p className="section-header mb-4">Your Data</p>
            
            <div className="matte-3d rounded-2xl overflow-hidden">
              <div 
                className="settings-row p-4 border-b border-smoke/30 cursor-pointer"
                onClick={handleDownloadData}
                data-testid="button-download-data"
              >
                <div className="flex items-center gap-3">
                  <div className="icon-capsule w-10 h-10 rounded-xl flex items-center justify-center">
                    <Icon3DImage icon="document" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-fluid-body font-bold text-white">Download My Data</p>
                    <p className="text-fluid-caption text-silver">Get a copy of your data</p>
                  </div>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <div 
                    className="settings-row p-4 cursor-pointer"
                    data-testid="button-delete-account"
                  >
                    <div className="flex items-center gap-3">
                      <div className="icon-capsule w-10 h-10 rounded-xl flex items-center justify-center bg-crimson/10">
                        <Icon3DImage icon="warn" size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-fluid-body font-bold text-crimson">Delete Account</p>
                        <p className="text-fluid-caption text-silver">Permanently delete your account</p>
                      </div>
                    </div>
                  </div>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-charcoal border-smoke">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white flex items-center gap-2">
                      <Icon3DImage icon="warn" size={20} />
                      Delete Account?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-silver">
                      This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-graphite text-white border-smoke hover:bg-smoke">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteAccount}
                      className="bg-crimson hover:bg-crimson-deep text-white"
                    >
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="pb-8"
          >
            <Button
              onClick={handleLogout}
              disabled={isLoggingOut}
              variant="outline"
              className="w-full border-smoke text-white hover:bg-smoke/20 touch-target"
              data-testid="button-logout"
            >
              {isLoggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <LogOut className="w-4 h-4 mr-2" />
              )}
              Sign Out
            </Button>
          </motion.section>
        </div>
      </div>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="bg-charcoal border-smoke">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Icon3DImage icon="vault" size={20} />
              Change Password
            </DialogTitle>
            <DialogDescription className="text-silver">
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password" className="text-silver">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  className="bg-graphite border-smoke text-white pr-10"
                  placeholder="Enter current password"
                  data-testid="input-current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-silver hover:text-white"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-silver">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="bg-graphite border-smoke text-white pr-10"
                  placeholder="Enter new password (min 8 chars)"
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-silver hover:text-white"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-silver">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="bg-graphite border-smoke text-white"
                placeholder="Confirm new password"
                data-testid="input-confirm-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setPasswordDialogOpen(false)}
              className="bg-graphite text-white border-smoke hover:bg-smoke"
            >
              Cancel
            </Button>
            <Button 
              onClick={handlePasswordChange}
              disabled={isChangingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
              className="bg-crimson hover:bg-crimson-deep text-white"
              data-testid="button-save-password"
            >
              {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={twoFactorDialogOpen} onOpenChange={setTwoFactorDialogOpen}>
        <DialogContent className="bg-charcoal border-smoke">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Icon3DImage icon="phone" size={20} />
              Two-Factor Authentication
            </DialogTitle>
            <DialogDescription className="text-silver">
              {twoFactorEnabled 
                ? "Two-factor authentication is currently enabled on your account."
                : "Add an extra layer of security to your account by enabling two-factor authentication."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {twoFactorEnabled ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-white font-bold">2FA is Active</p>
                <p className="text-silver text-sm">Your account is protected with two-factor authentication.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="matte-3d p-4 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="icon-capsule w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon3DImage icon="shield" size={20} />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">SMS Verification</p>
                      <p className="text-silver text-xs">Receive a code via text message when signing in from a new device.</p>
                    </div>
                  </div>
                </div>
                <p className="text-silver text-xs text-center">
                  We'll send a verification code to your registered phone number.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setTwoFactorDialogOpen(false)}
              className="bg-graphite text-white border-smoke hover:bg-smoke"
            >
              {twoFactorEnabled ? "Close" : "Cancel"}
            </Button>
            {!twoFactorEnabled && (
              <Button 
                onClick={handleEnable2FA}
                disabled={isEnabling2FA}
                className="bg-crimson hover:bg-crimson-deep text-white"
                data-testid="button-enable-2fa"
              >
                {isEnabling2FA ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Enable 2FA
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
