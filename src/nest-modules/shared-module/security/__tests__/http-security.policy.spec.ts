import {
  buildHelmetOptions,
  resolveHttpSecurityPolicy,
} from "../http-security.policy";

describe("resolveHttpSecurityPolicy — CORS (SM-020)", () => {
  /**
   * A regressão que motivou o achado: a allowlist era literal no `main.ts` e
   * carregava localhost em todo ambiente, com `credentials: true`.
   */
  it("não injeta localhost em produção", () => {
    const policy = resolveHttpSecurityPolicy({
      node_env: "production",
      cors_allowed_origins: "https://app.soundmeet.com.br",
    });

    expect(policy.corsOrigins).toEqual(["https://app.soundmeet.com.br"]);
    expect(policy.corsOrigins.some((o) => o.includes("localhost"))).toBe(false);
  });

  it("aceita lista separada por vírgula, com espaços", () => {
    const policy = resolveHttpSecurityPolicy({
      cors_allowed_origins: " https://a.com , https://b.com ",
    });

    expect(policy.corsOrigins).toEqual(["https://a.com", "https://b.com"]);
  });

  it("soma FRONTEND_URL sem duplicar o que já está na lista", () => {
    const policy = resolveHttpSecurityPolicy({
      cors_allowed_origins: "https://a.com,https://b.com",
      frontend_url: "https://a.com",
    });

    expect(policy.corsOrigins).toEqual(["https://a.com", "https://b.com"]);
  });

  it("mantém FRONTEND_URL quando ele não está na lista (deploys antigos)", () => {
    const policy = resolveHttpSecurityPolicy({
      cors_allowed_origins: "https://a.com",
      frontend_url: "https://legado.com",
    });

    expect(policy.corsOrigins).toEqual(["https://a.com", "https://legado.com"]);
  });

  it("descarta entradas vazias em vez de autorizar a string vazia", () => {
    const policy = resolveHttpSecurityPolicy({
      cors_allowed_origins: ",,https://a.com,,",
      frontend_url: "",
    });

    expect(policy.corsOrigins).toEqual(["https://a.com"]);
  });

  it("sem nenhuma origem configurada, não autoriza ninguém", () => {
    expect(resolveHttpSecurityPolicy({}).corsOrigins).toEqual([]);
  });
});

describe("resolveHttpSecurityPolicy — Swagger (SM-020)", () => {
  /**
   * O default inverte por ambiente porque o custo do engano é assimétrico:
   * esquecer de ligar em dev custa uma variável, esquecer de desligar em
   * produção publica o contrato inteiro da API.
   */
  it("fica DESLIGADO por padrão em produção", () => {
    expect(
      resolveHttpSecurityPolicy({ node_env: "production" }).swaggerEnabled,
    ).toBe(false);
  });

  it("fica ligado por padrão fora de produção", () => {
    expect(
      resolveHttpSecurityPolicy({ node_env: "development" }).swaggerEnabled,
    ).toBe(true);
  });

  it("respeita a variável explícita nos dois sentidos", () => {
    expect(
      resolveHttpSecurityPolicy({
        node_env: "production",
        swagger_enabled: true,
      }).swaggerEnabled,
    ).toBe(true);
    expect(
      resolveHttpSecurityPolicy({
        node_env: "development",
        swagger_enabled: false,
      }).swaggerEnabled,
    ).toBe(false);
  });
});

describe("buildHelmetOptions — CSP e HSTS (SM-020)", () => {
  const directivesOf = (options: ReturnType<typeof buildHelmetOptions>) =>
    (options.contentSecurityPolicy as any).directives as Record<
      string,
      string[]
    >;

  it("sem Swagger, a CSP é mínima — nada de inline", () => {
    const directives = directivesOf(
      buildHelmetOptions({ isProduction: true, swaggerEnabled: false }),
    );

    expect(directives.defaultSrc).toEqual(["'none'"]);
    expect(directives.scriptSrc).toBeUndefined();
  });

  /**
   * O `'unsafe-inline'` existe só porque o Swagger UI não renderiza sem ele.
   * Amarrado ao interruptor da documentação, some junto com ela em produção —
   * que é o ponto: um relaxamento permanente "porque o Swagger pode precisar"
   * ficaria valendo onde o Swagger nem existe.
   */
  it("com Swagger, relaxa o inline — e SÓ ele", () => {
    const directives = directivesOf(
      buildHelmetOptions({ isProduction: false, swaggerEnabled: true }),
    );

    expect(directives.scriptSrc).toContain("'unsafe-inline'");
    expect(directives.styleSrc).toContain("'unsafe-inline'");
    expect(directives.frameAncestors).toEqual(["'none'"]);
    expect(directives.baseUri).toEqual(["'none'"]);
    expect(directives.formAction).toEqual(["'none'"]);
  });

  it("clickjacking e base-tag ficam bloqueados nos dois modos", () => {
    for (const swaggerEnabled of [true, false]) {
      const directives = directivesOf(
        buildHelmetOptions({ isProduction: true, swaggerEnabled }),
      );
      expect(directives.frameAncestors).toEqual(["'none'"]);
      expect(directives.baseUri).toEqual(["'none'"]);
    }
  });

  it("HSTS só em produção — em dev travaria o navegador em https por um ano", () => {
    expect(
      buildHelmetOptions({ isProduction: true, swaggerEnabled: false }).hsts,
    ).toMatchObject({ maxAge: 31_536_000, includeSubDomains: true });
    expect(
      buildHelmetOptions({ isProduction: false, swaggerEnabled: true }).hsts,
    ).toBe(false);
  });
});
