import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { 
  Video, 
  Users, 
  BookOpen, 
  Brain, 
  Plus, 
  ArrowRight, 
  GraduationCap,
  Monitor,
  MessageSquare,
  FileText,
  Loader2
} from "lucide-react";

export default function Home() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [roomSlug, setRoomSlug] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [allowGuests, setAllowGuests] = useState(true);

  const createRoomMutation = trpc.room.create.useMutation({
    onSuccess: (room) => {
      toast.success("Sala criada com sucesso!");
      setCreateDialogOpen(false);
      setLocation(`/sala/${room.slug}`);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar sala");
    },
  });

  const handleJoinRoom = () => {
    if (!roomSlug.trim()) {
      toast.error("Digite o código da sala");
      return;
    }
    setLocation(`/sala/${roomSlug.trim()}`);
  };

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) {
      toast.error("Digite o nome da sala");
      return;
    }
    createRoomMutation.mutate({
      name: newRoomName,
      description: newRoomDescription || undefined,
      allowGuests,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">MathTutor Live</span>
          </div>
          <div className="flex items-center gap-4">
            {authLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  Olá, {user?.name || user?.email || "Professor"}
                </span>
                <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                  Meu Painel
                </Button>
              </div>
            ) : (
              <Button asChild>
                <a href={getLoginUrl()}>Entrar como Professor</a>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
                  Aulas de Matemática{" "}
                  <span className="text-primary">Online</span>{" "}
                  Interativas
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-xl">
                  Plataforma completa para tutoria de matemática com videoconferência, 
                  ferramentas pedagógicas e assistente de IA integrado.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="room-code" className="text-sm font-medium">
                    Entrar em uma Sala
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="room-code"
                      placeholder="Código da sala"
                      value={roomSlug}
                      onChange={(e) => setRoomSlug(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                      className="flex-1"
                    />
                    <Button onClick={handleJoinRoom}>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {isAuthenticated && (
                  <div className="flex items-end">
                    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="default" className="gap-2">
                          <Plus className="h-4 w-4" />
                          Criar Sala
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Criar Nova Sala</DialogTitle>
                          <DialogDescription>
                            Configure sua sala de tutoria de matemática
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="room-name">Nome da Sala</Label>
                            <Input
                              id="room-name"
                              placeholder="Ex: Matemática - Turma 3A"
                              value={newRoomName}
                              onChange={(e) => setNewRoomName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="room-desc">Descrição (opcional)</Label>
                            <Textarea
                              id="room-desc"
                              placeholder="Descreva o conteúdo ou objetivo da sala"
                              value={newRoomDescription}
                              onChange={(e) => setNewRoomDescription(e.target.value)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>Permitir Convidados</Label>
                              <p className="text-sm text-muted-foreground">
                                Alunos podem entrar sem fazer login
                              </p>
                            </div>
                            <Switch
                              checked={allowGuests}
                              onCheckedChange={setAllowGuests}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setCreateDialogOpen(false)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleCreateRoom}
                            disabled={createRoomMutation.isPending}
                          >
                            {createRoomMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Criar Sala
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
            </div>

            {/* Hero Image/Illustration */}
            <div className="hidden lg:flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/10 rounded-3xl blur-3xl"></div>
                <Card className="relative w-96 h-80 flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <div className="text-center space-y-4">
                    <div className="flex justify-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
                        <Video className="h-8 w-8 text-primary" />
                      </div>
                      <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
                        <Brain className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-primary">∫ f(x)dx</p>
                      <p className="text-lg text-muted-foreground">x² + y² = r²</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Recursos da Plataforma
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tudo que você precisa para aulas de matemática online de alta qualidade
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Videoconferência HD</CardTitle>
                <CardDescription>
                  Chamadas de vídeo em alta qualidade com WebRTC para aulas fluidas e sem travamentos
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Monitor className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Compartilhamento de Tela</CardTitle>
                <CardDescription>
                  Compartilhe seu iPad, tablet ou qualquer janela com baixa latência
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Visualizador de PDF</CardTitle>
                <CardDescription>
                  Carregue e apresente exercícios em PDF diretamente na plataforma
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Fórmulas LaTeX</CardTitle>
                <CardDescription>
                  Renderize fórmulas matemáticas complexas em tempo real com KaTeX
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Shadow Tutor</CardTitle>
                <CardDescription>
                  Assistente de IA exclusivo para alunos tirarem dúvidas sem interromper a aula
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Acesso Simplificado</CardTitle>
                <CardDescription>
                  Alunos podem entrar com link único, sem necessidade de cadastro
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Gravação de Aulas</CardTitle>
                <CardDescription>
                  Grave suas sessões para os alunos revisarem posteriormente
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Transcrição Automática</CardTitle>
                <CardDescription>
                  Notas de aula geradas automaticamente para facilitar a revisão
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
        <div className="container text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Pronto para Começar?
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Crie sua primeira sala de tutoria em segundos e comece a ensinar matemática de forma interativa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <Button size="lg" onClick={() => setCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-5 w-5" />
                Criar Minha Primeira Sala
              </Button>
            ) : (
              <Button size="lg" asChild>
                <a href={getLoginUrl()} className="gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Começar como Professor
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-white">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} MathTutor Live. Plataforma de tutoria de matemática online.</p>
        </div>
      </footer>
    </div>
  );
}
