/// <reference types="node" />
export interface FileUploadResult {
    key: string;
    url: string;
    etag: string;
    size: number;
    contentType?: string;
}
export interface FileDownloadResult {
    content: string | Buffer;
    contentType?: string;
    size: number;
    lastModified?: Date;
    etag?: string;
}
export interface FileMetadata {
    key: string;
    size: number;
    lastModified: Date;
    etag: string;
    contentType?: string;
}
export interface UploadOptions {
    contentType?: string;
    metadata?: Record<string, string>;
    cacheControl?: string;
    expires?: Date;
}
export interface DownloadOptions {
    range?: {
        start: number;
        end: number;
    };
}
export interface ListFilesOptions {
    prefix?: string;
    maxKeys?: number;
    continuationToken?: string;
}
export interface ListFilesResult {
    files: FileMetadata[];
    isTruncated: boolean;
    nextContinuationToken?: string;
}
export interface FileVersion {
    versionId: string;
    key: string;
    size: number;
    lastModified: Date;
    etag: string;
    isLatest: boolean;
}
export interface ProjectFileStructure {
    projectId: string;
    templateZip?: string;
    versions: {
        [versionId: string]: {
            files: Record<string, string>;
            metadata: {
                timestamp: string;
                totalSize: number;
                fileCount: number;
            };
        };
    };
    builds: {
        [buildId: string]: {
            distZip: string;
            metadata: {
                timestamp: string;
                buildStatus: "success" | "failed";
                buildLog?: string;
            };
        };
    };
}
