import cors from "cors";
import path from "path";
import http from "http";
import dotenv from "dotenv";
import express from "express";
import mainRouter from "./router";
import cookieParser from "cookie-parser";
import db from "../shared/config/database";
import logger from "../shared/utils/logger";
import promBundle from "express-prom-bundle";

import { pinoHttp } from "pino-http";
import { Server as SocketIOServer } from "socket.io";
import { createAdmin } from "../shared/scripts/createAdmin";
import { startJobPoller } from "../shared/workers/jobPoller";
import { seedTestData } from "../shared/scripts/seedTestData";
import { setupAssociations } from "../shared/models/associations";
import { initializeSocketIO } from "../shared/utils/socketManager";

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
app.use(cookieParser());
app.use(express.json());
app.use(metricsMiddleware);
app.use(express.urlencoded({ extended: true }));
app.use("/api/v1/", mainRouter);
app.use(express.static(path.join(__dirname, "../../public")));
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

    server.listen(PORT, () => {
      logger.info(`Server successfully started and running on port ${PORT}`);
      startJobPoller(io);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
  }
};

startServer().then((r) => logger.info("Server started"));
