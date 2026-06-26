import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  Establishment,
  EstablishmentId,
} from "../../../domain/establishment.aggregate";
import {
  MENU_PDF_MAX_COUNT,
} from "../../../domain/establishment-profile.aggregate";
import { IEstablishmentRepository } from "../../../domain/establishment.repository";
import { IEstablishmentStorage } from "../../ports/establishment-storage.interface";
import { randomUUID } from "crypto";

import {
  EstablishmentOutputMapper,
  EstablishmentProfileOutput,
} from "../common/establishment-output";

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;

export type UploadEstablishmentMenuPdfInput = {
  establishment_id: string;
  data: NodeJS.ReadableStream | Buffer;
  content_type: string;
  file_size: number;
};

export type UploadEstablishmentMenuPdfOutput = EstablishmentProfileOutput;

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export class UploadEstablishmentMenuPdfUseCase
  implements
    IUseCase<UploadEstablishmentMenuPdfInput, UploadEstablishmentMenuPdfOutput>
{
  constructor(
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly storage: IEstablishmentStorage,
  ) {}

  async execute(
    input: UploadEstablishmentMenuPdfInput,
  ): Promise<UploadEstablishmentMenuPdfOutput> {
    const maxSize = Number(
      process.env.ESTABLISHMENT_MENU_PDF_MAX_SIZE ?? DEFAULT_MAX_FILE_SIZE,
    );

    if (input.file_size > maxSize) {
      const n = new Notification();
      n.addError(
        `File size exceeds the maximum allowed (${maxSize} bytes)`,
        "file",
      );
      throw new EntityValidationError(n.toJSON());
    }

    if (input.content_type !== "application/pdf") {
      const n = new Notification();
      n.addError("Only PDF files are allowed", "file");
      throw new EntityValidationError(n.toJSON());
    }

    const establishmentId = new EstablishmentId(input.establishment_id);
    const establishment =
      await this.establishmentRepo.findById(establishmentId);

    if (!establishment) {
      throw new NotFoundError(input.establishment_id, Establishment);
    }

    const profile = establishment.profile;

    if (!profile) {
      const n = new Notification();
      n.addError(
        "Establishment profile must be created before uploading a menu PDF",
        "profile",
      );
      throw new EntityValidationError(n.toJSON());
    }

    if (profile.menu_pdfs.length >= MENU_PDF_MAX_COUNT) {
      const n = new Notification();
      n.addError(
        `Maximum of ${MENU_PDF_MAX_COUNT} menu PDFs allowed. Delete one before uploading a new one.`,
        "file",
      );
      throw new EntityValidationError(n.toJSON());
    }

    const slug = toSlug(establishment.name);
    const objectKey = `establishments/${slug}/${input.establishment_id}/menu-pdf/menu-${Date.now()}-${randomUUID()}.pdf`;

    await this.storage.putObject({
      object_key: objectKey,
      data: input.data,
      content_type: "application/pdf",
    });

    const publicUrl = this.storage.getPublicUrl(objectKey) ?? objectKey;

    profile.addMenuPdf({ url: publicUrl, key: objectKey });

    await this.establishmentRepo.update(establishment);

    return EstablishmentOutputMapper.toProfileOutput(profile);
  }
}
