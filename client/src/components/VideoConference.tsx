import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor,
  Users,
  Loader2,
  AlertCircle,
  RefreshCw,
  User
} from "lucide-react";

interface VideoConferenceProps {
  roomSlug: string;
  isHost: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  sessionId?: number | null;
  participantId?: number | null;
  participantName?: string;
}

interface RemoteParticipant {
  id: number;
  visibleName: string | null;
  guestName: string | null;
  role: string;
  isVideoOff?: boolean;
  isMuted?: boolean;
}

export function VideoConference({
  roomSlug,
  isHost,
  isMuted,
  isVideoOff,
  isScreenSharing,
  sessionId,
  participantId,
  participantName = "Você",
}: VideoConferenceProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Fetch participants from the session
  const { data: participants } = trpc.session.getParticipants.useQuery(
    { sessionId: sessionId || 0 },
    { 
      enabled: !!sessionId,
      refetchInterval: 3000, // Poll every 3 seconds for new participants
    }
  );

  // Filter out current participant to show others
  const otherParticipants: RemoteParticipant[] = participants?.filter(
    (p: any) => p.id !== participantId
  ) || [];

  // Initialize local media
  const initMedia = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setVideoReady(false);

      // Stop any existing streams first
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: true,
      });

      setLocalStream(stream);
      
      // Attach stream to video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.onloadedmetadata = () => {
          localVideoRef.current?.play().then(() => {
            setVideoReady(true);
          }).catch(err => {
            console.error("Error playing local video:", err);
          });
        };
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error("Error accessing media devices:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Permissão de câmera/microfone negada. Por favor, permita o acesso nas configurações do navegador."
          : err.name === "NotFoundError"
          ? "Câmera ou microfone não encontrado. Verifique se os dispositivos estão conectados."
          : "Erro ao acessar câmera/microfone. Verifique se os dispositivos estão conectados."
      );
      setIsLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initMedia();

    return () => {
      // Cleanup streams on unmount
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Re-attach stream when video element is available
  useEffect(() => {
    if (localStream && localVideoRef.current && !localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.onloadedmetadata = () => {
        localVideoRef.current?.play().catch(err => {
          console.error("Error playing video:", err);
        });
      };
    }
  }, [localStream]);

  // Handle mute/unmute
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted, localStream]);

  // Handle video on/off
  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoOff;
      });
    }
  }, [isVideoOff, localStream]);

  // Handle screen sharing
  useEffect(() => {
    const handleScreenShare = async () => {
      if (isScreenSharing && isHost) {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false,
          });

          setScreenStream(stream);

          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = stream;
            screenVideoRef.current.onloadedmetadata = () => {
              screenVideoRef.current?.play().catch(err => {
                console.error("Error playing screen share:", err);
              });
            };
          }

          // Handle when user stops sharing via browser UI
          stream.getVideoTracks()[0].onended = () => {
            setScreenStream(null);
          };
        } catch (err) {
          console.error("Error sharing screen:", err);
        }
      } else {
        // Stop screen sharing
        if (screenStream) {
          screenStream.getTracks().forEach(track => track.stop());
          setScreenStream(null);
        }
      }
    };

    handleScreenShare();
  }, [isScreenSharing, isHost]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string, role: string) => {
    if (role === 'teacher') return 'bg-primary';
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-orange-500",
      "bg-pink-500",
      "bg-teal-500",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Iniciando câmera e microfone...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-destructive font-medium">Erro de Mídia</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                onClick={initMedia}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Tentar Novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate grid layout based on number of participants
  const totalParticipants = otherParticipants.length + 1; // +1 for self
  const gridCols = totalParticipants <= 1 ? 1 : totalParticipants <= 4 ? 2 : 3;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Screen Share View (when active) */}
      {screenStream && (
        <div className="flex-1 relative rounded-lg overflow-hidden bg-slate-900 min-h-[300px]">
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain bg-black"
          />
          <div className="absolute bottom-4 left-4 bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm font-medium">
            <Monitor className="h-4 w-4" />
            <span>Compartilhando Tela</span>
          </div>
        </div>
      )}

      {/* Video Grid */}
      <div className={`${screenStream ? 'h-32' : 'flex-1'} min-h-[200px]`}>
        <div 
          className={`grid gap-3 h-full ${
            screenStream 
              ? 'grid-cols-4' 
              : gridCols === 1 
                ? 'grid-cols-1' 
                : gridCols === 2 
                  ? 'grid-cols-2' 
                  : 'grid-cols-3'
          }`}
        >
          {/* Local Video (You) */}
          <div className={`relative rounded-lg overflow-hidden bg-slate-900 ${!screenStream && totalParticipants === 1 ? 'col-span-full' : ''}`}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
              style={{ transform: 'scaleX(-1)' }}
            />
            
            {/* Video Off Placeholder */}
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                <div className="text-center space-y-2">
                  <div className={`w-16 h-16 rounded-full ${getAvatarColor(participantName, isHost ? 'teacher' : 'student')} flex items-center justify-center mx-auto`}>
                    <span className="text-white text-xl font-semibold">{getInitials(participantName)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Name Label */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <div className="bg-black/60 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5">
                <span>{participantName} (Você)</span>
                {isHost && <span className="text-primary">👨‍🏫</span>}
              </div>
              <div className="flex gap-1">
                {isMuted && (
                  <div className="bg-red-500/90 text-white p-1 rounded">
                    <MicOff className="h-3 w-3" />
                  </div>
                )}
                {isVideoOff && (
                  <div className="bg-red-500/90 text-white p-1 rounded">
                    <VideoOff className="h-3 w-3" />
                  </div>
                )}
              </div>
            </div>

            {/* Loading indicator */}
            {!videoReady && !isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
          </div>

          {/* Remote Participants */}
          {otherParticipants.map((participant) => {
            const name = participant.visibleName || participant.guestName || "Participante";
            const isTeacher = participant.role === 'teacher';
            
            return (
              <div 
                key={participant.id} 
                className="relative rounded-lg overflow-hidden bg-slate-800"
              >
                {/* Placeholder for remote video - in production, this would show actual video stream */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className={`w-16 h-16 rounded-full ${getAvatarColor(name, participant.role)} flex items-center justify-center mx-auto`}>
                      <span className="text-white text-xl font-semibold">{getInitials(name)}</span>
                    </div>
                    <p className="text-slate-400 text-xs">Conectando...</p>
                  </div>
                </div>

                {/* Name Label */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <div className="bg-black/60 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5">
                    <span>{name}</span>
                    {isTeacher && <span className="text-primary">👨‍🏫</span>}
                  </div>
                </div>

                {/* Connection indicator */}
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" title="Aguardando conexão" />
                </div>
              </div>
            );
          })}

          {/* Empty slots message */}
          {otherParticipants.length === 0 && !screenStream && (
            <div className="col-span-1 rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center bg-slate-800/30">
              <div className="text-center space-y-2 p-4">
                <Users className="h-8 w-8 text-slate-500 mx-auto" />
                <p className="text-slate-500 text-sm">Aguardando participantes...</p>
                <p className="text-slate-600 text-xs">
                  Compartilhe o link da sala para outros entrarem
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <Card className="shrink-0">
        <CardContent className="py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{totalParticipants} participante(s)</span>
              </div>
              <div className="h-4 w-px bg-border hidden sm:block" />
              <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${localStream ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-muted-foreground">
                  {localStream ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground font-medium">
              {isHost ? '👨‍🏫 Professor' : '👨‍🎓 Aluno'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Note about WebRTC */}
      <div className="text-center text-xs text-muted-foreground px-4">
        <p>
          💡 Para ver os vídeos de outros participantes em tempo real, 
          integre com <strong>Daily.co</strong> ou <strong>Agora SDK</strong>.
          Os participantes conectados aparecem no grid acima.
        </p>
      </div>
    </div>
  );
}
