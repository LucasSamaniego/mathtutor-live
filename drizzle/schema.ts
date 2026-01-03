import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Rooms table - stores tutoring room configurations
 */
export const rooms = mysqlTable("rooms", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  hostId: int("hostId").notNull(), // References users.id (teacher)
  dailyRoomName: varchar("dailyRoomName", { length: 255 }), // Daily.co room name
  dailyRoomUrl: varchar("dailyRoomUrl", { length: 512 }), // Daily.co room URL
  isActive: boolean("isActive").default(true).notNull(),
  allowGuests: boolean("allowGuests").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = typeof rooms.$inferInsert;

/**
 * Sessions table - stores individual tutoring sessions
 */
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(), // References rooms.id
  title: varchar("title", { length: 255 }),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  duration: int("duration"), // Duration in seconds
  status: mysqlEnum("status", ["active", "ended", "cancelled"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Participants table - tracks who joined each session
 */
export const participants = mysqlTable("participants", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(), // References sessions.id
  userId: int("userId"), // References users.id (null for guests)
  guestName: varchar("guestName", { length: 255 }), // Name for guest participants
  role: mysqlEnum("role", ["teacher", "student", "guest"]).default("student").notNull(),
visibleName: varchar("visibleName", { length: 255 }), // Display name in the room
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  leftAt: timestamp("leftAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = typeof participants.$inferInsert;

/**
 * Recordings table - stores session recordings metadata
 */
export const recordings = mysqlTable("recordings", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(), // References sessions.id
  title: varchar("title", { length: 255 }),
  s3Key: varchar("s3Key", { length: 512 }).notNull(),
  s3Url: varchar("s3Url", { length: 1024 }).notNull(),
  duration: int("duration"), // Duration in seconds
  fileSize: int("fileSize"), // Size in bytes
  mimeType: varchar("mimeType", { length: 128 }).default("video/webm"),
  status: mysqlEnum("status", ["processing", "ready", "failed"]).default("processing").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Recording = typeof recordings.$inferSelect;
export type InsertRecording = typeof recordings.$inferInsert;

/**
 * Transcriptions table - stores session transcriptions
 */
export const transcriptions = mysqlTable("transcriptions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(), // References sessions.id
  recordingId: int("recordingId"), // References recordings.id (optional)
  content: text("content").notNull(), // Full transcription text
  language: varchar("language", { length: 10 }).default("pt-BR"),
  status: mysqlEnum("status", ["processing", "ready", "failed"]).default("processing").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transcription = typeof transcriptions.$inferSelect;
export type InsertTranscription = typeof transcriptions.$inferInsert;

/**
 * Chat messages table - stores Shadow Tutor chat history
 */
export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(), // References sessions.id
  participantId: int("participantId").notNull(), // References participants.id
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * PDF documents table - stores uploaded PDFs for sessions
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(), // References rooms.id
  uploadedBy: int("uploadedBy").notNull(), // References users.id
  title: varchar("title", { length: 255 }).notNull(),
  s3Key: varchar("s3Key", { length: 512 }).notNull(),
  s3Url: varchar("s3Url", { length: 1024 }).notNull(),
  fileSize: int("fileSize"),
  pageCount: int("pageCount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
