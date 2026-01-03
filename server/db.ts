import { eq, desc, and, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  rooms, InsertRoom, Room,
  sessions, InsertSession, Session,
  participants, InsertParticipant, Participant,
  recordings, InsertRecording, Recording,
  transcriptions, InsertTranscription, Transcription,
  chatMessages, InsertChatMessage, ChatMessage,
  documents, InsertDocument, Document
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USER FUNCTIONS ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== ROOM FUNCTIONS ====================

export async function createRoom(room: InsertRoom): Promise<Room | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.insert(rooms).values(room);
  const result = await db.select().from(rooms).where(eq(rooms.slug, room.slug)).limit(1);
  return result[0];
}

export async function getRoomBySlug(slug: string): Promise<Room | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
  return result[0];
}

export async function getRoomById(id: number): Promise<Room | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  return result[0];
}

export async function getRoomsByHost(hostId: number): Promise<Room[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(rooms).where(eq(rooms.hostId, hostId)).orderBy(desc(rooms.createdAt));
}

export async function updateRoom(id: number, data: Partial<InsertRoom>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(rooms).set(data).where(eq(rooms.id, id));
}

export async function deleteRoom(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(rooms).where(eq(rooms.id, id));
}

// ==================== SESSION FUNCTIONS ====================

export async function createSession(session: InsertSession): Promise<Session | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(sessions).values(session);
  const insertId = result[0].insertId;
  const created = await db.select().from(sessions).where(eq(sessions.id, insertId)).limit(1);
  return created[0];
}

export async function getSessionById(id: number): Promise<Session | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return result[0];
}

export async function getActiveSessionByRoom(roomId: number): Promise<Session | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(sessions)
    .where(and(eq(sessions.roomId, roomId), eq(sessions.status, "active")))
    .limit(1);
  return result[0];
}

export async function getSessionsByRoom(roomId: number): Promise<Session[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(sessions)
    .where(eq(sessions.roomId, roomId))
    .orderBy(desc(sessions.startedAt));
}

export async function endSession(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const session = await getSessionById(id);
  if (!session) return;

  const endedAt = new Date();
  const duration = Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000);

  await db.update(sessions).set({
    status: "ended",
    endedAt,
    duration
  }).where(eq(sessions.id, id));
}

// ==================== PARTICIPANT FUNCTIONS ====================

export async function addParticipant(participant: InsertParticipant): Promise<Participant | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(participants).values(participant);
  const insertId = result[0].insertId;
  const created = await db.select().from(participants).where(eq(participants.id, insertId)).limit(1);
  return created[0];
}

export async function getParticipantsBySession(sessionId: number): Promise<Participant[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(participants).where(eq(participants.sessionId, sessionId));
}

export async function getActiveParticipantsBySession(sessionId: number): Promise<Participant[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(participants)
    .where(and(eq(participants.sessionId, sessionId), isNull(participants.leftAt)));
}

export async function updateParticipantLeft(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(participants).set({ leftAt: new Date() }).where(eq(participants.id, id));
}

// ==================== RECORDING FUNCTIONS ====================

export async function createRecording(recording: InsertRecording): Promise<Recording | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(recordings).values(recording);
  const insertId = result[0].insertId;
  const created = await db.select().from(recordings).where(eq(recordings.id, insertId)).limit(1);
  return created[0];
}

export async function getRecordingsBySession(sessionId: number): Promise<Recording[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(recordings)
    .where(eq(recordings.sessionId, sessionId))
    .orderBy(desc(recordings.createdAt));
}

export async function updateRecording(id: number, data: Partial<InsertRecording>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(recordings).set(data).where(eq(recordings.id, id));
}

// ==================== TRANSCRIPTION FUNCTIONS ====================

export async function createTranscription(transcription: InsertTranscription): Promise<Transcription | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(transcriptions).values(transcription);
  const insertId = result[0].insertId;
  const created = await db.select().from(transcriptions).where(eq(transcriptions.id, insertId)).limit(1);
  return created[0];
}

export async function getTranscriptionsBySession(sessionId: number): Promise<Transcription[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(transcriptions)
    .where(eq(transcriptions.sessionId, sessionId))
    .orderBy(desc(transcriptions.createdAt));
}

export async function updateTranscription(id: number, data: Partial<InsertTranscription>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(transcriptions).set(data).where(eq(transcriptions.id, id));
}

// ==================== CHAT MESSAGE FUNCTIONS ====================

export async function addChatMessage(message: InsertChatMessage): Promise<ChatMessage | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(chatMessages).values(message);
  const insertId = result[0].insertId;
  const created = await db.select().from(chatMessages).where(eq(chatMessages.id, insertId)).limit(1);
  return created[0];
}

export async function getChatMessagesBySession(sessionId: number): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);
}

export async function getChatMessagesByParticipant(participantId: number): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(chatMessages)
    .where(eq(chatMessages.participantId, participantId))
    .orderBy(chatMessages.createdAt);
}

// ==================== DOCUMENT FUNCTIONS ====================

export async function createDocument(document: InsertDocument): Promise<Document | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(documents).values(document);
  const insertId = result[0].insertId;
  const created = await db.select().from(documents).where(eq(documents.id, insertId)).limit(1);
  return created[0];
}

export async function getDocumentsByRoom(roomId: number): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(documents)
    .where(eq(documents.roomId, roomId))
    .orderBy(desc(documents.createdAt));
}

export async function deleteDocument(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(documents).where(eq(documents.id, id));
}
