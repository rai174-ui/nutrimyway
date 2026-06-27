import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve the built admin frontend when ADMIN_STATIC is set (local / ngrok mode)
const adminStatic = process.env.ADMIN_STATIC;
if (adminStatic) {
  const adminDir = path.resolve(adminStatic);
  app.use("/admin", express.static(adminDir));
  // SPA fallback — all /admin/* routes serve index.html
  app.get("/admin/*splat", (_req, res) => {
    res.sendFile(path.join(adminDir, "index.html"));
  });
  logger.info({ adminDir }, "Serving admin static files");
}

export default app;
