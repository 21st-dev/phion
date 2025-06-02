import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getR2Config } from "../client";
import { FileDownloadResult, DownloadOptions, FileMetadata } from "../types";

/**
 * Скачать файл из R2
 */
export async function downloadFile(
  key: string,
  options: DownloadOptions = {}
): Promise<FileDownloadResult> {
  const client = getR2Client();
  const config = getR2Config();

  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Range: options.range ? `bytes=${options.range.start}-${options.range.end}` : undefined,
  });

  const result = await client.send(command);

  if (!result.Body) {
    throw new Error(`File not found: ${key}`);
  }

  // Преобразуем поток в Buffer
  const content = await streamToString(result.Body);

  return {
    content,
    contentType: result.ContentType,
    size: result.ContentLength || 0,
    lastModified: result.LastModified,
    etag: result.ETag,
  };
}

/**
 * Скачать текстовый файл
 */
export async function downloadTextFile(key: string): Promise<string> {
  const result = await downloadFile(key);
  return result.content.toString();
}

/**
 * Скачать JSON файл
 */
export async function downloadJsonFile<T = any>(key: string): Promise<T> {
  const content = await downloadTextFile(key);
  return JSON.parse(content);
}

/**
 * Скачать версию файла проекта
 */
export async function downloadFileVersion(
  projectId: string,
  versionId: string,
  filePath: string
): Promise<string> {
  const key = `projects/${projectId}/versions/${versionId}/${filePath}`;
  return downloadTextFile(key);
}

/**
 * Скачать шаблон проекта
 */
export async function downloadProjectTemplate(projectId: string): Promise<Buffer> {
  const key = `projects/${projectId}/template.zip`;
  const result = await downloadFile(key);
  return Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content);
}

/**
 * Скачать собранные артефакты
 */
export async function downloadBuildArtifacts(
  projectId: string,
  buildId: string
): Promise<Buffer> {
  const key = `projects/${projectId}/builds/${buildId}/dist.zip`;
  const result = await downloadFile(key);
  return Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content);
}

/**
 * Получить метаданные файла
 */
export async function getFileMetadata(key: string): Promise<FileMetadata> {
  const client = getR2Client();
  const config = getR2Config();

  const command = new HeadObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  const result = await client.send(command);

  return {
    key,
    size: result.ContentLength || 0,
    lastModified: result.LastModified || new Date(),
    etag: result.ETag || "",
    contentType: result.ContentType,
  };
}

/**
 * Проверить существование файла
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    await getFileMetadata(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Создать подписанный URL для скачивания
 */
export async function createDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getR2Client();
  const config = getR2Config();

  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Скачать все файлы проекта для определенной версии
 */
export async function downloadProjectFiles(
  projectId: string,
  versionId: string
): Promise<Record<string, string>> {
  // Это упрощенная версия - в реальности нужно будет получить список файлов из БД
  // и затем скачать каждый файл
  const files: Record<string, string> = {};
  
  // Пример: скачиваем основные файлы
  const commonFiles = [
    "package.json",
    "index.html",
    "src/main.jsx",
    "src/App.jsx",
    "src/index.css",
  ];

  for (const filePath of commonFiles) {
    try {
      const content = await downloadFileVersion(projectId, versionId, filePath);
      files[filePath] = content;
    } catch (error) {
      // Файл может не существовать - это нормально
      console.warn(`File not found: ${filePath}`);
    }
  }

  return files;
}

/**
 * Утилита для преобразования потока в строку
 */
async function streamToString(stream: any): Promise<Buffer> {
  if (typeof stream === "string") {
    return Buffer.from(stream);
  }

  if (Buffer.isBuffer(stream)) {
    return stream;
  }

  // Для AWS SDK ReadableStream (Node.js Readable)
  if (stream && typeof stream.pipe === 'function') {
    const chunks: Uint8Array[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(new Uint8Array(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  // Для Web ReadableStream
  if (stream && typeof stream.getReader === 'function') {
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    return Buffer.concat(chunks);
  }

  // Если это уже массив байтов
  if (stream && stream.constructor === Uint8Array) {
    return Buffer.from(stream);
  }

  throw new Error(`Unsupported stream type: ${typeof stream}`);
} 