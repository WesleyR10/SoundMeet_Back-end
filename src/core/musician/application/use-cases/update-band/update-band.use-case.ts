import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { IGeocodingService } from "../../../../shared/domain/geocoding.service";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { assertBandIsActive, assertBandLeader } from "../common/band-actor";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { toBandPriceRange } from "../common/band-price-range";
import { resolveLocation } from "../common/resolve-location";
import { UpdateBandInput } from "./update-band.input";

export class UpdateBandUseCase implements IUseCase<
  UpdateBandInput,
  BandOutput
> {
  constructor(
    private readonly bandRepo: IBandRepository,
    // Opcional, como no perfil do músico: sem o serviço, salva sem coordenada.
    private readonly geocodingService?: IGeocodingService,
  ) {}

  async execute(input: UpdateBandInput): Promise<BandOutput> {
    const bandId = new BandId(input.id);
    const band = await this.bandRepo.findById(bandId);

    if (!band) {
      throw new NotFoundError(input.id, Band);
    }

    assertBandLeader(band, input, "alterar os dados da banda");
    assertBandIsActive(band);

    // `!== undefined` em todos, nunca truthiness. Com `if (input.name)`, um
    // nome vazio era IGNORADO e a rota respondia 200 — o líder apagava o campo
    // e via o nome antigo voltar. Agora o vazio chega ao validador e é recusado.
    if (input.name !== undefined) {
      band.changeName(input.name);
    }

    if (input.description !== undefined) {
      band.changeDescription(input.description || null);
    }

    if (input.genres !== undefined) {
      band.updateGenres(input.genres);
    }

    // `null` aqui significa APAGAR o ano.
    if (input.formed_in !== undefined) {
      band.changeFormedIn(input.formed_in);
    }

    if (input.priceRange !== undefined) {
      band.changePriceRange(
        input.priceRange === null ? null : toBandPriceRange(input.priceRange),
      );
    }

    if (input.address !== undefined) {
      // A banda não geocodificava: `location_lat/lng` ficavam nulos e toda
      // banda criada pelo app estava fora da busca por raio.
      band.changeAddress(
        input.address
          ? await resolveLocation(
              input.address,
              band.address,
              this.geocodingService,
              "address",
            )
          : null,
      );
    }

    // 🔴 Sem esta checagem, `changeName`/`updateGenres`/`changeFormedIn`
    // validavam e o resultado era jogado fora: o valor inválido seguia para o
    // banco e a resposta era 200 (ou 500, quando o Postgres recusava).
    if (band.notification.hasErrors()) {
      throw new EntityValidationError(band.notification.toJSON());
    }

    await this.bandRepo.update(band);

    return BandOutputMapper.toOutput(band);
  }
}
