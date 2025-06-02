/**
 * Утилиты для генерации путей файлов в R2
 */

/**
 * Генерировать путь к шаблону проекта
 */
export function getProjectTemplatePath(projectId: string): string {
  return `projects/${projectId}/template.zip`;
}

/**
 * Генерировать путь к файлу версии
 */
export function getFileVersionPath(
  projectId: string,
  versionId: string,
  filePath: string
): string {
  return `projects/${projectId}/versions/${versionId}/${filePath}`;
}

/**
 * Генерировать путь к структуре проекта
 */
export function getProjectStructurePath(projectId: string): string {
  return `projects/${projectId}/structure.json`;
}

/**
 * Генерировать путь к собранным артефактам
 */
export function getBuildArtifactsPath(
  projectId: string,
  buildId: string
): string {
  return `projects/${projectId}/builds/${buildId}/dist.zip`;
}

/**
 * Генерировать путь к метаданным сборки
 */
export function getBuildMetadataPath(
  projectId: string,
  buildId: string
): string {
  return `projects/${projectId}/builds/${buildId}/metadata.json`;
}

/**
 * Генерировать префикс для всех файлов проекта
 */
export function getProjectPrefix(projectId: string): string {
  return `projects/${projectId}/`;
}

/**
 * Генерировать префикс для версий проекта
 */
export function getProjectVersionsPrefix(projectId: string): string {
  return `projects/${projectId}/versions/`;
}

/**
 * Генерировать префикс для конкретной версии
 */
export function getVersionPrefix(projectId: string, versionId: string): string {
  return `projects/${projectId}/versions/${versionId}/`;
}

/**
 * Генерировать префикс для сборок проекта
 */
export function getProjectBuildsPrefix(projectId: string): string {
  return `projects/${projectId}/builds/`;
}

/**
 * Извлечь ID проекта из пути
 */
export function extractProjectId(path: string): string | null {
  const match = path.match(/^projects\/([^\/]+)\//);
  return match ? match[1] : null;
}

/**
 * Извлечь ID версии из пути
 */
export function extractVersionId(path: string): string | null {
  const match = path.match(/^projects\/[^\/]+\/versions\/([^\/]+)\//);
  return match ? match[1] : null;
}

/**
 * Извлечь путь файла из полного пути версии
 */
export function extractFilePath(path: string): string | null {
  const match = path.match(/^projects\/[^\/]+\/versions\/[^\/]+\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Извлечь ID сборки из пути
 */
export function extractBuildId(path: string): string | null {
  const match = path.match(/^projects\/[^\/]+\/builds\/([^\/]+)\//);
  return match ? match[1] : null;
}

/**
 * Проверить, является ли путь файлом шаблона
 */
export function isTemplatePath(path: string): boolean {
  return path.endsWith("/template.zip");
}

/**
 * Проверить, является ли путь файлом версии
 */
export function isVersionFilePath(path: string): boolean {
  return /^projects\/[^\/]+\/versions\/[^\/]+\//.test(path);
}

/**
 * Проверить, является ли путь файлом сборки
 */
export function isBuildPath(path: string): boolean {
  return /^projects\/[^\/]+\/builds\/[^\/]+\//.test(path);
}

/**
 * Проверить, является ли путь структурным файлом проекта
 */
export function isStructurePath(path: string): boolean {
  return path.endsWith("/structure.json");
}

/**
 * Нормализовать путь файла (убрать лишние слеши, точки)
 */
export function normalizePath(path: string): string {
  return path
    .replace(/\/+/g, "/") // Убираем множественные слеши
    .replace(/^\//, "") // Убираем начальный слеш
    .replace(/\/$/, "") // Убираем конечный слеш
    .replace(/\/\./g, "/") // Убираем /.
    .replace(/\/[^\/]+\/\.\./g, ""); // Убираем /folder/..
}

/**
 * Получить расширение файла
 */
export function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  return lastDot > 0 ? filePath.substring(lastDot + 1).toLowerCase() : "";
}

/**
 * Получить имя файла без расширения
 */
export function getFileNameWithoutExtension(filePath: string): string {
  const fileName = filePath.split("/").pop() || "";
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
}

/**
 * Получить директорию файла
 */
export function getFileDirectory(filePath: string): string {
  const lastSlash = filePath.lastIndexOf("/");
  return lastSlash > 0 ? filePath.substring(0, lastSlash) : "";
} 