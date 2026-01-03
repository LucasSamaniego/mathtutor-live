import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import "katex/dist/katex.min.css";
import katex from "katex";
import { 
  Copy, 
  Trash2, 
  Plus,
  BookOpen,
  Lightbulb
} from "lucide-react";
import { toast } from "sonner";

// Common LaTeX examples
const LATEX_EXAMPLES = [
  { label: "Fração", code: "\\frac{a}{b}" },
  { label: "Raiz Quadrada", code: "\\sqrt{x}" },
  { label: "Raiz N-ésima", code: "\\sqrt[n]{x}" },
  { label: "Potência", code: "x^{2}" },
  { label: "Índice", code: "x_{i}" },
  { label: "Integral", code: "\\int_{a}^{b} f(x) dx" },
  { label: "Somatório", code: "\\sum_{i=1}^{n} x_i" },
  { label: "Produtório", code: "\\prod_{i=1}^{n} x_i" },
  { label: "Limite", code: "\\lim_{x \\to \\infty} f(x)" },
  { label: "Derivada", code: "\\frac{df}{dx}" },
  { label: "Derivada Parcial", code: "\\frac{\\partial f}{\\partial x}" },
  { label: "Matriz 2x2", code: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
  { label: "Sistema de Equações", code: "\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}" },
  { label: "Pi", code: "\\pi" },
  { label: "Infinito", code: "\\infty" },
  { label: "Pertence", code: "\\in" },
  { label: "Não Pertence", code: "\\notin" },
  { label: "Subconjunto", code: "\\subset" },
  { label: "União", code: "\\cup" },
  { label: "Interseção", code: "\\cap" },
  { label: "Para Todo", code: "\\forall" },
  { label: "Existe", code: "\\exists" },
  { label: "Seta Direita", code: "\\rightarrow" },
  { label: "Seta Dupla", code: "\\Leftrightarrow" },
  { label: "Aproximadamente", code: "\\approx" },
  { label: "Diferente", code: "\\neq" },
  { label: "Menor ou Igual", code: "\\leq" },
  { label: "Maior ou Igual", code: "\\geq" },
  { label: "Vetor", code: "\\vec{v}" },
  { label: "Chapéu", code: "\\hat{x}" },
  { label: "Barra", code: "\\bar{x}" },
  { label: "Ponto (derivada)", code: "\\dot{x}" },
];

interface FormulaItem {
  id: string;
  latex: string;
  timestamp: Date;
}

export function LatexEditor() {
  const [inputLatex, setInputLatex] = useState("");
  const [renderedHtml, setRenderedHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedFormulas, setSavedFormulas] = useState<FormulaItem[]>([]);

  // Render LaTeX on input change
  useEffect(() => {
    if (!inputLatex.trim()) {
      setRenderedHtml("");
      setError(null);
      return;
    }

    try {
      const html = katex.renderToString(inputLatex, {
        displayMode: true,
        throwOnError: true,
        strict: false,
      });
      setRenderedHtml(html);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Erro de sintaxe LaTeX");
      setRenderedHtml("");
    }
  }, [inputLatex]);

  const handleSaveFormula = () => {
    if (!inputLatex.trim() || error) return;

    const newFormula: FormulaItem = {
      id: Date.now().toString(),
      latex: inputLatex,
      timestamp: new Date(),
    };

    setSavedFormulas((prev) => [newFormula, ...prev]);
    toast.success("Fórmula salva!");
  };

  const handleDeleteFormula = (id: string) => {
    setSavedFormulas((prev) => prev.filter((f) => f.id !== id));
  };

  const handleCopyLatex = (latex: string) => {
    navigator.clipboard.writeText(latex);
    toast.success("Copiado para a área de transferência!");
  };

  const handleInsertExample = (code: string) => {
    setInputLatex((prev) => prev + (prev ? " " : "") + code);
  };

  const renderSavedFormula = (latex: string) => {
    try {
      return katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return latex;
    }
  };

  return (
    <div className="h-full flex gap-4">
      {/* Main Editor */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Input Area */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Editor LaTeX
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={inputLatex}
              onChange={(e) => setInputLatex(e.target.value)}
              placeholder="Digite sua fórmula LaTeX aqui... Ex: \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
              className="font-mono min-h-[100px]"
            />
            
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSaveFormula}
                disabled={!inputLatex.trim() || !!error}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Salvar Fórmula
              </Button>
              <Button
                variant="outline"
                onClick={() => handleCopyLatex(inputLatex)}
                disabled={!inputLatex.trim()}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
              <Button
                variant="outline"
                onClick={() => setInputLatex("")}
                disabled={!inputLatex}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview Area */}
        <Card className="flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Visualização</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="min-h-[150px] flex items-center justify-center bg-muted/30 rounded-lg p-4">
              {renderedHtml ? (
                <div
                  className="text-2xl"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              ) : (
                <p className="text-muted-foreground">
                  A fórmula aparecerá aqui...
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Saved Formulas */}
        {savedFormulas.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Fórmulas Salvas</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {savedFormulas.map((formula) => (
                    <div
                      key={formula.id}
                      className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg"
                    >
                      <div
                        className="flex-1 overflow-x-auto"
                        dangerouslySetInnerHTML={{
                          __html: renderSavedFormula(formula.latex),
                        }}
                      />
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleCopyLatex(formula.latex)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setInputLatex(formula.latex)}
                        >
                          <BookOpen className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDeleteFormula(formula.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Examples Sidebar */}
      <Card className="w-72 shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Exemplos Rápidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-1">
              {LATEX_EXAMPLES.map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleInsertExample(example.code)}
                  className="w-full text-left p-2 rounded-lg hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{example.label}</span>
                    <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <code className="text-xs text-muted-foreground font-mono block truncate">
                    {example.code}
                  </code>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
