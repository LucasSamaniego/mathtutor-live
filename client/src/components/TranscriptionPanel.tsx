import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  FileText, 
  Plus,
  Loader2,
  Copy,
  Download,
  Trash2
} from "lucide-react";

interface TranscriptionPanelProps {
  sessionId: number;
  isHost: boolean;
}

export function TranscriptionPanel({ sessionId, isHost }: TranscriptionPanelProps) {
  const [newTranscription, setNewTranscription] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Fetch transcriptions
  const { data: transcriptions, refetch: refetchTranscriptions } = trpc.transcription.getBySession.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  // Create transcription mutation
  const createTranscriptionMutation = trpc.transcription.create.useMutation({
    onSuccess: () => {
      toast.success("Transcrição adicionada!");
      setNewTranscription("");
      setIsAdding(false);
      refetchTranscriptions();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao adicionar transcrição");
    },
  });

  const handleAddTranscription = () => {
    if (!newTranscription.trim()) {
      toast.error("Digite o conteúdo da transcrição");
      return;
    }

    createTranscriptionMutation.mutate({
      sessionId,
      content: newTranscription.trim(),
    });
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copiado para a área de transferência!");
  };

  const handleDownload = (content: string, id: number) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcricao-${id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcrições / Notas de Aula
          </CardTitle>
          {isHost && !isAdding && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              Adicionar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {/* Add New Transcription */}
        {isAdding && isHost && (
          <div className="space-y-2 mb-4 shrink-0">
            <Textarea
              value={newTranscription}
              onChange={(e) => setNewTranscription(e.target.value)}
              placeholder="Digite ou cole a transcrição da aula aqui..."
              className="min-h-[100px]"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleAddTranscription}
                disabled={createTranscriptionMutation.isPending}
                size="sm"
              >
                {createTranscriptionMutation.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                )}
                Salvar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setNewTranscription("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Transcriptions List */}
        <ScrollArea className="flex-1">
          <div className="space-y-3">
            {transcriptions && transcriptions.length > 0 ? (
              transcriptions.map((trans) => (
                <Card key={trans.id} className="bg-muted/30">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={trans.status === "ready" ? "default" : "secondary"}>
                          {trans.status === "ready" ? "Pronto" : "Processando"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(trans.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopy(trans.content)}
                          title="Copiar"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleDownload(trans.content, trans.id)}
                          title="Baixar"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap line-clamp-5">
                      {trans.content}
                    </p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma transcrição disponível</p>
                {isHost && (
                  <p className="text-xs mt-1">
                    Clique em "Adicionar" para criar uma nota de aula
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Info */}
        <div className="mt-4 pt-4 border-t shrink-0">
          <p className="text-xs text-muted-foreground">
            As transcrições podem ser geradas automaticamente a partir das gravações 
            ou adicionadas manualmente pelo professor.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
