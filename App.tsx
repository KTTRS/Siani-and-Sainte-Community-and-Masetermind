import { Switch, Route, useLocation, Link, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CelebrationProvider } from "@/lib/celebrations";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from "framer-motion";
import { useNativeShell } from "@/hooks/useNativeShell";
import { 
  Download,
  WifiOff,
  Loader2,
} from "lucide-react";
import { CornerMenu } from "@/components/CornerMenu";
import { lazy, Suspense, useEffect, useState } from "react";
import { EASE, DURATION, SPRING } from "@/lib/motion";
import { haptic } from "@/lib/haptics";

// Lazy load pages for better initial load performance
const Home = lazy(() => import("@/pages/Home"));
const ForYou = lazy(() => import("@/pages/ForYou"));
const HQ = lazy(() => import("@/pages/HQ"));
const Bag = lazy(() => import("@/pages/Bag"));
const Profile = lazy(() => import("@/pages/Profile"));
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const RequestInvite = lazy(() => import("@/pages/RequestInvite"));
const OnboardingRitual = lazy(() => import("@/pages/OnboardingRitual"));
const MembershipCard = lazy(() => import("@/pages/MembershipCard"));
const EventCheckIn = lazy(() => import("@/pages/EventCheckIn"));
const Resources = lazy(() => import("@/pages/Resources"));
const VaultConfessions = lazy(() => import("@/pages/VaultConfessions"));
const HeatIndex = lazy(() => import("@/pages/HeatIndex"));
const TheDrop = lazy(() => import("@/pages/TheDrop"));
const Signal = lazy(() => import("@/pages/Signal"));
const Mastermind = lazy(() => import("@/pages/Mastermind"));
const PayerDashboard = lazy(() => import("@/pages/dashboard/PayerDashboard"));
const ProviderDashboard = lazy(() => import("@/pages/dashboard/ProviderDashboard"));
const AccountSettings = lazy(() => import("@/pages/AccountSettings"));
const PrivacySecurity = lazy(() => import("@/pages/PrivacySecurity"));
const ConciergeLine = lazy(() => import("@/pages/ConciergeLine"));
const CrewChat = lazy(() => import("@/pages/CrewChat"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center app-ground">
      <Loader2 className="h-8 w-8 animate-spin text-mint-200" />
    </div>
  );
}

const pageTransitionConfig = {
  duration: DURATION.page,
  ease: EASE.out,
};

const pageVariants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      duration: pageTransitionConfig.duration, 
      ease: pageTransitionConfig.ease 
    } 
  },
  exit: { 
    opacity: 0, 
    scale: 1.02,
    transition: { 
      duration: pageTransitionConfig.duration * 0.6,
      ease: pageTransitionConfig.ease 
    } 
  }
};

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className = "" }: PageTransitionProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`min-h-full ${className}`}
    >
      {children}
    </motion.div>
  );
}

type LazyComponent = React.LazyExoticComponent<() => JSX.Element | null>;

function ProtectedRoute({ component: Component, skipOnboarding = false }: { component: LazyComponent; skipOnboarding?: boolean }) {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const [location] = useLocation();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-ground">
        <Loader2 className="h-8 w-8 animate-spin text-mint-200" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  if (!skipOnboarding && profile && !profile.onboardingComplete && location !== "/welcome") {
    return <Redirect to="/welcome" />;
  }
  
  return <Component />;
}

function PublicRoute({ component: Component }: { component: LazyComponent }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-ground">
        <Loader2 className="h-8 w-8 animate-spin text-mint-200" />
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Redirect to="/" />;
  }
  
  return <Component />;
}

