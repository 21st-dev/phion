import { S3Client } from "@aws-sdk/client-s3";
export interface R2Config {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    region?: string;
    bucketName: string;
}
export declare function createR2Client(config: R2Config): S3Client;
export declare function getR2Client(): S3Client;
export declare function getR2Config(): R2Config;
export declare function testR2Connection(client: S3Client, bucketName: string): Promise<boolean>;
