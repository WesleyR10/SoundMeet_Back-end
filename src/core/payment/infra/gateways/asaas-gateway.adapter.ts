import axios, { AxiosInstance, isAxiosError } from "axios";

import {
  IPixWithdrawGateway,
  PixWithdrawRejectedError,
  PixWithdrawRequest,
  PixWithdrawResponse,
} from "./pix-withdraw-gateway.interface";

const PIX_KEY_TYPE_MAP: Record<string, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "EMAIL",
  phone: "PHONE",
  random: "EVP",
};

/**
 * Status HTTP que provam que a transferência **não** foi criada.
 *
 * 400/422 são recusa de validação, 401/403 são credencial — em nenhum deles o
 * provedor chegou a movimentar dinheiro. Tudo o mais (429, 5xx, timeout, DNS,
 * socket) é indeterminado por construção e NÃO entra aqui: a requisição pode
 * ter sido processada e só a resposta ter se perdido.
 */
const CONCLUSIVE_REJECTION_STATUSES = new Set([400, 401, 403, 422]);

export class AsaasGatewayAdapter implements IPixWithdrawGateway {
  private readonly http: AxiosInstance;

  constructor(
    apiUrl: string,
    private readonly apiKey: string,
  ) {
    this.http = axios.create({
      baseURL: apiUrl,
      headers: {
        access_token: apiKey,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    });
  }

  async withdraw(input: PixWithdrawRequest): Promise<PixWithdrawResponse> {
    const asaasKeyType = PIX_KEY_TYPE_MAP[input.pix_key_type] ?? "EVP";

    try {
      const { data } = await this.http.post("/transfers", {
        value: input.amount,
        operationType: "PIX",
        pixAddressKey: input.pix_key,
        pixAddressKeyType: asaasKeyType,
        description: input.description ?? "Saque SoundMeet",
        externalReference: input.external_reference,
      });

      return {
        transfer_id: data.id,
        status: data.status,
      };
    } catch (error) {
      throw this.classify(error);
    }
  }

  async findTransferByExternalReference(
    externalReference: string,
  ): Promise<PixWithdrawResponse | null> {
    const { data } = await this.http.get("/transfers", {
      params: { externalReference, limit: 1 },
    });

    const transfer = data?.data?.[0];
    if (!transfer) {
      return null;
    }

    return { transfer_id: transfer.id, status: transfer.status };
  }

  /**
   * Traduz a falha HTTP em "o provedor recusou" ou "não sei".
   *
   * Quando não sei, o erro original sobe intacto — o chamador precisa
   * distinguir os dois casos, e engolir a causa aqui apagaria a informação de
   * que a resposta se perdeu em vez de ter sido negativa.
   */
  private classify(error: unknown): unknown {
    if (!isAxiosError(error) || !error.response) {
      return error;
    }

    const { status, data } = error.response;
    if (!CONCLUSIVE_REJECTION_STATUSES.has(status)) {
      return error;
    }

    const first = data?.errors?.[0];
    return new PixWithdrawRejectedError(
      first?.description ?? `Transferência recusada pelo provedor (${status})`,
      first?.code,
    );
  }
}
