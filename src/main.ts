import cors from "cors";
import path from "path";
import http from "http";
import dotenv from "dotenv";
import express from "express";
import passport from "passport";
import mainRouter from "./router";
import cookieParser from "cookie-parser";
import db from "../shared/config/database";
import logger from "../shared/utils/logger";
import promBundle from "express-prom-bundle";
import "../shared/config/passport";

import { pinoHttp } from "pino-http";
import { PUBLIC_ROOT } from "../shared/utils/paths";
import { Server as SocketIOServer } from "socket.io";
import { createAdmin } from "../shared/scripts/createAdmin";
import { startJobPoller } from "../shared/workers/jobPoller";
import { seedTestData } from "../shared/scripts/seedTestData";
import { setupAssociations } from "../shared/models/associations";
import { initializeSocketIO } from "../shared/utils/socketManager";
import { verifyTelegramWebAppData } from "../shared/utils/telegram";

dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  promClient: {
    collectDefaultMetrics: {},
  },
});
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  process.env.ADMIN_URL || "http://localhost:3001",
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(passport.initialize());
app.use(cookieParser());
app.use(express.json());
app.use(metricsMiddleware);
app.use(express.urlencoded({ extended: true }));
app.use("/api/v1/", mainRouter);
app.use(express.static(PUBLIC_ROOT));
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === "/api/v1/health" },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
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

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize associations
    setupAssociations();
    // Initialize database
    await db.sync({ alter: true });
    logger.info("Database synchronized");
    // Initialize socket
    initializeSocketIO(io);
    logger.info("Socket initialized");

    // Seed
    // await seedTestData();
    // Admin
    await createAdmin();
    // Test init data validator
    const initdata = "query_id=AAFevahKAgAAAF69qErhU833&user=%7B%22id%22%3A5547539806%2C%22first_name%22%3A%22Aim%C3%A9%22%2C%22last_name%22%3A%22%22%2C%22username%22%3A%22somewrld%22%2C%22language_code%22%3A%22ru%22%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2Fv3dyeQ-u8bYcCju3QKhxRNYTh9efeZ8I3F8Kz7nDT7zRS8t_CL5xOSslhg68NJkC.svg%22%7D&auth_date=1769285445&signature=55B-HDTbxjevD-DzL0xunWqVAeXntlF-BgxoBJa0qku3WrVMV1lLoTTp1j7uVpSgAm5HSleqeDZp8F4R89JWBg&hash=8e868e222748a6fd11fa96017167d2d785934955ebdc1a27f276135eb8e73f95";

    await verifyTelegramWebAppData(initdata);

    server.listen(PORT, () => {
      logger.info(`Server successfully started and running on port ${PORT}`);
      startJobPoller(io);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
  }
};

startServer().then((r) => logger.info("Server started"));