function AnimatedRoutes() {
  const [location] = useLocation();
  
  return (
    <Suspense fallback={<PageLoader />}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="min-h-full"
        >
          <Switch location={location}>
            {/* Public routes */}
            <Route path="/login">{() => <PublicRoute component={Login} />}</Route>
            <Route path="/signup">{() => <PublicRoute component={Signup} />}</Route>
            <Route path="/forgot-password">{() => <PublicRoute component={ForgotPassword} />}</Route>
            <Route path="/request-invite">{() => <PublicRoute component={RequestInvite} />}</Route>
            
            {/* Protected routes - specific paths BEFORE "/" */}
            <Route path="/welcome">{() => <ProtectedRoute component={OnboardingRitual} skipOnboarding />}</Route>
            <Route path="/flow">{() => <ProtectedRoute component={ForYou} />}</Route>
            <Route path="/hq">{() => <ProtectedRoute component={HQ} />}</Route>
            <Route path="/bag">{() => <ProtectedRoute component={Bag} />}</Route>
            <Route path="/resources">{() => <ProtectedRoute component={Resources} />}</Route>
            <Route path="/vault">{() => <ProtectedRoute component={VaultConfessions} />}</Route>
            <Route path="/heat">{() => <ProtectedRoute component={HeatIndex} />}</Route>
            <Route path="/drop">{() => <ProtectedRoute component={TheDrop} />}</Route>
            <Route path="/signal">{() => <ProtectedRoute component={Signal} />}</Route>
            <Route path="/mastermind">{() => <ProtectedRoute component={Mastermind} />}</Route>
            <Route path="/profile">{() => <ProtectedRoute component={Profile} />}</Route>
            <Route path="/membership">{() => <ProtectedRoute component={MembershipCard} />}</Route>
            <Route path="/door">{() => <ProtectedRoute component={EventCheckIn} />}</Route>
            <Route path="/event-check-in">{() => <ProtectedRoute component={EventCheckIn} />}</Route>
            <Route path="/dashboard/payer">{() => <ProtectedRoute component={PayerDashboard} />}</Route>
            <Route path="/dashboard/provider">{() => <ProtectedRoute component={ProviderDashboard} />}</Route>
            <Route path="/settings">{() => <ProtectedRoute component={AccountSettings} />}</Route>
            <Route path="/privacy">{() => <ProtectedRoute component={PrivacySecurity} />}</Route>
            <Route path="/concierge">{() => <ProtectedRoute component={ConciergeLine} />}</Route>
            <Route path="/crew/:crewId/chat">{() => <ProtectedRoute component={CrewChat} />}</Route>
            
            {/* Home route MUST be last (before NotFound) - "/" matches everything */}
            <Route path="/">{() => <ProtectedRoute component={Home} />}</Route>
            <Route component={NotFound} />
          </Switch>
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}

function InstallPrompt({ onDismiss, onInstall }: { onDismiss: () => void; onInstall: () => void }) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0, transition: { duration: DURATION.fast, ease: EASE.out } }}
      transition={SPRING.sheet}
      className="fixed bottom-24 left-4 right-4 z-50"
    >
      <div 
        className="p-4 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, #1A1A1A 0%, #111 100%)',
          border: '1px solid rgba(199,255,62,0.3)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex items-center gap-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ 
              background: 'linear-gradient(135deg, #A7E9BC 0%, #28513A 100%)',
            }}
          >
            <Download className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white">Install SAINTE</h3>
            <p className="text-xs text-gray-400 mt-0.5">Add to home screen for the full experience</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => { haptic('soft'); onDismiss(); }}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              data-testid="button-dismiss-install"
            >
              Later
            </button>
            <button
              onClick={() => { haptic('click'); onInstall(); }}
              className="px-4 py-1.5 text-xs font-bold rounded-lg"
              style={{ 
                background: 'linear-gradient(180deg, #E6FFE8 0%, #A7E9BC 100%)',
                color: '#0C1712',
              }}
              data-testid="button-install-app"
            >
              Install
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function OfflineBanner() {
  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0, transition: { duration: DURATION.fast, ease: EASE.out } }}
      transition={SPRING.soft}
      className="fixed top-0 left-0 right-0 z-50"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div 
        className="mx-4 mt-2 px-4 py-2 rounded-xl flex items-center justify-center gap-2 bg-everglade-700 border border-[hsl(var(--rim))]"
      >
        <WifiOff className="w-4 h-4 text-white" />
        <span className="text-xs font-medium text-white">No connection - Some features unavailable</span>
      </div>
    </motion.div>
  );
}

function NativeAppShell() {
  const { isOnline, canInstall, promptInstall, isStandalone } = useNativeShell();
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);

  const isAuthPage = ['/login', '/signup', '/forgot-password'].includes(location);

  useEffect(() => {
    const dismissed = localStorage.getItem('sainte-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        setInstallDismissed(true);
      }
    }
  }, []);

  useEffect(() => {
    if (canInstall && !isStandalone && !installDismissed) {
      const timer = setTimeout(() => {
        setShowInstallPrompt(true);
        haptic('rise');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [canInstall, isStandalone, installDismissed]);

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
    setInstallDismissed(true);
    localStorage.setItem('sainte-install-dismissed', Date.now().toString());
  };

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      setShowInstallPrompt(false);
    }
  };

  return (
    <div 
      className="flex min-h-screen flex-col app-ground"
      style={{ 
        color: 'rgba(240,240,240,0.95)',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <AnimatePresence>
        {!isOnline && <OfflineBanner />}
      </AnimatePresence>

      <main 
        className="flex-1 overflow-y-auto relative z-0"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: isAuthPage ? '0px' : 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        <AnimatedRoutes />
      </main>
      
      {!isAuthPage && <CornerMenu />}

      <AnimatePresence>
        {showInstallPrompt && !isAuthPage && (
          <InstallPrompt 
            onDismiss={handleDismissInstall} 
            onInstall={handleInstall}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MotionShell({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <MotionConfig
      reducedMotion="user"
      transition={reduce ? { duration: 0 } : { duration: DURATION.base, ease: EASE.out }}
    >
      {children}
    </MotionConfig>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <AuthProvider>
            <CelebrationProvider>
              <MotionShell>
                <NativeAppShell />
              </MotionShell>
            </CelebrationProvider>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
