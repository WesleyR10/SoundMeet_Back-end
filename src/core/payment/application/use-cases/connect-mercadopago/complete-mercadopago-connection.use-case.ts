import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { MusicianWallet } from "../../../domain/musician-wallet.aggregate";
import { IMusicianWalletRepository } from "../../../domain/repositories/musician-wallet.repository";
import { IMercadoPagoOAuthGateway } from "../../../infra/gateways/mercadopago-oauth.gateway";

export type CompleteMercadoPagoConnectionInput = {
  /** `code` devolvido pelo provedor no callback. */
  code: string;
  /** `state` assinado — é ele que diz de quem é a conta. */
  state: string;
};

export type CompleteMercadoPagoConnectionOutput = {
  musician_id: string;
  mp_user_id: string;
  expires_at: Date;
};

export interface IOAuthStateVerifier {
  verify(state: string): { musician_id: string };
}

/**
 * Passo 2 do vínculo: troca o `code` pelos tokens e liga à carteira.
 *
 * ## A ordem importa
 *
 * 1. **Verificar o `state` primeiro.** Ele diz de quem é a conta, e vem de um
 *    redirect sem autenticação — trocar o código antes seria gastar o `code` de
 *    um fluxo que pode nem ser legítimo.
 * 2. Só então trocar o `code` pelos tokens.
 * 3. Persistir cifrado (o mapper faz).
 *
 * Cria a carteira se ainda não existir — o músico pode conectar o MP antes de
 * receber a primeira gorjeta, e exigir carteira prévia seria uma ordem de
 * cadastro que não existe em lugar nenhum do produto.
 */
export class CompleteMercadoPagoConnectionUseCase implements IUseCase<
  CompleteMercadoPagoConnectionInput,
  CompleteMercadoPagoConnectionOutput
> {
  constructor(
    private readonly walletRepo: IMusicianWalletRepository,
    private readonly oauth: IMercadoPagoOAuthGateway,
    private readonly state: IOAuthStateVerifier,
  ) {}

  async execute(
    input: CompleteMercadoPagoConnectionInput,
  ): Promise<CompleteMercadoPagoConnectionOutput> {
    const { musician_id } = this.state.verify(input.state);

    const tokens = await this.oauth.exchangeCode(input.code);

    let wallet = await this.walletRepo.findByMusicianId(musician_id);
    const isNew = !wallet;

    if (!wallet) {
      wallet = MusicianWallet.create({ musician_id });
    }

    wallet.linkMercadoPago({
      mp_user_id: tokens.mp_user_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
    });

    if (wallet.notification.hasErrors()) {
      throw new EntityValidationError(wallet.notification.toJSON());
    }

    if (isNew) {
      await this.walletRepo.insert(wallet);
    } else {
      await this.walletRepo.update(wallet);
    }

    return {
      musician_id,
      mp_user_id: tokens.mp_user_id,
      expires_at: tokens.expires_at,
    };
  }
}
