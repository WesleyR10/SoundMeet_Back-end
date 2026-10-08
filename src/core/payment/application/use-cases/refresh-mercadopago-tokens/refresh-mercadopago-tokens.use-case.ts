import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IMusicianWalletRepository } from "../../../domain/repositories/musician-wallet.repository";
import { IMercadoPagoOAuthGateway } from "../../../infra/gateways/mercadopago-oauth.gateway";

export type RefreshMercadoPagoTokensInput = { limit?: number };

export type RefreshMercadoPagoTokensOutput = {
  examined: number;
  refreshed: number;
  failed: { musician_id: string; reason: string }[];
};

export type RefreshMercadoPagoTokensDeps = {
  walletRepo: IMusicianWalletRepository;
  oauth: IMercadoPagoOAuthGateway;
  clock?: IClock;
  /** Antecedência da renovação. Padrão: 15 dias. */
  slackMs?: number;
  batchLimit?: number;
};

/** 15 dias de antecedência num token de 180. */
const DEFAULT_SLACK_MS = 15 * 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_LIMIT = 200;

/**
 * Renova os tokens do Mercado Pago antes de vencerem.
 *
 * ## Por que a folga é de DIAS, e não de horas
 *
 * O token vale 180 dias. Deixá-lo vencer custa uma **reautorização manual** do
 * músico — que é exatamente a fricção que o `offline_access` existe para
 * eliminar, e que ele descobriria quando uma gorjeta falhasse, no palco. Com 15
 * dias de folga, o provedor pode ficar fora do ar por uma semana inteira e ainda
 * sobra tempo.
 *
 * ## Por que uma carteira problemática não derruba as outras
 *
 * Um vínculo revogado pelo músico do lado do provedor faz o refresh falhar para
 * sempre. Se isso interrompesse a varredura, **um** músico que desconectou
 * travaria a renovação de todos os outros — e o estrago só apareceria meses
 * depois, em massa.
 */
export class RefreshMercadoPagoTokensUseCase implements IUseCase<
  RefreshMercadoPagoTokensInput,
  RefreshMercadoPagoTokensOutput
> {
  private readonly clock: IClock;

  constructor(private readonly deps: RefreshMercadoPagoTokensDeps) {
    this.clock = deps.clock ?? { now: () => new Date() };
  }

  async execute(
    input: RefreshMercadoPagoTokensInput = {},
  ): Promise<RefreshMercadoPagoTokensOutput> {
    const now = this.clock.now();
    const slack = this.deps.slackMs ?? DEFAULT_SLACK_MS;
    const limit = input.limit ?? this.deps.batchLimit ?? DEFAULT_BATCH_LIMIT;

    const wallets = await this.deps.walletRepo.findMercadoPagoExpiring(
      new Date(now.getTime() + slack),
      limit,
    );

    const failed: { musician_id: string; reason: string }[] = [];
    let refreshed = 0;

    for (const wallet of wallets) {
      try {
        const tokens = await this.deps.oauth.refresh(wallet.mp_refresh_token!);

        wallet.refreshMercadoPagoTokens({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expires_at,
        });

        if (wallet.notification.hasErrors()) {
          failed.push({
            musician_id: wallet.musician_id.id,
            reason: JSON.stringify(wallet.notification.toJSON()),
          });
          continue;
        }

        await this.deps.walletRepo.update(wallet);
        refreshed += 1;
      } catch (error) {
        failed.push({
          musician_id: wallet.musician_id.id,
          reason: error instanceof Error ? error.message : "erro desconhecido",
        });
      }
    }

    return { examined: wallets.length, refreshed, failed };
  }
}
