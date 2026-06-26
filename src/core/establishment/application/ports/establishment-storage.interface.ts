export interface IEstablishmentStorage {
  putObject(input: {
    object_key: string;
    data: Buffer | NodeJS.ReadableStream;
    content_type: string;
  }): Promise<void>;

  deleteObject(input: { object_key: string }): Promise<void>;

  getPublicUrl(object_key: string): string | null;
}
