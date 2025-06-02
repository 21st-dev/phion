/// <reference types="node" />
/**
 * Создать ZIP архив из файлов проекта
 * Примечание: Для полной реализации нужна библиотека типа 'archiver' или 'jszip'
 * Пока что создаем простую заглушку
 */
export declare function createProjectZip(files: Record<string, string>, // filePath -> content
projectName?: string): Promise<Buffer>;
/**
 * Извлечь файлы из ZIP архива
 * Примечание: Для полной реализации нужна библиотека типа 'yauzl' или 'jszip'
 */
export declare function extractProjectZip(zipBuffer: Buffer): Promise<Record<string, string>>;
/**
 * Создать архив директории
 */
export declare function createDirectoryZip(directoryPath: string, excludePatterns?: string[]): Promise<Buffer>;
/**
 * Извлечь архив в директорию
 */
export declare function extractZipToDirectory(zipBuffer: Buffer, targetDirectory: string): Promise<void>;
/**
 * Получить размер архива
 */
export declare function getArchiveSize(zipBuffer: Buffer): number;
/**
 * Проверить валидность ZIP архива
 */
export declare function validateZipArchive(zipBuffer: Buffer): Promise<boolean>;
/**
 * Получить список файлов в архиве
 */
export declare function listZipContents(zipBuffer: Buffer): Promise<string[]>;
/**
 * Сжать текстовые файлы (простое gzip-подобное сжатие)
 */
export declare function compressText(text: string): Buffer;
/**
 * Распаковать сжатый текст
 */
export declare function decompressText(buffer: Buffer): string;
/**
 * Создать манифест архива
 */
export interface ArchiveManifest {
    name: string;
    version: string;
    created: string;
    files: {
        path: string;
        size: number;
        hash: string;
    }[];
    totalSize: number;
    fileCount: number;
}
export declare function createArchiveManifest(files: Record<string, string>, name?: string, version?: string): Promise<ArchiveManifest>;
