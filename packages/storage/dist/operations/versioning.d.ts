import { FileVersion, ProjectFileStructure, ListFilesOptions, ListFilesResult } from "../types";
/**
 * Создать новую версию проекта
 */
export declare function createProjectVersion(projectId: string, files: Record<string, string>, // filePath -> content
metadata?: {
    comment?: string;
    author?: string;
}): Promise<string>;
/**
 * Получить список версий проекта
 */
export declare function getProjectVersions(projectId: string): Promise<FileVersion[]>;
/**
 * Получить файлы определенной версии
 */
export declare function getVersionFiles(projectId: string, versionId: string): Promise<Record<string, string>>;
/**
 * Удалить версию проекта
 */
export declare function deleteProjectVersion(projectId: string, versionId: string): Promise<void>;
/**
 * Скопировать версию (создать новую версию на основе существующей)
 */
export declare function copyProjectVersion(projectId: string, sourceVersionId: string, targetVersionId?: string): Promise<string>;
/**
 * Получить структуру проекта
 */
export declare function getProjectStructure(projectId: string): Promise<ProjectFileStructure>;
/**
 * Сохранить структуру проекта
 */
export declare function saveProjectStructure(projectId: string, structure: ProjectFileStructure): Promise<void>;
/**
 * Получить список файлов в папке
 */
export declare function listFiles(prefix: string, options?: ListFilesOptions): Promise<ListFilesResult>;
