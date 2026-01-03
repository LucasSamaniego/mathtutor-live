import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Upload, 
  FileText,
  Loader2,
  Trash2,
  AlertCircle,
  ExternalLink,
  X,
  Users,
  Share2
} from "lucide-react";

interface PdfViewerProps {
  roomId: number;
  isHost: boolean;
  sessionId?: number | null;
}

interface DocumentData {
  id: number;
  title: string;
  s3Url: string | null;
}

export function PdfViewer({ roomId, isHost, sessionId }: PdfViewerProps) {
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (localPdfUrl && localPdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(localPdfUrl);
      }
    };
  }, []);

  // Fetch documents
  const { data: documents, refetch: refetchDocs } = trpc.document.getByRoom.useQuery(
    { roomId },
    { enabled: !!roomId }
  );

  // PDF Sync State - for students to receive teacher's state
  const { data: syncState, refetch: refetchSyncState } = trpc.pdfSync.getState.useQuery(
    { sessionId: sessionId || 0 },
    { 
      enabled: !!sessionId && !isHost,
      refetchInterval: 2000, // Poll every 2 seconds for sync updates
    }
  );

  // Update sync state mutation (teacher only)
  const updateSyncMutation = trpc.pdfSync.updateState.useMutation({
    onSuccess: () => {
      setIsSyncing(false);
    },
    onError: (error) => {
      console.error("Sync error:", error);
      setIsSyncing(false);
    },
  });

  // Clear sync state mutation
  const clearSyncMutation = trpc.pdfSync.clearState.useMutation();

  // Sync state to students when teacher changes document
  const syncToStudents = useCallback((docId: number | null, docUrl: string | null) => {
    if (!isHost || !sessionId) return;
    
    setIsSyncing(true);
    updateSyncMutation.mutate({
      sessionId,
      documentId: docId,
      currentPage: 1,
      totalPages: 1,
    });
  }, [isHost, sessionId, updateSyncMutation]);

  // Student: auto-load document when sync state changes
  useEffect(() => {
    if (isHost || !syncState || !documents) return;

    // If teacher has a document selected
    if (syncState.documentId) {
      const doc = documents.find(d => d.id === syncState.documentId);
      if (doc && doc.s3Url && selectedDocId !== doc.id) {
        setSelectedDocId(doc.id);
        setSelectedPdf(doc.s3Url);
        setPdfError(null);
      }
    } else if (selectedDocId && !syncState.documentId) {
      // Teacher cleared the document
      clearPdfState();
    }
  }, [syncState, documents, isHost, selectedDocId]);

  // Upload mutation
  const uploadMutation = trpc.document.upload.useMutation({
    onSuccess: (data) => {
      toast.success("PDF enviado com sucesso!");
      refetchDocs();
      setIsUploading(false);
      // If we have a URL from the upload, use it
      if (data?.s3Url) {
        setSelectedPdf(data.s3Url);
        setSelectedDocId(data.id);
        // Sync to students
        syncToStudents(data.id, data.s3Url);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao enviar PDF");
      setIsUploading(false);
    },
  });

  // Delete mutation
  const deleteMutation = trpc.document.delete.useMutation({
    onSuccess: () => {
      toast.success("PDF removido!");
      refetchDocs();
      if (selectedDocId) {
        clearPdfState();
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao remover PDF");
    },
  });

  const clearPdfState = useCallback(() => {
    if (localPdfUrl && localPdfUrl.startsWith('blob:')) {
      URL.revokeObjectURL(localPdfUrl);
    }
    setSelectedPdf(null);
    setSelectedDocId(null);
    setLocalPdfUrl(null);
    setPdfError(null);
    setIsLoadingPdf(false);

    // Clear sync state if teacher
    if (isHost && sessionId) {
      clearSyncMutation.mutate({ sessionId });
    }
  }, [localPdfUrl, isHost, sessionId, clearSyncMutation]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Por favor, selecione um arquivo PDF");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 10MB");
      return;
    }

    // Clear previous state
    clearPdfState();
    setIsLoadingPdf(true);
    setPdfError(null);

    // Create local URL for immediate preview
    const localUrl = URL.createObjectURL(file);
    setLocalPdfUrl(localUrl);
    setSelectedPdf(localUrl);
    setSelectedDocId(null);
    setIsLoadingPdf(false);

    // Upload to server in background
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        roomId,
        title: file.name,
        fileData: base64,
        mimeType: file.type,
        fileSize: file.size,
      });
    };
    reader.onerror = () => {
      toast.error("Erro ao processar arquivo");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [roomId, uploadMutation, clearPdfState]);

  const handleSelectDocument = useCallback((doc: DocumentData) => {
    if (!doc.s3Url) {
      toast.error("URL do documento não disponível");
      return;
    }

    // Clear previous state first
    if (localPdfUrl && localPdfUrl.startsWith('blob:')) {
      URL.revokeObjectURL(localPdfUrl);
    }
    setLocalPdfUrl(null);
    
    setSelectedDocId(doc.id);
    setIsLoadingPdf(true);
    setPdfError(null);

    // Use the S3 URL directly
    setSelectedPdf(doc.s3Url);
    setIsLoadingPdf(false);

    // Sync to students if teacher
    if (isHost) {
      syncToStudents(doc.id, doc.s3Url);
      toast.success("PDF sincronizado com os alunos!");
    }
  }, [localPdfUrl, isHost, syncToStudents]);

  const handleIframeLoad = () => {
    setIsLoadingPdf(false);
    setPdfError(null);
  };

  const handleIframeError = () => {
    setIsLoadingPdf(false);
    setPdfError("Erro ao carregar o PDF no visualizador embutido.");
  };

  const openInNewTab = () => {
    if (selectedPdf) {
      window.open(selectedPdf, '_blank');
    }
  };

  return (
    <div className="h-full flex gap-4">
      {/* Document List Sidebar */}
      <Card className="w-56 shrink-0 flex flex-col">
        <CardHeader className="py-3 px-3 shrink-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-2 p-3 pt-0 overflow-hidden">
          {isHost && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full gap-2 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isUploading ? "Enviando..." : "Enviar PDF"}
              </Button>
            </>
          )}

          {/* Sync Status Indicator */}
          {sessionId && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded-md">
              <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {isHost ? (
                  isSyncing ? "Sincronizando..." : "Sincronizado"
                ) : (
                  syncState?.documentId ? "Recebendo do professor" : "Aguardando professor"
                )}
              </span>
              {(isSyncing || (!isHost && syncState?.documentId)) && (
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-auto" />
              )}
            </div>
          )}

          <div 
            className="flex-1 overflow-y-auto space-y-1" 
            style={{ scrollbarWidth: 'thin' }}
          >
            {documents?.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  selectedDocId === doc.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted"
                }`}
                onClick={() => handleSelectDocument(doc)}
              >
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs truncate flex-1" title={doc.title}>{doc.title}</span>
                {/* Show sync indicator for the synced document */}
                {!isHost && syncState?.documentId === doc.id && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    <Users className="h-2.5 w-2.5 mr-0.5" />
                    Ao vivo
                  </Badge>
                )}
                {isHost && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate({ id: doc.id });
                    }}
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            ))}

            {(!documents || documents.length === 0) && (
              <div className="text-center py-6">
                <FileText className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Nenhum documento
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* PDF Viewer */}
      <div className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
        {selectedPdf ? (
          <>
            {/* Controls */}
            <div className="h-11 bg-card border-b flex items-center justify-between px-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {documents?.find(d => d.id === selectedDocId)?.title || "Documento local"}
                </span>
                {!isHost && syncState?.documentId === selectedDocId && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Users className="h-3 w-3" />
                    Sincronizado
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={openInNewTab}
                  title="Abrir em nova aba"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Abrir
                </Button>
                {isHost && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearPdfState}
                    title="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* PDF Content */}
            <div className="flex-1 overflow-hidden relative">
              {isLoadingPdf && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">Carregando PDF...</p>
                </div>
              )}

              {pdfError ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <AlertCircle className="h-10 w-10 text-destructive mb-3" />
                  <p className="text-destructive font-medium mb-2">Erro ao carregar PDF</p>
                  <p className="text-sm text-muted-foreground mb-4 max-w-xs">{pdfError}</p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    <Button variant="outline" size="sm" onClick={openInNewTab}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir em nova aba
                    </Button>
                    {isHost && (
                      <Button variant="outline" size="sm" onClick={clearPdfState}>
                        Fechar
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <iframe
                  src={selectedPdf}
                  className="w-full h-full border-0"
                  title="PDF Viewer"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-muted-foreground font-medium">
                  Nenhum documento selecionado
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isHost 
                    ? "Envie um PDF ou selecione um da lista para compartilhar com os alunos" 
                    : "Aguarde o professor compartilhar um documento"
                  }
                </p>
              </div>
              {isHost && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Enviar PDF
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
