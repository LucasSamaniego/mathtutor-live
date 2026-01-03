import { useState, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
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
  AlertCircle
} from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker - use CDN with correct version
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  roomId: number;
  isHost: boolean;
}

interface DocumentData {
  id: number;
  title: string;
  s3Url: string | null;
}

export function PdfViewer({ roomId, isHost }: PdfViewerProps) {
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [isUploading, setIsUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setSelectedPdf(null);
        setSelectedDocId(null);
        setLocalPdfUrl(null);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao remover PDF");
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

    // Create local URL for immediate preview
    const localUrl = URL.createObjectURL(file);
    setLocalPdfUrl(localUrl);
    setSelectedPdf(localUrl);
    setSelectedDocId(null);
    setPageNumber(1);
    setPdfError(null);
    setIsLoadingPdf(true);

    // Also upload to server
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
  }, [roomId, uploadMutation]);

  const handleSelectDocument = useCallback(async (doc: DocumentData) => {
    setSelectedDocId(doc.id);
    setPdfError(null);
    setIsLoadingPdf(true);
    setPageNumber(1);
    
    // Clean up previous local URL if exists
    if (localPdfUrl) {
      URL.revokeObjectURL(localPdfUrl);
      setLocalPdfUrl(null);
    }

    if (doc.s3Url) {
      // Try to fetch the PDF and create a blob URL for better compatibility
      try {
        const response = await fetch(doc.s3Url);
        if (!response.ok) {
          throw new Error("Failed to fetch PDF");
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setSelectedPdf(blobUrl);
        setLocalPdfUrl(blobUrl);
      } catch (error) {
        console.error("Error fetching PDF:", error);
        // Fallback to direct URL
        setSelectedPdf(doc.s3Url);
      }
    }
  }, [localPdfUrl]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoadingPdf(false);
    setPdfError(null);
    toast.success(`PDF carregado: ${numPages} página(s)`);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error("PDF load error:", error);
    setIsLoadingPdf(false);
    setPdfError("Erro ao carregar o PDF. Tente novamente ou selecione outro arquivo.");
  }, []);

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  // Cleanup on unmount
  // Note: We don't use useEffect for cleanup because localPdfUrl changes frequently

  return (
    <div className="h-full flex gap-4">
      {/* Document List Sidebar */}
      <Card className="w-64 shrink-0 flex flex-col">
        <CardHeader className="pb-2 shrink-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-2 overflow-hidden">
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

          <div className="flex-1 overflow-y-auto space-y-1">
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
                <span className="text-sm truncate flex-1">{doc.title}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectDocument(doc);
                    }}
                    title="Visualizar"
                  >
                    <Eye className="h-3 w-3 text-muted-foreground" />
                  </Button>
                  {isHost && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
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
              </div>
            ))}

            {(!documents || documents.length === 0) && (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum documento
                </p>
                {isHost && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Clique em "Enviar PDF" para adicionar
                  </p>
                )}
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
            <div className="h-12 bg-card border-b flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPrevPage}
                  disabled={pageNumber <= 1 || isLoadingPdf}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm min-w-[120px] text-center">
                  {isLoadingPdf ? "Carregando..." : `Página ${pageNumber} de ${numPages}`}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNextPage}
                  disabled={pageNumber >= numPages || isLoadingPdf}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={zoomOut} disabled={isLoadingPdf}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm min-w-[60px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button variant="outline" size="icon" onClick={zoomIn} disabled={isLoadingPdf}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* PDF Content */}
            <div className="flex-1 overflow-auto flex justify-center p-4">
              {pdfError ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                  <p className="text-destructive font-medium mb-2">Erro ao carregar PDF</p>
                  <p className="text-sm text-muted-foreground mb-4">{pdfError}</p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setPdfError(null);
                      setSelectedPdf(null);
                      setSelectedDocId(null);
                    }}
                  >
                    Tentar outro arquivo
                  </Button>
                </div>
              ) : (
                <Document
                  file={selectedPdf}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="flex flex-col items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                      <p className="text-muted-foreground">Carregando PDF...</p>
                    </div>
                  }
                  error={
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      <AlertCircle className="h-8 w-8 text-destructive mb-4" />
                      <p className="text-destructive">Erro ao carregar PDF</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Verifique se o arquivo é um PDF válido
                      </p>
                    </div>
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    loading={
                      <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    }
                    className="shadow-lg"
                  />
                </Document>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto">
                <FileText className="h-10 w-10 text-muted-foreground/50" />
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
