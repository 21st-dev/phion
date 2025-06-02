/**
 * Утилиты для генерации путей файлов в R2
 */
/**
 * Генерировать путь к шаблону проекта
 */
export declare function getProjectTemplatePath(projectId: string): string;
/**
 * Генерировать путь к файлу версии
 */
export declare function getFileVersionPath(projectId: string, versionId: string, filePath: string): string;
/**
 * Генерировать путь к структуре проекта
 */
export declare function getProjectStructurePath(projectId: string): string;
/**
 * Генерировать путь к собранным артефактам
 */
export declare function getBuildArtifactsPath(projectId: string, buildId: string): string;
/**
 * Генерировать путь к метаданным сборки
 */
export declare function getBuildMetadataPath(projectId: string, buildId: string): string;
/**
 * Генерировать префикс для всех файлов проекта
 */
export declare function getProjectPrefix(projectId: string): string;
/**
 * Генерировать префикс для версий проекта
 */
export declare function getProjectVersionsPrefix(projectId: string): string;
/**
 * Генерировать префикс для конкретной версии
 */
export declare function getVersionPrefix(projectId: string, versionId: string): string;
/**
 * Генерировать префикс для сборок проекта
 */
export declare function getProjectBuildsPrefix(projectId: string): string;
/**
 * Извлечь ID проекта из пути
 */
export declare function extractProjectId(path: string): string | null;
/**
 * Извлечь ID версии из пути
 */
export declare function extractVersionId(path: string): string | null;
/**
 * Извлечь путь файла из полного пути версии
 */
export declare function extractFilePath(path: string): string | null;
/**
 * Извлечь ID сборки из пути
 */
export declare function extractBuildId(path: string): string | null;
/**
 * Проверить, является ли путь файлом шаблона
 */
export declare function isTemplatePath(path: string): boolean;
/**
 * Проверить, является ли путь файлом версии
 */
export declare function isVersionFilePath(path: string): boolean;
/**
 * Проверить, является ли путь файлом сборки
 */
export declare function isBuildPath(path: string): boolean;
/**
 * Проверить, является ли путь структурным файлом проекта
 */
export declare function isStructurePath(path: string): boolean;
/**
 * Нормализовать путь файла (убрать лишние слеши, точки)
 */
export declare function normalizePath(path: string): string;
/**
 * Получить расширение файла
 */
export declare function getFileExtension(filePath: string): string;
/**
 * Получить имя файла без расширения
 */
export declare function getFileNameWithoutExtension(filePath: string): string;
/**
 * Получить директорию файла
 */
export declare function getFileDirectory(filePath: string): string;
