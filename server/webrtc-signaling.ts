import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

interface Participant {
  socketId: string;
  oderId: number;
  odername: string;
  isHost: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
}

interface Room {
  sessionId: number;
  participants: Map<string, Participant>;
}

// Store active rooms
const rooms = new Map<string, Room>();

export function initializeWebRTCSignaling(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/webrtc",
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[WebRTC] Client connected: ${socket.id}`);

    // Join a room
    socket.on("join-room", (data: {
      roomSlug: string;
      sessionId: number;
      oderId: number;
      odername: string;
      isHost: boolean;
    }) => {
      const { roomSlug, sessionId, oderId, odername, isHost } = data;
      const roomKey = `${roomSlug}-${sessionId}`;

      // Create room if it doesn't exist
      if (!rooms.has(roomKey)) {
        rooms.set(roomKey, {
          sessionId,
          participants: new Map(),
        });
      }

      const room = rooms.get(roomKey)!;

      // Add participant
      const participant: Participant = {
        socketId: socket.id,
        oderId,
        odername,
        isHost,
        hasVideo: true,
        hasAudio: true,
      };

      room.participants.set(socket.id, participant);
      socket.join(roomKey);

      console.log(`[WebRTC] ${odername} joined room ${roomKey}`);

      // Notify existing participants about new user
      socket.to(roomKey).emit("user-joined", {
        socketId: socket.id,
        oderId,
        odername,
        isHost,
      });

      // Send list of existing participants to new user
      const existingParticipants = Array.from(room.participants.entries())
        .filter(([id]) => id !== socket.id)
        .map(([id, p]) => ({
          socketId: id,
          oderId: p.oderId,
          odername: p.odername,
          isHost: p.isHost,
          hasVideo: p.hasVideo,
          hasAudio: p.hasAudio,
        }));

      socket.emit("existing-participants", existingParticipants);

      // Store room key in socket for cleanup
      (socket as any).roomKey = roomKey;
    });

    // WebRTC signaling: offer
    socket.on("offer", (data: {
      targetSocketId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      const { targetSocketId, offer } = data;
      console.log(`[WebRTC] Offer from ${socket.id} to ${targetSocketId}`);
      
      io.to(targetSocketId).emit("offer", {
        senderSocketId: socket.id,
        offer,
      });
    });

    // WebRTC signaling: answer
    socket.on("answer", (data: {
      targetSocketId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      const { targetSocketId, answer } = data;
      console.log(`[WebRTC] Answer from ${socket.id} to ${targetSocketId}`);
      
      io.to(targetSocketId).emit("answer", {
        senderSocketId: socket.id,
        answer,
      });
    });

    // WebRTC signaling: ICE candidate
    socket.on("ice-candidate", (data: {
      targetSocketId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const { targetSocketId, candidate } = data;
      
      io.to(targetSocketId).emit("ice-candidate", {
        senderSocketId: socket.id,
        candidate,
      });
    });

    // Media state updates
    socket.on("media-state-change", (data: {
      hasVideo: boolean;
      hasAudio: boolean;
    }) => {
      const roomKey = (socket as any).roomKey;
      if (!roomKey) return;

      const room = rooms.get(roomKey);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (participant) {
        participant.hasVideo = data.hasVideo;
        participant.hasAudio = data.hasAudio;

        // Broadcast to all other participants in the room
        socket.to(roomKey).emit("participant-media-changed", {
          socketId: socket.id,
          hasVideo: data.hasVideo,
          hasAudio: data.hasAudio,
        });
      }
    });

    // Screen sharing state
    socket.on("screen-share-started", () => {
      const roomKey = (socket as any).roomKey;
      if (roomKey) {
        socket.to(roomKey).emit("participant-screen-share", {
          socketId: socket.id,
          isSharing: true,
        });
      }
    });

    socket.on("screen-share-stopped", () => {
      const roomKey = (socket as any).roomKey;
      if (roomKey) {
        socket.to(roomKey).emit("participant-screen-share", {
          socketId: socket.id,
          isSharing: false,
        });
      }
    });

    // Leave room
    socket.on("leave-room", () => {
      handleDisconnect(socket);
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      handleDisconnect(socket);
    });
  });

  function handleDisconnect(socket: Socket) {
    const roomKey = (socket as any).roomKey;
    if (!roomKey) return;

    const room = rooms.get(roomKey);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (participant) {
      console.log(`[WebRTC] ${participant.odername} left room ${roomKey}`);
    }

    room.participants.delete(socket.id);
    socket.leave(roomKey);

    // Notify other participants
    socket.to(roomKey).emit("user-left", {
      socketId: socket.id,
    });

    // Clean up empty rooms
    if (room.participants.size === 0) {
      rooms.delete(roomKey);
      console.log(`[WebRTC] Room ${roomKey} deleted (empty)`);
    }
  }

  console.log("[WebRTC] Signaling server initialized on /api/webrtc");
  return io;
}
