import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { EditorialEmpty } from "@/components/Editorial";
import { SEO } from "@/components/SEO";
import { PageBackground } from "@/components/PageBackground";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-6">
      <SEO title="Off the map" description="This door doesn't open. Head back to base." path="/404" />
      <PageBackground directionD />
      <div
        className="relative z-10 w-full max-w-md flex flex-col items-stretch gap-6"
        data-testid="page-not-found"
      >
        <EditorialEmpty
          directionD
          serial="SAINTE / 404 / OFF-MAP"
          label="this door doesn't open"
          testId="empty-not-found"
        />
        <div className="flex justify-center">
          <Button
            variant="signal"
            size="lg"
            onClick={() => navigate("/")}
            data-testid="button-return-home"
          >
            Return to base
          </Button>
        </div>
      </div>
    </div>
  );
}
