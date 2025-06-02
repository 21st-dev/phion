/// <reference types="node" />
import { FileDownloadResult, DownloadOptions, FileMetadata } from "../types";
/**
 * Скачать файл из R2
 */
export declare function downloadFile(key: string, options?: DownloadOptions): Promise<FileDownloadResult>;
/**
 * Скачать текстовый файл
 */
export declare function downloadTextFile(key: string): Promise<string>;
/**
 * Скачать JSON файл
 */
export declare function downloadJsonFile<T = any>(key: string): Promise<T>;
/**
 * Скачать версию файла проекта
 */
export declare function downloadFileVersion(projectId: string, versionId: string, filePath: string): Promise<string>;
/**
 * Скачать шаблон проекта
 */
export declare function downloadProjectTemplate(projectId: string): Promise<Buffer>;
/**
 * Скачать собранные артефакты
 */
export declare function downloadBuildArtifacts(projectId: string, buildId: string): Promise<Buffer>;
/**
 * Получить метаданные файла
 */
export declare function getFileMetadata(key: string): Promise<FileMetadata>;
/**
 * Проверить существование файла
 */
export declare function fileExists(key: string): Promise<boolean>;
/**
 * Создать подписанный URL для скачивания
 */
export declare function createDownloadUrl(key: string, expiresIn?: number): Promise<string>;
/**
 * Скачать все файлы проекта для определенной версии
 */
export declare function downloadProjectFiles(projectId: string, versionId: string): Promise<Record<string, string>>;
