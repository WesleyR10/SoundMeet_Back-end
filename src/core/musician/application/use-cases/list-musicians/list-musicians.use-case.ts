import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  IMusicianRepository,
  MusicianSearchParams,
  MusicianSearchResult,
} from "../../../domain/musician.repository";
import { toPublicDistanceKm } from "../../../domain/musician-location-privacy";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";
import { ListMusiciansInput } from "./list-musicians.input";

export class ListMusiciansUseCase implements IUseCase<
  ListMusiciansInput,
  ListMusiciansOutput
> {
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(input: ListMusiciansInput): Promise<ListMusiciansOutput> {
    // Gate de consentimento (não é preferência de busca opcional) — único
    // ponto de aplicação em MusicianSearchParams.createPublic, nenhum
    // estabelecimento consegue contornar via query param.
    //
    // 🔴 `is_active: true` também é forçado aqui, DEPOIS do filtro do chamador.
    // A busca só aplicava o gate de consentimento: músico desativado seguia na
    // grade das casas e no Explorar do fã, embora pedido, scan de QR, convite
    // de banda e a faixa "Em destaque" já o recusassem. Fica neste use-case, e
    // não em `createPublic`, porque a recomendação do fã tem o seu próprio
    // interruptor (`only_active`) e o painel de contratação o seu recorte.
    const params = MusicianSearchParams.createPublic({
      ...input,
      filter: { ...(input.filter ?? {}), is_active: true },
    });
    const searchResult = await this.musicianRepo.search(params);

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: MusicianSearchResult): ListMusiciansOutput {
    const { items: _items } = searchResult;
    const items = _items.map((item) => ({
      ...MusicianOutputMapper.toOutput(item),
      // `null` e não ausente: com origem na busca, "sem coordenada" é uma
      // resposta; sem origem, o campo também vem nulo e o cliente omite o chip.
      distance_km: toPublicDistanceKm(
        searchResult.distances.get(item.musician_id.id) ?? null,
      ),
    }));
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}

export type ListMusiciansOutput = PaginationOutput<MusicianOutput>;
