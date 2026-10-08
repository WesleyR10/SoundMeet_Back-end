import axios from "axios";

import {
  IdentityProviderConflictError,
  IdentityProviderInvalidCredentialsError,
  IdentityProviderSessionExpiredError,
  IdentityProviderUnavailableError,
} from "../identity-provider-gateway.interface";
import { KeycloakAdminGateway } from "../keycloak-admin.gateway";

jest.mock("axios", () => {
  const actualAxios = jest.requireActual("axios");
  return {
    __esModule: true,
    default: { create: jest.fn() },
    isAxiosError: actualAxios.isAxiosError,
  };
});

describe("KeycloakAdminGateway Unit Tests", () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  let mockHttp: {
    post: jest.Mock;
    get: jest.Mock;
    put: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    mockHttp = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };
    mockedAxios.create.mockReturnValue(mockHttp as any);
  });

  function makeGateway(): KeycloakAdminGateway {
    return new KeycloakAdminGateway({
      baseUrl: "http://localhost:8080",
      realm: "soundmeet",
      clientId: "soundmeet-api",
      clientSecret: "secret",
      registrationClientId: "soundmeet-registration",
      registrationClientSecret: "registration-secret",
    });
  }

  function mockAdminTokenResponse(): void {
    mockHttp.post.mockResolvedValueOnce({
      data: { access_token: "admin-token", expires_in: 300 },
    });
  }

  it("creates a user and extracts the id from the Location header", async () => {
    mockAdminTokenResponse();
    mockHttp.post.mockResolvedValueOnce({
      status: 201,
      headers: {
        location: "http://localhost:8080/admin/realms/soundmeet/users/abc-123",
      },
      data: null,
    });

    const gateway = makeGateway();
    const result = await gateway.createUser({
      email: "a@b.com",
      name: "A",
      password: "Senha123",
    });

    expect(result.external_id).toBe("abc-123");
  });

  it("throws IdentityProviderConflictError when Keycloak returns 409", async () => {
    mockAdminTokenResponse();
    mockHttp.post.mockResolvedValueOnce({ status: 409, headers: {}, data: {} });

    const gateway = makeGateway();
    await expect(
      gateway.createUser({
        email: "a@b.com",
        name: "A",
        password: "Senha123",
      }),
    ).rejects.toThrow(IdentityProviderConflictError);
  });

  it("throws IdentityProviderUnavailableError on network failure", async () => {
    mockHttp.post.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const gateway = makeGateway();
    await expect(
      gateway.createUser({
        email: "a@b.com",
        name: "A",
        password: "Senha123",
      }),
    ).rejects.toThrow(IdentityProviderUnavailableError);
  });

  it("caches the admin token between calls instead of requesting it every time", async () => {
    mockAdminTokenResponse();
    mockHttp.post.mockResolvedValueOnce({
      status: 201,
      headers: {
        location: "http://localhost:8080/admin/realms/soundmeet/users/id-1",
      },
      data: null,
    });
    mockHttp.post.mockResolvedValueOnce({
      status: 201,
      headers: {
        location: "http://localhost:8080/admin/realms/soundmeet/users/id-2",
      },
      data: null,
    });

    const gateway = makeGateway();
    await gateway.createUser({
      email: "a@b.com",
      name: "A",
      password: "Senha123",
    });
    await gateway.createUser({
      email: "c@d.com",
      name: "C",
      password: "Senha123",
    });

    const tokenCalls = mockHttp.post.mock.calls.filter(
      ([path]) => path === "/token",
    );
    expect(tokenCalls).toHaveLength(1);
  });

  it("assigns a realm role by looking up the role representation first", async () => {
    mockAdminTokenResponse();
    mockHttp.get.mockResolvedValueOnce({ data: { name: "musician" } });
    mockHttp.post.mockResolvedValueOnce({ status: 204, data: null });

    const gateway = makeGateway();
    await gateway.assignRealmRole("abc-123", "musician");

    expect(mockHttp.get).toHaveBeenCalledWith(
      "/roles/musician",
      expect.any(Object),
    );
    expect(mockHttp.post).toHaveBeenCalledWith(
      "/users/abc-123/role-mappings/realm",
      [{ name: "musician" }],
      expect.any(Object),
    );
  });

  it("deletes a user for compensation", async () => {
    mockAdminTokenResponse();
    mockHttp.delete.mockResolvedValueOnce({ status: 204 });

    const gateway = makeGateway();
    await gateway.deleteUser("abc-123");

    expect(mockHttp.delete).toHaveBeenCalledWith(
      "/users/abc-123",
      expect.any(Object),
    );
  });

  it("removes a realm role by looking up the role representation first", async () => {
    mockAdminTokenResponse();
    mockHttp.get.mockResolvedValueOnce({ data: { name: "musician" } });
    mockHttp.delete.mockResolvedValueOnce({ status: 204 });

    const gateway = makeGateway();
    await gateway.removeRealmRole("abc-123", "musician");

    expect(mockHttp.get).toHaveBeenCalledWith(
      "/roles/musician",
      expect.any(Object),
    );
    expect(mockHttp.delete).toHaveBeenCalledWith(
      "/users/abc-123/role-mappings/realm",
      expect.objectContaining({ data: [{ name: "musician" }] }),
    );
  });

  it("gets a user by id", async () => {
    mockAdminTokenResponse();
    mockHttp.get.mockResolvedValueOnce({
      data: { email: "a@b.com", firstName: "A" },
    });

    const gateway = makeGateway();
    const user = await gateway.getUser("abc-123");

    expect(user).toEqual({ email: "a@b.com", name: "A" });
    expect(mockHttp.get).toHaveBeenCalledWith(
      "/users/abc-123",
      expect.any(Object),
    );
  });

  describe("addClaimValue", () => {
    it("acrescenta o id à lista existente sem sobrescrevê-la", async () => {
      mockAdminTokenResponse();
      mockHttp.get.mockResolvedValueOnce({
        data: {
          attributes: { establishment_ids: ["est-1"], organization_id: ["o1"] },
        },
      });

      const gateway = makeGateway();
      await gateway.addClaimValue("user-1", "establishment_ids", "est-2");

      expect(mockHttp.put).toHaveBeenCalledWith(
        "/users/user-1",
        {
          attributes: {
            establishment_ids: ["est-1", "est-2"],
            organization_id: ["o1"],
          },
        },
        expect.any(Object),
      );
    });

    it("cria o atributo quando o usuário ainda não tem nenhum", async () => {
      mockAdminTokenResponse();
      mockHttp.get.mockResolvedValueOnce({ data: {} });

      const gateway = makeGateway();
      await gateway.addClaimValue("user-1", "band_ids", "band-1");

      expect(mockHttp.put).toHaveBeenCalledWith(
        "/users/user-1",
        { attributes: { band_ids: ["band-1"] } },
        expect.any(Object),
      );
    });

    it("é idempotente — valor já presente não gera escrita", async () => {
      mockAdminTokenResponse();
      mockHttp.get.mockResolvedValueOnce({
        data: { attributes: { establishment_ids: ["est-1"] } },
      });

      const gateway = makeGateway();
      await gateway.addClaimValue("user-1", "establishment_ids", "est-1");

      expect(mockHttp.put).not.toHaveBeenCalled();
    });

    it("normaliza atributo gravado como string crua pela console do Keycloak", async () => {
      mockAdminTokenResponse();
      mockHttp.get.mockResolvedValueOnce({
        data: { attributes: { establishment_ids: "est-1" } },
      });

      const gateway = makeGateway();
      await gateway.addClaimValue("user-1", "establishment_ids", "est-2");

      expect(mockHttp.put).toHaveBeenCalledWith(
        "/users/user-1",
        { attributes: { establishment_ids: ["est-1", "est-2"] } },
        expect.any(Object),
      );
    });

    it("propaga indisponibilidade do Keycloak como erro tipado", async () => {
      mockAdminTokenResponse();
      mockHttp.get.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const gateway = makeGateway();
      await expect(
        gateway.addClaimValue("user-1", "establishment_ids", "est-1"),
      ).rejects.toThrow(IdentityProviderUnavailableError);
    });
  });

  describe("removeClaimValue", () => {
    it("tira só o valor pedido e preserva o resto dos atributos", async () => {
      mockAdminTokenResponse();
      mockHttp.get.mockResolvedValueOnce({
        status: 200,
        data: {
          attributes: {
            band_ids: ["band-1", "band-2"],
            establishment_ids: ["est-1"],
          },
        },
      });

      const gateway = makeGateway();
      await gateway.removeClaimValue("user-1", "band_ids", "band-1");

      expect(mockHttp.put).toHaveBeenCalledWith(
        "/users/user-1",
        {
          attributes: {
            band_ids: ["band-2"],
            // O PUT leva o mapa INTEIRO: mandar só `band_ids` apagaria o
            // vínculo do usuário com o estabelecimento dele.
            establishment_ids: ["est-1"],
          },
        },
        expect.any(Object),
      );
    });

    it("é idempotente — valor ausente não gera escrita", async () => {
      mockAdminTokenResponse();
      mockHttp.get.mockResolvedValueOnce({
        status: 200,
        data: { attributes: { band_ids: ["band-2"] } },
      });

      const gateway = makeGateway();
      await gateway.removeClaimValue("user-1", "band_ids", "band-1");

      expect(mockHttp.put).not.toHaveBeenCalled();
    });

    it("usuário que não existe mais não é erro", async () => {
      mockAdminTokenResponse();
      mockHttp.get.mockResolvedValueOnce({ status: 404, data: {} });

      const gateway = makeGateway();
      await expect(
        gateway.removeClaimValue("user-1", "band_ids", "band-1"),
      ).resolves.toBeUndefined();
      expect(mockHttp.put).not.toHaveBeenCalled();
    });

    it("propaga indisponibilidade do Keycloak como erro tipado", async () => {
      mockAdminTokenResponse();
      mockHttp.get.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const gateway = makeGateway();
      await expect(
        gateway.removeClaimValue("user-1", "band_ids", "band-1"),
      ).rejects.toThrow(IdentityProviderUnavailableError);
    });
  });

  it("throws IdentityProviderInvalidCredentialsError when Keycloak returns invalid_grant", async () => {
    mockHttp.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { error: "invalid_grant" } },
    });

    const gateway = makeGateway();
    await expect(
      gateway.authenticateWithPassword("a@b.com", "wrong-password"),
    ).rejects.toThrow(IdentityProviderInvalidCredentialsError);
  });

  // Regressão: o realm deste projeto responde 401 (não 400) para senha errada
  // no direct grant. Enquanto a checagem só cobria 400, credencial inválida
  // virava IdentityProviderUnavailableError → 503 no HTTP.
  it("throws IdentityProviderInvalidCredentialsError when invalid_grant comes with 401", async () => {
    mockHttp.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { error: "invalid_grant" } },
    });

    const gateway = makeGateway();
    await expect(
      gateway.authenticateWithPassword("a@b.com", "wrong-password"),
    ).rejects.toThrow(IdentityProviderInvalidCredentialsError);
  });

  // O status sozinho não basta: um 401 que não seja invalid_grant (ex.: client
  // sem permissão de direct grant) continua sendo indisponibilidade, não
  // credencial errada.
  it("treats a 401 without invalid_grant as unavailability", async () => {
    mockHttp.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { error: "unauthorized_client" } },
    });

    const gateway = makeGateway();
    await expect(
      gateway.authenticateWithPassword("a@b.com", "any-password"),
    ).rejects.toThrow(IdentityProviderUnavailableError);
  });

  describe("sessão do login por senha (AUTH-3)", () => {
    function invalidGrant(status = 400) {
      return {
        isAxiosError: true,
        response: { status, data: { error: "invalid_grant" } },
      };
    }

    function sentBody(callIndex = 0): URLSearchParams {
      return mockHttp.post.mock.calls[callIndex][1] as URLSearchParams;
    }

    it("o grant de senha usa o client CONFIDENCIAL e pede offline_access", async () => {
      mockHttp.post.mockResolvedValueOnce({
        data: { access_token: "a", refresh_token: "r", expires_in: 900 },
      });

      await makeGateway().authenticateWithPassword("a@b.com", "Senha123");

      const body = sentBody();
      expect(mockHttp.post.mock.calls[0][0]).toBe("/token");
      expect(body.get("client_id")).toBe("soundmeet-registration");
      expect(body.get("client_secret")).toBe("registration-secret");
      expect(body.get("scope")).toBe("openid offline_access");
    });

    it("renova pelo client confidencial — o mesmo que emitiu o token", async () => {
      mockHttp.post.mockResolvedValueOnce({
        data: { access_token: "a2", refresh_token: "r2", expires_in: 900 },
      });

      const result = await makeGateway().refreshSession("r1");

      const body = sentBody();
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("refresh_token")).toBe("r1");
      expect(body.get("client_id")).toBe("soundmeet-registration");
      expect(body.get("client_secret")).toBe("registration-secret");
      expect(result.access_token).toBe("a2");
    });

    it("refresh recusado (invalid_grant) vira sessão expirada, não indisponibilidade", async () => {
      mockHttp.post.mockRejectedValueOnce(invalidGrant());

      await expect(makeGateway().refreshSession("r1")).rejects.toThrow(
        IdentityProviderSessionExpiredError,
      );
    });

    it("revoga em /revoke com o secret (derruba também a sessão offline)", async () => {
      mockHttp.post.mockResolvedValueOnce({ status: 200, data: {} });

      await makeGateway().revokeSession("r1");

      const body = sentBody();
      expect(mockHttp.post.mock.calls[0][0]).toBe("/revoke");
      expect(body.get("token")).toBe("r1");
      expect(body.get("token_type_hint")).toBe("refresh_token");
      expect(body.get("client_secret")).toBe("registration-secret");
    });

    it("redefinição: conta inexistente resolve em silêncio, sem disparar e-mail", async () => {
      mockAdminTokenResponse();
      mockHttp.get.mockResolvedValueOnce({ data: [] });

      await expect(
        makeGateway().sendPasswordResetEmail("ninguem@b.com"),
      ).resolves.toBeUndefined();
      expect(mockHttp.put).not.toHaveBeenCalled();
    });

    it("redefinição: conta existente recebe UPDATE_PASSWORD com link de 30 min", async () => {
      mockAdminTokenResponse();
      mockHttp.get.mockResolvedValueOnce({
        data: [{ id: "user-1", enabled: true }],
      });
      mockHttp.put.mockResolvedValueOnce({ status: 204 });

      await makeGateway().sendPasswordResetEmail("a@b.com");

      expect(mockHttp.get.mock.calls[0][1].params).toEqual({
        email: "a@b.com",
        exact: true,
        max: 1,
      });
      const [path, actions, options] = mockHttp.put.mock.calls[0];
      expect(path).toBe("/users/user-1/execute-actions-email");
      expect(actions).toEqual(["UPDATE_PASSWORD"]);
      expect(options.params).toEqual({ lifespan: 1800 });
    });

    it("redefinição: conta desabilitada não recebe link", async () => {
      mockAdminTokenResponse();
      mockHttp.get.mockResolvedValueOnce({
        data: [{ id: "user-1", enabled: false }],
      });

      await makeGateway().sendPasswordResetEmail("a@b.com");

      expect(mockHttp.put).not.toHaveBeenCalled();
    });
  });
});
