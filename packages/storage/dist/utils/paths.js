/**
 * Утилиты для генерации путей файлов в R2
 */
/**
 * Генерировать путь к шаблону проекта
 */
export function getProjectTemplatePath(projectId) {
    return `projects/${projectId}/template.zip`;
}
/**
 * Генерировать путь к файлу версии
 */
export function getFileVersionPath(projectId, versionId, filePath) {
    return `projects/${projectId}/versions/${versionId}/${filePath}`;
}
/**
 * Генерировать путь к структуре проекта
 */
export function getProjectStructurePath(projectId) {
    return `projects/${projectId}/structure.json`;
}
/**
 * Генерировать путь к собранным артефактам
 */
export function getBuildArtifactsPath(projectId, buildId) {
    return `projects/${projectId}/builds/${buildId}/dist.zip`;
}
/**
 * Генерировать путь к метаданным сборки
 */
export function getBuildMetadataPath(projectId, buildId) {
    return `projects/${projectId}/builds/${buildId}/metadata.json`;
}
/**
 * Генерировать префикс для всех файлов проекта
 */
export function getProjectPrefix(projectId) {
    return `projects/${projectId}/`;
}
/**
 * Генерировать префикс для версий проекта
 */
export function getProjectVersionsPrefix(projectId) {
    return `projects/${projectId}/versions/`;
}
/**
 * Генерировать префикс для конкретной версии
 */
export function getVersionPrefix(projectId, versionId) {
    return `projects/${projectId}/versions/${versionId}/`;
}
/**
 * Генерировать префикс для сборок проекта
 */
export function getProjectBuildsPrefix(projectId) {
    return `projects/${projectId}/builds/`;
}
/**
 * Извлечь ID проекта из пути
 */
export function extractProjectId(path) {
    const match = path.match(/^projects\/([^\/]+)\//);
    return match ? match[1] : null;
}
/**
 * Извлечь ID версии из пути
 */
export function extractVersionId(path) {
    const match = path.match(/^projects\/[^\/]+\/versions\/([^\/]+)\//);
    return match ? match[1] : null;
}
/**
 * Извлечь путь файла из полного пути версии
 */
export function extractFilePath(path) {
    const match = path.match(/^projects\/[^\/]+\/versions\/[^\/]+\/(.+)$/);
    return match ? match[1] : null;
}
/**
 * Извлечь ID сборки из пути
 */
export function extractBuildId(path) {
    const match = path.match(/^projects\/[^\/]+\/builds\/([^\/]+)\//);
    return match ? match[1] : null;
}
/**
 * Проверить, является ли путь файлом шаблона
 */
export function isTemplatePath(path) {
    return path.endsWith("/template.zip");
}
/**
 * Проверить, является ли путь файлом версии
 */
export function isVersionFilePath(path) {
    return /^projects\/[^\/]+\/versions\/[^\/]+\//.test(path);
}
/**
 * Проверить, является ли путь файлом сборки
 */
export function isBuildPath(path) {
    return /^projects\/[^\/]+\/builds\/[^\/]+\//.test(path);
}
/**
 * Проверить, является ли путь структурным файлом проекта
 */
export function isStructurePath(path) {
    return path.endsWith("/structure.json");
}
/**
 * Нормализовать путь файла (убрать лишние слеши, точки)
 */
export function normalizePath(path) {
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
export function getFileExtension(filePath) {
    const lastDot = filePath.lastIndexOf(".");
    return lastDot > 0 ? filePath.substring(lastDot + 1).toLowerCase() : "";
}
/**
 * Получить имя файла без расширения
 */
export function getFileNameWithoutExtension(filePath) {
    const fileName = filePath.split("/").pop() || "";
    const lastDot = fileName.lastIndexOf(".");
    return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
}
/**
 * Получить директорию файла
 */
export function getFileDirectory(filePath) {
    const lastSlash = filePath.lastIndexOf("/");
    return lastSlash > 0 ? filePath.substring(0, lastSlash) : "";
}
