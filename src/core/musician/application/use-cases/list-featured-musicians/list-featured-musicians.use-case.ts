import { IUseCase } from "../../../../shared/application/use-case.interface";
import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import {
  IMusicianRepository,
  MusicianSearchParams,
} from "../../../domain/musician.repository";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";

export type ListFeaturedMusiciansInput = {
  /** Teto de artistas na faixa. O chamador decide; o use-case clampa. */
  limit?: number;
};

export type ListFeaturedMusiciansOutput = {
  items: MusicianOutput[];
};

/**
 * Máximo absoluto de destaques, independente do que o chamador pedir.
 *
 * A faixa é um lugar de exposição comprada; sem teto, ela cresceria até virar
 * a própria grade e a busca deixaria de ser por mérito. Três também é o que
 * cabe numa linha da grade de artistas sem empurrar o resultado orgânico
 * abaixo da dobra.
 */
export const FEATURED_MUSICIANS_MAX = 3;

/**
 * Os artistas da faixa "Em destaque" da grade de artistas.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE É UMA FAIXA, E NÃO UM CRITÉRIO DE ORDENAÇÃO
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Plano pago empurrando o artista para o topo de "Melhor avaliados" tornaria o
 * rótulo da própria tela falso: o rodapé do cartaz ESCREVE a ordem em vigor
 * ("ORDEM: MELHOR AVALIADOS"), e um assinante com 3,6 na frente de um FREE com
 * 4,8 faria a tela afirmar uma hierarquia que ela não aplicou. A faixa separada
 * e rotulada mantém as duas coisas verdadeiras: o destaque é visível como
 * destaque, e a grade abaixo continua sendo o que o filtro pediu.
 *
 * ⚠️ **Não expõe o tier.** O output é o mesmo `MusicianOutput` da busca, sem
 * `plan_tier`: saber que a casa está vendo um PRO e não um ESSENTIAL não muda
 * nada para ela, e é dado comercial do artista.
 *
 * ⚠️ **O gate de consentimento não é contornado aqui.** Os ids vêm de
 * assinaturas, mas a leitura dos músicos passa por
 * `MusicianSearchParams.createPublic`, que força `open_to_gigs: true` por
 * último no spread. Um assinante PRO que nunca ligou "disponível para shows"
 * **não** aparece — pagar não substitui consentir.
 */
export class ListFeaturedMusiciansUseCase implements IUseCase<
  ListFeaturedMusiciansInput,
  ListFeaturedMusiciansOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    /*
     * `PlanCheckService`, não o repositório de assinaturas: é a costura que
     * `PlansModule` já exporta e a única pela qual este módulo pergunta sobre
     * plano. Injetar o repositório exigiria exportá-lo e criaria um segundo
     * caminho para a mesma pergunta.
     */
    private readonly planCheck: PlanCheckService,
  ) {}

  async execute(
    input: ListFeaturedMusiciansInput = {},
  ): Promise<ListFeaturedMusiciansOutput> {
    const limit = Math.min(
      Math.max(Math.trunc(input.limit ?? FEATURED_MUSICIANS_MAX), 1),
      FEATURED_MUSICIANS_MAX,
    );

    const paidIds = await this.planCheck.getActivePaidMusicianIds();

    /*
     * Atalho para o caso mais comum em base nova: ninguém assinando. Sem ele a
     * consulta seguinte seria `id IN ()`, que é correta mas inútil — e o
     * atalho documenta que zero destaques é um estado NORMAL, não uma falha
     * que mereça log ou fallback para artistas orgânicos. Preencher a faixa
     * com quem não pagou seria entregar de graça o que é o produto.
     */
    if (paidIds.length === 0) {
      return { items: [] };
    }

    const params = MusicianSearchParams.createPublic({
      page: 1,
      per_page: limit,
      /*
       * Melhor avaliado primeiro, DESC explícito.
       *
       * 🔴 `sort_dir` explícito porque o default de `SearchParams` é `asc`
       * quando há `sort` — omiti-lo aqui colocaria o PIOR avaliado dos
       * assinantes na vitrine que eles pagaram. É o mesmo defeito que a tela
       * de artistas tinha em "Melhor avaliados".
       */
      sort: "rating",
      sort_dir: "desc",
      filter: { ids: paidIds, is_active: true },
    });

    const result = await this.musicianRepo.search(params);

    return {
      items: result.items.map((item) => MusicianOutputMapper.toOutput(item)),
    };
  }
}
