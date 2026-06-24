import axios, { AxiosInstance } from "axios";

import {
  IPixWithdrawGateway,
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

export class AsaasGatewayAdapter implements IPixWithdrawGateway {
  private readonly http: AxiosInstance;

  constructor(
    apiUrl: string,
    private readonly apiKey: string,
  ) {
    this.http = axios.create({
      baseURL: apiUrl,
      headers: {
        "access_token": apiKey,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    });
  }

  async withdraw(input: PixWithdrawRequest): Promise<PixWithdrawResponse> {
    const asaasKeyType = PIX_KEY_TYPE_MAP[input.pix_key_type] ?? "EVP";

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
  }
}
