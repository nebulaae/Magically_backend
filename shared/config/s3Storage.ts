import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import { publicDir } from '../utils/paths';
import * as Minio from 'minio';

dotenv.config();

interface UploadResult {
    url: string;
    key: string;
};

class S3Storage {
    private client: Minio.Client;
    private bucketName: string;
    private useS3: boolean;

    constructor() {
        this.useS3 = process.env.USE_S3 === 'true';
        this.bucketName = process.env.S3_BUCKET_NAME || 'volshebny-bucket';

        if (this.useS3) {
            const isSSL = process.env.S3_USE_SSL === 'true';

            this.client = new Minio.Client({
                endPoint: process.env.S3_ENDPOINT,
                port: process.env.S3_PORT ? parseInt(process.env.S3_PORT) : (isSSL ? 443 : 80),
                useSSL: isSSL,
                accessKey: process.env.S3_ACCESS_KEY,
                secretKey: process.env.S3_SECRET_KEY,
            });
            // Инициализацию бакета лучше вызывать отдельно или при старте, чтобы не тормозить конструктор
            this.initializeBucket().catch(err => logger.error(`S3 Init Error: ${err.message}`));
        }
    }

    private async initializeBucket() {
        try {
            const exists = await this.client.bucketExists(this.bucketName);
            if (!exists) {
                await this.client.makeBucket(this.bucketName, 'us-east-1');

                // Политика для публичного чтения
                const policy = {
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Effect: 'Allow',
                            Principal: { AWS: ['*'] },
                            Action: ['s3:GetObject'],
                            Resource: [`arn:aws:s3:::${this.bucketName}/*`],
                        },
                    ],
                };
                await this.client.setBucketPolicy(this.bucketName, JSON.stringify(policy));
                logger.info(`Bucket ${this.bucketName} created and configured.`);
            }
        } catch (error: any) {
            // Игнорируем ошибку, если бакет уже есть или нет прав (создастся через docker-compose)
            logger.warn(`Bucket init check: ${error.message}`);
        }
    }

    /**
     * Получение публичной ссылки (Для фронтенда)
     */
    getPublicUrl(keyOrUrl: string): string {
        if (!keyOrUrl) return '';

        // Если это уже полная ссылка (например, от внешнего AI провайдера или уже сформированная), возвращаем
        if (keyOrUrl.startsWith('http')) return keyOrUrl;

        // Убираем начальный слеш для чистоты
        const key = keyOrUrl.startsWith('/') ? keyOrUrl.slice(1) : keyOrUrl;

        if (!this.useS3) {
            // Локальный режим: просто путь от корня (nginx/express static раздаст)
            return `/${key}`;
        }

        // S3 режим: формируем ссылку на MinIO/AWS
        const protocol = process.env.S3_USE_SSL === 'true' ? 'https' : 'http';
        // S3_PUBLIC_ENDPOINT - это то, что видит браузер (localhost или домен)
        const endpoint = process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || 'localhost';
        const port = process.env.S3_PORT || '9000';
        const portSuffix = (port !== '80' && port !== '443') ? `:${port}` : '';

        return `${protocol}://${endpoint}${portSuffix}/${this.bucketName}/${key}`;
    }

    /**
     * Загрузка файла (Работает и с DiskStorage, и с MemoryStorage)
     */
    async uploadFile(
        file: Express.Multer.File,
        directory: string
    ): Promise<UploadResult> {
        // Генерируем ключ (путь в бакете)
        // Multer уже дал уникальное имя файлу, используем его
        const key = `${directory}/${file.filename}`;

        // 1. ЛОКАЛЬНЫЙ РЕЖИМ
        if (!this.useS3) {
            // Multer (DiskStorage) уже сохранил файл в public/directory/filename
            // Нам ничего делать не надо, просто вернуть путь.
            return { url: `/${key}`, key };
        }

        // 2. S3 РЕЖИМ
        const metaData = {
            'Content-Type': file.mimetype,
        };

        try {
            // Если файл на диске (DiskStorage) - создаем поток
            if (file.path) {
                const fileStream = fs.createReadStream(file.path);
                const stats = fs.statSync(file.path);

                await this.client.putObject(
                    this.bucketName,
                    key,
                    fileStream,
                    stats.size,
                    metaData
                );

                // ВАЖНО: Удаляем локальный файл после загрузки в S3, чтобы не засорять контейнер
                fs.unlinkSync(file.path);
            }
            // Если файл в памяти (MemoryStorage) - используем буфер
            else if (file.buffer) {
                await this.client.putObject(
                    this.bucketName,
                    key,
                    file.buffer,
                    file.size,
                    metaData
                );
            } else {
                throw new Error('File has no path and no buffer.');
            }

            // Возвращаем ключ. Метод getPublicUrl сам превратит его в ссылку.
            return { url: key, key };
        } catch (error: any) {
            logger.error(`S3 Upload Error: ${error.message}`);
            throw new Error('Failed to upload file to S3');
        }
    }

    async uploadFiles(
        files: Express.Multer.File[],
        directory: string
    ): Promise<UploadResult[]> {
        return Promise.all(files.map((file) => this.uploadFile(file, directory)));
    }

    /**
     * Скачивание внешнего файла и загрузка в хранилище (S3 или Local)
     * Используется для сохранения результатов генерации AI
     */
    async downloadAndUpload(
        imageUrl: string,
        directory: string,
        filename: string
    ): Promise<string> {
        const key = `${directory}/${filename}`;

        try {
            const response = await axios({
                method: 'GET',
                url: imageUrl,
                responseType: 'stream',
            });

            // 1. ЛОКАЛЬНЫЙ РЕЖИМ
            if (!this.useS3) {
                // Создаем папку, если нет
                const localDir = publicDir(directory); // используем утилиту из paths.ts или path.join
                if (!fs.existsSync(localDir)) {
                    fs.mkdirSync(localDir, { recursive: true });
                }

                const localPath = path.join(localDir, filename);
                const writer = fs.createWriteStream(localPath);
                response.data.pipe(writer);

                return new Promise((resolve, reject) => {
                    writer.on('finish', () => resolve(`/${key}`));
                    writer.on('error', reject);
                });
            }

            // 2. S3 РЕЖИМ
            // Для S3 нам нужно знать размер, если это stream, либо буферизовать.
            // MinIO клиент умеет работать со стримом, но иногда просит размер.
            // Проще всего скачать в буфер или временный файл, но axios stream pipe в MinIO работает.

            // Вариант с pass-through (надежнее скачать в буфер для определения размера, если картинка небольшая)
            // Но для видео лучше стрим. MinIO putObject требует размер для стрима.
            // Попробуем получить размер из заголовков.
            const contentLength = response.headers['content-length'];
            if (!contentLength) {
                // Если размера нет, придется буферизовать (для картинок ок)
                // Перезапрашиваем как arraybuffer для надежности, если это картинка
                const bufferResp = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                await this.client.putObject(
                    this.bucketName,
                    key,
                    bufferResp.data,
                    bufferResp.data.length,
                    { 'Content-Type': response.headers['content-type'] }
                );
            } else {
                await this.client.putObject(
                    this.bucketName,
                    key,
                    response.data,
                    parseInt(contentLength),
                    { 'Content-Type': response.headers['content-type'] }
                );
            }

            return key; // Возвращаем ключ
        } catch (error: any) {
            logger.error(`DownloadAndUpload Error: ${error.message}`);
            throw new Error('Failed to save generated file');
        }
    }

    /**
     * Удаление файла
     */
    async deleteFile(pathOrUrl: string): Promise<void> {
        if (!pathOrUrl) return;

        // Извлекаем ключ из URL или пути
        let key = pathOrUrl;

        // Если это полный URL S3, вырезаем ключ
        if (pathOrUrl.includes(this.bucketName)) {
            const parts = pathOrUrl.split(`${this.bucketName}/`);
            if (parts.length > 1) key = parts[1];
        } else if (pathOrUrl.startsWith('/')) {
            key = pathOrUrl.substring(1);
        }

        // 1. ЛОКАЛЬНЫЙ РЕЖИМ
        if (!this.useS3) {
            // Пытаемся удалить файл физически с диска
            // Импортируем publicDir динамически или используем process.cwd
            const fullPath = path.join(process.cwd(), 'public', key);

            if (fs.existsSync(fullPath)) {
                try {
                    fs.unlinkSync(fullPath);
                    logger.info(`Deleted local file: ${fullPath}`);
                } catch (e) {
                    logger.error(`Failed to delete local file: ${e}`);
                }
            }
            return;
        }

        // 2. S3 РЕЖИМ
        try {
            await this.client.removeObject(this.bucketName, key);
            logger.info(`Deleted S3 file: ${key}`);
        } catch (error: any) {
            // Игнорируем ошибку "не найдено", но логируем остальные
            logger.warn(`Error deleting S3 file ${key}: ${error.message}`);
        }
    }

    async deleteFiles(pathsOrKeys: string[]): Promise<void> {
        await Promise.all(pathsOrKeys.map(p => this.deleteFile(p)));
    }
}

export const s3Storage = new S3Storage();