import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerModule, ThrottlerModuleOptions } from "@nestjs/throttler";

import { AuthJwtVerifier } from "../../auth-module/auth-jwt.verifier";
import { UserThrottlerGuard } from "../guards/user-throttler.guard";

/**
 * Regressão do rate limit compartilhado (roadmap-web §11).
 *
 * O caso que motivou o guard: com o tracker padrão (`req.ip`), duas sessões
 * diferentes do painel web chegam do MESMO ip — o do BFF — e somam no mesmo
 * balde. O primeiro teste é literalmente esse cenário.
 */

function createRequest(options: {
  token?: string;
  ip?: string;
}): Record<string, any> {
  return {
    ip: options.ip ?? "10.0.0.7",
    headers: options.token ? { authorization: `Bearer ${options.token}` } : {},
  };
}

function createGuard(verify: jest.Mock) {
  const options: ThrottlerModuleOptions = [{ ttl: 60_000, limit: 100 }];
  const storage = { increment: jest.fn() } as any;
  const verifier = { verify } as unknown as AuthJwtVerifier;

  return new UserThrottlerGuard(options, storage, new Reflector(), verifier);
}

/** `getTracker` é `protected`; o teste exercita o contrato real do guard. */
function track(guard: UserThrottlerGuard, req: Record<string, any>) {
  return (guard as any).getTracker(req) as Promise<string>;
}

describe("UserThrottlerGuard", () => {
  it("separa os baldes de dois usuários que chegam do mesmo IP", async () => {
    const verify = jest
      .fn()
      .mockResolvedValueOnce({ sub: "musico-1" })
      .mockResolvedValueOnce({ sub: "estabelecimento-9" });
    const guard = createGuard(verify);

    const primeiro = await track(
      guard,
      createRequest({ token: "a", ip: "10.0.0.7" }),
    );
    const segundo = await track(
      guard,
      createRequest({ token: "b", ip: "10.0.0.7" }),
    );

    expect(primeiro).toBe("user:musico-1");
    expect(segundo).toBe("user:estabelecimento-9");
    expect(primeiro).not.toBe(segundo);
  });

  it("mantém o MESMO balde para o mesmo usuário vindo de IPs diferentes", async () => {
    const verify = jest.fn().mockResolvedValue({ sub: "musico-1" });
    const guard = createGuard(verify);

    const casa = await track(
      guard,
      createRequest({ token: "a", ip: "10.0.0.7" }),
    );
    const celular = await track(
      guard,
      createRequest({ token: "a", ip: "191.2.3.4" }),
    );

    expect(casa).toBe(celular);
  });

  it("cai para o IP quando não há token (rota pública anônima)", async () => {
    const verify = jest.fn();
    const guard = createGuard(verify);

    await expect(
      track(guard, createRequest({ ip: "203.0.113.5" })),
    ).resolves.toBe("203.0.113.5");
    // Sem token não faz sentido pagar uma verificação de assinatura.
    expect(verify).not.toHaveBeenCalled();
  });

  it("cai para o IP — sem lançar — quando o token é inválido ou expirado", async () => {
    const verify = jest.fn().mockRejectedValue(new Error("jwt expired"));
    const guard = createGuard(verify);

    /*
     * Este é o caso do soft-auth de `auth.guard.ts`: o app manda o Bearer em
     * TODA chamada, inclusive nas `@Public()`. Se o rate limiter lançasse com
     * um token velho, derrubaria as rotas públicas — que precisam continuar
     * respondendo a anônimos.
     */
    await expect(
      track(guard, createRequest({ token: "expirado", ip: "198.51.100.2" })),
    ).resolves.toBe("198.51.100.2");
  });

  it("cai para o IP quando o token é válido mas não traz `sub`", async () => {
    const verify = jest.fn().mockResolvedValue({ aud: "soundmeet-api" });
    const guard = createGuard(verify);

    await expect(
      track(guard, createRequest({ token: "sem-sub", ip: "192.0.2.9" })),
    ).resolves.toBe("192.0.2.9");
  });

  it("ignora Authorization que não seja Bearer", async () => {
    const verify = jest.fn();
    const guard = createGuard(verify);
    const req = {
      ip: "192.0.2.10",
      headers: { authorization: "Basic dXNlcjpwYXNz" },
    };

    await expect(track(guard, req)).resolves.toBe("192.0.2.10");
    expect(verify).not.toHaveBeenCalled();
  });

  it("verifica a assinatura em vez de só decodificar o payload", async () => {
    /*
     * A garantia central: um `sub` forjado não vale balde novo, porque o
     * caminho passa pelo AuthJwtVerifier (JWKS com cache). O desenho original
     * no §11 aceitava decodificar sem verificar; este teste é o que impede
     * alguém de "simplificar" para aquilo mais tarde.
     */
    const verify = jest.fn().mockRejectedValue(new Error("invalid signature"));
    const guard = createGuard(verify);

    const tracker = await track(
      guard,
      createRequest({ token: "token.forjado.aqui", ip: "198.51.100.77" }),
    );

    expect(verify).toHaveBeenCalledWith("token.forjado.aqui");
    expect(tracker).toBe("198.51.100.77");
    expect(tracker).not.toContain("user:");
  });

  /**
   * Smoke de DI.
   *
   * O guard recebe uma 4ª dependência além das três que o `ThrottlerGuard`
   * declara, e é registrado como `APP_GUARD`. Se os tokens
   * `@InjectThrottlerOptions`/`@InjectThrottlerStorage` estiverem errados, nada
   * falha em tempo de compilação — quebra no boot da aplicação, com o container
   * já buildado. Este teste antecipa isso para a suíte.
   */
  it("resolve na injeção de dependências", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
      providers: [
        { provide: AuthJwtVerifier, useValue: { verify: jest.fn() } },
        UserThrottlerGuard,
      ],
    }).compile();

    // Instanciar já exercita os 4 tokens; `APP_GUARD` usa a mesma resolução,
    // mas não é recuperável por `get()` (é um token de enhancer).
    expect(moduleRef.get(UserThrottlerGuard)).toBeInstanceOf(
      UserThrottlerGuard,
    );
  });
});
