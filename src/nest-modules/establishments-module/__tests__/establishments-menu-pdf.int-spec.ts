import { Readable } from "stream";

import { UploadEstablishmentMenuPdfUseCase } from "../../../core/establishment/application/use-cases/upload-establishment-menu-pdf/upload-establishment-menu-pdf.use-case";
import { DeleteEstablishmentMenuPdfUseCase } from "../../../core/establishment/application/use-cases/delete-establishment-menu-pdf/delete-establishment-menu-pdf.use-case";
import { IEstablishmentStorage } from "../../../core/establishment/application/ports/establishment-storage.interface";
import { EstablishmentInMemoryRepository } from "../../../core/establishment/infra/db/in-memory/establishment-in-memory.repository";
import { Establishment, EstablishmentId } from "../../../core/establishment/domain/establishment.aggregate";
import { EntityValidationError } from "../../../core/shared/domain/validators/validation.error";
import { NotFoundError } from "../../../core/shared/domain/errors/not-found.error";

class StorageMemoryImpl implements IEstablishmentStorage {
  readonly uploads: Map<string, { data: Buffer; content_type: string }> =
    new Map();

  async putObject(input: {
    object_key: string;
    data: Buffer | NodeJS.ReadableStream;
    content_type: string;
  }): Promise<void> {
    const chunks: Buffer[] = [];
    if (Buffer.isBuffer(input.data)) {
      chunks.push(input.data);
    } else {
      await new Promise<void>((resolve, reject) => {
        (input.data as NodeJS.ReadableStream).on("data", (c) =>
          chunks.push(Buffer.from(c)),
        );
        (input.data as NodeJS.ReadableStream).on("end", resolve);
        (input.data as NodeJS.ReadableStream).on("error", reject);
      });
    }
    this.uploads.set(input.object_key, {
      data: Buffer.concat(chunks),
      content_type: input.content_type,
    });
  }

  async deleteObject(input: { object_key: string }): Promise<void> {
    this.uploads.delete(input.object_key);
  }

  getPublicUrl(object_key: string): string {
    return `https://r2.example.com/${object_key}`;
  }
}

function makePdfBuffer(): Buffer {
  return Buffer.from("%PDF-1.4 test content");
}

async function uploadPdf(
  repo: EstablishmentInMemoryRepository,
  storage: StorageMemoryImpl,
  establishment: Establishment,
) {
  const uc = new UploadEstablishmentMenuPdfUseCase(repo, storage);
  return uc.execute({
    establishment_id: establishment.establishment_id.id,
    data: Readable.from([makePdfBuffer()]),
    content_type: "application/pdf",
    file_size: 100,
  });
}

function makeEstablishmentWithProfile(repo: EstablishmentInMemoryRepository) {
  const establishment = Establishment.fake()
    .anEstablishment()
    .withName("Bar do Zeca")
    .withProfile()
    .build();
  return repo.insert(establishment).then(() => establishment);
}

function makeEstablishmentWithoutProfile(
  repo: EstablishmentInMemoryRepository,
) {
  const establishment = Establishment.fake().anEstablishment().build();
  return repo.insert(establishment).then(() => establishment);
}

