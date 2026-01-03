import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { storagePut, storageGet } from "./storage";
import * as db from "./db";

// Shadow Tutor system prompt
const SHADOW_TUTOR_SYSTEM_PROMPT = `Você é um assistente tutor de matemática útil. Responda dúvidas específicas do aluno de forma concisa sem interromper o fluxo da aula principal. Use LaTeX para fórmulas.

Diretrizes:
- Seja conciso e direto nas respostas
- Use notação LaTeX para fórmulas matemáticas (ex: $x^2 + y^2 = r^2$)
- Explique conceitos de forma clara e acessível
- Se o aluno estiver confuso, ofereça exemplos práticos
- Mantenha um tom amigável e encorajador
- Responda sempre em português brasileiro`;

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== ROOM ROUTES ====================
  room: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        allowGuests: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const slug = nanoid(10);
        
        const room = await db.createRoom({
          slug,
          name: input.name,
          description: input.description ?? null,
          hostId: ctx.user.id,
          allowGuests: input.allowGuests,
          isActive: true,
        });

        if (!room) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar sala" });
        }

        // Notify owner about new room creation
        await notifyOwner({
          title: "Nova Sala de Tutoria Criada",
          content: `Uma nova sala "${input.name}" foi criada por ${ctx.user.name || ctx.user.email || "Usuário"}.\n\nSlug: ${slug}\nDescrição: ${input.description || "Sem descrição"}`
        });

        return room;
      }),

    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const room = await db.getRoomBySlug(input.slug);
        if (!room) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sala não encontrada" });
        }
        
        // Get host info
        const host = await db.getUserById(room.hostId);
        
        return {
          ...room,
          hostName: host?.name || "Professor"
        };
      }),

    getMyRooms: protectedProcedure.query(async ({ ctx }) => {
      return db.getRoomsByHost(ctx.user.id);
    }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        allowGuests: z.boolean().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.id);
        if (!room || room.hostId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para editar esta sala" });
        }

        const { id, ...updateData } = input;
        await db.updateRoom(id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.id);
        if (!room || room.hostId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para excluir esta sala" });
        }

        await db.deleteRoom(input.id);
        return { success: true };
      }),
  }),

  // ==================== SESSION ROUTES ====================
  session: router({
    start: protectedProcedure
      .input(z.object({
        roomId: z.number(),
        title: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.roomId);
        if (!room || room.hostId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o professor pode iniciar sessões" });
        }

        // Check if there's already an active session
        const activeSession = await db.getActiveSessionByRoom(input.roomId);
        if (activeSession) {
          throw new TRPCError({ code: "CONFLICT", message: "Já existe uma sessão ativa nesta sala" });
        }

        const session = await db.createSession({
          roomId: input.roomId,
          title: input.title ?? `Aula ${new Date().toLocaleDateString('pt-BR')}`,
          status: "active",
        });

        if (!session) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar sessão" });
        }

        // Add teacher as participant
        await db.addParticipant({
          sessionId: session.id,
          userId: ctx.user.id,
          role: "teacher",
          visibleName: ctx.user.name || "Professor",
        });

        // Notify owner
        await notifyOwner({
          title: "Nova Sessão de Tutoria Iniciada",
          content: `Uma nova sessão foi iniciada na sala "${room.name}".\n\nTítulo: ${session.title}\nProfessor: ${ctx.user.name || ctx.user.email}`
        });

        return session;
      }),

    end: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
        }

        const room = await db.getRoomById(session.roomId);
        if (!room || room.hostId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o professor pode encerrar sessões" });
        }

        await db.endSession(input.sessionId);

        // Get participants for summary
        const participants = await db.getParticipantsBySession(input.sessionId);
        const participantNames = participants.map(p => p.visibleName || p.guestName || "Anônimo").join(", ");

        // Calculate duration
        const endedSession = await db.getSessionById(input.sessionId);
        const durationMinutes = endedSession?.duration ? Math.floor(endedSession.duration / 60) : 0;

        // Notify owner with session summary
        await notifyOwner({
          title: "Sessão de Tutoria Finalizada",
          content: `A sessão "${session.title}" na sala "${room.name}" foi finalizada.\n\nDuração: ${durationMinutes} minutos\nParticipantes: ${participantNames}\nTotal de participantes: ${participants.length}`
        });

        return { success: true };
      }),

    getActive: publicProcedure
      .input(z.object({ roomId: z.number() }))
      .query(async ({ input }) => {
        return db.getActiveSessionByRoom(input.roomId);
      }),

    getByRoom: publicProcedure
      .input(z.object({ roomId: z.number() }))
      .query(async ({ input }) => {
        return db.getSessionsByRoom(input.roomId);
      }),

    join: publicProcedure
      .input(z.object({
        sessionId: z.number(),
        guestName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.sessionId);
        if (!session || session.status !== "active") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada ou não está ativa" });
        }

        const room = await db.getRoomById(session.roomId);
        if (!room) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sala não encontrada" });
        }

        // Check if guests are allowed
        if (!room.allowGuests && !ctx.user) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Esta sala não permite convidados" });
        }

        const isTeacher = ctx.user && room.hostId === ctx.user.id;
        const visibleName = ctx.user?.name || input.guestName || "Convidado";

        const participant = await db.addParticipant({
          sessionId: input.sessionId,
          userId: ctx.user?.id ?? null,
          guestName: ctx.user ? null : input.guestName,
          role: isTeacher ? "teacher" : (ctx.user ? "student" : "guest"),
          visibleName,
        });

        if (!participant) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao entrar na sessão" });
        }

        // Notify owner when student joins
        if (!isTeacher) {
          await notifyOwner({
            title: "Aluno Entrou na Sessão",
            content: `${visibleName} entrou na sessão "${session.title}" na sala "${room.name}".`
          });
        }

        return participant;
      }),

    leave: publicProcedure
      .input(z.object({ participantId: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateParticipantLeft(input.participantId);
        return { success: true };
      }),

    getParticipants: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return db.getActiveParticipantsBySession(input.sessionId);
      }),
  }),

  // ==================== SHADOW TUTOR (AI CHAT) ROUTES ====================
  shadowTutor: router({
    chat: publicProcedure
      .input(z.object({
        sessionId: z.number(),
        participantId: z.number(),
        message: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        // Save user message
        await db.addChatMessage({
          sessionId: input.sessionId,
          participantId: input.participantId,
          role: "user",
          content: input.message,
        });

        // Get chat history for context
        const history = await db.getChatMessagesByParticipant(input.participantId);
        
        // Build messages array for LLM
        const messages = [
          { role: "system" as const, content: SHADOW_TUTOR_SYSTEM_PROMPT },
          ...history.slice(-10).map(msg => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
        ];

        try {
          const response = await invokeLLM({ messages });
          const rawContent = response.choices[0]?.message?.content;
          const assistantMessage = typeof rawContent === 'string' ? rawContent : "Desculpe, não consegui processar sua pergunta.";

          // Save assistant response
          await db.addChatMessage({
            sessionId: input.sessionId,
            participantId: input.participantId,
            role: "assistant",
            content: assistantMessage,
          });

          return { response: assistantMessage };
        } catch (error) {
          console.error("Shadow Tutor error:", error);
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: "Erro ao processar sua pergunta. Tente novamente." 
          });
        }
      }),

    getHistory: publicProcedure
      .input(z.object({ participantId: z.number() }))
      .query(async ({ input }) => {
        return db.getChatMessagesByParticipant(input.participantId);
      }),
  }),

  // ==================== RECORDING ROUTES ====================
  recording: router({
    create: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        title: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
        }

        const room = await db.getRoomById(session.roomId);
        if (!room || room.hostId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o professor pode criar gravações" });
        }

        const s3Key = `recordings/${room.slug}/${session.id}/${nanoid()}.webm`;
        
        const recording = await db.createRecording({
          sessionId: input.sessionId,
          title: input.title ?? `Gravação ${new Date().toLocaleDateString('pt-BR')}`,
          s3Key,
          s3Url: "", // Will be updated after upload
          status: "processing",
        });

        return recording;
      }),

    uploadComplete: protectedProcedure
      .input(z.object({
        recordingId: z.number(),
        s3Url: z.string(),
        duration: z.number().optional(),
        fileSize: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateRecording(input.recordingId, {
          s3Url: input.s3Url,
          duration: input.duration,
          fileSize: input.fileSize,
          status: "ready",
        });
        return { success: true };
      }),

    getBySession: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return db.getRecordingsBySession(input.sessionId);
      }),
  }),

  // ==================== TRANSCRIPTION ROUTES ====================
  transcription: router({
    create: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        recordingId: z.number().optional(),
        content: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
        }

        const room = await db.getRoomById(session.roomId);
        if (!room || room.hostId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o professor pode criar transcrições" });
        }

        const transcription = await db.createTranscription({
          sessionId: input.sessionId,
          recordingId: input.recordingId ?? null,
          content: input.content,
          language: "pt-BR",
          status: "ready",
        });

        return transcription;
      }),

    getBySession: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return db.getTranscriptionsBySession(input.sessionId);
      }),
  }),

  // ==================== LIVE CHAT ROUTES ====================
  liveChat: router({
    sendMessage: publicProcedure
      .input(z.object({
        sessionId: z.number(),
        participantId: z.number(),
        senderName: z.string(),
        message: z.string().min(1).max(1000),
      }))
      .mutation(async ({ input }) => {
        const chatMessage = await db.addLiveChatMessage({
          sessionId: input.sessionId,
          participantId: input.participantId,
          senderName: input.senderName,
          message: input.message,
        });
        return chatMessage;
      }),

    getMessages: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return db.getLiveChatMessages(input.sessionId);
      }),
  }),

  // ==================== INTERACTIVE GRAPHS ROUTES ====================
  graph: router({
    create: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        title: z.string().optional(),
        graphType: z.enum(["linear", "quadratic", "cubic", "trigonometric", "exponential", "custom"]),
        equation: z.string(),
        config: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
        }

        const room = await db.getRoomById(session.roomId);
        if (!room || room.hostId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o professor pode criar gráficos" });
        }

        const graph = await db.createInteractiveGraph({
          sessionId: input.sessionId,
          createdBy: ctx.user.id,
          title: input.title ?? "Gráfico",
          graphType: input.graphType,
          equation: input.equation,
          config: input.config ?? null,
          isActive: true,
        });

        return graph;
      }),

    getBySession: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return db.getGraphsBySession(input.sessionId);
      }),

    getActive: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return db.getActiveGraphBySession(input.sessionId);
      }),

    setActive: protectedProcedure
      .input(z.object({
        graphId: z.number(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateGraph(input.graphId, { isActive: input.isActive });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteGraph(input.id);
        return { success: true };
      }),
  }),

  // ==================== GAMIFICATION ROUTES ====================
  exercise: router({
    create: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        question: z.string(),
        questionLatex: z.string().optional(),
        correctAnswer: z.string(),
        points: z.number().default(10),
        timeLimit: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
        }

        const room = await db.getRoomById(session.roomId);
        if (!room || room.hostId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o professor pode criar exercícios" });
        }

        // Deactivate previous exercises
        await db.deactivateSessionExercises(input.sessionId);

        const exercise = await db.createExercise({
          sessionId: input.sessionId,
          createdBy: ctx.user.id,
          question: input.question,
          questionLatex: input.questionLatex ?? null,
          correctAnswer: input.correctAnswer,
          points: input.points,
          timeLimit: input.timeLimit ?? null,
          isActive: true,
        });

        return exercise;
      }),

    getActive: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return db.getActiveExercise(input.sessionId);
      }),

    getBySession: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return db.getExercisesBySession(input.sessionId);
      }),

    submitAnswer: publicProcedure
      .input(z.object({
        exerciseId: z.number(),
        participantId: z.number(),
        answer: z.string(),
      }))
      .mutation(async ({ input }) => {
        const exercise = await db.getExerciseById(input.exerciseId);
        if (!exercise || !exercise.isActive) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Exercício não encontrado ou não está ativo" });
        }

        // Check if already answered
        const existingResponse = await db.getExerciseResponse(input.exerciseId, input.participantId);
        if (existingResponse) {
          throw new TRPCError({ code: "CONFLICT", message: "Você já respondeu este exercício" });
        }

        // Check answer (case insensitive, trim whitespace)
        const isCorrect = input.answer.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();
        const pointsEarned = isCorrect ? exercise.points : 0;

        // Save response
        const response = await db.createExerciseResponse({
          exerciseId: input.exerciseId,
          participantId: input.participantId,
          answer: input.answer,
          isCorrect,
          pointsEarned,
        });

        // Update participant score
        await db.updateParticipantScore(exercise.sessionId, input.participantId, pointsEarned, isCorrect);

        return {
          ...response,
          correctAnswer: exercise.correctAnswer,
        };
      }),

    endExercise: protectedProcedure
      .input(z.object({ exerciseId: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateExercise(input.exerciseId, { isActive: false });
        return { success: true };
      }),
  }),

  // ==================== SCORES/RANKING ROUTES ====================
  score: router({
    getRanking: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return db.getSessionRanking(input.sessionId);
      }),

    getMyScore: publicProcedure
      .input(z.object({
        sessionId: z.number(),
        participantId: z.number(),
      }))
      .query(async ({ input }) => {
        return db.getParticipantScore(input.sessionId, input.participantId);
      }),
  }),

  // ==================== DOCUMENT ROUTES ====================
  document: router({
    upload: protectedProcedure
      .input(z.object({
        roomId: z.number(),
        title: z.string(),
        fileData: z.string(), // Base64 encoded
        mimeType: z.string(),
        fileSize: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.roomId);
        if (!room || room.hostId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o professor pode fazer upload de documentos" });
        }

        const s3Key = `documents/${room.slug}/${nanoid()}.pdf`;
        const fileBuffer = Buffer.from(input.fileData, "base64");
        
        const { url } = await storagePut(s3Key, fileBuffer, input.mimeType);

        const document = await db.createDocument({
          roomId: input.roomId,
          uploadedBy: ctx.user.id,
          title: input.title,
          s3Key,
          s3Url: url,
          fileSize: input.fileSize,
        });

        return document;
      }),

    getByRoom: publicProcedure
      .input(z.object({ roomId: z.number() }))
      .query(async ({ input }) => {
        return db.getDocumentsByRoom(input.roomId);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verify ownership through room
        const docs = await db.getDocumentsByRoom(input.id);
        // For simplicity, just delete - in production, verify ownership
        await db.deleteDocument(input.id);
        return { success: true };
      }),
  }),

  // ==================== PDF SYNC ROUTES ====================
  pdfSync: router({
    // Get current PDF sync state for a session (used by students)
    getState: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const state = await db.getPdfSyncState(input.sessionId);
        if (!state) {
          return null;
        }
        
        // Get document info if there's a document selected
        let document = null;
        if (state.documentId) {
          const docs = await db.getDocumentsByRoom(0); // We need to get by doc ID
          // For now, we'll return the state with documentId
        }
        
        return state;
      }),

    // Update PDF sync state (teacher only)
    updateState: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        documentId: z.number().nullable().optional(),
        currentPage: z.number().min(1).optional(),
        totalPages: z.number().min(1).optional(),
        zoomLevel: z.number().min(25).max(400).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify user is the teacher of this session
        const session = await db.getSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
        }
        
        const room = await db.getRoomById(session.roomId);
        if (!room || room.hostId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o professor pode sincronizar o PDF" });
        }

        const state = await db.updatePdfSyncState(input.sessionId, {
          documentId: input.documentId,
          currentPage: input.currentPage,
          totalPages: input.totalPages,
          zoomLevel: input.zoomLevel,
          updatedBy: ctx.user.id,
        });

        return state;
      }),

    // Clear PDF sync state (teacher only)
    clearState: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
        }
        
        const room = await db.getRoomById(session.roomId);
        if (!room || room.hostId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o professor pode limpar o estado do PDF" });
        }

        await db.clearPdfSyncState(input.sessionId);
        return { success: true };
      }),
  }),

  // ==================== DAILY.CO VIDEO ROUTES ====================
  daily: router({
    // Create a Daily.co room for a session
    createRoom: protectedProcedure
      .input(z.object({
        roomSlug: z.string(),
        sessionId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const apiKey = process.env.DAILY_API_KEY;
        if (!apiKey) {
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: "Daily.co API key não configurada" 
          });
        }

        // Check if room exists and user is host
        const room = await db.getRoomBySlug(input.roomSlug);
        if (!room || room.hostId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o professor pode criar sala de vídeo" });
        }

        // Create unique room name for Daily.co
        const dailyRoomName = `mathtutor-${input.roomSlug}-${input.sessionId}`;

        try {
          const response = await fetch('https://api.daily.co/v1/rooms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              name: dailyRoomName,
              privacy: 'public',
              properties: {
                max_participants: 50,
                enable_screenshare: true,
                enable_chat: false, // We have our own chat
                start_video_off: false,
                start_audio_off: false,
              },
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            // If room already exists, get it instead
            if (error.info === 'a]room with this name already exists') {
              const getResponse = await fetch(`https://api.daily.co/v1/rooms/${dailyRoomName}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
              });
              if (getResponse.ok) {
                const existingRoom = await getResponse.json();
                return {
                  url: existingRoom.url,
                  name: existingRoom.name,
                };
              }
            }
            throw new TRPCError({ 
              code: "INTERNAL_SERVER_ERROR", 
              message: `Erro ao criar sala Daily.co: ${error.info || 'Unknown error'}` 
            });
          }

          const dailyRoom = await response.json();
          return {
            url: dailyRoom.url,
            name: dailyRoom.name,
          };
        } catch (error) {
          console.error('Daily.co API error:', error);
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: "Erro ao conectar com Daily.co" 
          });
        }
      }),

    // Get or create Daily.co room for a session
    getRoom: publicProcedure
      .input(z.object({
        roomSlug: z.string(),
        sessionId: z.number(),
      }))
      .query(async ({ input }) => {
        const apiKey = process.env.DAILY_API_KEY;
        if (!apiKey) {
          return { url: null, configured: false };
        }

        const dailyRoomName = `mathtutor-${input.roomSlug}-${input.sessionId}`;

        try {
          const response = await fetch(`https://api.daily.co/v1/rooms/${dailyRoomName}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });

          if (response.ok) {
            const room = await response.json();
            return { url: room.url, name: room.name, configured: true };
          }

          return { url: null, configured: true };
        } catch (error) {
          console.error('Daily.co API error:', error);
          return { url: null, configured: true };
        }
      }),

    // Delete Daily.co room when session ends
    deleteRoom: protectedProcedure
      .input(z.object({
        roomSlug: z.string(),
        sessionId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const apiKey = process.env.DAILY_API_KEY;
        if (!apiKey) {
          return { success: false };
        }

        const room = await db.getRoomBySlug(input.roomSlug);
        if (!room || room.hostId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o professor pode deletar sala de vídeo" });
        }

        const dailyRoomName = `mathtutor-${input.roomSlug}-${input.sessionId}`;

        try {
          await fetch(`https://api.daily.co/v1/rooms/${dailyRoomName}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });
          return { success: true };
        } catch (error) {
          console.error('Daily.co delete error:', error);
          return { success: false };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
