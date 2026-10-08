import axios from "axios";

import { SubscriptionBillingError } from "../../../application/ports/subscription-billing.gateway";
import { BillingCycle } from "../../../domain/plan-tier.enum";
import { AsaasSubscriptionGateway } from "../asaas-subscription.gateway";

jest.mock("axios");

describe("AsaasSubscriptionGateway", () => {
  const httpMock = {
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  };

  let gateway: AsaasSubscriptionGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue(httpMock);
    (axios.isAxiosError as unknown as jest.Mock) = jest
      .fn()
      .mockImplementation((e) => !!e?.isAxiosError);
    gateway = new AsaasSubscriptionGateway(
      "https://sandbox.asaas.com/api/v3",
      "test-api-key",
    );
  });

  describe("createCustomer", () => {
    it("envia cpfCnpj sem máscara e retorna o id do gateway", async () => {
      httpMock.post.mockResolvedValueOnce({ data: { id: "cus_123" } });

      const result = await gateway.createCustomer({
        name: "João da Silva",
        email: "joao@email.com",
        cpf_cnpj: "123.456.789-09",
      });

      expect(result).toEqual({ gateway_customer_id: "cus_123" });
      expect(httpMock.post).toHaveBeenCalledWith(
        "/customers",
        expect.objectContaining({ cpfCnpj: "12345678909" }),
      );
    });

    it("envolve falha do Asaas em SubscriptionBillingError", async () => {
      httpMock.post.mockRejectedValueOnce(new Error("network down"));

      await expect(
        gateway.createCustomer({
          name: "x",
          email: "x@x.com",
          cpf_cnpj: "12345678909",
        }),
      ).rejects.toThrow(SubscriptionBillingError);
    });
  });

  describe("createSubscription", () => {
    it("mapeia BillingCycle.ANNUAL para YEARLY e retorna a invoiceUrl da 1ª cobrança", async () => {
      httpMock.post.mockResolvedValueOnce({
        data: { id: "sub_123", status: "ACTIVE" },
      });
      httpMock.get.mockResolvedValueOnce({
        data: { data: [{ invoiceUrl: "https://asaas.com/i/abc" }] },
      });

      const result = await gateway.createSubscription({
        gateway_customer_id: "cus_123",
        value_brl: 300,
        cycle: BillingCycle.ANNUAL,
        description: "Plano PRO anual",
        external_reference: "sub:musician:m1:pro:annual",
      });

      expect(result).toEqual({
        gateway_subscription_id: "sub_123",
        checkout_url: "https://asaas.com/i/abc",
        status: "ACTIVE",
      });
      expect(httpMock.post).toHaveBeenCalledWith(
        "/subscriptions",
        expect.objectContaining({ cycle: "YEARLY", value: 300 }),
      );
    });

    it("checkout_url null quando a busca da 1ª cobrança falha (não derruba o checkout)", async () => {
      httpMock.post.mockResolvedValueOnce({
        data: { id: "sub_123", status: "ACTIVE" },
      });
      httpMock.get.mockRejectedValueOnce(new Error("timeout"));

      const result = await gateway.createSubscription({
        gateway_customer_id: "cus_123",
        value_brl: 34.9,
        cycle: BillingCycle.MONTHLY,
        description: "Plano Essential",
        external_reference: "sub:musician:m1:essential:monthly",
      });

      expect(result.gateway_subscription_id).toBe("sub_123");
      expect(result.checkout_url).toBeNull();
    });
  });

  describe("getSubscription", () => {
    it("retorna null em 404 em vez de lançar", async () => {
      httpMock.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 404 },
      });

      const result = await gateway.getSubscription("sub_inexistente");

      expect(result).toBeNull();
    });

    it("retorna os dados da assinatura quando encontrada", async () => {
      httpMock.get.mockResolvedValueOnce({
        data: {
          id: "sub_123",
          externalReference: "sub:musician:m1:pro:monthly",
          status: "ACTIVE",
        },
      });

      const result = await gateway.getSubscription("sub_123");

      expect(result).toEqual({
        gateway_subscription_id: "sub_123",
        external_reference: "sub:musician:m1:pro:monthly",
        status: "ACTIVE",
      });
    });
  });

  describe("cancelSubscription", () => {
    it("chama DELETE no id da assinatura", async () => {
      httpMock.delete.mockResolvedValueOnce({ data: {} });

      await gateway.cancelSubscription("sub_123");

      expect(httpMock.delete).toHaveBeenCalledWith("/subscriptions/sub_123");
    });

    it("é idempotente: 404 não lança (já cancelada/inexistente = sucesso)", async () => {
      httpMock.delete.mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 404 },
      });

      await expect(
        gateway.cancelSubscription("sub_ja_cancelada"),
      ).resolves.toBeUndefined();
    });

    it("propaga como SubscriptionBillingError em falha não-idempotente (5xx)", async () => {
      httpMock.delete.mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 500 },
      });

      await expect(gateway.cancelSubscription("sub_123")).rejects.toThrow(
        SubscriptionBillingError,
      );
    });
  });
});
