import axios from "axios";

import { MercadoPagoOAuthAdapter } from "../mercadopago-oauth.adapter";

jest.mock("axios");

describe("MercadoPagoOAuthAdapter", () => {
  const httpMock = {
    post: jest.fn(),
    get: jest.fn(),
  };

  let adapter: MercadoPagoOAuthAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue(httpMock);
    adapter = new MercadoPagoOAuthAdapter({
      apiUrl: "https://api.mercadopago.com",
      authUrl: "https://auth.mercadopago.com.br/authorization",
      clientId: "client-123",
      clientSecret: "secret-456",
      redirectUri:
        "https://soundmeet.com.br/api/v1/musicians/mercadopago/callback",
    });
  });

  describe("buildAuthorizationUrl", () => {
    it("pede scope=offline_access — sem ele o MP nunca devolve refresh_token", () => {
      const url = new URL(adapter.buildAuthorizationUrl("signed-state"));

      expect(url.searchParams.get("scope")).toBe("offline_access");
      expect(url.searchParams.get("client_id")).toBe("client-123");
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("platform_id")).toBe("mp");
      expect(url.searchParams.get("state")).toBe("signed-state");
      expect(url.searchParams.get("redirect_uri")).toBe(
        "https://soundmeet.com.br/api/v1/musicians/mercadopago/callback",
      );
    });
  });

  describe("exchangeCode", () => {
    it("troca o code por tokens e converte expires_in (segundos) em Date", async () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(now);

      httpMock.post.mockResolvedValueOnce({
        data: {
          user_id: 123,
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 15552000,
        },
      });

      const tokens = await adapter.exchangeCode("auth-code");

      expect(httpMock.post).toHaveBeenCalledWith("/oauth/token", {
        grant_type: "authorization_code",
        client_id: "client-123",
        client_secret: "secret-456",
        code: "auth-code",
        redirect_uri:
          "https://soundmeet.com.br/api/v1/musicians/mercadopago/callback",
      });
      expect(tokens).toEqual({
        mp_user_id: "123",
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: new Date(now + 15552000 * 1000),
      });
    });

    it("falha alto quando o MP não devolve refresh_token (escopo offline_access ausente)", async () => {
      httpMock.post.mockResolvedValueOnce({
        data: {
          user_id: 123,
          access_token: "access-token",
          expires_in: 15552000,
        },
      });

      await expect(adapter.exchangeCode("auth-code")).rejects.toThrow(
        /offline_access/,
      );
    });
  });

  describe("refresh", () => {
    it("renova com grant_type=refresh_token", async () => {
      httpMock.post.mockResolvedValueOnce({
        data: {
          user_id: 123,
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 15552000,
        },
      });

      await adapter.refresh("old-refresh-token");

      expect(httpMock.post).toHaveBeenCalledWith("/oauth/token", {
        grant_type: "refresh_token",
        client_id: "client-123",
        client_secret: "secret-456",
        refresh_token: "old-refresh-token",
      });
    });
  });

  describe("getPayment", () => {
    it("lê a cobrança com o token do vendedor e soma fee_details", async () => {
      httpMock.get.mockResolvedValueOnce({
        data: {
          id: 999,
          status: "approved",
          transaction_amount: 20,
          fee_details: [{ amount: 1.6 }, { amount: 0.2 }],
          metadata: { tip_id: "tip-1" },
        },
      });

      const payment = await adapter.getPayment("999", "seller-access-token");

      expect(httpMock.get).toHaveBeenCalledWith("/v1/payments/999", {
        headers: { Authorization: "Bearer seller-access-token" },
      });
      expect(payment).toEqual({
        id: "999",
        status: "approved",
        transaction_amount: 20,
        fee_amount: 1.8,
        metadata: { tip_id: "tip-1" },
      });
    });

    it("mapeia external_reference → metadata.tip_id quando a Orders API não grava metadata", async () => {
      httpMock.get.mockResolvedValueOnce({
        data: {
          id: 173952391251,
          status: "approved",
          transaction_amount: 20,
          fee_details: [],
          metadata: {},
          external_reference: "tip-from-order",
        },
      });

      const payment = await adapter.getPayment(
        "173952391251",
        "seller-access-token",
      );

      expect(payment.metadata).toEqual({ tip_id: "tip-from-order" });
    });
  });
});
