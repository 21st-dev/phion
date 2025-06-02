import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getR2Config } from "../client";
import { FileUploadResult, UploadOptions } from "../types";

/**
 * Загрузить файл в R2
 */
export async function uploadFile(
  key: string,
  content: string | Buffer,
  options: UploadOptions = {}
): Promise<FileUploadResult> {
  const client = getR2Client();
  const config = getR2Config();

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: content,
    ContentType: options.contentType || "application/octet-stream",
    Metadata: options.metadata,
    CacheControl: options.cacheControl,
    Expires: options.expires,
  });

  const result = await client.send(command);

  const size = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, "utf-8");

  return {
    key,
    url: `${config.endpoint}/${config.bucketName}/${key}`,
    etag: result.ETag || "",
    size,
    contentType: options.contentType,
  };
}

/**
 * Загрузить текстовый файл
 */
export async function uploadTextFile(
  key: string,
  content: string,
  contentType: string = "text/plain"
): Promise<FileUploadResult> {
  return uploadFile(key, content, { contentType });
}

/**
 * Загрузить JSON файл
 */
export async function uploadJsonFile(
  key: string,
  data: any
): Promise<FileUploadResult> {
  const content = JSON.stringify(data, null, 2);
  return uploadFile(key, content, { contentType: "application/json" });
}

/**
 * Загрузить версию файла проекта
 */
export async function uploadFileVersion(
  projectId: string,
  versionId: string,
  filePath: string,
  content: string
): Promise<FileUploadResult> {
  const key = `projects/${projectId}/versions/${versionId}/${filePath}`;
  return uploadTextFile(key, content, getContentTypeFromPath(filePath));
}

/**
 * Загрузить шаблон проекта
 */
export async function uploadProjectTemplate(
  projectId: string,
  templateZip: Buffer
): Promise<FileUploadResult> {
  const key = `projects/${projectId}/template.zip`;
  return uploadFile(key, templateZip, { contentType: "application/zip" });
}

/**
 * Загрузить собранные артефакты
 */
export async function uploadBuildArtifacts(
  projectId: string,
  buildId: string,
  distZip: Buffer
): Promise<FileUploadResult> {
  const key = `projects/${projectId}/builds/${buildId}/dist.zip`;
  return uploadFile(key, distZip, { contentType: "application/zip" });
}

/**
 * Создать подписанный URL для загрузки
 */
export async function createUploadUrl(
  key: string,
  expiresIn: number = 3600,
  contentType?: string
): Promise<string> {
  const client = getR2Client();
  const config = getR2Config();

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Определить Content-Type по расширению файла
 */
function getContentTypeFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    js: "application/javascript",
    jsx: "application/javascript",
    ts: "application/typescript",
    tsx: "application/typescript",
    json: "application/json",
    html: "text/html",
    css: "text/css",
    md: "text/markdown",
    txt: "text/plain",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    ico: "image/x-icon",
  };

  return mimeTypes[ext || ""] || "text/plain";
} 