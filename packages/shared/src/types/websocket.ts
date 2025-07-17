import { z } from "zod";
import { FileChangeSchema, FileDeleteSchema } from "./file-history";

// WebSocket event types
export const WebSocketEventType = z.enum([
  "file_change",
  "file_delete",
  "file_saved",
  "deploy_started",
  "deploy_completed",
  "deploy_failed",
  "error",
  "ack",
]);

export type WebSocketEventType = z.infer<typeof WebSocketEventType>;

// Base WebSocket message schema
export const BaseWebSocketMessageSchema = z.object({
  type: WebSocketEventType,
  timestamp: z.number().int().min(0),
});

// File change message (from client to server)
export const FileChangeMessageSchema = BaseWebSocketMessageSchema.extend({
  type: z.literal("file_change"),
  data: FileChangeSchema,
});

export type FileChangeMessage = z.infer<typeof FileChangeMessageSchema>;

// File deletion message (from client to server)
export const FileDeleteMessageSchema = BaseWebSocketMessageSchema.extend({
  type: z.literal("file_delete"),
  data: FileDeleteSchema,
});

export type FileDeleteMessage = z.infer<typeof FileDeleteMessageSchema>;

// File save confirmation (from server to client)
export const FileSavedMessageSchema = BaseWebSocketMessageSchema.extend({
  type: z.literal("file_saved"),
  data: z.object({
    file_path: z.string(),
    version_id: z.string(),
    project_id: z.string().uuid(),
  }),
});

export type FileSavedMessage = z.infer<typeof FileSavedMessageSchema>;

// Deploy start notification
export const DeployStartedMessageSchema = BaseWebSocketMessageSchema.extend({
  type: z.literal("deploy_started"),
  data: z.object({
    project_id: z.string().uuid(),
    deploy_id: z.string(),
  }),
});

export type DeployStartedMessage = z.infer<typeof DeployStartedMessageSchema>;

// Deploy completion notification
export const DeployCompletedMessageSchema = BaseWebSocketMessageSchema.extend({
  type: z.literal("deploy_completed"),
  data: z.object({
    project_id: z.string().uuid(),
    deploy_id: z.string(),
    url: z.string().url(),
  }),
});

export type DeployCompletedMessage = z.infer<
  typeof DeployCompletedMessageSchema
>;

// Deploy error notification
export const DeployFailedMessageSchema = BaseWebSocketMessageSchema.extend({
  type: z.literal("deploy_failed"),
  data: z.object({
    project_id: z.string().uuid(),
    deploy_id: z.string(),
    error: z.string(),
  }),
});

export type DeployFailedMessage = z.infer<typeof DeployFailedMessageSchema>;

// Error message
export const ErrorMessageSchema = BaseWebSocketMessageSchema.extend({
  type: z.literal("error"),
  data: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
});

export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

// Message acknowledgment
export const AckMessageSchema = BaseWebSocketMessageSchema.extend({
  type: z.literal("ack"),
  data: z.object({
    message_id: z.string().optional(),
    success: z.boolean(),
  }),
});

export type AckMessage = z.infer<typeof AckMessageSchema>;

// Combined type of all WebSocket messages
export const WebSocketMessageSchema = z.discriminatedUnion("type", [
  FileChangeMessageSchema,
  FileDeleteMessageSchema,
  FileSavedMessageSchema,
  DeployStartedMessageSchema,
  DeployCompletedMessageSchema,
  DeployFailedMessageSchema,
  ErrorMessageSchema,
  AckMessageSchema,
]);

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// Schema for WebSocket connection authentication
export const WebSocketAuthSchema = z.object({
  project_id: z.string().uuid(),
  token: z.string().min(1),
});

export type WebSocketAuth = z.infer<typeof WebSocketAuthSchema>;
