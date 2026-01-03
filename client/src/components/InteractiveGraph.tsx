import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  LineChart, 
  Plus,
  Loader2,
  ZoomIn,
  ZoomOut,
  Move,
  RotateCcw
} from "lucide-react";

interface InteractiveGraphProps {
  sessionId: number;
  isHost: boolean;
}

type GraphType = "linear" | "quadratic" | "cubic" | "trigonometric" | "exponential" | "custom";

interface GraphConfig {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  color: string;
  showGrid: boolean;
}

const defaultConfig: GraphConfig = {
  xMin: -10,
  xMax: 10,
  yMin: -10,
  yMax: 10,
  color: "#3b82f6",
  showGrid: true,
};

export function InteractiveGraph({ sessionId, isHost }: InteractiveGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [equation, setEquation] = useState("y = x");
  const [graphType, setGraphType] = useState<GraphType>("linear");
  const [config, setConfig] = useState<GraphConfig>(defaultConfig);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Fetch active graph
  const { data: activeGraph, refetch: refetchGraph } = trpc.graph.getActive.useQuery(
    { sessionId },
    { 
      enabled: !!sessionId,
      refetchInterval: 3000,
    }
  );

  // Create graph mutation
  const createGraphMutation = trpc.graph.create.useMutation({
    onSuccess: () => {
      toast.success("Gráfico criado!");
      setShowCreateForm(false);
      refetchGraph();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Erro ao criar gráfico");
    },
  });

  // Parse equation and evaluate
  const evaluateEquation = useCallback((x: number, eq: string, type: GraphType): number | null => {
    try {
      // Clean the equation
      let cleanEq = eq.replace(/y\s*=\s*/i, "").trim();
      
      // Replace common math functions
      cleanEq = cleanEq
        .replace(/sen|sin/gi, "Math.sin")
        .replace(/cos/gi, "Math.cos")
        .replace(/tan/gi, "Math.tan")
        .replace(/sqrt/gi, "Math.sqrt")
        .replace(/abs/gi, "Math.abs")
        .replace(/log/gi, "Math.log")
        .replace(/exp/gi, "Math.exp")
        .replace(/\^/g, "**")
        .replace(/π|pi/gi, "Math.PI")
        .replace(/e(?![xp])/gi, "Math.E");

      // Replace x with the value
      const evalStr = cleanEq.replace(/x/gi, `(${x})`);
      
      // Evaluate safely
      const result = Function(`"use strict"; return (${evalStr})`)();
      
      if (typeof result === "number" && isFinite(result)) {
        return result;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Draw graph on canvas
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const currentConfig = activeGraph?.config ? JSON.parse(activeGraph.config) : config;
    const currentEquation = activeGraph?.equation || equation;
    const currentType = (activeGraph?.graphType || graphType) as GraphType;

    // Apply zoom and pan
    const xRange = (currentConfig.xMax - currentConfig.xMin) / zoom;
    const yRange = (currentConfig.yMax - currentConfig.yMin) / zoom;
    const xMin = currentConfig.xMin + panOffset.x;
    const xMax = xMin + xRange;
    const yMin = currentConfig.yMin + panOffset.y;
    const yMax = yMin + yRange;

    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    if (currentConfig.showGrid) {
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;

      // Vertical lines
      const xStep = xRange / 20;
      for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
        const px = ((x - xMin) / xRange) * width;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
        ctx.stroke();
      }

      // Horizontal lines
      const yStep = yRange / 20;
      for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
        const py = height - ((y - yMin) / yRange) * height;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(width, py);
        ctx.stroke();
      }
    }

    // Draw axes
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 2;

    // X axis
    if (yMin <= 0 && yMax >= 0) {
      const yAxisPos = height - ((0 - yMin) / yRange) * height;
      ctx.beginPath();
      ctx.moveTo(0, yAxisPos);
      ctx.lineTo(width, yAxisPos);
      ctx.stroke();
    }

    // Y axis
    if (xMin <= 0 && xMax >= 0) {
      const xAxisPos = ((0 - xMin) / xRange) * width;
      ctx.beginPath();
      ctx.moveTo(xAxisPos, 0);
      ctx.lineTo(xAxisPos, height);
      ctx.stroke();
    }

    // Draw function
    ctx.strokeStyle = currentConfig.color || "#3b82f6";
    ctx.lineWidth = 3;
    ctx.beginPath();

    let firstPoint = true;
    const step = xRange / width;

    for (let px = 0; px <= width; px++) {
      const x = xMin + (px / width) * xRange;
      const y = evaluateEquation(x, currentEquation, currentType);

      if (y !== null && y >= yMin && y <= yMax) {
        const py = height - ((y - yMin) / yRange) * height;
        
        if (firstPoint) {
          ctx.moveTo(px, py);
          firstPoint = false;
        } else {
          ctx.lineTo(px, py);
        }
      } else {
        firstPoint = true;
      }
    }

    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = "#374151";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";

    // X axis labels
    const xLabelStep = xRange / 10;
    for (let x = Math.ceil(xMin / xLabelStep) * xLabelStep; x <= xMax; x += xLabelStep) {
      if (Math.abs(x) > 0.001) {
        const px = ((x - xMin) / xRange) * width;
        const yAxisPos = yMin <= 0 && yMax >= 0 
          ? height - ((0 - yMin) / yRange) * height + 15
          : height - 5;
        ctx.fillText(x.toFixed(1), px, yAxisPos);
      }
    }

    // Y axis labels
    ctx.textAlign = "left";
    const yLabelStep = yRange / 10;
    for (let y = Math.ceil(yMin / yLabelStep) * yLabelStep; y <= yMax; y += yLabelStep) {
      if (Math.abs(y) > 0.001) {
        const py = height - ((y - yMin) / yRange) * height;
        const xAxisPos = xMin <= 0 && xMax >= 0 
          ? ((0 - xMin) / xRange) * width + 5
          : 5;
        ctx.fillText(y.toFixed(1), xAxisPos, py + 4);
      }
    }

    // Draw equation label
    ctx.fillStyle = currentConfig.color || "#3b82f6";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(currentEquation, 10, 25);
  }, [activeGraph, config, equation, graphType, zoom, panOffset, evaluateEquation]);

  // Redraw when dependencies change
  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  // Handle mouse events for pan
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const currentConfig = activeGraph?.config ? JSON.parse(activeGraph.config) : config;
    const xRange = (currentConfig.xMax - currentConfig.xMin) / zoom;
    const yRange = (currentConfig.yMax - currentConfig.yMin) / zoom;

    const dx = ((e.clientX - dragStart.x) / canvas.width) * xRange;
    const dy = ((e.clientY - dragStart.y) / canvas.height) * yRange;

    setPanOffset(prev => ({
      x: prev.x - dx,
      y: prev.y + dy,
    }));

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.5, 10));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.5, 0.1));
  const handleReset = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleCreateGraph = () => {
    createGraphMutation.mutate({
      sessionId,
      title: `Gráfico: ${equation}`,
      graphType,
      equation,
      config: JSON.stringify(config),
    });
  };

  const getEquationPlaceholder = (type: GraphType): string => {
    switch (type) {
      case "linear": return "y = 2x + 1";
      case "quadratic": return "y = x^2 - 4";
      case "cubic": return "y = x^3 - 3x";
      case "trigonometric": return "y = sin(x)";
      case "exponential": return "y = 2^x";
      default: return "y = x";
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <LineChart className="h-4 w-4 text-primary" />
            Gráfico Interativo
          </CardTitle>
          {isHost && !showCreateForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateForm(true)}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              Novo
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Create Form (Host Only) */}
        {isHost && showCreateForm && (
          <div className="space-y-3 mb-4 p-3 bg-muted/50 rounded-lg shrink-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={graphType} onValueChange={(v) => setGraphType(v as GraphType)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linear</SelectItem>
                    <SelectItem value="quadratic">Quadrática</SelectItem>
                    <SelectItem value="cubic">Cúbica</SelectItem>
                    <SelectItem value="trigonometric">Trigonométrica</SelectItem>
                    <SelectItem value="exponential">Exponencial</SelectItem>
                    <SelectItem value="custom">Personalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cor</Label>
                <Input
                  type="color"
                  value={config.color}
                  onChange={(e) => setConfig(prev => ({ ...prev, color: e.target.value }))}
                  className="h-8 p-1"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Equação</Label>
              <Input
                value={equation}
                onChange={(e) => setEquation(e.target.value)}
                placeholder={getEquationPlaceholder(graphType)}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateGraph}
                disabled={createGraphMutation.isPending}
                size="sm"
                className="flex-1"
              >
                {createGraphMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Criar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Graph Canvas */}
        <div className="flex-1 relative border rounded-lg overflow-hidden bg-white min-h-[200px]">
          <canvas
            ref={canvasRef}
            width={500}
            height={400}
            className="w-full h-full cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          {/* Zoom Controls */}
          <div className="absolute bottom-2 right-2 flex gap-1">
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7"
              onClick={handleReset}
              title="Reset"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>

          {/* No Graph Message */}
          {!activeGraph && !showCreateForm && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <div className="text-center text-muted-foreground">
                <LineChart className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum gráfico ativo</p>
                {isHost && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowCreateForm(true)}
                    className="mt-1"
                  >
                    Criar gráfico
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <p className="text-xs text-muted-foreground mt-2 shrink-0">
          Arraste para mover • Use os botões para zoom • Interaja com o gráfico
        </p>
      </CardContent>
    </Card>
  );
}
