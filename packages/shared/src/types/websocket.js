import { z } from "zod";
import { FileChangeSchema, FileDeleteSchema } from "./file-history";
// Типы WebSocket событий
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
// Базовая схема WebSocket сообщения
export const BaseWebSocketMessageSchema = z.object({
    type: WebSocketEventType,
    timestamp: z.number().int().min(0),
});
// Сообщение об изменении файла (от клиента к серверу)
export const FileChangeMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("file_change"),
    data: FileChangeSchema,
});
// Сообщение об удалении файла (от клиента к серверу)
export const FileDeleteMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("file_delete"),
    data: FileDeleteSchema,
});
// Подтверждение сохранения файла (от сервера к клиенту)
export const FileSavedMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("file_saved"),
    data: z.object({
        file_path: z.string(),
        version_id: z.string(),
        project_id: z.string().uuid(),
    }),
});
// Уведомление о начале деплоя
export const DeployStartedMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("deploy_started"),
    data: z.object({
        project_id: z.string().uuid(),
        deploy_id: z.string(),
    }),
});
// Уведомление о завершении деплоя
export const DeployCompletedMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("deploy_completed"),
    data: z.object({
        project_id: z.string().uuid(),
        deploy_id: z.string(),
        url: z.string().url(),
    }),
});
// Уведомление об ошибке деплоя
export const DeployFailedMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("deploy_failed"),
    data: z.object({
        project_id: z.string().uuid(),
        deploy_id: z.string(),
        error: z.string(),
    }),
});
// Сообщение об ошибке
export const ErrorMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("error"),
    data: z.object({
        message: z.string(),
        code: z.string().optional(),
    }),
});
// Подтверждение получения сообщения
export const AckMessageSchema = BaseWebSocketMessageSchema.extend({
    type: z.literal("ack"),
    data: z.object({
        message_id: z.string().optional(),
        success: z.boolean(),
    }),
});
// Объединенный тип всех WebSocket сообщений
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
// Схема для аутентификации WebSocket соединения
export const WebSocketAuthSchema = z.object({
    project_id: z.string().uuid(),
    token: z.string().min(1),
});
