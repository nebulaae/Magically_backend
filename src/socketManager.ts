import { Server as SocketIOServer, Socket } from 'socket.io';

// This map will store which user belongs to which socket ID
const userSocketMap = new Map<string, string>();

export const initializeSocketIO = (io: SocketIOServer) => {
    io.on('connection', (socket: Socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // The frontend should emit this event with the user's ID upon connecting
        socket.on('registerUser', (userId: string) => {
            if (userId) {
                console.log(`Registering user ${userId} to socket ${socket.id}`);
                userSocketMap.set(userId, socket.id);
            }
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
            // Clean up the map on disconnect
            for (const [userId, socketId] of userSocketMap.entries()) {
                if (socketId === socket.id) {
                    userSocketMap.delete(userId);
                    break;
                }
            }
        });
    });
};

export const getUserSocketId = (userId: string): string | undefined => {
    return userSocketMap.get(userId);
};