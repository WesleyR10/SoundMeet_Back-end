import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Address } from "../../../../../shared/domain/value-objects/address.vo";
import {
  Establishment,
  EstablishmentId,
} from "../../../../domain/establishment.aggregate";
import { EstablishmentFakeBuilder } from "../../../../domain/establishment-fake.builder";
import { EstablishmentInMemoryRepository } from "../../../../infra/db/in-memory/establishment-in-memory.repository";
import { DeleteEstablishmentProfileUseCase } from "../delete-establishment-profile.use-case";

describe("DeleteEstablishmentProfileUseCase Unit Tests", () => {
  let useCase: DeleteEstablishmentProfileUseCase;
  let repository: EstablishmentInMemoryRepository;

  beforeEach(() => {
    repository = new EstablishmentInMemoryRepository();
    useCase = new DeleteEstablishmentProfileUseCase(repository);
  });

  it("should throw an error when establishment not found", async () => {
    const establishmentId = new EstablishmentId();
    await expect(() =>
      useCase.execute({
        id: establishmentId.id,
      }),
    ).rejects.toThrow(new NotFoundError(establishmentId.id, Establishment));
  });

  it("should delete profile", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    establishment.ensureProfile(
      new Address({
        street: "Rua A",
        number: "10",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        zipCode: "01001000",
      }),
    );
    repository.items = [establishment];

    await useCase.execute({ id: establishment.establishment_id.id });

    const saved = await repository.findById(
      new EstablishmentId(establishment.establishment_id.id),
    );
    expect(saved).toBeTruthy();
    expect(saved!.profile).toBeNull();
  });
});
