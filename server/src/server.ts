import express, { Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env";
import authRoutes from "./routes/auth-routes";
import sparksRoutes from "./routes/sparks-routes";
import settingsRoutes from "./routes/settings-routes";
import { errorHandler } from "./middleware/error";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin:
      env.corsOrigin === "*" ? "*" : env.corsOrigin.split(",").map((o) => o.trim()),
  }),
);
app.use(express.json());

app.get("/", (_req: Request, res: Response): void => {
  res.send("Server is running. Sparks all over the place!!!");
});

app.use("/api/auth", authRoutes);
app.use("/api/sparks", sparksRoutes);
app.use("/api/settings", settingsRoutes);

// Must be last: turns AppError into JSON responses.
app.use(errorHandler);

export default app;
