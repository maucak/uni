import sourceManagementRoutes from "./routes/source-management.ts";
import authRoutes from "./routes/auth.ts";
import catalogRoutes from "./routes/catalog.ts";
import preferenceRoutes from "./routes/preferences.ts";
import communityRoutes from "./routes/community.ts";
import experienceRoutes from "./routes/experiences.ts";
import advisorRoutes from "./routes/advisor.ts";
import lifeRoutes from "./routes/life.ts";
import verificationRoutes from "./routes/verification.ts";
import adminRoutes from "./routes/admin.ts";
import {
  scheduleDocumentCleanup,
  seedEmailDomains,
} from "./services/verification.ts";
import notificationRoutes from "./routes/notifications.ts";
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pool } from "./db.ts";
import { applyAdminEmails, session } from "./auth.ts";
const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production" ? undefined : false,
  }),
);
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());
const origin = process.env.WEB_ORIGIN || "http://127.0.0.1:5173";
app.use("/api", (req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin !== origin
  )
    return res.status(403).json({
      code: "ORIGIN_REJECTED",
      message: "İstek kaynağı doğrulanamadı.",
    });
  next();
});
app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    limit: 150,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      code: "RATE_LIMIT",
      message: "Çok fazla istek. Biraz sonra tekrar dene.",
    },
  }),
);
app.use(session);
const api = express.Router();
app.use("/api/v1", api);
api.get("/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok", version: "0.1.0" });
});
api.use(
  authRoutes,
  catalogRoutes,
  preferenceRoutes,
  communityRoutes,
  experienceRoutes,
  advisorRoutes,
  lifeRoutes,
  notificationRoutes,
  sourceManagementRoutes,
  verificationRoutes,
  adminRoutes,
);
app.use("/api", (_req, res) =>
  res
    .status(404)
    .json({ code: "NOT_FOUND", message: "API adresi bulunamadı." }),
);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
}
app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        code: "VALIDATION",
        message: "Alanları kontrol et.",
        fieldErrors: error.issues.map(
          (i) => `${i.path.join(".")}: ${i.message}`,
        ),
      });
    if (error.type === "entity.too.large")
      return res.status(413).json({
        code: "TOO_LARGE",
        message: "İstek gövdesi çok büyük. Belgeler en fazla 5 MB olabilir.",
      });
    if (error.type === "entity.parse.failed")
      return res
        .status(400)
        .json({ code: "INVALID_JSON", message: "Geçersiz istek gövdesi." });
    const requestId = randomUUID();
    if (!error.status) console.error(`[${requestId}]`, error.message);
    res.status(error.status || 500).json({
      code: error.code && error.status ? error.code : "INTERNAL",
      message: error.status
        ? error.message
        : "İşlem tamamlanamadı. Tekrar dene.",
      requestId,
      ...(Number.isInteger(error.providerStatus)
        ? { providerStatus: error.providerStatus }
        : {}),
    });
  },
);
await applyAdminEmails();
await seedEmailDomains();
scheduleDocumentCleanup();
const server = app.listen(Number(process.env.PORT || 3001), "127.0.0.1", () =>
  console.log(`API hazır: http://127.0.0.1:${process.env.PORT || 3001}`),
);
function shutdown() {
  server.close(() => void pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
