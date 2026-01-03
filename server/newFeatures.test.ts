import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  getUserById: vi.fn().mockResolvedValue({ id: 1, name: "Test User" }),
  getRoomById: vi.fn().mockResolvedValue({ id: 1, hostId: 1, name: "Test Room" }),
  getSessionById: vi.fn().mockResolvedValue({ id: 1, roomId: 1, status: "active" }),
  addLiveChatMessage: vi.fn().mockResolvedValue({ 
    id: 1, 
    sessionId: 1, 
    participantId: 1, 
    senderName: "Test User",
    message: "Hello",
    createdAt: new Date()
  }),
  getLiveChatMessages: vi.fn().mockResolvedValue([
    { id: 1, sessionId: 1, participantId: 1, senderName: "Test User", message: "Hello", createdAt: new Date() }
  ]),
  createInteractiveGraph: vi.fn().mockResolvedValue({
    id: 1,
    sessionId: 1,
    createdBy: 1,
    title: "Test Graph",
    graphType: "linear",
    equation: "y = x",
    isActive: true,
    createdAt: new Date()
  }),
  getGraphsBySession: vi.fn().mockResolvedValue([]),
  getActiveGraphBySession: vi.fn().mockResolvedValue(null),
  updateGraph: vi.fn().mockResolvedValue(undefined),
  deleteGraph: vi.fn().mockResolvedValue(undefined),
  createExercise: vi.fn().mockResolvedValue({
    id: 1,
    sessionId: 1,
    createdBy: 1,
    question: "What is 2+2?",
    correctAnswer: "4",
    points: 10,
    isActive: true,
    createdAt: new Date()
  }),
  getActiveExercise: vi.fn().mockResolvedValue(null),
  getExercisesBySession: vi.fn().mockResolvedValue([]),
  getExerciseById: vi.fn().mockResolvedValue({
    id: 1,
    sessionId: 1,
    question: "What is 2+2?",
    correctAnswer: "4",
    points: 10,
    isActive: true
  }),
  getExerciseResponse: vi.fn().mockResolvedValue(null),
  createExerciseResponse: vi.fn().mockResolvedValue({
    id: 1,
    exerciseId: 1,
    participantId: 1,
    answer: "4",
    isCorrect: true,
    pointsEarned: 10
  }),
  updateParticipantScore: vi.fn().mockResolvedValue(undefined),
  deactivateSessionExercises: vi.fn().mockResolvedValue(undefined),
  updateExercise: vi.fn().mockResolvedValue(undefined),
  getSessionRanking: vi.fn().mockResolvedValue([
    { id: 1, sessionId: 1, participantId: 1, totalPoints: 10, correctAnswers: 1, totalAnswers: 1, participantName: "Test User" }
  ]),
  getParticipantScore: vi.fn().mockResolvedValue({
    id: 1,
    sessionId: 1,
    participantId: 1,
    totalPoints: 10,
    correctAnswers: 1,
    totalAnswers: 1
  }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

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

describe("liveChat", () => {
  it("sends a message successfully", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.liveChat.sendMessage({
      sessionId: 1,
      participantId: 1,
      senderName: "Test User",
      message: "Hello everyone!",
    });

    expect(result).toBeDefined();
    expect(result?.message).toBe("Hello");
  });

  it("gets messages for a session", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const messages = await caller.liveChat.getMessages({ sessionId: 1 });

    expect(messages).toBeDefined();
    expect(Array.isArray(messages)).toBe(true);
  });
});

describe("graph", () => {
  it("creates a graph successfully (authenticated)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.graph.create({
      sessionId: 1,
      title: "Linear Function",
      graphType: "linear",
      equation: "y = 2x + 1",
    });

    expect(result).toBeDefined();
    expect(result?.graphType).toBe("linear");
  });

  it("gets graphs for a session", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const graphs = await caller.graph.getBySession({ sessionId: 1 });

    expect(graphs).toBeDefined();
    expect(Array.isArray(graphs)).toBe(true);
  });
});

describe("exercise (gamification)", () => {
  it("creates an exercise successfully (authenticated)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.exercise.create({
      sessionId: 1,
      question: "What is 2+2?",
      correctAnswer: "4",
      points: 10,
    });

    expect(result).toBeDefined();
    expect(result?.points).toBe(10);
  });

  it("submits an answer successfully", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.exercise.submitAnswer({
      exerciseId: 1,
      participantId: 1,
      answer: "4",
    });

    expect(result).toBeDefined();
    expect(result.isCorrect).toBe(true);
    expect(result.pointsEarned).toBe(10);
  });

  it("gets session ranking", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const ranking = await caller.score.getRanking({ sessionId: 1 });

    expect(ranking).toBeDefined();
    expect(Array.isArray(ranking)).toBe(true);
    expect(ranking[0]?.totalPoints).toBe(10);
  });

  it("gets participant score", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const score = await caller.score.getMyScore({ sessionId: 1, participantId: 1 });

    expect(score).toBeDefined();
    expect(score?.totalPoints).toBe(10);
  });
});