describe("UploadEstablishmentMenuPdfUseCase", () => {
  let repo: EstablishmentInMemoryRepository;
  let storage: StorageMemoryImpl;
  let useCase: UploadEstablishmentMenuPdfUseCase;

  beforeEach(() => {
    repo = new EstablishmentInMemoryRepository();
    storage = new StorageMemoryImpl();
    useCase = new UploadEstablishmentMenuPdfUseCase(repo, storage);
  });

  it("should upload the first PDF and return it in menu_pdfs", async () => {
    const establishment = await makeEstablishmentWithProfile(repo);

    const output = await useCase.execute({
      establishment_id: establishment.establishment_id.id,
      data: Readable.from([makePdfBuffer()]),
      content_type: "application/pdf",
      file_size: makePdfBuffer().byteLength,
    });

    expect(output.menu_pdfs).toHaveLength(1);
    expect(output.menu_pdfs[0].id).toBeTruthy();
    expect(output.menu_pdfs[0].url).toMatch(
      /^https:\/\/r2\.example\.com\/establishments\/bar-do-zeca\/.+\/menu-pdf\/menu-.+\.pdf$/,
    );
    expect(output.menu_pdfs[0].uploaded_at).toBeInstanceOf(Date);
    expect(storage.uploads.size).toBe(1);
  });

  it("should upload a second PDF independently (both active simultaneously)", async () => {
    const establishment = await makeEstablishmentWithProfile(repo);

    await uploadPdf(repo, storage, establishment);
    const output = await uploadPdf(repo, storage, establishment);

    expect(output.menu_pdfs).toHaveLength(2);
    expect(storage.uploads.size).toBe(2);
  });

  it("should throw EntityValidationError when trying to upload a third PDF", async () => {
    const establishment = await makeEstablishmentWithProfile(repo);

    await uploadPdf(repo, storage, establishment);
    await uploadPdf(repo, storage, establishment);

    await expect(uploadPdf(repo, storage, establishment)).rejects.toThrow(
      EntityValidationError,
    );
    expect(storage.uploads.size).toBe(2);
  });

  it("should throw EntityValidationError when file size exceeds limit", async () => {
    const establishment = await makeEstablishmentWithProfile(repo);
    process.env.ESTABLISHMENT_MENU_PDF_MAX_SIZE = "100";

    await expect(
      useCase.execute({
        establishment_id: establishment.establishment_id.id,
        data: Readable.from([makePdfBuffer()]),
        content_type: "application/pdf",
        file_size: 200,
      }),
    ).rejects.toThrow(EntityValidationError);

    delete process.env.ESTABLISHMENT_MENU_PDF_MAX_SIZE;
  });

  it("should throw EntityValidationError when content_type is not PDF", async () => {
    const establishment = await makeEstablishmentWithProfile(repo);

    await expect(
      useCase.execute({
        establishment_id: establishment.establishment_id.id,
        data: Readable.from([Buffer.from("fake image")]),
        content_type: "image/jpeg",
        file_size: 100,
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("should throw NotFoundError when establishment does not exist", async () => {
    await expect(
      useCase.execute({
        establishment_id: new EstablishmentId().id,
        data: Readable.from([makePdfBuffer()]),
        content_type: "application/pdf",
        file_size: 100,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("should throw EntityValidationError when establishment has no profile", async () => {
    const establishment = await makeEstablishmentWithoutProfile(repo);

    await expect(
      useCase.execute({
        establishment_id: establishment.establishment_id.id,
        data: Readable.from([makePdfBuffer()]),
        content_type: "application/pdf",
        file_size: 100,
      }),
    ).rejects.toThrow(EntityValidationError);
  });
});

describe("DeleteEstablishmentMenuPdfUseCase", () => {
  let repo: EstablishmentInMemoryRepository;
  let storage: StorageMemoryImpl;
  let deleteUseCase: DeleteEstablishmentMenuPdfUseCase;

  beforeEach(() => {
    repo = new EstablishmentInMemoryRepository();
    storage = new StorageMemoryImpl();
    deleteUseCase = new DeleteEstablishmentMenuPdfUseCase(repo, storage);
  });

  it("should delete the specified PDF from storage and remove it from profile", async () => {
    const establishment = await makeEstablishmentWithProfile(repo);
    const output = await uploadPdf(repo, storage, establishment);
    const pdf_id = output.menu_pdfs[0].id;

    expect(storage.uploads.size).toBe(1);

    await deleteUseCase.execute({
      establishment_id: establishment.establishment_id.id,
      pdf_id,
    });

    expect(storage.uploads.size).toBe(0);

    const updated = await repo.findById(establishment.establishment_id);
    expect(updated!.profile!.menu_pdfs).toHaveLength(0);
  });

  it("should delete only the targeted PDF when two are active", async () => {
    const establishment = await makeEstablishmentWithProfile(repo);
    const first = await uploadPdf(repo, storage, establishment);
    const second = await uploadPdf(repo, storage, establishment);
    const firstId = first.menu_pdfs[0].id;
    const secondId = second.menu_pdfs[1].id;

    await deleteUseCase.execute({
      establishment_id: establishment.establishment_id.id,
      pdf_id: firstId,
    });

    expect(storage.uploads.size).toBe(1);
    const updated = await repo.findById(establishment.establishment_id);
    expect(updated!.profile!.menu_pdfs).toHaveLength(1);
    expect(updated!.profile!.menu_pdfs[0].id).toBe(secondId);
  });

  it("should allow re-uploading after deleting (back to capacity)", async () => {
    const establishment = await makeEstablishmentWithProfile(repo);
    await uploadPdf(repo, storage, establishment);
    const secondOutput = await uploadPdf(repo, storage, establishment);
    const pdf_id = secondOutput.menu_pdfs[0].id;

    await deleteUseCase.execute({
      establishment_id: establishment.establishment_id.id,
      pdf_id,
    });

    const thirdOutput = await uploadPdf(repo, storage, establishment);
    expect(thirdOutput.menu_pdfs).toHaveLength(2);
  });

  it("should throw NotFoundError when establishment does not exist", async () => {
    await expect(
      deleteUseCase.execute({
        establishment_id: new EstablishmentId().id,
        pdf_id: new EstablishmentId().id,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("should throw NotFoundError when pdf_id does not exist in profile", async () => {
    const establishment = await makeEstablishmentWithProfile(repo);

    await expect(
      deleteUseCase.execute({
        establishment_id: establishment.establishment_id.id,
        pdf_id: new EstablishmentId().id,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
