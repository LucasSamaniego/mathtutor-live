import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  createRoom: vi.fn(),
  getRoomBySlug: vi.fn(),
  getRoomById: vi.fn(),
  getRoomsByHost: vi.fn(),
  updateRoom: vi.fn(),
  deleteRoom: vi.fn(),
  getUserById: vi.fn(),
}));

// Mock notification
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
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

describe("room.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a room successfully for authenticated user", async () => {
    const mockRoom = {
      id: 1,
      slug: "abc123",
      name: "Matemática - Turma 3A",
      description: "Aulas de cálculo",
      hostId: 1,
      dailyRoomName: null,
      dailyRoomUrl: null,
      isActive: true,
      allowGuests: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.createRoom).mockResolvedValue(mockRoom);

    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.room.create({
      name: "Matemática - Turma 3A",
      description: "Aulas de cálculo",
      allowGuests: true,
    });

    expect(result).toBeDefined();
    expect(result.name).toBe("Matemática - Turma 3A");
    expect(result.hostId).toBe(1);
    expect(db.createRoom).toHaveBeenCalledTimes(1);
  });

  it("throws error when room creation fails", async () => {
    vi.mocked(db.createRoom).mockResolvedValue(undefined);

    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.room.create({
        name: "Test Room",
        allowGuests: true,
      })
    ).rejects.toThrow("Falha ao criar sala");
  });
});

describe("room.getBySlug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns room with host name for valid slug", async () => {
    const mockRoom = {
      id: 1,
      slug: "abc123",
      name: "Matemática - Turma 3A",
      description: "Aulas de cálculo",
      hostId: 1,
      dailyRoomName: null,
      dailyRoomUrl: null,
      isActive: true,
      allowGuests: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockHost = {
      id: 1,
      openId: "host-1",
      name: "Professor João",
      email: "joao@example.com",
      loginMethod: "manus",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    vi.mocked(db.getRoomBySlug).mockResolvedValue(mockRoom);
    vi.mocked(db.getUserById).mockResolvedValue(mockHost);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.room.getBySlug({ slug: "abc123" });

    expect(result).toBeDefined();
    expect(result.slug).toBe("abc123");
    expect(result.hostName).toBe("Professor João");
  });

  it("throws NOT_FOUND for invalid slug", async () => {
    vi.mocked(db.getRoomBySlug).mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.room.getBySlug({ slug: "invalid" })
    ).rejects.toThrow("Sala não encontrada");
  });
});

describe("room.getMyRooms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns rooms for authenticated host", async () => {
    const mockRooms = [
      {
        id: 1,
        slug: "room1",
        name: "Room 1",
        description: null,
        hostId: 1,
        dailyRoomName: null,
        dailyRoomUrl: null,
        isActive: true,
        allowGuests: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        slug: "room2",
        name: "Room 2",
        description: null,
        hostId: 1,
        dailyRoomName: null,
        dailyRoomUrl: null,
        isActive: true,
        allowGuests: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(db.getRoomsByHost).mockResolvedValue(mockRooms);

    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.room.getMyRooms();

    expect(result).toHaveLength(2);
    expect(db.getRoomsByHost).toHaveBeenCalledWith(1);
  });
});

describe("room.update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates room successfully for owner", async () => {
    const mockRoom = {
      id: 1,
      slug: "abc123",
      name: "Old Name",
      description: null,
      hostId: 1,
      dailyRoomName: null,
      dailyRoomUrl: null,
      isActive: true,
      allowGuests: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.getRoomById).mockResolvedValue(mockRoom);
    vi.mocked(db.updateRoom).mockResolvedValue();

    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.room.update({
      id: 1,
      name: "New Name",
    });

    expect(result.success).toBe(true);
    expect(db.updateRoom).toHaveBeenCalledWith(1, { name: "New Name" });
  });

  it("throws FORBIDDEN for non-owner", async () => {
    const mockRoom = {
      id: 1,
      slug: "abc123",
      name: "Room",
      description: null,
      hostId: 2, // Different user
      dailyRoomName: null,
      dailyRoomUrl: null,
      isActive: true,
      allowGuests: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.getRoomById).mockResolvedValue(mockRoom);

    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.room.update({ id: 1, name: "New Name" })
    ).rejects.toThrow("Sem permissão para editar esta sala");
  });
});

describe("room.delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes room successfully for owner", async () => {
    const mockRoom = {
      id: 1,
      slug: "abc123",
      name: "Room",
      description: null,
      hostId: 1,
      dailyRoomName: null,
      dailyRoomUrl: null,
      isActive: true,
      allowGuests: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.getRoomById).mockResolvedValue(mockRoom);
    vi.mocked(db.deleteRoom).mockResolvedValue();

    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.room.delete({ id: 1 });

    expect(result.success).toBe(true);
    expect(db.deleteRoom).toHaveBeenCalledWith(1);
  });

  it("throws FORBIDDEN for non-owner", async () => {
    const mockRoom = {
      id: 1,
      slug: "abc123",
      name: "Room",
      description: null,
      hostId: 2,
      dailyRoomName: null,
      dailyRoomUrl: null,
      isActive: true,
      allowGuests: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.getRoomById).mockResolvedValue(mockRoom);

    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.room.delete({ id: 1 })
    ).rejects.toThrow("Sem permissão para excluir esta sala");
  });
});
