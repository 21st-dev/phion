import { SupabaseClient } from "@supabase/supabase-js";
import {
  Database,
  FileHistoryRow,
  FileHistoryInsert,
  FileHistoryUpdate,
} from "../types";
import { CreateFileHistory } from "@shipvibes/shared";

export class FileHistoryQueries {
  constructor(private client: SupabaseClient<Database>) {}

  /**
   * Получить историю файлов проекта
   */
  async getProjectFileHistory(
    projectId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<FileHistoryRow[]> {
    const { data, error } = await this.client
      .from("file_history")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch file history: ${error.message}`);
    }

    return (data as unknown as FileHistoryRow[]) || [];
  }

  /**
   * Получить историю конкретного файла
   */
  async getFileHistory(
    projectId: string,
    filePath: string,
    limit: number = 50
  ): Promise<FileHistoryRow[]> {
    const { data, error } = await this.client
      .from("file_history")
      .select("*")
      .eq("project_id", projectId)
      .eq("file_path", filePath)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch file history: ${error.message}`);
    }

    return (data as unknown as FileHistoryRow[]) || [];
  }

  /**
   * Получить последнюю версию файла
   */
  async getLatestFileVersion(
    projectId: string,
    filePath: string
  ): Promise<FileHistoryRow | null> {
    const { data, error } = await this.client
      .from("file_history")
      .select("*")
      .eq("project_id", projectId)
      .eq("file_path", filePath)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Файл не найден
      }
      throw new Error(`Failed to fetch latest file version: ${error.message}`);
    }

    return data as unknown as FileHistoryRow;
  }

  /**
   * Создать запись истории файла
   */
  async createFileHistory(
    historyData: CreateFileHistory
  ): Promise<FileHistoryRow> {
    const insertData: FileHistoryInsert = {
      project_id: historyData.project_id,
      file_path: historyData.file_path,
      r2_object_key: historyData.r2_object_key,
      content_hash: historyData.content_hash,
      diff_text: historyData.diff_text,
      file_size: historyData.file_size,
    };

    const { data, error } = await this.client
      .from("file_history")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create file history: ${error.message}`);
    }

    return data as unknown as FileHistoryRow;
  }

  /**
   * Получить запись по ID
   */
  async getFileHistoryById(id: string): Promise<FileHistoryRow | null> {
    const { data, error } = await this.client
      .from("file_history")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch file history by ID: ${error.message}`);
    }

    return data as unknown as FileHistoryRow;
  }

  /**
   * Найти файлы по хешу содержимого (дедупликация)
   */
  async findFilesByContentHash(contentHash: string): Promise<FileHistoryRow[]> {
    const { data, error } = await this.client
      .from("file_history")
      .select("*")
      .eq("content_hash", contentHash)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to find files by content hash: ${error.message}`);
    }

    return (data as unknown as FileHistoryRow[]) || [];
  }

  /**
   * Получить изменения между двумя версиями
   */
  async getChangesBetweenVersions(
    projectId: string,
    fromDate: string,
    toDate: string
  ): Promise<FileHistoryRow[]> {
    const { data, error } = await this.client
      .from("file_history")
      .select("*")
      .eq("project_id", projectId)
      .gte("created_at", fromDate)
      .lte("created_at", toDate)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(
        `Failed to fetch changes between versions: ${error.message}`
      );
    }

    return (data as unknown as FileHistoryRow[]) || [];
  }

  /**
   * Получить статистику по файлам проекта (упрощенная версия)
   */
  async getProjectFileStats(projectId: string): Promise<{
    total_files: number;
    total_versions: number;
    total_size: number;
    last_updated: string | null;
  }> {
    // Получаем все записи истории для проекта
    const { data, error } = await this.client
      .from("file_history")
      .select("file_path, file_size, created_at");

    if (error) {
      throw new Error(`Failed to fetch project file stats: ${error.message}`);
    }

    const files = data as unknown as Array<{
      file_path: string;
      file_size: number;
      created_at: string;
    }>;

    // Подсчитываем статистику
    const uniqueFiles = new Set(files.map((f) => f.file_path));
    const totalSize = files.reduce((sum, f) => sum + f.file_size, 0);
    const lastUpdated =
      files.length > 0
        ? files.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )[0].created_at
        : null;

    return {
      total_files: uniqueFiles.size,
      total_versions: files.length,
      total_size: totalSize,
      last_updated: lastUpdated,
    };
  }
}
