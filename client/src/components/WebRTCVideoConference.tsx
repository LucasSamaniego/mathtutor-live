import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Users,
  Loader2,
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";

interface WebRTCVideoConferenceProps {
  roomSlug: string;
  sessionId: number | null;
  isHost: boolean;
  oderId: number;
  odername: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  onMuteToggle: () => void;
  onVideoToggle: () => void;
  onScreenShareToggle: () => void;
}

interface RemotePeer {
  socketId: string;
  oderId: number;
  odername: string;
  isHost: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  connection: RTCPeerConnection;
  stream: MediaStream | null;
}

// Free STUN/TURN servers
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  // Free TURN server (limited but works for most cases)
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export function WebRTCVideoConference({
  roomSlug,
  sessionId,
  isHost,
  oderId,
  odername,
  isMuted,
  isVideoOff,
  isScreenSharing,
  onMuteToggle,
  onVideoToggle,
  onScreenShareToggle,
}: WebRTCVideoConferenceProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeer>>(new Map());
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, RemotePeer>>(new Map());

  // Initialize local media stream
  const initLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error("Failed to get local media:", err);
      setError("Não foi possível acessar câmera/microfone. Verifique as permissões.");
      return null;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((
    targetSocketId: string,
    targetUserId: number,
    targetUserName: string,
    targetIsHost: boolean,
    stream: MediaStream
  ): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks to connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("ice-candidate", {
          targetSocketId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle incoming tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream) {
        setRemotePeers((prev) => {
          const updated = new Map(prev);
          const peer = updated.get(targetSocketId);
          if (peer) {
            peer.stream = remoteStream;
            updated.set(targetSocketId, { ...peer });
          }
          return updated;
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${targetUserName}: ${pc.connectionState}`);
      if (pc.connectionState === "failed") {
        toast.error(`Conexão com ${targetUserName} falhou`);
      }
    };

    return pc;
  }, [socket]);

  // Initialize socket connection
  useEffect(() => {
    if (!sessionId) return;

    setIsConnecting(true);
    setError(null);

    const socketInstance = io({
      path: "/api/webrtc",
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", async () => {
      console.log("[WebRTC] Socket connected");
      setIsConnected(true);
      setIsConnecting(false);

      // Initialize local stream first
      const stream = await initLocalStream();
      if (!stream) return;

      // Join the room
      socketInstance.emit("join-room", {
        roomSlug,
        sessionId,
        oderId,
        odername,
        isHost,
      });
    });

    socketInstance.on("disconnect", () => {
      console.log("[WebRTC] Socket disconnected");
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (err) => {
      console.error("[WebRTC] Connection error:", err);
      setError("Erro ao conectar ao servidor de vídeo");
      setIsConnecting(false);
    });

    // Handle existing participants
    socketInstance.on("existing-participants", async (participants: Array<{
      socketId: string;
      oderId: number;
      odername: string;
      isHost: boolean;
      hasVideo: boolean;
      hasAudio: boolean;
    }>) => {
      console.log("[WebRTC] Existing participants:", participants);
      
      for (const participant of participants) {
        if (localStream) {
          await initiateCall(socketInstance, participant.socketId, participant, localStream);
        }
      }
    });

    // Handle new user joining
    socketInstance.on("user-joined", async (data: {
      socketId: string;
      oderId: number;
      odername: string;
      isHost: boolean;
    }) => {
      console.log("[WebRTC] User joined:", data.odername);
      toast.info(`${data.odername} entrou na sala`);
      
      // Create peer entry (connection will be established when they send offer)
      const peer: RemotePeer = {
        socketId: data.socketId,
        oderId: data.oderId,
        odername: data.odername,
        isHost: data.isHost,
        hasVideo: true,
        hasAudio: true,
        connection: null as any,
        stream: null,
      };
      
      peersRef.current.set(data.socketId, peer);
      setRemotePeers(new Map(peersRef.current));
    });

    // Handle user leaving
    socketInstance.on("user-left", (data: { socketId: string }) => {
      const peer = peersRef.current.get(data.socketId);
      if (peer) {
        toast.info(`${peer.odername} saiu da sala`);
        peer.connection?.close();
        peersRef.current.delete(data.socketId);
        setRemotePeers(new Map(peersRef.current));
      }
    });

    // Handle incoming offer
    socketInstance.on("offer", async (data: {
      senderSocketId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      console.log("[WebRTC] Received offer from:", data.senderSocketId);
      
      if (!localStream) return;

      const peer = peersRef.current.get(data.senderSocketId);
      if (!peer) return;

      const pc = createPeerConnection(
        data.senderSocketId,
        peer.oderId,
        peer.odername,
        peer.isHost,
        localStream
      );

      peer.connection = pc;
      peersRef.current.set(data.senderSocketId, peer);

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketInstance.emit("answer", {
        targetSocketId: data.senderSocketId,
        answer: answer,
      });
    });

    // Handle incoming answer
    socketInstance.on("answer", async (data: {
      senderSocketId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      console.log("[WebRTC] Received answer from:", data.senderSocketId);
      
      const peer = peersRef.current.get(data.senderSocketId);
      if (peer?.connection) {
        await peer.connection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    // Handle incoming ICE candidate
    socketInstance.on("ice-candidate", async (data: {
      senderSocketId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const peer = peersRef.current.get(data.senderSocketId);
      if (peer?.connection) {
        try {
          await peer.connection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error("[WebRTC] Error adding ICE candidate:", err);
        }
      }
    });

    // Handle media state changes
    socketInstance.on("participant-media-changed", (data: {
      socketId: string;
      hasVideo: boolean;
      hasAudio: boolean;
    }) => {
      setRemotePeers((prev) => {
        const updated = new Map(prev);
        const peer = updated.get(data.socketId);
        if (peer) {
          peer.hasVideo = data.hasVideo;
          peer.hasAudio = data.hasAudio;
          updated.set(data.socketId, { ...peer });
        }
        return updated;
      });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      peersRef.current.forEach((peer) => {
        peer.connection?.close();
      });
      peersRef.current.clear();
    };
  }, [sessionId, roomSlug, oderId, odername, isHost, initLocalStream, createPeerConnection]);

  // Initiate call to a peer
  const initiateCall = async (
    socketInstance: Socket,
    targetSocketId: string,
    participant: { oderId: number; odername: string; isHost: boolean },
    stream: MediaStream
  ) => {
    const pc = createPeerConnection(
      targetSocketId,
      participant.oderId,
      participant.odername,
      participant.isHost,
      stream
    );

    const peer: RemotePeer = {
      socketId: targetSocketId,
      oderId: participant.oderId,
      odername: participant.odername,
      isHost: participant.isHost,
      hasVideo: true,
      hasAudio: true,
      connection: pc,
      stream: null,
    };

    peersRef.current.set(targetSocketId, peer);
    setRemotePeers(new Map(peersRef.current));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketInstance.emit("offer", {
      targetSocketId,
      offer: offer,
    });
  };

  // Handle mute toggle
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
      socket?.emit("media-state-change", {
        hasVideo: !isVideoOff,
        hasAudio: !isMuted,
      });
    }
  }, [localStream, isMuted, isVideoOff, socket]);

  // Handle video toggle
  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoOff;
      });
      socket?.emit("media-state-change", {
        hasVideo: !isVideoOff,
        hasAudio: !isMuted,
      });
    }
  }, [localStream, isVideoOff, isMuted, socket]);

  // Handle screen sharing
  useEffect(() => {
    if (isScreenSharing && !screenStream) {
      navigator.mediaDevices
        .getDisplayMedia({ video: true, audio: true })
        .then((stream) => {
          setScreenStream(stream);
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = stream;
          }
          socket?.emit("screen-share-started");
          
          // Replace video track in all peer connections
          const videoTrack = stream.getVideoTracks()[0];
          peersRef.current.forEach((peer) => {
            const sender = peer.connection?.getSenders().find(s => s.track?.kind === "video");
            if (sender && videoTrack) {
              sender.replaceTrack(videoTrack);
            }
          });

          stream.getVideoTracks()[0].onended = () => {
            setScreenStream(null);
            socket?.emit("screen-share-stopped");
            onScreenShareToggle();
            
            // Restore camera track
            if (localStream) {
              const cameraTrack = localStream.getVideoTracks()[0];
              peersRef.current.forEach((peer) => {
                const sender = peer.connection?.getSenders().find(s => s.track?.kind === "video");
                if (sender && cameraTrack) {
                  sender.replaceTrack(cameraTrack);
                }
              });
            }
          };
        })
        .catch((err) => {
          console.error("Screen share failed:", err);
          onScreenShareToggle();
        });
    } else if (!isScreenSharing && screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
      socket?.emit("screen-share-stopped");
      
      // Restore camera track
      if (localStream) {
        const cameraTrack = localStream.getVideoTracks()[0];
        peersRef.current.forEach((peer) => {
          const sender = peer.connection?.getSenders().find(s => s.track?.kind === "video");
          if (sender && cameraTrack) {
            sender.replaceTrack(cameraTrack);
          }
        });
      }
    }
  }, [isScreenSharing, screenStream, socket, localStream, onScreenShareToggle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach((track) => track.stop());
      screenStream?.getTracks().forEach((track) => track.stop());
    };
  }, [localStream, screenStream]);

  // Leave call
  const handleLeaveCall = () => {
    socket?.emit("leave-room");
    socket?.disconnect();
    localStream?.getTracks().forEach((track) => track.stop());
    screenStream?.getTracks().forEach((track) => track.stop());
    peersRef.current.forEach((peer) => peer.connection?.close());
    peersRef.current.clear();
    setRemotePeers(new Map());
    setLocalStream(null);
    setScreenStream(null);
    setIsConnected(false);
  };

  // Retry connection
  const handleRetry = () => {
    setError(null);
    window.location.reload();
  };

  // No session state
  if (!sessionId) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <Video className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aguardando sessão</h3>
          <p className="text-muted-foreground">
            {isHost ? "Inicie uma sessão para habilitar a videoconferência" : "Aguardando o professor iniciar a sessão"}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro na videoconferência</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={handleRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Connecting state
  if (isConnecting) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold mb-2">Conectando...</h3>
          <p className="text-muted-foreground">
            Iniciando videoconferência
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate grid layout
  const totalParticipants = 1 + remotePeers.size; // local + remotes
  const getGridClass = () => {
    if (totalParticipants <= 1) return "grid-cols-1";
    if (totalParticipants === 2) return "grid-cols-2";
    if (totalParticipants <= 4) return "grid-cols-2";
    if (totalParticipants <= 6) return "grid-cols-3";
    return "grid-cols-4";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Connection status */}
      <div className="flex items-center justify-between px-3 py-2 bg-card border-b">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
              <Wifi className="h-3 w-3" />
              Conectado
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-red-600 border-red-600">
              <WifiOff className="h-3 w-3" />
              Desconectado
            </Badge>
          )}
        </div>
        <Badge variant="secondary" className="gap-1">
          <Users className="h-3 w-3" />
          {totalParticipants} participante{totalParticipants !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Video Grid */}
      <div className={`flex-1 grid ${getGridClass()} gap-2 p-2 bg-slate-900 rounded-lg overflow-hidden`}>
        {/* Screen share (if active) */}
        {screenStream && (
          <div className="col-span-full relative bg-slate-800 rounded-lg overflow-hidden aspect-video">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            <div className="absolute bottom-2 left-2">
              <Badge variant="secondary">Compartilhamento de tela</Badge>
            </div>
          </div>
        )}

        {/* Local video */}
        <div className="relative bg-slate-800 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
          {!isVideoOff && localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {odername.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-medium">
                Você {isHost && <Badge variant="secondary" className="ml-1 text-xs">Professor</Badge>}
              </span>
              <div className="flex items-center gap-1">
                {isMuted && <MicOff className="h-4 w-4 text-red-400" />}
                {isVideoOff && <VideoOff className="h-4 w-4 text-red-400" />}
              </div>
            </div>
          </div>
        </div>

        {/* Remote participants */}
        {Array.from(remotePeers.values()).map((peer) => (
          <div
            key={peer.socketId}
            className="relative bg-slate-800 rounded-lg overflow-hidden aspect-video flex items-center justify-center"
          >
            {peer.stream && peer.hasVideo ? (
              <video
                autoPlay
                playsInline
                ref={(el) => {
                  if (el && peer.stream) {
                    el.srcObject = peer.stream;
                  }
                }}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {peer.odername.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              <div className="flex items-center justify-between">
                <span className="text-white text-sm font-medium truncate">
                  {peer.odername}
                  {peer.isHost && <Badge variant="secondary" className="ml-1 text-xs">Professor</Badge>}
                </span>
                <div className="flex items-center gap-1">
                  {!peer.hasAudio && <MicOff className="h-4 w-4 text-red-400" />}
                  {!peer.hasVideo && <VideoOff className="h-4 w-4 text-red-400" />}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 p-3 bg-card border-t">
        <Button
          variant={isMuted ? "destructive" : "outline"}
          size="icon"
          onClick={onMuteToggle}
          title={isMuted ? "Ativar microfone" : "Desativar microfone"}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>

        <Button
          variant={isVideoOff ? "destructive" : "outline"}
          size="icon"
          onClick={onVideoToggle}
          title={isVideoOff ? "Ativar câmera" : "Desativar câmera"}
        >
          {isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        </Button>

        {isHost && (
          <Button
            variant={isScreenSharing ? "default" : "outline"}
            size="icon"
            onClick={onScreenShareToggle}
            title={isScreenSharing ? "Parar compartilhamento" : "Compartilhar tela"}
          >
            {isScreenSharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
          </Button>
        )}

        <div className="w-px h-6 bg-border mx-2" />

        <Button
          variant="destructive"
          size="sm"
          onClick={handleLeaveCall}
          title="Sair da chamada"
        >
          <PhoneOff className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );
}
