import { S3Client } from "@aws-sdk/client-s3";
// Создание R2 клиента
export function createR2Client(config) {
    const clientConfig = {
        region: config.region || "auto",
        endpoint: config.endpoint,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
        // Cloudflare R2 требует отключения проверки региона
        forcePathStyle: true,
    };
    return new S3Client(clientConfig);
}
// Глобальный клиент для сервера (инициализируется один раз)
let r2Client = null;
let r2Config = null;
export function getR2Client() {
    if (!r2Client) {
        const endpoint = process.env.R2_ENDPOINT;
        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
        const bucketName = process.env.R2_BUCKET_NAME;
        if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
            throw new Error("R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME environment variables are required");
        }
        r2Config = {
            endpoint,
            accessKeyId,
            secretAccessKey,
            bucketName,
        };
        r2Client = createR2Client(r2Config);
    }
    return r2Client;
}
export function getR2Config() {
    if (!r2Config) {
        // Инициализируем клиент, что также инициализирует конфиг
        getR2Client();
    }
    return r2Config;
}
// Утилита для проверки подключения к R2
export async function testR2Connection(client, bucketName) {
    try {
        const { HeadBucketCommand } = await import("@aws-sdk/client-s3");
        await client.send(new HeadBucketCommand({ Bucket: bucketName }));
        return true;
    }
    catch {
        return false;
    }
}
