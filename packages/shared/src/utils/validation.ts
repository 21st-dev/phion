import { z } from "zod";

/**
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return {
        success: false,
        error: result.error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", "),
      };
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

/**
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = safeValidate(schema, data);
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error}`);
  }
  return result.data;
}

/**
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 */
export function isValidURL(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 */
export function isAllowedFileExtension(
  fileName: string,
  allowedExtensions: string[]
): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension ? allowedExtensions.includes(extension) : false;
}
