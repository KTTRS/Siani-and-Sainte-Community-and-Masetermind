import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { supabaseConfigError } from "./lib/supabase";

interface BoundaryState {
  error: Error | null;
}

class RootErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RootErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0C1712",
          color: "#F6F8F7",
          fontFamily:
            "'Neue Haas Grotesk', 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "48px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: 520, width: "100%" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              color: "#A7E9BC",
              marginBottom: 12,
              textTransform: "uppercase",
            }}
          >
            SAINTE · SIGNAL INTERRUPTED
          </div>
          <h1
            style={{
              fontSize: 28,
              lineHeight: 1.1,
              margin: "0 0 16px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Something blocked the interface from loading.
          </h1>
          <p style={{ color: "#E9EEEC", opacity: 0.78, marginBottom: 20 }}>
            Pull to refresh, or sign out and back in. If it keeps happening, the
            error below will help us fix it.
          </p>
          <pre
            style={{
              background: "#193024",
              border: "1px solid #1F3E2D",
              borderRadius: 12,
              padding: 14,
              fontSize: 12,
              color: "#F6F8F7",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
            }}
          >
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => {
              try {
                if ("caches" in window) {
                  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
                }
                if ("serviceWorker" in navigator) {
                  navigator.serviceWorker
                    .getRegistrations()
                    .then((regs) => regs.forEach((r) => r.unregister()))
                    .finally(() => window.location.reload());
                  return;
                }
              } catch {}
              window.location.reload();
            }}
            style={{
              marginTop: 20,
              width: "100%",
              padding: "14px 20px",
              borderRadius: 999,
              border: "1px solid rgba(231,255,182,0.35)",
              background: "#C7FF3E",
              color: "#0C1712",
              fontWeight: 700,
              letterSpacing: "0.14em",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            RESET &amp; RELOAD
          </button>
        </div>
      </div>
    );
  }
}

function ConfigNotice({ message }: { message: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0C1712",
        color: "#F6F8F7",
        fontFamily:
          "'Neue Haas Grotesk', 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        padding: "48px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: 520, width: "100%" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            color: "#A7E9BC",
            marginBottom: 12,
            textTransform: "uppercase",
          }}
        >
          SAINTE · CONFIG MISSING
        </div>
        <h1 style={{ fontSize: 26, lineHeight: 1.1, margin: "0 0 12px", fontWeight: 600 }}>
          The app is missing a required setting.
        </h1>
        <p style={{ color: "#E9EEEC", opacity: 0.8 }}>
          {message}. Set this secret in the deployment and republish.
        </p>
      </div>
    </div>
  );
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      })
      .catch(() => {});
  });
}

// Auto-recover from stale-deploy chunk failures. After a deploy, Vite's
// hashed chunks change; an open tab still references the old hashes and
// throws "Unable to preload CSS for /assets/..." or "Failed to fetch
// dynamically imported module". One-shot reload (guarded by sessionStorage
// to prevent loops) pulls the fresh index.html + chunk graph.
function handleStaleChunk(reason: string) {
  const key = "sainte:stale-chunk-reload";
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, String(Date.now()));
  console.warn("[stale-chunk] reloading once:", reason);
  try {
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  } catch {}
  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .finally(() => window.location.reload());
      return;
    }
  } catch {}
  window.location.reload();
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  handleStaleChunk("vite:preloadError");
});

window.addEventListener("error", (event) => {
  const msg = event.message || "";
  if (
    msg.includes("Unable to preload CSS") ||
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module")
  ) {
    handleStaleChunk(msg);
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const msg = String(event.reason?.message || event.reason || "");
  if (
    msg.includes("Unable to preload CSS") ||
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module")
  ) {
    handleStaleChunk(msg);
  }
});

const rootEl = document.getElementById("root")!;
createRoot(rootEl).render(
  <RootErrorBoundary>
    {supabaseConfigError ? <ConfigNotice message={supabaseConfigError} /> : <App />}
  </RootErrorBoundary>,
);
