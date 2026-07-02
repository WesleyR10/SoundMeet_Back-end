import axios from "axios";

import {
  IdentityProviderConflictError,
  IdentityProviderUnavailableError,
} from "../identity-provider-gateway.interface";
import { KeycloakAdminGateway } from "../keycloak-admin.gateway";

jest.mock("axios");

describe("KeycloakAdminGateway Unit Tests", () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  let mockHttp: {
    post: jest.Mock;
    get: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    mockHttp = {
      post: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    };
    mockedAxios.create.mockReturnValue(mockHttp as any);
    (mockedAxios as any).isAxiosError =
      jest.requireActual("axios").isAxiosError;
  });

  function makeGateway(): KeycloakAdminGateway {
    return new KeycloakAdminGateway({
      baseUrl: "http://localhost:8080",
      realm: "soundmeet",
      clientId: "soundmeet-api",
      clientSecret: "secret",
      mobileClientId: "soundmeet-mobile",
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
});
