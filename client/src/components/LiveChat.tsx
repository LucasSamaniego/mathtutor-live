import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Send, 
  MessageCircle,
  Loader2,
  Users
} from "lucide-react";

interface LiveChatProps {
  sessionId: number;
  participantId: number;
  participantName: string;
  isHost: boolean;
}

interface ChatMessageType {
  id: number;
  senderName: string;
  message: string;
  createdAt: Date;
  participantId: number;
}

export function LiveChat({ sessionId, participantId, participantName, isHost }: LiveChatProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch messages with polling for real-time updates
  const { data: messages, refetch } = trpc.liveChat.getMessages.useQuery(
    { sessionId },
    { 
      enabled: !!sessionId,
      refetchInterval: 2000, // Poll every 2 seconds
    }
  );

  // Send message mutation
  const sendMessageMutation = trpc.liveChat.sendMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      refetch();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Erro ao enviar mensagem");
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!message.trim()) return;

    sendMessageMutation.mutate({
      sessionId,
      participantId,
      senderName: participantName,
      message: message.trim(),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-orange-500",
      "bg-pink-500",
      "bg-teal-500",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0 border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Chat da Aula
          {messages && messages.length > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {messages.length} mensagens
            </span>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages && messages.length > 0 ? (
              messages.map((msg: ChatMessageType) => {
                const isOwnMessage = msg.participantId === participantId;
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${isOwnMessage ? "flex-row-reverse" : ""}`}
                  >
                    <Avatar className={`h-8 w-8 shrink-0 ${getAvatarColor(msg.senderName)}`}>
                      <AvatarFallback className="text-white text-xs">
                        {getInitials(msg.senderName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex flex-col ${isOwnMessage ? "items-end" : ""}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">
                          {isOwnMessage ? "Você" : msg.senderName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      <div
                        className={`rounded-lg px-3 py-2 max-w-[220px] ${
                          isOwnMessage
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm break-words">{msg.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma mensagem ainda</p>
                <p className="text-xs mt-1">Seja o primeiro a enviar uma mensagem!</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t shrink-0">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              className="flex-1"
              disabled={sendMessageMutation.isPending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || sendMessageMutation.isPending}
              size="icon"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
