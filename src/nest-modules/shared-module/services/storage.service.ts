import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3 } from "aws-sdk";
import { ConfigSchemaType } from "../../config-module/config.schema";

export interface UploadOptions {
  folder?: string;
  fileName?: string;
  contentType?: string;
  isPublic?: boolean;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  url: string;
  publicUrl?: string;
  size: number;
  contentType: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3;
  private bucket: string;
  private isProduction: boolean;

  constructor(private configService: ConfigSchemaType) {
    this.isProduction = this.configService.get("NODE_ENV") === "production";
    const bucket = this.configService.get("AWS_S3_BUCKET");
    if (!bucket) {
      throw new Error("AWS_S3_BUCKET is not defined");
    }
    this.bucket = bucket;

    if (this.isProduction) {
      // Production: Use AWS S3
      this.s3Client = new S3({
        region: this.configService.get("AWS_REGION"),
        accessKeyId: this.configService.get("AWS_ACCESS_KEY_ID"),
        secretAccessKey: this.configService.get("AWS_SECRET_ACCESS_KEY"),
      });
    } else {
      // Development: Use MinIO
      this.s3Client = new S3({
        endpoint: `http://${this.configService.get("MINIO_ENDPOINT")}:${this.configService.get("MINIO_PORT")}`,
        accessKeyId: this.configService.get("MINIO_ACCESS_KEY"),
        secretAccessKey: this.configService.get("MINIO_SECRET_KEY"),
        s3ForcePathStyle: true,
        signatureVersion: "v4",
      });
      const minioBucket = this.configService.get("MINIO_BUCKET");
      if (!minioBucket) {
        throw new Error("MINIO_BUCKET is not defined");
      }
      this.bucket = minioBucket;
    }
  }

  /**
   * Upload file to storage
   */
  async uploadFile(
    buffer: Buffer,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    try {
      const key = this.generateKey(options.folder, options.fileName);
      const contentType = options.contentType || "application/octet-stream";

      const uploadParams: S3.PutObjectRequest = {
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: options.metadata || {},
      };

      if (options.isPublic) {
        uploadParams.ACL = "public-read";
      }

      const result = await this.s3Client.upload(uploadParams).promise();

      const uploadResult: UploadResult = {
        key,
        url: result.Location,
        size: buffer.length,
        contentType,
      };

      if (this.isProduction && this.configService.get("AWS_CLOUDFRONT_URL")) {
        uploadResult.publicUrl = `${this.configService.get("AWS_CLOUDFRONT_URL")}/${key}`;
      } else {
        uploadResult.publicUrl = result.Location;
      }

      this.logger.debug(`File uploaded successfully: ${key}`);
      return uploadResult;
    } catch (error) {
      this.logger.error("Failed to upload file:", error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    files: Array<{ buffer: Buffer; options?: UploadOptions }>,
  ): Promise<UploadResult[]> {
    const uploadPromises = files.map(({ buffer, options }) =>
      this.uploadFile(buffer, options),
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Delete file from storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3Client
        .deleteObject({
          Bucket: this.bucket,
          Key: key,
        })
        .promise();

      this.logger.debug(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}:`, error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Delete multiple files
   */
  async deleteFiles(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      await this.s3Client
        .deleteObjects({
          Bucket: this.bucket,
          Delete: {
            Objects: keys.map((key) => ({ Key: key })),
          },
        })
        .promise();

      this.logger.debug(`${keys.length} files deleted successfully`);
    } catch (error) {
      this.logger.error("Failed to delete files:", error);
      throw new Error(`Bulk delete failed: ${error.message}`);
    }
  }

  /**
   * Get signed URL for private file access
   */
  async getSignedUrl(
    key: string,
    expiresIn: number = 3600, // 1 hour default
  ): Promise<string> {
    try {
      const url = await this.s3Client.getSignedUrlPromise("getObject", {
        Bucket: this.bucket,
        Key: key,
        Expires: expiresIn,
      });

      this.logger.debug(`Generated signed URL for: ${key}`);
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${key}:`, error);
      throw new Error(`Signed URL generation failed: ${error.message}`);
    }
  }

  /**
   * Get signed URL for file upload
   */
  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const url = await this.s3Client.getSignedUrlPromise("putObject", {
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        Expires: expiresIn,
      });

      this.logger.debug(`Generated signed upload URL for: ${key}`);
      return url;
    } catch (error) {
      this.logger.error(
        `Failed to generate signed upload URL for ${key}:`,
        error,
      );
      throw new Error(`Signed upload URL generation failed: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      await this.s3Client
        .headObject({
          Bucket: this.bucket,
          Key: key,
        })
        .promise();
      return true;
    } catch (error) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<S3.HeadObjectOutput> {
    try {
      const result = await this.s3Client
        .headObject({
          Bucket: this.bucket,
          Key: key,
        })
        .promise();

      return result;
    } catch (error) {
      this.logger.error(`Failed to get metadata for ${key}:`, error);
      throw new Error(`Get metadata failed: ${error.message}`);
    }
  }

  /**
   * Generate unique key for file
   */
  private generateKey(folder?: string, fileName?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const uniqueFileName = fileName || `file_${timestamp}_${random}`;

    if (folder) {
      return `${folder}/${uniqueFileName}`;
    }

    return uniqueFileName;
  }

  /**
   * Get public URL for file
   */
  getPublicUrl(key: string): string {
    if (this.isProduction && this.configService.get("AWS_CLOUDFRONT_URL")) {
      return `${this.configService.get("AWS_CLOUDFRONT_URL")}/${key}`;
    }

    if (this.isProduction) {
      return `https://${this.bucket}.s3.${this.configService.get("AWS_REGION")}.amazonaws.com/${key}`;
    }

    // MinIO local URL
    return `http://${this.configService.get("MINIO_ENDPOINT")}:${this.configService.get("MINIO_PORT")}/${this.bucket}/${key}`;
  }

  /**
   * Store file (alias for uploadFile to match FileUploadService expectation)
   */
  async store(
    key: string,
    file: Buffer | Uint8Array | string,
    options?: { contentType?: string; metadata?: Record<string, string> },
  ): Promise<string> {
    let buffer: Buffer;

    if (Buffer.isBuffer(file)) {
      buffer = file;
    } else if (typeof file === "string") {
      buffer = Buffer.from(file);
    } else {
      buffer = Buffer.from(file);
    }

    const result = await this.uploadFile(buffer, {
      fileName: key,
      contentType: options?.contentType,
      metadata: options?.metadata,
    });

    return result.url;
  }

  /**
   * Delete file from storage
   */
  async delete(key: string): Promise<void> {
    try {
      await this.s3Client
        .deleteObject({
          Bucket: this.bucket,
          Key: key,
        })
        .promise();
      this.logger.debug(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get file URL
   */
  getUrl(key: string): string {
    return this.getPublicUrl(key);
  }
}
