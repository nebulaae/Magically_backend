import cors from 'cors';
import path from 'path';
import http from 'http';
import YAML from 'yamljs';
import dotenv from 'dotenv';
import express from 'express';
import db from './config/database';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import promBundle from 'express-prom-bundle';

import { initializeSocketIO } from './socketManager';
import { Server as SocketIOServer } from 'socket.io';
import { startJobPoller } from './workers/jobPoller';
import { setupAssociations } from './models/associations';

// Import routes
import falRoutes from './routes/fal';
import gptRoutes from './routes/gpt';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import adminRoutes from './routes/admin';
import klingRoutes from './routes/kling';
import searchRoutes from './routes/search';
import galleryRoutes from './routes/gallery';
import commentRoutes from './routes/comment';
import replicateRoutes from './routes/replicate';
import higgsfieldRoutes from './routes/higgsfield';
import publicationRoutes from './routes/publication';

dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const swaggerSpec = YAML.load(path.join(__dirname, "../swagger.yaml"));

const metricsMiddleware = promBundle({
    includeMethod: true, 
    includePath: true, 
    includeStatusCode: true, 
    includeUp: true,
    promClient: {
        collectDefaultMetrics: {}
    }
});
app.use(metricsMiddleware);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// API Documentation Route
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Refactored Routes
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/fal', falRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/gpt', gptRoutes);
app.use('/api/higgsfield', higgsfieldRoutes);
app.use('/api/kling', klingRoutes);
app.use('/api/publications', publicationRoutes);
app.use('/api/replicate', replicateRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/users', userRoutes);


// Initialize WebSocket Manager
initializeSocketIO(io);

// Initialize database and start server
const startServer = async () => {
  try {
    setupAssociations();
    await db.sync({ alter: true });
    console.log('Database synchronized');

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API documentation available at http://localhost:${PORT}/api/docs`);
      startJobPoller(io);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer();
