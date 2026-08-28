import express, { Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env";
import authRoutes from "./routes/auth-routes";
import sparksRoutes from "./routes/sparks-routes";
import settingsRoutes from "./routes/settings-routes";
import childrenRoutes from "./routes/children-routes";
import shiftsRoutes from "./routes/shifts-routes";
import analyticsRoutes from "./routes/analytics-routes";
import festivalRoutes from "./routes/festival-routes";
import { errorHandler } from "./middleware/error";
import { maintenanceGate } from "./middleware/maintenance";
import * as appStateController from "./controllers/app-state-controller";

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

// Состояние приложения — открыто всем и работает даже на техобслуживании:
// по нему клиент решает, показывать заглушку или сайт.
app.get("/api/state", appStateController.state);
app.put("/api/state/maintenance", appStateController.setMaintenance);

// Фестиваль — отдельная от искр подсистема (биатлон по кругу, свои участники
// и судьи). Стоит до техобслуживания: заглушка в искрах не должна гасить экран
// показа посреди мероприятия.
app.use("/api/festival", festivalRoutes);

// Ниже — всё, что закрывается на техобслуживании. Админ проходит.
app.use(maintenanceGate);

app.use("/api/auth", authRoutes);
app.use("/api/sparks", sparksRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/children", childrenRoutes);
app.use("/api/shifts", shiftsRoutes);
app.use("/api/analytics", analyticsRoutes);

// Must be last: turns AppError into JSON responses.
app.use(errorHandler);

export default app;
