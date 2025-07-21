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
// File deletion message (from client to server)
export const FileDeleteMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("file_delete"),
    data: FileDeleteSchema,
});
// File save confirmation (from server to client)
export const FileSavedMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("file_saved"),
    data: z.object({
        file_path: z.string(),
        version_id: z.string(),
        project_id: z.string().uuid(),
    }),
});
// Deploy start notification
export const DeployStartedMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("deploy_started"),
    data: z.object({
        project_id: z.string().uuid(),
        deploy_id: z.string(),
    }),
});
// Deploy completion notification
export const DeployCompletedMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("deploy_completed"),
    data: z.object({
        project_id: z.string().uuid(),
        deploy_id: z.string(),
        url: z.string().url(),
    }),
});
// Deploy error notification
export const DeployFailedMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("deploy_failed"),
    data: z.object({
        project_id: z.string().uuid(),
        deploy_id: z.string(),
        error: z.string(),
    }),
});
// Error message
export const ErrorMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("error"),
    data: z.object({
        message: z.string(),
        code: z.string().optional(),
    }),
});
// Message acknowledgment
export const AckMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("ack"),
    data: z.object({
        message_id: z.string().optional(),
        success: z.boolean(),
    }),
});
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
// Schema for WebSocket connection authentication
export const WebSocketAuthSchema = z.object({
    project_id: z.string().uuid(),
    token: z.string().min(1),
});
