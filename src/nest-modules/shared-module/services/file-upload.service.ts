import { Injectable } from "@nestjs/common";
import { StorageService } from "./storage.service";

export interface FileUploadOptions {
  bucket?: string;
  key?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
}

@Injectable()
export class FileUploadService {
  constructor(private readonly storageService: StorageService) {}

  async uploadFile(
    file: Buffer | Uint8Array | string,
    options: FileUploadOptions = {},
  ): Promise<UploadResult> {
    const key = options.key || this.generateKey();
    const bucket = options.bucket || "default";

    // For now, just return a mock result
    // This should be replaced with actual S3 or storage implementation
    const url = await this.storageService.store(key, file, {
      contentType: options.contentType,
      metadata: options.metadata,
    });

    return {
      url,
      key,
      bucket,
    };
  }

  async deleteFile(key: string, bucket?: string): Promise<void> {
    await this.storageService.delete(key);
  }

  private generateKey(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `uploads/${timestamp}-${random}`;
  }

  getFileUrl(key: string, bucket?: string): string {
    return this.storageService.getUrl(key);
  }
}
