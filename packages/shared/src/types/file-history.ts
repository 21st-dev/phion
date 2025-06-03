import { z } from "zod";

// Схема истории файлов
export const FileHistorySchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  file_path: z.string().min(1),
  r2_object_key: z.string().min(1),
  content_hash: z.string().nullable(),
  diff_text: z.string().nullable(),
  file_size: z.number().int().min(0),
  created_at: z.string().datetime(),
});

export type FileHistory = z.infer<typeof FileHistorySchema>;

// Схема для создания записи истории файла
export const CreateFileHistorySchema = z.object({
  project_id: z.string().uuid(),
  file_path: z.string().min(1),
  r2_object_key: z.string().min(1),
  content_hash: z.string().optional(),
  diff_text: z.string().optional(),
  file_size: z.number().int().min(0),
  commit_id: z.string().uuid().optional(),
  commit_message: z.string().optional(),
});

export type CreateFileHistory = z.infer<typeof CreateFileHistorySchema>;

// Схема для файлового изменения (от локального агента)
export const FileChangeSchema = z.object({
  project_id: z.string().uuid(),
  file_path: z.string().min(1),
  content: z.string(),
  hash: z.string(),
  timestamp: z.number().int().min(0),
});

export type FileChange = z.infer<typeof FileChangeSchema>;

// Схема для удаления файла
export const FileDeleteSchema = z.object({
  project_id: z.string().uuid(),
  file_path: z.string().min(1),
  timestamp: z.number().int().min(0),
});

export type FileDelete = z.infer<typeof FileDeleteSchema>;

// Схема для diff между версиями
export const FileDiffSchema = z.object({
  file_path: z.string(),
  old_content: z.string().nullable(),
  new_content: z.string(),
  diff: z.string(),
  change_type: z.enum(["added", "modified", "deleted"]),
});

export type FileDiff = z.infer<typeof FileDiffSchema>;
