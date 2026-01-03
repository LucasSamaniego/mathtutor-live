import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import katex from "katex";
import { 
  Trophy, 
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Timer,
  Star,
  Medal,
  Target
} from "lucide-react";

interface GamificationProps {
  sessionId: number;
  participantId: number;
  isHost: boolean;
}

export function Gamification({ sessionId, participantId, isHost }: GamificationProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [questionLatex, setQuestionLatex] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [points, setPoints] = useState(10);
  const [timeLimit, setTimeLimit] = useState<number | undefined>(undefined);
  const [answer, setAnswer] = useState("");
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; correctAnswer: string } | null>(null);

  // Fetch active exercise
  const { data: activeExercise, refetch: refetchExercise } = trpc.exercise.getActive.useQuery(
    { sessionId },
    { 
      enabled: !!sessionId,
      refetchInterval: 2000,
    }
  );

  // Fetch ranking
  const { data: ranking, refetch: refetchRanking } = trpc.score.getRanking.useQuery(
    { sessionId },
    { 
      enabled: !!sessionId,
      refetchInterval: 3000,
    }
  );

  // Fetch my score
  const { data: myScore } = trpc.score.getMyScore.useQuery(
    { sessionId, participantId },
    { enabled: !!sessionId && !!participantId }
  );

  // Create exercise mutation
  const createExerciseMutation = trpc.exercise.create.useMutation({
    onSuccess: () => {
      toast.success("Exercício criado!");
      setShowCreateForm(false);
      setQuestion("");
      setQuestionLatex("");
      setCorrectAnswer("");
      setPoints(10);
      setTimeLimit(undefined);
      refetchExercise();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Erro ao criar exercício");
    },
  });

  // Submit answer mutation
  const submitAnswerMutation = trpc.exercise.submitAnswer.useMutation({
    onSuccess: (result) => {
      setHasAnswered(true);
      setLastResult({
        isCorrect: result.isCorrect ?? false,
        correctAnswer: result.correctAnswer,
      });
      refetchRanking();
      
      if (result.isCorrect === true) {
        toast.success(`Correto! +${result.pointsEarned} pontos`);
      } else {
        toast.error(`Incorreto. A resposta era: ${result.correctAnswer}`);
      }
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Erro ao enviar resposta");
    },
  });

  // End exercise mutation
  const endExerciseMutation = trpc.exercise.endExercise.useMutation({
    onSuccess: () => {
      toast.success("Exercício encerrado!");
      refetchExercise();
    },
  });

  // Timer effect
  useEffect(() => {
    if (activeExercise?.timeLimit && !hasAnswered) {
      const startTime = new Date(activeExercise.createdAt).getTime();
      const endTime = startTime + activeExercise.timeLimit * 1000;
      
      const updateTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeRemaining(remaining);
        
        if (remaining === 0 && !hasAnswered) {
          setHasAnswered(true);
          toast.error("Tempo esgotado!");
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeRemaining(null);
    }
  }, [activeExercise, hasAnswered]);

  // Reset state when exercise changes
  useEffect(() => {
    if (activeExercise) {
      setHasAnswered(false);
      setLastResult(null);
      setAnswer("");
    }
  }, [activeExercise?.id]);

  const handleCreateExercise = () => {
    if (!question.trim() || !correctAnswer.trim()) {
      toast.error("Preencha a pergunta e a resposta correta");
      return;
    }

    createExerciseMutation.mutate({
      sessionId,
      question: question.trim(),
      questionLatex: questionLatex.trim() || undefined,
      correctAnswer: correctAnswer.trim(),
      points,
      timeLimit,
    });
  };

  const handleSubmitAnswer = () => {
    if (!activeExercise || !answer.trim()) return;

    submitAnswerMutation.mutate({
      exerciseId: activeExercise.id,
      participantId,
      answer: answer.trim(),
    });
  };

  const renderLatex = (latex: string) => {
    try {
      return katex.renderToString(latex, { throwOnError: false });
    } catch {
      return latex;
    }
  };

  const getRankIcon = (position: number) => {
    switch (position) {
      case 0: return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 1: return <Medal className="h-4 w-4 text-gray-400" />;
      case 2: return <Medal className="h-4 w-4 text-amber-600" />;
      default: return <Star className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Desafios
            {myScore && (
              <Badge variant="secondary" className="ml-2">
                {myScore.totalPoints} pts
              </Badge>
            )}
          </CardTitle>
          {isHost && !showCreateForm && !activeExercise && (
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
        {/* Create Exercise Form (Host Only) */}
        {isHost && showCreateForm && (
          <div className="space-y-3 mb-4 p-3 bg-muted/50 rounded-lg shrink-0">
            <div className="space-y-1">
              <Label className="text-xs">Pergunta</Label>
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Qual é o valor de x em 2x + 5 = 15?"
                className="min-h-[60px] text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">LaTeX (opcional)</Label>
              <Input
                value={questionLatex}
                onChange={(e) => setQuestionLatex(e.target.value)}
                placeholder="2x + 5 = 15"
                className="h-8 text-xs font-mono"
              />
              {questionLatex && (
                <div 
                  className="p-2 bg-white rounded text-center"
                  dangerouslySetInnerHTML={{ __html: renderLatex(questionLatex) }}
                />
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Resposta</Label>
                <Input
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  placeholder="5"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pontos</Label>
                <Input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tempo (s)</Label>
                <Input
                  type="number"
                  value={timeLimit || ""}
                  onChange={(e) => setTimeLimit(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="∞"
                  min={10}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateExercise}
                disabled={createExerciseMutation.isPending}
                size="sm"
                className="flex-1"
              >
                {createExerciseMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Enviar Desafio
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

        {/* Active Exercise */}
        {activeExercise && (
          <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-lg shrink-0">
            {/* Timer */}
            {timeRemaining !== null && (
              <div className="flex items-center gap-2 mb-3">
                <Timer className="h-4 w-4 text-primary" />
                <Progress 
                  value={(timeRemaining / (activeExercise.timeLimit || 60)) * 100} 
                  className="flex-1 h-2"
                />
                <span className={`text-sm font-mono ${timeRemaining < 10 ? "text-red-500" : ""}`}>
                  {timeRemaining}s
                </span>
              </div>
            )}

            {/* Question */}
            <div className="mb-3">
              <Badge variant="secondary" className="mb-2">
                {activeExercise.points} pontos
              </Badge>
              <p className="text-sm font-medium">{activeExercise.question}</p>
              {activeExercise.questionLatex && (
                <div 
                  className="mt-2 p-2 bg-white rounded text-center text-lg"
                  dangerouslySetInnerHTML={{ __html: renderLatex(activeExercise.questionLatex) }}
                />
              )}
            </div>

            {/* Answer Input (Student) */}
            {!isHost && !hasAnswered && (
              <div className="flex gap-2">
                <Input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Sua resposta..."
                  className="flex-1"
                  onKeyPress={(e) => e.key === "Enter" && handleSubmitAnswer()}
                  disabled={submitAnswerMutation.isPending}
                />
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={!answer.trim() || submitAnswerMutation.isPending}
                >
                  {submitAnswerMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Enviar"
                  )}
                </Button>
              </div>
            )}

            {/* Result Feedback */}
            {hasAnswered && lastResult && (
              <div className={`flex items-center gap-2 p-2 rounded ${
                lastResult.isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                {lastResult.isCorrect ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <span className="text-sm font-medium">
                  {lastResult.isCorrect 
                    ? "Correto!" 
                    : `Incorreto. Resposta: ${lastResult.correctAnswer}`
                  }
                </span>
              </div>
            )}

            {/* End Exercise Button (Host) */}
            {isHost && (
              <Button
                variant="destructive"
                size="sm"
                className="mt-3 w-full"
                onClick={() => endExerciseMutation.mutate({ exerciseId: activeExercise.id })}
                disabled={endExerciseMutation.isPending}
              >
                Encerrar Desafio
              </Button>
            )}
          </div>
        )}

        {/* Ranking */}
        <div className="flex-1 overflow-hidden">
          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Trophy className="h-3 w-3" />
            Ranking
          </h4>
          <ScrollArea className="h-full">
            {ranking && ranking.length > 0 ? (
              <div className="space-y-2">
                {ranking.map((score, index) => (
                  <div
                    key={score.id}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      score.participantId === participantId 
                        ? "bg-primary/10 border border-primary/20" 
                        : "bg-muted/50"
                    }`}
                  >
                    <div className="w-6 flex justify-center">
                      {getRankIcon(index)}
                    </div>
                    <span className="flex-1 text-sm truncate">
                      {score.participantName}
                      {score.participantId === participantId && " (você)"}
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-bold">{score.totalPoints}</span>
                      <span className="text-xs text-muted-foreground ml-1">pts</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {score.correctAnswers}/{score.totalAnswers}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma pontuação ainda</p>
                <p className="text-xs">Responda desafios para ganhar pontos!</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
