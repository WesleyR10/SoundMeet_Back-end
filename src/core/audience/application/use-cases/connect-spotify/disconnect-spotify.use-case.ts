import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IAudienceSpotifyLinkRepository } from "../../../domain/audience-spotify-link.repository";

export type DisconnectSpotifyInput = {
  audience_id: string;
};

export type DisconnectSpotifyOutput = {
  audience_id: string;
  linked: false;
};

/**
 * Desfaz o vínculo — apaga os tokens.
 *
 * Apagar, e não marcar como inativo: são credenciais de acesso à conta de outra
 * pessoa, e a única leitura honesta de "desconectar" é que elas deixam de
 * existir aqui. Guardar "para o caso de reconectar" seria manter poder sobre a
 * conta de quem pediu para sair.
 *
 * **Idempotente**: desconectar quem já está desconectado devolve o mesmo estado
 * em vez de 404 — o resultado desejado já foi alcançado, e um erro aqui só
 * faria a UI mostrar falha numa ação que deu certo.
 */
export class DisconnectSpotifyUseCase implements IUseCase<
  DisconnectSpotifyInput,
  DisconnectSpotifyOutput
> {
  constructor(private readonly linkRepo: IAudienceSpotifyLinkRepository) {}

  async execute(
    input: DisconnectSpotifyInput,
  ): Promise<DisconnectSpotifyOutput> {
    await this.linkRepo.deleteByAudienceId(input.audience_id);

    return { audience_id: input.audience_id, linked: false };
  }
}
