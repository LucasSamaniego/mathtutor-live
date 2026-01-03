import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { toast } from "sonner";
import { 
  Video, 
  VideoOff,
  Mic, 
  MicOff,
  Monitor,
  MonitorOff,
  Phone,
  MessageSquare,
  FileText,
  Users,
  Settings,
  Loader2,
  GraduationCap,
  ChevronRight,
  ChevronLeft,
  Send,
  Upload,
  X,
  Maximize2,
  Minimize2
} from "lucide-react";
import { ShadowTutor } from "@/components/ShadowTutor";
import { PdfViewer } from "@/components/PdfViewer";
import { LatexEditor } from "@/components/LatexEditor";
import { VideoConference } from "@/components/VideoConference";

export default function Room() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  
  // Room and session state
  const [guestName, setGuestName] = useState("");
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  
  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"video" | "pdf" | "latex">("video");
  const [shadowTutorOpen, setShadowTutorOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Fetch room data
  const { data: room, isLoading: roomLoading, error: roomError } = trpc.room.getBySlug.useQuery(
    { slug: slug || "" },
    { enabled: !!slug }
  );

  // Fetch active session
  const { data: activeSession, refetch: refetchSession } = trpc.session.getActive.useQuery(
    { roomId: room?.id || 0 },
    { enabled: !!room?.id }
  );

  // Fetch participants
  const { data: participants } = trpc.session.getParticipants.useQuery(
    { sessionId: sessionId || 0 },
    { enabled: !!sessionId, refetchInterval: 5000 }
  );

  // Mutations
  const startSessionMutation = trpc.session.start.useMutation({
    onSuccess: (session) => {
      setSessionId(session.id);
      toast.success("Sessão iniciada!");
      refetchSession();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const endSessionMutation = trpc.session.end.useMutation({
    onSuccess: () => {
      toast.success("Sessão encerrada!");
      setSessionId(null);
      refetchSession();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const joinSessionMutation = trpc.session.join.useMutation({
    onSuccess: (participant) => {
      setParticipantId(participant.id);
      setShowGuestDialog(false);
      toast.success("Você entrou na sessão!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const leaveSessionMutation = trpc.session.leave.useMutation();

  // Check if user is the host (teacher)
  const isHost = user && room && user.id === room.hostId;

  // Handle joining session
  useEffect(() => {
    if (activeSession && !participantId) {
      setSessionId(activeSession.id);
      
      if (isAuthenticated) {
        // Auto-join for authenticated users
        joinSessionMutation.mutate({ sessionId: activeSession.id });
      } else if (room?.allowGuests) {
        // Show guest dialog
        setShowGuestDialog(true);
      }
    }
  }, [activeSession, isAuthenticated, room]);

  // Handle guest join
  const handleGuestJoin = () => {
    if (!guestName.trim()) {
      toast.error("Digite seu nome");
      return;
    }
    if (activeSession) {
      joinSessionMutation.mutate({
        sessionId: activeSession.id,
        guestName: guestName.trim(),
      });
    }
  };

  // Handle leave
  const handleLeave = () => {
    if (participantId) {
      leaveSessionMutation.mutate({ participantId });
    }
    setLocation("/");
  };

  // Handle start session (teacher only)
  const handleStartSession = () => {
    if (room) {
      startSessionMutation.mutate({ roomId: room.id });
    }
  };

  // Handle end session (teacher only)
  const handleEndSession = () => {
    if (sessionId) {
      endSessionMutation.mutate({ sessionId });
    }
  };

  // Loading state
  if (roomLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando sala...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (roomError || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Sala não encontrada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              A sala que você está procurando não existe ou foi removida.
            </p>
            <Button onClick={() => setLocation("/")}>Voltar ao Início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Waiting for session (no active session)
  if (!activeSession && !isHost) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="font-semibold">MathTutor Live</span>
            </div>
            <CardTitle>{room.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Aguardando o professor iniciar a sessão...
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verificando status da sala</span>
            </div>
            <Button variant="outline" onClick={() => setLocation("/")}>
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Guest Name Dialog */}
      <Dialog open={showGuestDialog} onOpenChange={setShowGuestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrar na Sala</DialogTitle>
            <DialogDescription>
              Digite seu nome para entrar na sessão de tutoria
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="guest-name">Seu Nome</Label>
              <Input
                id="guest-name"
                placeholder="Ex: João Silva"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGuestJoin()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocation("/")}>
              Cancelar
            </Button>
            <Button onClick={handleGuestJoin} disabled={joinSessionMutation.isPending}>
              {joinSessionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Entrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="font-semibold hidden sm:inline">MathTutor Live</span>
          </div>
          <div className="h-6 w-px bg-border hidden sm:block" />
          <div className="flex flex-col">
            <span className="font-medium text-sm">{room.name}</span>
            <span className="text-xs text-muted-foreground">
              {participants?.length || 0} participante(s)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Media Controls */}
          <Button
            variant={isMuted ? "destructive" : "outline"}
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? "Ativar microfone" : "Desativar microfone"}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          
          <Button
            variant={isVideoOff ? "destructive" : "outline"}
            size="icon"
            onClick={() => setIsVideoOff(!isVideoOff)}
            title={isVideoOff ? "Ativar câmera" : "Desativar câmera"}
          >
            {isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          </Button>

          {isHost && (
            <Button
              variant={isScreenSharing ? "default" : "outline"}
              size="icon"
              onClick={() => setIsScreenSharing(!isScreenSharing)}
              title={isScreenSharing ? "Parar compartilhamento" : "Compartilhar tela"}
            >
              {isScreenSharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
            </Button>
          )}

          <div className="h-6 w-px bg-border" />

          {/* Shadow Tutor Button (students only) */}
          {!isHost && participantId && (
            <Button
              variant={shadowTutorOpen ? "default" : "outline"}
              size="sm"
              onClick={() => setShadowTutorOpen(!shadowTutorOpen)}
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Perguntar à IA</span>
            </Button>
          )}

          {/* Session Controls */}
          {isHost && !activeSession && (
            <Button onClick={handleStartSession} disabled={startSessionMutation.isPending}>
              {startSessionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Iniciar Sessão
            </Button>
          )}

          {isHost && activeSession && (
            <Button variant="destructive" onClick={handleEndSession} disabled={endSessionMutation.isPending}>
              {endSessionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Encerrar
            </Button>
          )}

          <Button variant="destructive" size="icon" onClick={handleLeave} title="Sair da sala">
            <Phone className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Participants & Tools */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} border-r bg-card transition-all duration-300 overflow-hidden shrink-0`}>
          <div className="h-full flex flex-col w-64">
            {/* Tabs */}
            <Tabs defaultValue="participants" className="flex-1 flex flex-col">
              <TabsList className="w-full justify-start rounded-none border-b h-10 px-2">
                <TabsTrigger value="participants" className="gap-1 text-xs">
                  <Users className="h-3 w-3" />
                  Participantes
                </TabsTrigger>
                {isHost && (
                  <TabsTrigger value="tools" className="gap-1 text-xs">
                    <Settings className="h-3 w-3" />
                    Ferramentas
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="participants" className="flex-1 overflow-auto p-4 mt-0">
                <div className="space-y-2">
                  {participants?.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        p.role === 'teacher' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                      }`}>
                        {(p.visibleName || p.guestName || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {p.visibleName || p.guestName || "Anônimo"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.role === 'teacher' ? 'Professor' : p.role === 'student' ? 'Aluno' : 'Convidado'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {isHost && (
                <TabsContent value="tools" className="flex-1 overflow-auto p-4 mt-0">
                  <div className="space-y-4">
                    <Button
                      variant={activeTab === "pdf" ? "default" : "outline"}
                      className="w-full justify-start gap-2"
                      onClick={() => setActiveTab("pdf")}
                    >
                      <FileText className="h-4 w-4" />
                      Visualizador PDF
                    </Button>
                    <Button
                      variant={activeTab === "latex" ? "default" : "outline"}
                      className="w-full justify-start gap-2"
                      onClick={() => setActiveTab("latex")}
                    >
                      <span className="font-mono text-sm">∑</span>
                      Editor LaTeX
                    </Button>
                    <Button
                      variant={activeTab === "video" ? "default" : "outline"}
                      className="w-full justify-start gap-2"
                      onClick={() => setActiveTab("video")}
                    >
                      <Video className="h-4 w-4" />
                      Apenas Vídeo
                    </Button>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </aside>

        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-card border rounded-r-lg p-1 hover:bg-muted transition-colors"
          style={{ left: sidebarOpen ? '256px' : '0' }}
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* Main Stage */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Content Area */}
          <div className="flex-1 p-4 overflow-auto">
            {activeTab === "video" && (
              <VideoConference
                roomSlug={slug || ""}
                isHost={isHost || false}
                isMuted={isMuted}
                isVideoOff={isVideoOff}
                isScreenSharing={isScreenSharing}
              />
            )}
            
            {activeTab === "pdf" && isHost && room && (
              <PdfViewer roomId={room.id} isHost={isHost} />
            )}
            
            {activeTab === "latex" && isHost && (
              <LatexEditor />
            )}

            {/* For students, show what teacher is presenting */}
            {!isHost && activeTab !== "video" && (
              <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">
                  Aguardando conteúdo do professor...
                </p>
              </div>
            )}
          </div>

          {/* Video Thumbnails (when not in video-only mode) */}
          {activeTab !== "video" && (
            <div className="h-32 border-t bg-card p-2 shrink-0">
              <div className="flex gap-2 h-full overflow-x-auto">
                <div className="aspect-video h-full bg-muted rounded-lg flex items-center justify-center">
                  <Video className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Shadow Tutor Sidebar */}
        {shadowTutorOpen && participantId && sessionId && (
          <ShadowTutor
            sessionId={sessionId}
            participantId={participantId}
            onClose={() => setShadowTutorOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
