import { IIdentityClaimsWriter } from "../../../../shared/application/identity-claims.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IGeocodingService } from "../../../../shared/domain/geocoding.service";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Band } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { toBandPriceRange } from "../common/band-price-range";
import { resolveLocation } from "../common/resolve-location";
import { CreateBandInput } from "./create-band.input";

export class CreateBandUseCase implements IUseCase<
  CreateBandInput,
  BandOutput
> {
  constructor(
    private readonly bandRepo: IBandRepository,
    private readonly identityClaims?: IIdentityClaimsWriter,
    private readonly geocodingService?: IGeocodingService,
  ) {}

  async execute(input: CreateBandInput): Promise<BandOutput> {
    // Banda sem líder não tem quem a administre: toda escrita exige liderança
    // (`assertBandLeader`), e ela só existe a partir de quem cria.
    if (!input.creator_musician_id) {
      throw new EntityValidationError([
        { creator_musician_id: ["A band needs a musician to lead it"] },
      ]);
    }

    const entity = Band.create({
      name: input.name,
      description: input.description,
      genres: input.genres,
      formed_in: input.formed_in,
      // O líder entra direto como membro aceito — não convida a si mesmo. Os
      // demais integrantes entram por convite (`POST /bands/:id/members`),
      // que é a única porta: é lá que o gate de plano e o aceite acontecem.
      members: [
        {
          musician_id: new Uuid(input.creator_musician_id),
          role: "leader",
          instrument: "N/A",
          status: "accepted",
          joined_at: new Date(),
          responded_at: new Date(),
        },
      ],
      priceRange: input.priceRange ? toBandPriceRange(input.priceRange) : null,
      address: input.address
        ? await resolveLocation(
            input.address,
            null,
            this.geocodingService,
            "address",
          )
        : null,
      open_to_gigs: input.open_to_gigs,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    // Mesma razão do estabelecimento: a banda tem UUID próprio, distinto do
    // `sub` do líder, e é o claim `band_ids` que põe a agenda, os contratos e
    // as conversas DA BANDA no escopo do líder (`resolveParticipantIds`).
    // Vinculado antes do insert para que falha no Keycloak não deixe uma banda
    // cujos shows o próprio líder não consegue ver.
    //
    // ⚠️ O claim é escopo de leitura, não autorização: quem pode ALTERAR a
    // banda é decidido no banco, a cada chamada (`assertBandLeader`).
    if (this.identityClaims) {
      await this.identityClaims.addClaimValue(
        input.creator_musician_id,
        "band_ids",
        entity.band_id.id,
      );
    }

    await this.bandRepo.insert(entity);

    return BandOutputMapper.toOutput(entity);
  }
}
