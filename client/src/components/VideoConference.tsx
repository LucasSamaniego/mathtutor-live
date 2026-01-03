import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor,
  Users,
  Loader2,
  AlertCircle,
  RefreshCw
} from "lucide-react";

interface VideoConferenceProps {
  roomSlug: string;
  isHost: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
}

export function VideoConference({
  roomSlug,
  isHost,
  isMuted,
  isVideoOff,
  isScreenSharing,
}: VideoConferenceProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);

  // Function to attach stream to video element
  const attachStreamToVideo = useCallback((videoElement: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (videoElement && stream) {
      videoElement.srcObject = stream;
      videoElement.onloadedmetadata = () => {
        videoElement.play().catch(err => {
          console.error("Error playing video:", err);
        });
      };
    }
  }, []);

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
      attachStreamToVideo(localVideoRef.current, localStream);
    }
  }, [localStream, attachStreamToVideo]);

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

          // Also attach local video to PIP
          if (pipVideoRef.current && localStream) {
            pipVideoRef.current.srcObject = localStream;
            pipVideoRef.current.onloadedmetadata = () => {
              pipVideoRef.current?.play().catch(err => {
                console.error("Error playing PIP video:", err);
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

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Main Video Area */}
      <div className="flex-1 relative rounded-lg overflow-hidden bg-slate-900 min-h-[300px]">
        {/* Screen Share (when active) */}
        {screenStream ? (
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          /* Local Video (when no screen share) */
          <>
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
                  <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center mx-auto">
                    <VideoOff className="h-12 w-12 text-slate-400" />
                  </div>
                  <p className="text-slate-400">Câmera desativada</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Status Indicators */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          {isMuted && (
            <div className="bg-red-500/90 text-white px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm font-medium">
              <MicOff className="h-4 w-4" />
              <span>Mudo</span>
            </div>
          )}
          {screenStream && (
            <div className="bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm font-medium">
              <Monitor className="h-4 w-4" />
              <span>Compartilhando Tela</span>
            </div>
          )}
          {!videoReady && !isVideoOff && !error && (
            <div className="bg-yellow-500/90 text-white px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Carregando vídeo...</span>
            </div>
          )}
        </div>

        {/* Self View (Picture-in-Picture when screen sharing) */}
        {screenStream && localStream && !isVideoOff && (
          <div className="absolute bottom-4 right-4 w-48 aspect-video rounded-lg overflow-hidden border-2 border-white/20 shadow-lg bg-slate-800">
            <video
              ref={pipVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
        )}
      </div>

      {/* Info Banner */}
      <Card className="shrink-0">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Sala: {roomSlug}</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${localStream ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-muted-foreground">
                  {localStream ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              {localStream && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-2 text-sm">
                    <Video className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground">
                      {isVideoOff ? 'Câmera desligada' : 'Câmera ligada'}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="text-sm text-muted-foreground font-medium">
              {isHost ? '👨‍🏫 Professor' : '👨‍🎓 Aluno'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Note about WebRTC */}
      <div className="text-center text-xs text-muted-foreground">
        <p>
          Para videoconferência em produção com múltiplos participantes, 
          integre com Daily.co ou Agora SDK.
        </p>
      </div>
    </div>
  );
}
