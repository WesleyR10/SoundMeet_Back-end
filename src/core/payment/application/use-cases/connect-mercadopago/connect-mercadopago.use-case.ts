import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IMercadoPagoOAuthGateway } from "../../../infra/gateways/mercadopago-oauth.gateway";

export type ConnectMercadoPagoInput = { musician_id: string };
export type ConnectMercadoPagoOutput = { authorization_url: string };

export interface IOAuthStateSigner {
  sign(musician_id: string): string;
}

/**
 * Passo 1 do vínculo: devolve a URL para onde mandar o músico autorizar.
 *
 * O `musician_id` vai assinado dentro do `state` — o callback chega pelo
 * navegador, **sem Bearer token**, e essa assinatura é a única coisa que impede
 * alguém de vincular a própria conta de pagamento ao músico de outra pessoa.
 */
export class ConnectMercadoPagoUseCase implements IUseCase<
  ConnectMercadoPagoInput,
  ConnectMercadoPagoOutput
> {
  constructor(
    private readonly oauth: IMercadoPagoOAuthGateway,
    private readonly state: IOAuthStateSigner,
  ) {}

  async execute(
    input: ConnectMercadoPagoInput,
  ): Promise<ConnectMercadoPagoOutput> {
    return {
      authorization_url: this.oauth.buildAuthorizationUrl(
        this.state.sign(input.musician_id),
      ),
    };
  }
}
