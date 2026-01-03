import { useState, useRef, useCallback, useEffect, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Eye,
  AlertCircle,
  RefreshCw
} from "lucide-react";

interface PdfViewerProps {
  roomId: number;
  isHost: boolean;
}

interface DocumentData {
  id: number;
  title: string;
  s3Url: string | null;
}

// Lazy load react-pdf to avoid blocking the main thread
const LazyDocument = lazy(() => 
  import("react-pdf").then(module => {
    // Set up PDF.js worker
    module.pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${module.pdfjs.version}/pdf.worker.min.js`;
    return { default: module.Document };
  })
);

const LazyPage = lazy(() => 
  import("react-pdf").then(module => ({ default: module.Page }))
);

// Import CSS for react-pdf
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

export function PdfViewer({ roomId, isHost }: PdfViewerProps) {
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isUploading, setIsUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (localPdfUrl) {
        URL.revokeObjectURL(localPdfUrl);
      }
    };
  }, []);

  // Fetch documents
  const { data: documents, refetch: refetchDocs } = trpc.document.getByRoom.useQuery(
    { roomId },
    { enabled: !!roomId }
  );

  // Upload mutation
  const uploadMutation = trpc.document.upload.useMutation({
    onSuccess: () => {
      toast.success("PDF enviado com sucesso!");
      refetchDocs();
      setIsUploading(false);
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
    if (localPdfUrl) {
      URL.revokeObjectURL(localPdfUrl);
    }
    setSelectedPdf(null);
    setSelectedDocId(null);
    setLocalPdfUrl(null);
    setNumPages(0);
    setPageNumber(1);
    setPdfError(null);
    setIsLoadingPdf(false);
    setPdfReady(false);
  }, [localPdfUrl]);

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

    // Use setTimeout to allow UI to update before heavy operations
    setTimeout(() => {
      // Create local URL for immediate preview
      const localUrl = URL.createObjectURL(file);
      setLocalPdfUrl(localUrl);
      setSelectedPdf(localUrl);
      setSelectedDocId(null);
      setPageNumber(1);
      setPdfError(null);
      setIsLoadingPdf(true);
      setPdfReady(false);

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
    }, 50);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [roomId, uploadMutation, clearPdfState]);

  const handleSelectDocument = useCallback(async (doc: DocumentData) => {
    if (!doc.s3Url) {
      toast.error("URL do documento não disponível");
      return;
    }

    // Clear previous state first
    clearPdfState();

    setSelectedDocId(doc.id);
    setPdfError(null);
    setIsLoadingPdf(true);
    setPageNumber(1);
    setPdfReady(false);

    // Use setTimeout to prevent UI blocking
    setTimeout(async () => {
      try {
        const response = await fetch(doc.s3Url!, {
          mode: 'cors',
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setSelectedPdf(blobUrl);
        setLocalPdfUrl(blobUrl);
      } catch (error) {
        console.error("Error fetching PDF:", error);
        // Try direct URL as fallback
        setSelectedPdf(doc.s3Url);
        setLocalPdfUrl(null);
      }
    }, 50);
  }, [clearPdfState]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoadingPdf(false);
    setPdfError(null);
    setPdfReady(true);
    toast.success(`PDF carregado: ${numPages} página(s)`);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error("PDF load error:", error);
    setIsLoadingPdf(false);
    setPdfReady(false);
    setPdfError("Erro ao carregar o PDF. Tente novamente ou selecione outro arquivo.");
  }, []);

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 2.5));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const retryLoad = () => {
    if (selectedPdf) {
      setPdfError(null);
      setIsLoadingPdf(true);
      setPdfReady(false);
      // Force re-render by setting a new reference
      const currentPdf = selectedPdf;
      setSelectedPdf(null);
      setTimeout(() => setSelectedPdf(currentPdf), 100);
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

          <div className="flex-1 overflow-y-auto space-y-1" style={{ scrollbarWidth: 'thin' }}>
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
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPrevPage}
                  disabled={pageNumber <= 1 || isLoadingPdf || !pdfReady}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs min-w-[90px] text-center px-2">
                  {isLoadingPdf ? "Carregando..." : `${pageNumber} / ${numPages}`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={pageNumber >= numPages || isLoadingPdf || !pdfReady}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={zoomOut} disabled={isLoadingPdf || !pdfReady}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs min-w-[50px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button variant="outline" size="sm" onClick={zoomIn} disabled={isLoadingPdf || !pdfReady}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* PDF Content */}
            <div className="flex-1 overflow-auto flex justify-center p-4" style={{ scrollbarWidth: 'thin' }}>
              {pdfError ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <AlertCircle className="h-10 w-10 text-destructive mb-3" />
                  <p className="text-destructive font-medium mb-2">Erro ao carregar PDF</p>
                  <p className="text-sm text-muted-foreground mb-4 max-w-xs">{pdfError}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={retryLoad}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Tentar novamente
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearPdfState}>
                      Fechar
                    </Button>
                  </div>
                </div>
              ) : (
                <Suspense fallback={
                  <div className="flex flex-col items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                    <p className="text-sm text-muted-foreground">Carregando visualizador...</p>
                  </div>
                }>
                  <LazyDocument
                    file={selectedPdf}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className="flex flex-col items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                        <p className="text-sm text-muted-foreground">Carregando PDF...</p>
                      </div>
                    }
                    error={
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                        <AlertCircle className="h-8 w-8 text-destructive mb-3" />
                        <p className="text-destructive">Erro ao carregar PDF</p>
                      </div>
                    }
                  >
                    {pdfReady && (
                      <LazyPage
                        pageNumber={pageNumber}
                        scale={scale}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        loading={
                          <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          </div>
                        }
                        className="shadow-lg"
                      />
                    )}
                  </LazyDocument>
                </Suspense>
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
                    ? "Envie um PDF ou selecione um da lista" 
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
