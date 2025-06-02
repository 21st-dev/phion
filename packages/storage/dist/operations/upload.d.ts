/// <reference types="node" />
import { FileUploadResult, UploadOptions } from "../types";
/**
 * Загрузить файл в R2
 */
export declare function uploadFile(key: string, content: string | Buffer, options?: UploadOptions): Promise<FileUploadResult>;
/**
 * Загрузить текстовый файл
 */
export declare function uploadTextFile(key: string, content: string, contentType?: string): Promise<FileUploadResult>;
/**
 * Загрузить JSON файл
 */
export declare function uploadJsonFile(key: string, data: any): Promise<FileUploadResult>;
/**
 * Загрузить версию файла проекта
 */
export declare function uploadFileVersion(projectId: string, versionId: string, filePath: string, content: string): Promise<FileUploadResult>;
/**
 * Загрузить шаблон проекта
 */
export declare function uploadProjectTemplate(projectId: string, templateZip: Buffer): Promise<FileUploadResult>;
/**
 * Загрузить собранные артефакты
 */
export declare function uploadBuildArtifacts(projectId: string, buildId: string, distZip: Buffer): Promise<FileUploadResult>;
/**
 * Создать подписанный URL для загрузки
 */
export declare function createUploadUrl(key: string, expiresIn?: number, contentType?: string): Promise<string>;
