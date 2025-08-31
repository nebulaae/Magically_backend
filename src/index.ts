import cors from 'cors';
import path from 'path';
import http from 'http';
import dotenv from 'dotenv';
import express from 'express';
import db from './config/database';
import cookieParser from 'cookie-parser';

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
import galleryRoutes from './routes/gallery';
import commentRoutes from './routes/comment';
import replicateRoutes from './routes/replicate';
import higgsfieldRoutes from './routes/higgsfield';
import publicationRoutes from './routes/publication';

dotenv.config()

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"]
  }
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

// Routes
app.use('/api/fal', falRoutes);
app.use('/api/gpt', gptRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/kling', klingRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/replicate', replicateRoutes);
app.use('/api/higgsfield', higgsfieldRoutes);
app.use('/api/publications', publicationRoutes);

// Initialize WebSocket Manager
initializeSocketIO(io);

// Initialize database and start server
const startServer = async () => {
  try {
    setupAssociations();

    await db.sync({ alter: true });
    console.log('Database synchronized');

    // Start the server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      // Start the background worker AFTER the server is running
      startJobPoller(io);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer();