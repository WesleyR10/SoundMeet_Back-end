import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../../../../musician/application/use-cases/common/musician-profile-output";
import {
  IMusicianRepository,
  MusicianSearchParams,
} from "../../../../musician/domain/musician.repository";
import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import { IAudienceRepository } from "../../../domain/audience.repository";
import { RecommendMusiciansInput } from "./recommend-musicians.input";

export type RecommendMusiciansOutput = PaginationOutput<MusicianOutput>;

export class RecommendMusiciansUseCase implements IUseCase<
  RecommendMusiciansInput,
  RecommendMusiciansOutput
> {
  constructor(
    private readonly audienceRepo: IAudienceRepository,
    private readonly musicianRepo: IMusicianRepository,
  ) {}

  async execute(
    input: RecommendMusiciansInput,
  ): Promise<RecommendMusiciansOutput> {
    const audienceId = new AudienceId(input.audience_id);
    const audience = await this.audienceRepo.findById(audienceId);
    if (!audience) {
      throw new NotFoundError(input.audience_id, Audience);
    }

    const favoriteInstruments = audience.favorite_instruments;
    const favoriteGenres = audience.favorite_genres;

    const filter = {
      ...(input.only_active === false ? {} : { is_active: true }),
      ...(favoriteInstruments.length > 0
        ? { instruments: favoriteInstruments }
        : {}),
      ...(favoriteGenres.length > 0 ? { genres: favoriteGenres } : {}),
    };

    // Gate de consentimento via único ponto de aplicação — indicar músico
    // para contratação sempre exige opt-in, sem bypass (diferente de
    // is_active/only_active acima, que o chamador pode desligar).
    const params = MusicianSearchParams.createPublic({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort ?? "rating",
      sort_dir: input.sort_dir ?? "desc",
      filter,
    });

    const searchResult = await this.musicianRepo.search(params);
    const items = searchResult.items.map((m) =>
      MusicianOutputMapper.toOutput(m),
    );

    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}
