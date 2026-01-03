import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { 
  Plus, 
  Video, 
  Users, 
  Clock, 
  ExternalLink,
  Trash2,
  Edit,
  Copy,
  GraduationCap,
  LayoutDashboard,
  History,
  Settings,
  LogOut,
  Loader2,
  Calendar
} from "lucide-react";

export default function Dashboard() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  
  // Form states
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [allowGuests, setAllowGuests] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Fetch rooms
  const { data: rooms, isLoading: roomsLoading, refetch: refetchRooms } = trpc.room.getMyRooms.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Mutations
  const createRoomMutation = trpc.room.create.useMutation({
    onSuccess: (room) => {
      toast.success("Sala criada com sucesso!");
      setCreateDialogOpen(false);
      setNewRoomName("");
      setNewRoomDescription("");
      setAllowGuests(true);
      refetchRooms();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar sala");
    },
  });

  const updateRoomMutation = trpc.room.update.useMutation({
    onSuccess: () => {
      toast.success("Sala atualizada!");
      setEditDialogOpen(false);
      setEditingRoom(null);
      refetchRooms();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar sala");
    },
  });

  const deleteRoomMutation = trpc.room.delete.useMutation({
    onSuccess: () => {
      toast.success("Sala removida!");
      refetchRooms();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao remover sala");
    },
  });

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

  const handleUpdateRoom = () => {
    if (!editingRoom) return;
    updateRoomMutation.mutate({
      id: editingRoom.id,
      name: editingRoom.name,
      description: editingRoom.description,
      allowGuests: editingRoom.allowGuests,
      isActive: editingRoom.isActive,
    });
  };

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/sala/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
              <GraduationCap className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-foreground">MathTutor Live</span>
            </div>
            <Badge variant="secondary">Professor</Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.name || user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64 shrink-0">
            <Card>
              <CardContent className="p-4">
                <nav className="space-y-1">
                  <Button variant="ghost" className="w-full justify-start gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    Minhas Salas
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-2" disabled>
                    <History className="h-4 w-4" />
                    Histórico
                    <Badge variant="outline" className="ml-auto text-xs">Em breve</Badge>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-2" disabled>
                    <Settings className="h-4 w-4" />
                    Configurações
                    <Badge variant="outline" className="ml-auto text-xs">Em breve</Badge>
                  </Button>
                </nav>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Minhas Salas</h1>
                <p className="text-muted-foreground">
                  Gerencie suas salas de tutoria de matemática
                </p>
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Sala
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
                      {createRoomMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Criar Sala
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Rooms Grid */}
            {roomsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : rooms && rooms.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {rooms.map((room) => (
                  <Card key={room.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{room.name}</CardTitle>
                          <CardDescription className="line-clamp-2">
                            {room.description || "Sem descrição"}
                          </CardDescription>
                        </div>
                        <Badge variant={room.isActive ? "default" : "secondary"}>
                          {room.isActive ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{room.allowGuests ? "Convidados permitidos" : "Apenas logados"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <code className="flex-1 bg-muted px-2 py-1 rounded text-xs truncate">
                          /sala/{room.slug}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleCopyLink(room.slug)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 gap-2"
                          onClick={() => setLocation(`/sala/${room.slug}`)}
                        >
                          <Video className="h-4 w-4" />
                          Entrar
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setEditingRoom({ ...room });
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja excluir esta sala?")) {
                              deleteRoomMutation.mutate({ id: room.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center space-y-4">
                    <Video className="h-12 w-12 text-muted-foreground/50 mx-auto" />
                    <div>
                      <h3 className="font-semibold">Nenhuma sala criada</h3>
                      <p className="text-sm text-muted-foreground">
                        Crie sua primeira sala de tutoria para começar
                      </p>
                    </div>
                    <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Criar Primeira Sala
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>

      {/* Edit Room Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Sala</DialogTitle>
            <DialogDescription>
              Atualize as configurações da sala
            </DialogDescription>
          </DialogHeader>
          {editingRoom && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-room-name">Nome da Sala</Label>
                <Input
                  id="edit-room-name"
                  value={editingRoom.name}
                  onChange={(e) =>
                    setEditingRoom({ ...editingRoom, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-room-desc">Descrição</Label>
                <Textarea
                  id="edit-room-desc"
                  value={editingRoom.description || ""}
                  onChange={(e) =>
                    setEditingRoom({ ...editingRoom, description: e.target.value })
                  }
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
                  checked={editingRoom.allowGuests}
                  onCheckedChange={(checked) =>
                    setEditingRoom({ ...editingRoom, allowGuests: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sala Ativa</Label>
                  <p className="text-sm text-muted-foreground">
                    Desative para impedir novos acessos
                  </p>
                </div>
                <Switch
                  checked={editingRoom.isActive}
                  onCheckedChange={(checked) =>
                    setEditingRoom({ ...editingRoom, isActive: checked })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateRoom}
              disabled={updateRoomMutation.isPending}
            >
              {updateRoomMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
