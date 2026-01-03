import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Send, 
  MessageCircle,
  Loader2,
  Users,
  Bell,
  BellOff
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMessageCountRef = useRef(0);

  // Track window focus for notifications
  useEffect(() => {
    const handleFocus = () => {
      setIsWindowFocused(true);
      setUnreadCount(0);
    };
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!notificationsEnabled) return;
    
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      // Ignore audio errors
    }
  }, [notificationsEnabled]);

  // Fetch messages with polling for real-time updates
  const { data: messages, refetch } = trpc.liveChat.getMessages.useQuery(
    { sessionId },
    { 
      enabled: !!sessionId,
      refetchInterval: 2000,
    }
  );

  // Check for new messages and notify
  useEffect(() => {
    if (!messages) return;
    
    const currentCount = messages.length;
    const previousCount = lastMessageCountRef.current;
    
    if (currentCount > previousCount && previousCount > 0) {
      const newMessages = messages.slice(previousCount);
      const hasNewFromOthers = newMessages.some(
        (msg: ChatMessageType) => msg.participantId !== participantId
      );
      
      if (hasNewFromOthers) {
        // Play sound notification
        playNotificationSound();
        
        // Show toast notification
        const lastNewMsg = newMessages[newMessages.length - 1];
        if (lastNewMsg && lastNewMsg.participantId !== participantId) {
          toast.info(`${lastNewMsg.senderName}: ${lastNewMsg.message.slice(0, 50)}${lastNewMsg.message.length > 50 ? '...' : ''}`, {
            duration: 3000,
          });
        }
        
        // Update unread count if window not focused
        if (!isWindowFocused) {
          setUnreadCount(prev => prev + newMessages.filter((m: ChatMessageType) => m.participantId !== participantId).length);
        }
      }
    }
    
    lastMessageCountRef.current = currentCount;
  }, [messages, participantId, isWindowFocused, playNotificationSound]);

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
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
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
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="py-3 px-4 shrink-0 border-b bg-card">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Chat da Aula
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5">
              {unreadCount}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            {messages && messages.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {messages.length} msgs
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              title={notificationsEnabled ? "Desativar notificações" : "Ativar notificações"}
            >
              {notificationsEnabled ? (
                <Bell className="h-3.5 w-3.5 text-primary" />
              ) : (
                <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
        {/* Messages Area with explicit scrollbar */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-0"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'hsl(var(--border)) transparent'
          }}
        >
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
                    <div className={`flex flex-col max-w-[75%] ${isOwnMessage ? "items-end" : ""}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">
                          {isOwnMessage ? "Você" : msg.senderName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      <div
                        className={`rounded-lg px-3 py-2 ${
                          isOwnMessage
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
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
            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-3 border-t shrink-0 bg-card">
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
