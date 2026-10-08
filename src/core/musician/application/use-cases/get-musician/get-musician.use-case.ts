import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";

export class GetMusicianUseCase implements IUseCase<
  GetMusicianInput,
  GetMusicianOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly planCheckService: PlanCheckService,
  ) {}

  async execute(input: GetMusicianInput): Promise<GetMusicianOutput> {
    const musicianId = new MusicianId(input.id);
    const entity = await this.musicianRepo.findById(musicianId);

    if (!entity) {
      throw new NotFoundError(input.id, Musician);
    }

    /*
     * O tier só é consultado quando alguém vai LER o tier.
     *
     * `GET /musicians/:id` é a rota mais chamada do módulo: destino do QR,
     * perfil público, e uma chamada por artista em toda lista que o web
     * hidrata. Só o dono e o admin recebem `plan_tier` (ver
     * `PublicMusicianPresenter`); para todos os outros esta consulta de
     * assinatura era custo puro, pago em cada visita.
     */
    if (input.include_plan_tier === false) {
      return MusicianOutputMapper.toOutput(entity);
    }

    const plan_tier = await this.planCheckService.getMusicianPlanTier(input.id);

    return { ...MusicianOutputMapper.toOutput(entity), plan_tier };
  }
}

export type GetMusicianInput = {
  id: string;
  /**
   * `false` pula a consulta de plano. Omitido = inclui, para que um chamador
   * novo que esqueça o campo continue recebendo o output completo — quem
   * decide o que SAI para terceiros é o presenter, não este flag.
   */
  include_plan_tier?: boolean;
};

export type GetMusicianOutput = MusicianOutput;
