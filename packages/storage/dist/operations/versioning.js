import { ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Config } from "../client";
import { uploadJsonFile } from "./upload";
import { downloadJsonFile } from "./download";
/**
 * Создать новую версию проекта
 */
export async function createProjectVersion(projectId, files, // filePath -> content
metadata) {
    const versionId = generateVersionId();
    const timestamp = new Date().toISOString();
    // Загружаем все файлы версии
    const uploadPromises = Object.entries(files).map(async ([filePath, content]) => {
        const key = `projects/${projectId}/versions/${versionId}/${filePath}`;
        return uploadFile(key, content);
    });
    await Promise.all(uploadPromises);
    // Обновляем структуру проекта
    await updateProjectStructure(projectId, versionId, files, {
        timestamp,
        totalSize: Object.values(files).reduce((sum, content) => sum + Buffer.byteLength(content, 'utf-8'), 0),
        fileCount: Object.keys(files).length,
        ...metadata,
    });
    return versionId;
}
/**
 * Получить список версий проекта
 */
export async function getProjectVersions(projectId) {
    const client = getR2Client();
    const config = getR2Config();
    const command = new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: `projects/${projectId}/versions/`,
        Delimiter: "/",
    });
    const result = await client.send(command);
    const versions = [];
    if (result.CommonPrefixes) {
        for (const prefix of result.CommonPrefixes) {
            if (prefix.Prefix) {
                const versionId = prefix.Prefix.split("/")[3]; // projects/id/versions/versionId/
                if (versionId) {
                    // Получаем метаданные версии
                    try {
                        const structure = await getProjectStructure(projectId);
                        const versionData = structure.versions[versionId];
                        if (versionData) {
                            versions.push({
                                versionId,
                                key: prefix.Prefix,
                                size: versionData.metadata.totalSize,
                                lastModified: new Date(versionData.metadata.timestamp),
                                etag: "",
                                isLatest: false, // Определим позже
                            });
                        }
                    }
                    catch (error) {
                        console.warn(`Failed to get metadata for version ${versionId}:`, error);
                    }
                }
            }
        }
    }
    // Сортируем по дате и отмечаем последнюю версию
    versions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    if (versions.length > 0) {
        versions[0].isLatest = true;
    }
    return versions;
}
/**
 * Получить файлы определенной версии
 */
export async function getVersionFiles(projectId, versionId) {
    const client = getR2Client();
    const config = getR2Config();
    const command = new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: `projects/${projectId}/versions/${versionId}/`,
    });
    const result = await client.send(command);
    const files = {};
    if (result.Contents) {
        const downloadPromises = result.Contents.map(async (object) => {
            if (object.Key) {
                const filePath = object.Key.replace(`projects/${projectId}/versions/${versionId}/`, "");
                if (filePath) {
                    try {
                        const { downloadTextFile } = await import("./download");
                        const content = await downloadTextFile(object.Key);
                        files[filePath] = content;
                    }
                    catch (error) {
                        console.warn(`Failed to download file ${filePath}:`, error);
                    }
                }
            }
        });
        await Promise.all(downloadPromises);
    }
    return files;
}
/**
 * Удалить версию проекта
 */
export async function deleteProjectVersion(projectId, versionId) {
    const client = getR2Client();
    const config = getR2Config();
    // Получаем список всех файлов версии
    const command = new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: `projects/${projectId}/versions/${versionId}/`,
    });
    const result = await client.send(command);
    if (result.Contents) {
        // Удаляем все файлы версии
        const deletePromises = result.Contents.map(async (object) => {
            if (object.Key) {
                const deleteCommand = new DeleteObjectCommand({
                    Bucket: config.bucketName,
                    Key: object.Key,
                });
                return client.send(deleteCommand);
            }
        });
        await Promise.all(deletePromises);
    }
    // Обновляем структуру проекта
    const structure = await getProjectStructure(projectId);
    delete structure.versions[versionId];
    await saveProjectStructure(projectId, structure);
}
/**
 * Скопировать версию (создать новую версию на основе существующей)
 */
export async function copyProjectVersion(projectId, sourceVersionId, targetVersionId) {
    const newVersionId = targetVersionId || generateVersionId();
    const files = await getVersionFiles(projectId, sourceVersionId);
    await createProjectVersion(projectId, files, {
        comment: `Copied from version ${sourceVersionId}`,
    });
    return newVersionId;
}
/**
 * Получить структуру проекта
 */
export async function getProjectStructure(projectId) {
    try {
        const key = `projects/${projectId}/structure.json`;
        return await downloadJsonFile(key);
    }
    catch (error) {
        // Если файл не существует, создаем новую структуру
        return {
            projectId,
            versions: {},
            builds: {},
        };
    }
}
/**
 * Сохранить структуру проекта
 */
export async function saveProjectStructure(projectId, structure) {
    const key = `projects/${projectId}/structure.json`;
    await uploadJsonFile(key, structure);
}
/**
 * Обновить структуру проекта с новой версией
 */
async function updateProjectStructure(projectId, versionId, files, metadata) {
    const structure = await getProjectStructure(projectId);
    // Создаем маппинг файлов на их ключи в R2
    const fileKeys = {};
    Object.keys(files).forEach((filePath) => {
        fileKeys[filePath] = `projects/${projectId}/versions/${versionId}/${filePath}`;
    });
    structure.versions[versionId] = {
        files: fileKeys,
        metadata,
    };
    await saveProjectStructure(projectId, structure);
}
/**
 * Генерировать ID версии
 */
function generateVersionId() {
    return `v${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Получить список файлов в папке
 */
export async function listFiles(prefix, options = {}) {
    const client = getR2Client();
    const config = getR2Config();
    const command = new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: prefix,
        MaxKeys: options.maxKeys || 1000,
        ContinuationToken: options.continuationToken,
    });
    const result = await client.send(command);
    const files = (result.Contents || []).map((object) => ({
        key: object.Key || "",
        size: object.Size || 0,
        lastModified: object.LastModified || new Date(),
        etag: object.ETag || "",
        contentType: undefined, // Не доступно в ListObjects
    }));
    return {
        files,
        isTruncated: result.IsTruncated || false,
        nextContinuationToken: result.NextContinuationToken,
    };
}
// Импорт функции uploadFile из upload.ts
async function uploadFile(key, content) {
    const { uploadTextFile } = await import("./upload");
    await uploadTextFile(key, content);
}
