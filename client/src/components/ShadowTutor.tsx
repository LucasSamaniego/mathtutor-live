import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, Send, Loader2, Brain, User } from "lucide-react";
import { Streamdown } from "streamdown";
import "katex/dist/katex.min.css";
import katex from "katex";

interface ShadowTutorProps {
  sessionId: number;
  participantId: number;
  onClose: () => void;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

// Function to render LaTeX in text
function renderLatexInText(text: string): string {
  // Replace display math $$...$$ 
  let result = text.replace(/\$\$(.*?)\$\$/g, (_, latex) => {
    try {
      return katex.renderToString(latex, { displayMode: true, throwOnError: false });
    } catch {
      return `$$${latex}$$`;
    }
  });
  
  // Replace inline math $...$
  result = result.replace(/\$([^$]+)\$/g, (_, latex) => {
    try {
      return katex.renderToString(latex, { displayMode: false, throwOnError: false });
    } catch {
      return `$${latex}$`;
    }
  });
  
  return result;
}

export function ShadowTutor({ sessionId, participantId, onClose }: ShadowTutorProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch chat history
  const { data: history, refetch: refetchHistory } = trpc.shadowTutor.getHistory.useQuery(
    { participantId },
    { refetchInterval: false }
  );

  // Chat mutation
  const chatMutation = trpc.shadowTutor.chat.useMutation({
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: () => {
      refetchHistory();
      setIsTyping(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao enviar mensagem");
      setIsTyping(false);
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isTyping]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (!message.trim() || chatMutation.isPending) return;

    chatMutation.mutate({
      sessionId,
      participantId,
      message: message.trim(),
    });
    setMessage("");
  };

  return (
    <aside className="w-80 border-l bg-card flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <span className="font-semibold">Shadow Tutor</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Chat Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--muted-foreground) / 0.3) transparent' }}
      >
        <div className="space-y-4">
          {/* Welcome message */}
          {(!history || history.length === 0) && (
            <div className="text-center py-8 space-y-2">
              <Brain className="h-12 w-12 text-primary/50 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Olá! Sou seu assistente de matemática. Pergunte suas dúvidas aqui sem interromper a aula!
              </p>
            </div>
          )}

          {/* Messages */}
          {history?.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div 
                    className="text-sm prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: renderLatexInText(msg.content) }}
                  />
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-2 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua dúvida..."
            disabled={chatMutation.isPending}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!message.trim() || chatMutation.isPending}
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Use $ para fórmulas: $x^2 + y^2$
        </p>
      </div>
    </aside>
  );
}
