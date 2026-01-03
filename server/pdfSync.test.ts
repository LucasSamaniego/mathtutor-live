import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  getPdfSyncState: vi.fn(),
  updatePdfSyncState: vi.fn(),
  clearPdfSyncState: vi.fn(),
  getSessionById: vi.fn(),
  getRoomById: vi.fn(),
  getDocumentsByRoom: vi.fn(),
}));

import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(user?: AuthenticatedUser): TrpcContext {
  return {
    user: user || null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createTestUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 1,
    openId: "test-user-123",
    email: "teacher@example.com",
    name: "Professor Teste",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

describe("pdfSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getState", () => {
    it("returns null when no sync state exists", async () => {
      vi.mocked(db.getPdfSyncState).mockResolvedValue(undefined);
      
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.pdfSync.getState({ sessionId: 1 });
      
      expect(result).toBeNull();
      expect(db.getPdfSyncState).toHaveBeenCalledWith(1);
    });

    it("returns sync state when it exists", async () => {
      const mockState = {
        id: 1,
        sessionId: 1,
        documentId: 5,
        currentPage: 3,
        totalPages: 10,
        zoomLevel: 100,
        updatedBy: 1,
        updatedAt: new Date(),
      };
      
      vi.mocked(db.getPdfSyncState).mockResolvedValue(mockState);
      
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.pdfSync.getState({ sessionId: 1 });
      
      expect(result).toEqual(mockState);
    });
  });

  describe("updateState", () => {
    it("updates sync state when user is the teacher", async () => {
      const user = createTestUser({ id: 1 });
      const mockSession = { id: 1, roomId: 1, status: "active" };
      const mockRoom = { id: 1, hostId: 1, slug: "test-room" };
      const mockUpdatedState = {
        id: 1,
        sessionId: 1,
        documentId: 5,
        currentPage: 2,
        totalPages: 10,
        zoomLevel: 100,
        updatedBy: 1,
        updatedAt: new Date(),
      };
      
      vi.mocked(db.getSessionById).mockResolvedValue(mockSession as any);
      vi.mocked(db.getRoomById).mockResolvedValue(mockRoom as any);
      vi.mocked(db.updatePdfSyncState).mockResolvedValue(mockUpdatedState);
      
      const ctx = createMockContext(user);
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.pdfSync.updateState({
        sessionId: 1,
        documentId: 5,
        currentPage: 2,
      });
      
      expect(result).toEqual(mockUpdatedState);
      expect(db.updatePdfSyncState).toHaveBeenCalledWith(1, {
        documentId: 5,
        currentPage: 2,
        totalPages: undefined,
        zoomLevel: undefined,
        updatedBy: 1,
      });
    });

    it("throws error when user is not the teacher", async () => {
      const user = createTestUser({ id: 2 }); // Different user
      const mockSession = { id: 1, roomId: 1, status: "active" };
      const mockRoom = { id: 1, hostId: 1, slug: "test-room" }; // hostId is 1, not 2
      
      vi.mocked(db.getSessionById).mockResolvedValue(mockSession as any);
      vi.mocked(db.getRoomById).mockResolvedValue(mockRoom as any);
      
      const ctx = createMockContext(user);
      const caller = appRouter.createCaller(ctx);
      
      await expect(
        caller.pdfSync.updateState({ sessionId: 1, currentPage: 2 })
      ).rejects.toThrow("Apenas o professor pode sincronizar o PDF");
    });

    it("throws error when session not found", async () => {
      const user = createTestUser();
      vi.mocked(db.getSessionById).mockResolvedValue(undefined);
      
      const ctx = createMockContext(user);
      const caller = appRouter.createCaller(ctx);
      
      await expect(
        caller.pdfSync.updateState({ sessionId: 999, currentPage: 1 })
      ).rejects.toThrow("Sessão não encontrada");
    });
  });

  describe("clearState", () => {
    it("clears sync state when user is the teacher", async () => {
      const user = createTestUser({ id: 1 });
      const mockSession = { id: 1, roomId: 1, status: "active" };
      const mockRoom = { id: 1, hostId: 1, slug: "test-room" };
      
      vi.mocked(db.getSessionById).mockResolvedValue(mockSession as any);
      vi.mocked(db.getRoomById).mockResolvedValue(mockRoom as any);
      vi.mocked(db.clearPdfSyncState).mockResolvedValue(undefined);
      
      const ctx = createMockContext(user);
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.pdfSync.clearState({ sessionId: 1 });
      
      expect(result).toEqual({ success: true });
      expect(db.clearPdfSyncState).toHaveBeenCalledWith(1);
    });

    it("throws error when user is not the teacher", async () => {
      const user = createTestUser({ id: 2 });
      const mockSession = { id: 1, roomId: 1, status: "active" };
      const mockRoom = { id: 1, hostId: 1, slug: "test-room" };
      
      vi.mocked(db.getSessionById).mockResolvedValue(mockSession as any);
      vi.mocked(db.getRoomById).mockResolvedValue(mockRoom as any);
      
      const ctx = createMockContext(user);
      const caller = appRouter.createCaller(ctx);
      
      await expect(
        caller.pdfSync.clearState({ sessionId: 1 })
      ).rejects.toThrow("Apenas o professor pode limpar o estado do PDF");
    });
  });
});
