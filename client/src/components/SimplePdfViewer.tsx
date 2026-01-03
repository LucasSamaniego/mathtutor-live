import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Upload, 
  FileText,
  Loader2,
  ExternalLink,
  Users,
  RefreshCw
} from "lucide-react";

interface SimplePdfViewerProps {
  roomId: number;
  isHost: boolean;
  sessionId?: number | null;
}

interface DocumentData {
  id: number;
  title: string;
  s3Url: string | null;
}

/**
 * SimplePdfViewer - A streamlined PDF viewer for the sidebar
 * Shows only the PDF in a large, readable format
 */
export function SimplePdfViewer({ roomId, isHost, sessionId }: SimplePdfViewerProps) {
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
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
  const { data: syncState } = trpc.pdfSync.getState.useQuery(
    { sessionId: sessionId || 0 },
    { 
      enabled: !!sessionId && !isHost,
      refetchInterval: 2000,
    }
  );

  // Update sync state mutation (teacher only)
  const updateSyncMutation = trpc.pdfSync.updateState.useMutation();

  // Sync state to students when teacher changes document
  const syncToStudents = useCallback((docId: number | null) => {
    if (!isHost || !sessionId) return;
    
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

    if (syncState.documentId) {
      const doc = documents.find(d => d.id === syncState.documentId);
      if (doc && doc.s3Url && selectedDocId !== doc.id) {
        setSelectedDocId(doc.id);
        setSelectedPdf(doc.s3Url);
        setPdfError(null);
      }
    }
  }, [syncState, documents, isHost, selectedDocId]);

  // Upload mutation
  const uploadMutation = trpc.document.upload.useMutation({
    onSuccess: (data) => {
      toast.success("PDF enviado!");
      refetchDocs();
      setIsUploading(false);
      if (data?.s3Url) {
        setSelectedPdf(data.s3Url);
        setSelectedDocId(data.id);
        syncToStudents(data.id);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao enviar PDF");
      setIsUploading(false);
    },
  });

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
    if (localPdfUrl && localPdfUrl.startsWith('blob:')) {
      URL.revokeObjectURL(localPdfUrl);
    }
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
  }, [roomId, uploadMutation, localPdfUrl]);

  const handleSelectDocument = useCallback((doc: DocumentData) => {
    if (!doc.s3Url) {
      toast.error("URL do documento não disponível");
      return;
    }

    if (localPdfUrl && localPdfUrl.startsWith('blob:')) {
      URL.revokeObjectURL(localPdfUrl);
    }
    setLocalPdfUrl(null);
    
    setSelectedDocId(doc.id);
    setIsLoadingPdf(true);
    setPdfError(null);
    setSelectedPdf(doc.s3Url);
    setIsLoadingPdf(false);

    if (isHost) {
      syncToStudents(doc.id);
      toast.success("PDF sincronizado!");
    }
  }, [localPdfUrl, isHost, syncToStudents]);

  const openInNewTab = () => {
    if (selectedPdf) {
      window.open(selectedPdf, '_blank');
    }
  };

  // If no PDF selected, show document selector
  if (!selectedPdf) {
    return (
      <div className="h-full flex flex-col p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            PDF da Aula
          </h3>
          {!isHost && syncState?.documentId && (
            <Badge variant="secondary" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              Ao vivo
            </Badge>
          )}
        </div>

        {/* Upload button for teacher */}
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
              className="w-full mb-4 gap-2"
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

        {/* Document list */}
        <div className="flex-1 overflow-y-auto space-y-2" style={{ scrollbarWidth: 'thin' }}>
          {documents?.map((doc) => (
            <div
              key={doc.id}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                syncState?.documentId === doc.id
                  ? "bg-primary/10 border-primary/30"
                  : "hover:bg-muted border-transparent"
              }`}
              onClick={() => handleSelectDocument(doc)}
            >
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm truncate flex-1">{doc.title}</span>
              {!isHost && syncState?.documentId === doc.id && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  Ao vivo
                </Badge>
              )}
            </div>
          ))}

          {(!documents || documents.length === 0) && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {isHost ? "Envie um PDF para compartilhar" : "Aguardando professor..."}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // PDF Viewer (full size)
  return (
    <div className="h-full flex flex-col">
      {/* Minimal header */}
      <div className="h-10 bg-card border-b flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground truncate">
            {documents?.find(d => d.id === selectedDocId)?.title || "PDF"}
          </span>
          {!isHost && syncState?.documentId === selectedDocId && (
            <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
              <Users className="h-2.5 w-2.5" />
              Ao vivo
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon"
            className="h-7 w-7"
            onClick={openInNewTab}
            title="Abrir em nova aba"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          {isHost && (
            <Button 
              variant="ghost" 
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                if (localPdfUrl && localPdfUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(localPdfUrl);
                }
                setSelectedPdf(null);
                setSelectedDocId(null);
                setLocalPdfUrl(null);
              }}
              title="Trocar documento"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* PDF Content - Full size */}
      <div className="flex-1 overflow-hidden relative bg-slate-200 dark:bg-slate-800">
        {isLoadingPdf && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Carregando PDF...</p>
          </div>
        )}

        {pdfError ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <p className="text-destructive font-medium mb-2">Erro ao carregar</p>
            <Button variant="outline" size="sm" onClick={openInNewTab}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir em nova aba
            </Button>
          </div>
        ) : (
          <iframe
            src={selectedPdf}
            className="w-full h-full border-0"
            title="PDF Viewer"
            onLoad={() => {
              setIsLoadingPdf(false);
              setPdfError(null);
            }}
            onError={() => {
              setIsLoadingPdf(false);
              setPdfError("Erro ao carregar o PDF");
            }}
          />
        )}
      </div>
    </div>
  );
}
