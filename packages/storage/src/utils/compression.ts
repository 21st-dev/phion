import * as fs from "fs";
import * as path from "path";

/**
 * Создать ZIP архив из файлов проекта
 * Примечание: Для полной реализации нужна библиотека типа 'archiver' или 'jszip'
 * Пока что создаем простую заглушку
 */
export async function createProjectZip(
  files: Record<string, string>, // filePath -> content
  projectName: string = "project"
): Promise<Buffer> {
  // TODO: Реализовать с помощью archiver или jszip
  // Пока что возвращаем простой JSON как заглушку
  const projectData = {
    name: projectName,
    files,
    created: new Date().toISOString(),
  };
  
  return Buffer.from(JSON.stringify(projectData, null, 2));
}

/**
 * Извлечь файлы из ZIP архива
 * Примечание: Для полной реализации нужна библиотека типа 'yauzl' или 'jszip'
 */
export async function extractProjectZip(
  zipBuffer: Buffer
): Promise<Record<string, string>> {
  try {
    // TODO: Реализовать с помощью yauzl или jszip
    // Пока что парсим JSON заглушку
    const projectData = JSON.parse(zipBuffer.toString());
    return projectData.files || {};
  } catch (error) {
    throw new Error(`Failed to extract ZIP archive: ${error}`);
  }
}

/**
 * Создать архив директории
 */
export async function createDirectoryZip(
  directoryPath: string,
  excludePatterns: string[] = ["node_modules", ".git", "dist", ".next"]
): Promise<Buffer> {
  const files: Record<string, string> = {};
  
  // Рекурсивно читаем все файлы в директории
  await walkDirectory(directoryPath, (filePath, content) => {
    const relativePath = path.relative(directoryPath, filePath);
    
    // Проверяем, не исключен ли файл
    const shouldExclude = excludePatterns.some(pattern => 
      relativePath.includes(pattern)
    );
    
    if (!shouldExclude) {
      files[relativePath.replace(/\\/g, "/")] = content;
    }
  });
  
  return createProjectZip(files);
}

/**
 * Извлечь архив в директорию
 */
export async function extractZipToDirectory(
  zipBuffer: Buffer,
  targetDirectory: string
): Promise<void> {
  const files = await extractProjectZip(zipBuffer);
  
  // Создаем директорию если не существует
  if (!fs.existsSync(targetDirectory)) {
    fs.mkdirSync(targetDirectory, { recursive: true });
  }
  
  // Записываем все файлы
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(targetDirectory, filePath);
    const directory = path.dirname(fullPath);
    
    // Создаем директорию для файла
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    // Записываем файл
    fs.writeFileSync(fullPath, content, "utf-8");
  }
}

/**
 * Получить размер архива
 */
export function getArchiveSize(zipBuffer: Buffer): number {
  return zipBuffer.length;
}

/**
 * Проверить валидность ZIP архива
 */
export async function validateZipArchive(zipBuffer: Buffer): Promise<boolean> {
  try {
    await extractProjectZip(zipBuffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Получить список файлов в архиве
 */
export async function listZipContents(zipBuffer: Buffer): Promise<string[]> {
  try {
    const files = await extractProjectZip(zipBuffer);
    return Object.keys(files);
  } catch {
    return [];
  }
}

/**
 * Сжать текстовые файлы (простое gzip-подобное сжатие)
 */
export function compressText(text: string): Buffer {
  // TODO: Реализовать с помощью zlib
  // Пока что просто возвращаем как есть
  return Buffer.from(text, "utf-8");
}

/**
 * Распаковать сжатый текст
 */
export function decompressText(buffer: Buffer): string {
  // TODO: Реализовать с помощью zlib
  // Пока что просто возвращаем как есть
  return buffer.toString("utf-8");
}

/**
 * Рекурсивно обойти директорию
 */
async function walkDirectory(
  dir: string,
  callback: (filePath: string, content: string) => void
): Promise<void> {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      await walkDirectory(fullPath, callback);
    } else if (stat.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        callback(fullPath, content);
      } catch (error) {
        // Пропускаем бинарные файлы или файлы с ошибками чтения
        console.warn(`Skipping file ${fullPath}: ${error}`);
      }
    }
  }
}

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

export async function createArchiveManifest(
  files: Record<string, string>,
  name: string = "project",
  version: string = "1.0.0"
): Promise<ArchiveManifest> {
  const fileList = Object.entries(files).map(([filePath, content]) => ({
    path: filePath,
    size: Buffer.byteLength(content, "utf-8"),
    hash: createSimpleHash(content),
  }));
  
  const totalSize = fileList.reduce((sum, file) => sum + file.size, 0);
  
  return {
    name,
    version,
    created: new Date().toISOString(),
    files: fileList,
    totalSize,
    fileCount: fileList.length,
  };
}

/**
 * Простая хеш-функция для содержимого файла
 */
function createSimpleHash(content: string): string {
  // TODO: Использовать crypto.createHash('sha256')
  // Пока что простая заглушка
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Преобразуем в 32-битное число
  }
  return hash.toString(16);
} 