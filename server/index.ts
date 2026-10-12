import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { initializeDatabase, createPerformanceIndexes, assertSchemaIntegrity } from "./db-init";
import { closeDatabase } from "./db";
import { wireRealtimeBroadcaster } from "./services/realtimeBroadcaster";
import { startRetentionWorker, stopRetentionWorker } from "./retentionWorker";
import { requestId } from "./middleware/requestId";
import path from "path";

const PROJECT_ROOT = process.cwd();
const IS_PROD = process.env.NODE_ENV === "production";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Request correlation id (must run before logger / handlers)
app.use(requestId);

// Security headers + CSP. CSP is strict but allows the SAINTE first-party
// service surface: Supabase (REST + Realtime websockets), OpenAI, ElevenLabs,
// Expo push, and PWA self-hosted assets. In dev we relax CSP because Vite HMR
// uses inline scripts + ws://.
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: IS_PROD
      ? {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            fontSrc: ["'self'", "data:"],
            mediaSrc: ["'self'", "blob:", "data:", "https://*.elevenlabs.io"],
            workerSrc: ["'self'", "blob:"],
            manifestSrc: ["'self'"],
            connectSrc: [
              "'self'",
              "https://*.supabase.co",
              "wss://*.supabase.co",
              "https://api.openai.com",
              "https://api.elevenlabs.io",
              "wss://api.elevenlabs.io",
              "https://exp.host",
              "https://*.expo.dev",
              "https://*.expo.io",
            ],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,
  }),
);

app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Serve attached_assets as static files (stock images, etc.)
app.use('/attached_assets', express.static(path.resolve(PROJECT_ROOT, 'attached_assets')));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// HTTP access log. Intentionally does NOT capture response bodies to prevent
// leakage of PII, auth tokens, or member data into logs. Each line carries the
// request id so server-side errors can be correlated with client reports.
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;

  res.on("finish", () => {
    if (!reqPath.startsWith("/api")) return;
    const duration = Date.now() - start;
    const id = req.requestId ? ` rid=${req.requestId}` : "";
    log(`${req.method} ${reqPath} ${res.statusCode} in ${duration}ms${id}`);
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);
  
  // Initialize database tables if they don't exist
  await initializeDatabase();
  // Fail fast if FK cascades aren't what shared/schema.ts promises —
  // initializeDatabase reconciles them, so this acts as a tripwire for
  // any future schema drift we don't have a reconcile entry for.
  await assertSchemaIntegrity();
  createPerformanceIndexes().catch(console.warn);

  // Wire in-process eventBus consumers (audit log + crisis signal surface).
  // Idempotent and never throws.
  wireRealtimeBroadcaster();

  // Background data-retention worker (Task #52) — prunes expired vault
  // confessions and old raw messages / emotional_states on a recurring
  // interval, archiving aggregate snapshots to the data lake first.
  startRetentionWorker();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error(`[${status}] ${message}`, err.stack || "");
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  let isShuttingDown = false;
  const shutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log(`${signal} received, shutting down gracefully`);
    try { stopRetentionWorker(); } catch {}
    httpServer.close(async () => {
      try { await closeDatabase(); } catch {}
      log("Shutdown complete");
      process.exit(0);
    });
    setTimeout(() => {
      log("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
  });
})();
