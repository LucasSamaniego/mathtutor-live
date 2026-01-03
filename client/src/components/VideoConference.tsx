import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor,
  MonitorOff,
  Users,
  Loader2,
  AlertCircle
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
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize local media
  useEffect(() => {
    const initMedia = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Error accessing media devices:", err);
        setError(
          err.name === "NotAllowedError"
            ? "Permissão de câmera/microfone negada. Por favor, permita o acesso nas configurações do navegador."
            : "Erro ao acessar câmera/microfone. Verifique se os dispositivos estão conectados."
        );
      } finally {
        setIsLoading(false);
      }
    };

    initMedia();

    return () => {
      // Cleanup streams on unmount
      localStream?.getTracks().forEach((track) => track.stop());
      screenStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

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
            video: true,
            audio: false,
          });

          setScreenStream(stream);

          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = stream;
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
        screenStream?.getTracks().forEach((track) => track.stop());
        setScreenStream(null);
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
                onClick={() => window.location.reload()}
                variant="outline"
              >
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
      <div className="flex-1 relative rounded-lg overflow-hidden bg-muted">
        {/* Screen Share (when active) */}
        {screenStream ? (
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          /* Local Video (when no screen share) */
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
          />
        )}

        {/* Video Off Placeholder */}
        {isVideoOff && !screenStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-center space-y-2">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <VideoOff className="h-12 w-12 text-primary/50" />
              </div>
              <p className="text-muted-foreground">Câmera desativada</p>
            </div>
          </div>
        )}

        {/* Status Indicators */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          {isMuted && (
            <div className="bg-destructive/90 text-destructive-foreground px-2 py-1 rounded-md flex items-center gap-1 text-sm">
              <MicOff className="h-3 w-3" />
              <span>Mudo</span>
            </div>
          )}
          {screenStream && (
            <div className="bg-primary/90 text-primary-foreground px-2 py-1 rounded-md flex items-center gap-1 text-sm">
              <Monitor className="h-3 w-3" />
              <span>Compartilhando Tela</span>
            </div>
          )}
        </div>

        {/* Self View (Picture-in-Picture when screen sharing) */}
        {screenStream && localStream && !isVideoOff && (
          <div className="absolute bottom-4 right-4 w-48 aspect-video rounded-lg overflow-hidden border-2 border-background shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
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
                <span className={`w-2 h-2 rounded-full ${localStream ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-muted-foreground">
                  {localStream ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {isHost ? 'Professor' : 'Aluno'}
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
