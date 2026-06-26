import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  Establishment,
  EstablishmentId,
} from "../../../domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../domain/establishment.repository";
import { IEstablishmentStorage } from "../../ports/establishment-storage.interface";

export type DeleteEstablishmentMenuPdfInput = {
  establishment_id: string;
  pdf_id: string;
};

export class DeleteEstablishmentMenuPdfUseCase
  implements IUseCase<DeleteEstablishmentMenuPdfInput, void>
{
  constructor(
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly storage: IEstablishmentStorage,
  ) {}

  async execute(input: DeleteEstablishmentMenuPdfInput): Promise<void> {
    const establishmentId = new EstablishmentId(input.establishment_id);
    const establishment =
      await this.establishmentRepo.findById(establishmentId);

    if (!establishment) {
      throw new NotFoundError(input.establishment_id, Establishment);
    }

    const profile = establishment.profile;
    const entry = profile?.menu_pdfs.find((e) => e.id === input.pdf_id);

    if (!entry) {
      throw new NotFoundError(input.pdf_id, {
        name: "EstablishmentMenuPdf",
      } as any);
    }

    await this.storage
      .deleteObject({ object_key: entry.key })
      .catch(() => undefined);

    profile!.removeMenuPdf(input.pdf_id);

    await this.establishmentRepo.update(establishment);
  }
}
