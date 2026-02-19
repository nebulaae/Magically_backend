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
}

class S3Storage {
  private client: Minio.Client;
  private bucketName: string;
  private useS3: boolean;

  constructor() {
    this.useS3 = String(process.env.USE_S3).toLowerCase() === 'true';
    this.bucketName = process.env.S3_BUCKET_NAME || 'magically';

    if (this.useS3) {
      // ВНУТРИ DOCKER всегда HTTP, SSL терминируется на nginx
      const isSSL = process.env.S3_USE_SSL === 'true';
      const port = process.env.S3_PORT
        ? parseInt(process.env.S3_PORT)
        : undefined;

      this.client = new Minio.Client({
        endPoint: process.env.S3_ENDPOINT || 'minio',
        ...(port && { port }),
        useSSL: isSSL,
        accessKey: process.env.S3_ACCESS_KEY || '',
        secretKey: process.env.S3_SECRET_KEY || '',
      });

      logger.info(
        `MinIO client initialized: ${process.env.S3_ENDPOINT}:${port}, SSL: ${isSSL}`
      );
      this.initializeBucket().catch((err) =>
        logger.error(`S3 Init Error: ${err.message}`)
      );
    }
  }

  private async initializeBucket() {
    try {
      const exists = await this.client.bucketExists(this.bucketName);

      if (!exists) {
        await this.client.makeBucket(this.bucketName, 'us-east-1');
        logger.info(`Bucket ${this.bucketName} created`);
      }

      // ПУБЛИЧНАЯ ПОЛИТИКА для анонимного чтения
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

      await this.client.setBucketPolicy(
        this.bucketName,
        JSON.stringify(policy)
      );
      logger.info(`Bucket ${this.bucketName} policy set to PUBLIC READ`);
    } catch (e: any) {
      logger.error(`S3 bucket init failed: ${e.message}`);
    }
  }

  /**
   * Получение публичной ссылки (Для фронтенда)
   */
  getPublicUrl(keyOrUrl: string): string {
    if (!keyOrUrl) return '';

    // Если это уже полная ссылка
    if (keyOrUrl.startsWith('http')) return keyOrUrl;

    // Убираем начальный слеш
    const key = keyOrUrl.startsWith('/') ? keyOrUrl.slice(1) : keyOrUrl;

    if (!this.useS3) {
      return `/${key}`;
    }

    // КРИТИЧНО: Используем S3_PUBLIC_ENDPOINT для браузера
    const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT;

    if (!publicEndpoint) {
      logger.error(
        'S3_PUBLIC_ENDPOINT not set! Browser will not be able to access files.'
      );
      return `/${key}`;
    }

    // Для прода: https://s3.staging.app.volshebny.by/magically/file.jpg
    // publicEndpoint должен быть: https://s3.staging.app.volshebny.by
    return `${publicEndpoint}/${this.bucketName}/${key}`;
  }

  /**
   * Загрузка файла
   */
  async uploadFile(
    file: Express.Multer.File,
    directory: string
  ): Promise<UploadResult> {
    const key = `${directory}/${file.filename}`;

    // ЛОКАЛЬНЫЙ РЕЖИМ
    if (!this.useS3) {
      return { url: `/${key}`, key };
    }

    // S3 РЕЖИМ
    const metaData = {
      'Content-Type': file.mimetype,
    };

    try {
      // Если файл на диске
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

        fs.unlinkSync(file.path);
      }
      // Если файл в памяти
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

      logger.info(`File uploaded to S3: ${key}`);
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
   * Скачивание внешнего файла и загрузка в хранилище
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

      // ЛОКАЛЬНЫЙ РЕЖИМ
      if (!this.useS3) {
        const localDir = publicDir(directory);
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

      // S3 РЕЖИМ
      const contentLength = response.headers['content-length'];
      if (!contentLength) {
        const bufferResp = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
        });
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

      logger.info(`External file downloaded and uploaded to S3: ${key}`);
      return key;
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

    let key = pathOrUrl;

    if (pathOrUrl.includes(this.bucketName)) {
      const parts = pathOrUrl.split(`${this.bucketName}/`);
      if (parts.length > 1) key = parts[1];
    } else if (pathOrUrl.startsWith('/')) {
      key = pathOrUrl.substring(1);
    }

    // ЛОКАЛЬНЫЙ РЕЖИМ
    if (!this.useS3) {
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

    // S3 РЕЖИМ
    try {
      await this.client.removeObject(this.bucketName, key);
      logger.info(`Deleted S3 file: ${key}`);
    } catch (error: any) {
      logger.warn(`Error deleting S3 file ${key}: ${error.message}`);
    }
  }

  async deleteFiles(pathsOrKeys: string[]): Promise<void> {
    await Promise.all(pathsOrKeys.map((p) => this.deleteFile(p)));
  }
}

export const s3Storage = new S3Storage();
