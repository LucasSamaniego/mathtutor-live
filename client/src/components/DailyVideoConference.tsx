import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DailyIframe, { DailyCall, DailyParticipant } from "@daily-co/daily-js";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Phone,
  PhoneOff,
  Users,
  Loader2,
  AlertCircle,
  Settings,
  RefreshCw,
} from "lucide-react";

interface DailyVideoConferenceProps {
  roomSlug: string;
  sessionId: number | null;
  isHost: boolean;
  participantName: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  onMuteToggle: () => void;
  onVideoToggle: () => void;
  onScreenShareToggle: () => void;
}

interface ParticipantState {
  id: string;
  name: string;
  video: boolean;
  audio: boolean;
  screen: boolean;
  local: boolean;
}

// Local WebRTC fallback component when Daily.co is not configured
function LocalVideoFallback({
  participantName,
  isMuted,
  isVideoOff,
  isScreenSharing,
  onMuteToggle,
  onVideoToggle,
  onScreenShareToggle,
  isHost,
}: {
  participantName: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  onMuteToggle: () => void;
  onVideoToggle: () => void;
  onScreenShareToggle: () => void;
  isHost: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize local video
  useEffect(() => {
    let stream: MediaStream | null = null;

    const initVideo = async () => {
      try {
        setIsLoading(true);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setError(null);
      } catch (err) {
        console.error("Failed to get media:", err);
        setError("Não foi possível acessar a câmera/microfone");
      } finally {
        setIsLoading(false);
      }
    };

    initVideo();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Handle mute toggle
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }, [localStream, isMuted]);

  // Handle video toggle
  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoOff;
      });
    }
  }, [localStream, isVideoOff]);

  // Handle screen sharing
  useEffect(() => {
    if (isScreenSharing && !screenStream) {
      navigator.mediaDevices
        .getDisplayMedia({ video: true, audio: true })
        .then((stream) => {
          setScreenStream(stream);
          if (screenRef.current) {
            screenRef.current.srcObject = stream;
          }
          stream.getVideoTracks()[0].onended = () => {
            setScreenStream(null);
            onScreenShareToggle();
          };
        })
        .catch((err) => {
          console.error("Screen share failed:", err);
          onScreenShareToggle();
        });
    } else if (!isScreenSharing && screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
    }
  }, [isScreenSharing, screenStream, onScreenShareToggle]);

  if (isLoading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold mb-2">Iniciando câmera...</h3>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro</h3>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Video Area */}
      <div className="flex-1 grid grid-cols-1 gap-2 p-2 bg-slate-900 rounded-lg overflow-hidden">
        {/* Screen share (if active) */}
        {screenStream && (
          <div className="relative bg-slate-800 rounded-lg overflow-hidden aspect-video">
            <video
              ref={screenRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
            <div className="absolute bottom-2 left-2">
              <Badge variant="secondary">Compartilhamento de tela</Badge>
            </div>
          </div>
        )}

        {/* Local video */}
        <div className="relative bg-slate-800 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
          {!isVideoOff ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: "scaleX(-1)" }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {participantName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-medium">Você</span>
              <div className="flex items-center gap-1">
                {isMuted && <MicOff className="h-4 w-4 text-red-400" />}
                {isVideoOff && <VideoOff className="h-4 w-4 text-red-400" />}
              </div>
            </div>
          </div>
        </div>

        {/* Info message */}
        <div className="text-center text-white/60 text-sm py-2">
          <p>Modo local - Configure DAILY_API_KEY para videoconferência com múltiplos participantes</p>
        </div>
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
      </div>
    </div>
  );
}

export function DailyVideoConference({
  roomSlug,
  sessionId,
  isHost,
  participantName,
  isMuted,
  isVideoOff,
  isScreenSharing,
  onMuteToggle,
  onVideoToggle,
  onScreenShareToggle,
}: DailyVideoConferenceProps) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [participants, setParticipants] = useState<ParticipantState[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyRoomUrl, setDailyRoomUrl] = useState<string | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Query to check if Daily.co room exists
  const { data: dailyRoom, refetch: refetchDailyRoom } = trpc.daily.getRoom.useQuery(
    { roomSlug, sessionId: sessionId || 0 },
    { enabled: !!sessionId }
  );

  // Mutation to create Daily.co room
  const createRoomMutation = trpc.daily.createRoom.useMutation({
    onSuccess: (data) => {
      setDailyRoomUrl(data.url);
      toast.success("Sala de vídeo criada!");
    },
    onError: (error) => {
      setError(error.message);
      toast.error(error.message);
    },
  });

  // Update participants list
  const updateParticipants = useCallback((call: DailyCall) => {
    const dailyParticipants = call.participants();
    const participantList: ParticipantState[] = [];

    Object.entries(dailyParticipants).forEach(([id, participant]) => {
      participantList.push({
        id,
        name: participant.user_name || (id === "local" ? participantName : "Participante"),
        video: participant.video ?? false,
        audio: participant.audio ?? false,
        screen: participant.screen ?? false,
        local: id === "local",
      });
    });

    setParticipants(participantList);
  }, [participantName]);

  // Attach video tracks to video elements
  const attachVideoTracks = useCallback((call: DailyCall) => {
    const dailyParticipants = call.participants();
    
    Object.entries(dailyParticipants).forEach(([id, participant]) => {
      const videoEl = videoRefs.current.get(id);
      if (videoEl && participant.videoTrack) {
        const stream = new MediaStream([participant.videoTrack]);
        if (videoEl.srcObject !== stream) {
          videoEl.srcObject = stream;
        }
      }
    });
  }, []);

  // Initialize Daily.co call
  const initializeCall = useCallback(async (url: string) => {
    if (callObject) return;

    setIsJoining(true);
    setError(null);

    try {
      const call = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: true,
      });

      // Set up event listeners
      call.on("joined-meeting", () => {
        setIsJoined(true);
        setIsJoining(false);
        updateParticipants(call);
        setTimeout(() => attachVideoTracks(call), 500);
      });

      call.on("left-meeting", () => {
        setIsJoined(false);
        setParticipants([]);
      });

      call.on("participant-joined", () => {
        updateParticipants(call);
        setTimeout(() => attachVideoTracks(call), 500);
      });

      call.on("participant-left", () => {
        updateParticipants(call);
      });

      call.on("participant-updated", () => {
        updateParticipants(call);
        attachVideoTracks(call);
      });

      call.on("track-started", () => {
        attachVideoTracks(call);
      });

      call.on("error", (event) => {
        console.error("Daily.co error:", event);
        setError("Erro na conexão de vídeo");
        setIsJoining(false);
      });

      setCallObject(call);

      // Join the call
      await call.join({
        url,
        userName: participantName,
      });

    } catch (err) {
      console.error("Failed to join Daily.co call:", err);
      setError("Falha ao conectar na sala de vídeo");
      setIsJoining(false);
    }
  }, [callObject, participantName, updateParticipants, attachVideoTracks]);

  // Handle room creation/joining
  useEffect(() => {
    if (!sessionId) return;

    if (dailyRoom?.url) {
      setDailyRoomUrl(dailyRoom.url);
    }
  }, [dailyRoom, sessionId]);

  // Auto-join when URL is available
  useEffect(() => {
    if (dailyRoomUrl && !callObject && !isJoining) {
      initializeCall(dailyRoomUrl);
    }
  }, [dailyRoomUrl, callObject, isJoining, initializeCall]);

  // Sync local audio/video state with Daily.co
  useEffect(() => {
    if (!callObject || !isJoined) return;

    callObject.setLocalAudio(!isMuted);
  }, [callObject, isJoined, isMuted]);

  useEffect(() => {
    if (!callObject || !isJoined) return;

    callObject.setLocalVideo(!isVideoOff);
  }, [callObject, isJoined, isVideoOff]);

  // Handle screen sharing
  useEffect(() => {
    if (!callObject || !isJoined) return;

    if (isScreenSharing) {
      callObject.startScreenShare();
    } else {
      callObject.stopScreenShare();
    }
  }, [callObject, isJoined, isScreenSharing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callObject) {
        callObject.leave();
        callObject.destroy();
      }
    };
  }, [callObject]);

  // Create room handler (for host)
  const handleCreateRoom = () => {
    if (!sessionId) {
      toast.error("Inicie uma sessão primeiro");
      return;
    }
    createRoomMutation.mutate({ roomSlug, sessionId });
  };

  // Leave call handler
  const handleLeaveCall = async () => {
    if (callObject) {
      await callObject.leave();
      callObject.destroy();
      setCallObject(null);
      setIsJoined(false);
      setParticipants([]);
    }
  };

  // Retry connection
  const handleRetry = () => {
    setError(null);
    if (dailyRoomUrl) {
      initializeCall(dailyRoomUrl);
    } else {
      refetchDailyRoom();
    }
  };

  // Register video ref
  const setVideoRef = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (el) {
      videoRefs.current.set(id, el);
      // Try to attach track immediately
      if (callObject) {
        const participant = callObject.participants()[id];
        if (participant?.videoTrack) {
          el.srcObject = new MediaStream([participant.videoTrack]);
        }
      }
    } else {
      videoRefs.current.delete(id);
    }
  }, [callObject]);

  // Not configured state - use local WebRTC fallback
  if (dailyRoom && !dailyRoom.configured) {
    return (
      <LocalVideoFallback
        participantName={participantName}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        onMuteToggle={onMuteToggle}
        onVideoToggle={onVideoToggle}
        onScreenShareToggle={onScreenShareToggle}
        isHost={isHost}
      />
    );
  }

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

  // Room not created yet (host needs to create)
  if (!dailyRoomUrl && isHost) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <Video className="h-12 w-12 text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Criar sala de vídeo</h3>
          <p className="text-muted-foreground mb-4">
            Clique para criar a sala de videoconferência para esta sessão.
          </p>
          <Button 
            onClick={handleCreateRoom}
            disabled={createRoomMutation.isPending}
          >
            {createRoomMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Video className="h-4 w-4 mr-2" />
                Criar Sala de Vídeo
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Waiting for room (student)
  if (!dailyRoomUrl && !isHost) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold mb-2">Aguardando sala de vídeo</h3>
          <p className="text-muted-foreground">
            O professor ainda não iniciou a videoconferência.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => refetchDailyRoom()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Verificar novamente
          </Button>
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

  // Joining state
  if (isJoining) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold mb-2">Conectando...</h3>
          <p className="text-muted-foreground">
            Entrando na sala de videoconferência
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate grid layout
  const getGridClass = () => {
    const count = participants.length;
    if (count <= 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-3";
    return "grid-cols-4";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Video Grid */}
      <div 
        ref={videoContainerRef}
        className={`flex-1 grid ${getGridClass()} gap-2 p-2 bg-slate-900 rounded-lg overflow-hidden`}
      >
        {participants.length === 0 ? (
          <div className="flex items-center justify-center text-white/50">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-2" />
              <p>Aguardando participantes...</p>
            </div>
          </div>
        ) : (
          participants.map((participant) => (
            <div
              key={participant.id}
              className="relative bg-slate-800 rounded-lg overflow-hidden aspect-video flex items-center justify-center"
            >
              {participant.video ? (
                <video
                  ref={(el) => setVideoRef(participant.id, el)}
                  autoPlay
                  playsInline
                  muted={participant.local}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">
                      {participant.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}

              {/* Participant info overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-medium truncate">
                    {participant.local ? "Você" : participant.name}
                    {participant.screen && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Compartilhando
                      </Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    {!participant.audio && (
                      <MicOff className="h-4 w-4 text-red-400" />
                    )}
                    {!participant.video && (
                      <VideoOff className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
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

        <Badge variant="outline" className="gap-1">
          <Users className="h-3 w-3" />
          {participants.length}
        </Badge>

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
