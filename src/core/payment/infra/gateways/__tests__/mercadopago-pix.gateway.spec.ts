import axios from "axios";

import { MercadoPagoAccountNotLinkedError } from "../mercadopago-account.resolver";
import { MercadoPagoPixGateway } from "../mercadopago-pix.gateway";

jest.mock("axios");

describe("MercadoPagoPixGateway", () => {
  const httpMock = {
    post: jest.fn(),
  };
  const accounts = {
    resolve: jest.fn(),
  };

  let gateway: MercadoPagoPixGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue(httpMock);
    gateway = new MercadoPagoPixGateway(
      "https://api.mercadopago.com",
      accounts,
    );
  });

  it("recusa gorjeta sem beneficiário — sem conta o dinheiro cairia na plataforma", async () => {
    await expect(
      gateway.generatePayment({ amount: 20 }),
    ).rejects.toBeInstanceOf(MercadoPagoAccountNotLinkedError);
  });

  it("cria a cobrança na Orders API com marketplace_fee e tip_id em external_reference", async () => {
    accounts.resolve.mockResolvedValueOnce({
      mp_user_id: "3629491815",
      access_token: "APP_USR-seller",
    });
    httpMock.post.mockResolvedValueOnce({
      data: {
        id: "ORDTST01ABC",
        transactions: {
          payments: [
            {
              payment_method: {
                qr_code: "000201pix-copia-cola",
                qr_code_base64: "base64-qr",
                ticket_url:
                  "https://www.mercadopago.com.br/sandbox/payments/173952391251/ticket?hash=abc",
              },
            },
          ],
        },
      },
    });

    const result = await gateway.generatePayment({
      amount: 20,
      platform_fee: 1.6,
      beneficiary_musician_id: "musician-1",
      payer: { email: "fa@test.com", name: "Fã" },
      metadata: { tip_id: "tip-uuid-1", musician_id: "musician-1" },
    });

    expect(accounts.resolve).toHaveBeenCalledWith("musician-1");
    expect(httpMock.post).toHaveBeenCalledWith(
      "/v1/orders",
      {
        type: "online",
        processing_mode: "automatic",
        total_amount: "20.00",
        marketplace_fee: "1.60",
        external_reference: "tip-uuid-1",
        payer: { email: "fa@test.com", first_name: "Fã" },
        transactions: {
          payments: [
            {
              amount: "20.00",
              payment_method: { id: "pix", type: "bank_transfer" },
            },
          ],
        },
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer APP_USR-seller",
          "X-Idempotency-Key": expect.any(String),
        }),
      }),
    );
    expect(result).toEqual({
      qr_code: "base64-qr",
      copy_paste_code: "000201pix-copia-cola",
      external_id: "173952391251",
    });
  });
});
