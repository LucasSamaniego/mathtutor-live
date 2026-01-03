import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  addChatMessage: vi.fn(),
  getChatMessagesByParticipant: vi.fn(),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import * as db from "./db";
import { invokeLLM } from "./_core/llm";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("shadowTutor.chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends message and receives AI response", async () => {
    const mockUserMessage = {
      id: 1,
      sessionId: 1,
      participantId: 1,
      role: "user" as const,
      content: "Como resolver x² + 2x + 1 = 0?",
      createdAt: new Date(),
    };

    const mockAssistantMessage = {
      id: 2,
      sessionId: 1,
      participantId: 1,
      role: "assistant" as const,
      content: "Para resolver $x^2 + 2x + 1 = 0$, podemos fatorar: $(x+1)^2 = 0$, logo $x = -1$.",
      createdAt: new Date(),
    };

    vi.mocked(db.addChatMessage)
      .mockResolvedValueOnce(mockUserMessage)
      .mockResolvedValueOnce(mockAssistantMessage);

    vi.mocked(db.getChatMessagesByParticipant).mockResolvedValue([]);

    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: "Para resolver $x^2 + 2x + 1 = 0$, podemos fatorar: $(x+1)^2 = 0$, logo $x = -1$.",
          },
        },
      ],
    } as any);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shadowTutor.chat({
      sessionId: 1,
      participantId: 1,
      message: "Como resolver x² + 2x + 1 = 0?",
    });

    expect(result.response).toContain("fatorar");
    expect(db.addChatMessage).toHaveBeenCalledTimes(2);
    expect(invokeLLM).toHaveBeenCalledTimes(1);
  });

  it("includes chat history in LLM context", async () => {
    const mockHistory = [
      {
        id: 1,
        sessionId: 1,
        participantId: 1,
        role: "user" as const,
        content: "O que é derivada?",
        createdAt: new Date(),
      },
      {
        id: 2,
        sessionId: 1,
        participantId: 1,
        role: "assistant" as const,
        content: "Derivada é a taxa de variação instantânea de uma função.",
        createdAt: new Date(),
      },
    ];

    vi.mocked(db.getChatMessagesByParticipant).mockResolvedValue(mockHistory);
    vi.mocked(db.addChatMessage).mockResolvedValue({
      id: 3,
      sessionId: 1,
      participantId: 1,
      role: "user" as const,
      content: "E integral?",
      createdAt: new Date(),
    });

    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: "Integral é o processo inverso da derivada.",
          },
        },
      ],
    } as any);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.shadowTutor.chat({
      sessionId: 1,
      participantId: 1,
      message: "E integral?",
    });

    // Verify LLM was called with history context
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user", content: "O que é derivada?" }),
          expect.objectContaining({ role: "assistant", content: "Derivada é a taxa de variação instantânea de uma função." }),
        ]),
      })
    );
  });

  it("handles LLM error gracefully", async () => {
    vi.mocked(db.getChatMessagesByParticipant).mockResolvedValue([]);
    vi.mocked(db.addChatMessage).mockResolvedValue({
      id: 1,
      sessionId: 1,
      participantId: 1,
      role: "user" as const,
      content: "Pergunta",
      createdAt: new Date(),
    });

    vi.mocked(invokeLLM).mockRejectedValue(new Error("LLM unavailable"));

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.shadowTutor.chat({
        sessionId: 1,
        participantId: 1,
        message: "Pergunta",
      })
    ).rejects.toThrow("Erro ao processar sua pergunta");
  });
});

describe("shadowTutor.getHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns chat history for participant", async () => {
    const mockHistory = [
      {
        id: 1,
        sessionId: 1,
        participantId: 1,
        role: "user" as const,
        content: "Pergunta 1",
        createdAt: new Date(),
      },
      {
        id: 2,
        sessionId: 1,
        participantId: 1,
        role: "assistant" as const,
        content: "Resposta 1",
        createdAt: new Date(),
      },
    ];

    vi.mocked(db.getChatMessagesByParticipant).mockResolvedValue(mockHistory);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shadowTutor.getHistory({ participantId: 1 });

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("Pergunta 1");
    expect(result[1].content).toBe("Resposta 1");
  });

  it("returns empty array for new participant", async () => {
    vi.mocked(db.getChatMessagesByParticipant).mockResolvedValue([]);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shadowTutor.getHistory({ participantId: 999 });

    expect(result).toHaveLength(0);
  });
});
