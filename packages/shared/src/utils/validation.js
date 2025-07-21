/**
 * Safe data validation with result return
 */
export function safeValidate(schema, data) {
    try {
        const result = schema.safeParse(data);
        if (result.success) {
            return { success: true, data: result.data };
        }
        else {
            return {
                success: false,
                error: result.error.errors
                    .map((e) => `${e.path.join(".")}: ${e.message}`)
                    .join(", "),
            };
        }
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown validation error",
        };
    }
}
/**
 * Validation with error throwing
 */
export function validateOrThrow(schema, data) {
    const result = safeValidate(schema, data);
    if (!result.success) {
        throw new Error(`Validation failed: ${result.error}`);
    }
    return result.data;
}
/**
 * Check if string is a valid UUID
 */
export function isValidUUID(str) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}
/**
 * Check if string is a valid URL
 */
export function isValidURL(str) {
    try {
        new URL(str);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Filename sanitization
 */
export function sanitizeFileName(fileName) {
    return fileName
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_{2,}/g, "_")
        .replace(/^_+|_+$/g, "");
}
/**
 * File extension validation
 */
export function isAllowedFileExtension(fileName, allowedExtensions) {
    const extension = fileName.split(".").pop()?.toLowerCase();
    return extension ? allowedExtensions.includes(extension) : false;
}
