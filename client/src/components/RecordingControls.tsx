import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Circle, 
  Square, 
  Loader2,
  Video,
  Clock,
  Download
} from "lucide-react";

interface RecordingControlsProps {
  sessionId: number;
  isHost: boolean;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
}

export function RecordingControls({
  sessionId,
  isHost,
  localStream,
  screenStream,
}: RecordingControlsProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch recordings
  const { data: recordings, refetch: refetchRecordings } = trpc.recording.getBySession.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  // Mutations
  const createRecordingMutation = trpc.recording.create.useMutation({
    onSuccess: (recording) => {
      if (recording) {
        setRecordingId(recording.id);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao iniciar gravação");
      setIsRecording(false);
    },
  });

  const uploadCompleteMutation = trpc.recording.uploadComplete.useMutation({
    onSuccess: () => {
      toast.success("Gravação salva com sucesso!");
      refetchRecordings();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao salvar gravação");
    },
  });

  // Timer effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setRecordingTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      // Get the stream to record (prefer screen share, fallback to local)
      const streamToRecord = screenStream || localStream;
      
      if (!streamToRecord) {
        toast.error("Nenhum stream disponível para gravação");
        return;
      }

      // Create recording entry in database
      createRecordingMutation.mutate({
        sessionId,
        title: `Gravação ${new Date().toLocaleString('pt-BR')}`,
      });

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(streamToRecord, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        // For now, create a download link (in production, upload to S3)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gravacao-${sessionId}-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Update recording status
        if (recordingId) {
          uploadCompleteMutation.mutate({
            recordingId,
            s3Url: url, // In production, this would be the S3 URL
            duration: recordingTime,
            fileSize: blob.size,
          });
        }

        setRecordingId(null);
      };

      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      toast.success("Gravação iniciada!");
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Erro ao iniciar gravação");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  if (!isHost) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Video className="h-4 w-4" />
          Gravação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recording Controls */}
        <div className="flex items-center gap-4">
          {isRecording ? (
            <>
              <Button
                variant="destructive"
                onClick={stopRecording}
                className="gap-2"
              >
                <Square className="h-4 w-4" />
                Parar
              </Button>
              <div className="flex items-center gap-2">
                <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" />
                <span className="font-mono text-sm">{formatTime(recordingTime)}</span>
              </div>
            </>
          ) : (
            <Button
              variant="default"
              onClick={startRecording}
              disabled={createRecordingMutation.isPending || (!localStream && !screenStream)}
              className="gap-2"
            >
              {createRecordingMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Circle className="h-4 w-4 fill-red-500 text-red-500" />
              )}
              Gravar
            </Button>
          )}
        </div>

        {/* Recording List */}
        {recordings && recordings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Gravações anteriores:</p>
            <div className="space-y-1 max-h-[150px] overflow-y-auto">
              {recordings.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Video className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate max-w-[150px]">{rec.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={rec.status === "ready" ? "default" : "secondary"}>
                      {rec.status === "ready" ? "Pronto" : rec.status === "processing" ? "Processando" : "Erro"}
                    </Badge>
                    {rec.status === "ready" && rec.s3Url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => window.open(rec.s3Url, '_blank')}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          A gravação será baixada automaticamente ao parar.
        </p>
      </CardContent>
    </Card>
  );
}
