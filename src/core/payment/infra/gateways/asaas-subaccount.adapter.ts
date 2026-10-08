import axios, { AxiosInstance } from "axios";

import {
  CreateSubaccountRequest,
  CreateSubaccountResponse,
  ISubaccountGateway,
} from "./subaccount-gateway.interface";

/**
 * Subconta do músico no Asaas (F1.0).
 *
 * ## Restrições do provedor que o chamador precisa conhecer
 *
 * - **Conta PF não cria subconta.** A conta da plataforma tem que ser PJ.
 * - **Período de avaliação de 60 dias:** no máximo 10 subcontas e R$2.000 em
 *   cobranças por subconta. É o teto do piloto — não dá para abrir 200 músicos
 *   no primeiro mês, e descobrir isso em produção seria caro.
 * - **`apiKey` só existe na resposta da criação.** Não há endpoint para
 *   recuperá-la.
 * - **Conta Escrow custa mensalidade por subconta habilitada**, e desabilitar
 *   libera tudo que está sob garantia.
 */
export class AsaasSubaccountAdapter implements ISubaccountGateway {
  private readonly http: AxiosInstance;

  constructor(apiUrl: string, apiKey: string) {
    this.http = axios.create({
      baseURL: apiUrl,
      headers: {
        access_token: apiKey,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    });
  }

  async createSubaccount(
    input: CreateSubaccountRequest,
  ): Promise<CreateSubaccountResponse> {
    const { data } = await this.http.post("/accounts", {
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpf_cnpj.replace(/\D/g, ""),
      mobilePhone: input.mobile_phone?.replace(/\D/g, "") ?? undefined,
      birthDate: input.birth_date ?? undefined,
      address: input.address?.street,
      addressNumber: input.address?.number,
      province: input.address?.province,
      postalCode: input.address?.postal_code?.replace(/\D/g, ""),
      externalReference: input.external_reference,
    });

    /*
     * 🔴 Falhar ALTO se a apiKey não vier.
     *
     * Devolver `""` faria a subconta ser persistida sem a única credencial que
     * a opera — e como o provedor não a devolve depois, o dinheiro custodiado
     * ali ficaria inalcançável. Um erro aqui custa uma retentativa; um `""`
     * custa a subconta inteira.
     */
    if (!data?.walletId || !data?.apiKey) {
      throw new Error(
        "Asaas não devolveu walletId/apiKey na criação da subconta",
      );
    }

    return {
      wallet_id: data.walletId,
      api_key: data.apiKey,
      account_status: data.status ?? null,
    };
  }

  async configureEscrow(input: {
    wallet_id: string;
    enabled: boolean;
    days_to_expire?: number;
  }): Promise<void> {
    await this.http.post(`/accounts/${input.wallet_id}/escrow`, {
      enabled: input.enabled,
      daysToExpire: input.days_to_expire,
      // A mensalidade da Conta Escrow fica com a PLATAFORMA, não com o músico:
      // cobrar R$9,90/mês de quem vai receber o cachê seria descontar do
      // artista o custo de uma garantia que protege o estabelecimento.
      isFeePayer: false,
    });
  }
}
