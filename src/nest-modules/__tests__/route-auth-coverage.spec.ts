import {
  GUARDS_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";

import { AppModule } from "../../app.module";
import { IS_PUBLIC_KEY } from "../auth-module/auth.decorators";
import { INTERNAL_TOKEN_KEY } from "../auth-module/internal-token.decorator";
import { InternalTokenGuard } from "../auth-module/internal-token.guard";

/**
 * 🔴 AUTH-2 — a regressão que faz a OMISSÃO falhar alto.
 *
 * No Nest, "não autenticado" é o default: uma rota sem `@UseGuards(AuthGuard)`
 * nasce pública, e esquecer o guard não quebra o build, não quebra o boot e não
 * quebra nenhum teste. Foi exatamente assim que `GET /synced-lyrics/search`
 * virou proxy grátis da LRCLIB (SM-026) — sem guard e sem `@Public()`, anônima
 * por acidente.
 *
 * Desde AUTH-2 o `AuthGuard` é `APP_GUARD` global, então o default inverteu:
 * toda rota exige JWT a menos que alguém escreva `@Public()`. Este teste fecha o
 * outro lado da porta — a lista abaixo é a **única** autorização para uma rota
 * anônima existir.
 *
 * ⚠️ **Se este teste falhar porque você criou uma rota nova, NÃO adicione a
 * rota na lista para o vermelho sumir.** Pergunte primeiro por que ela é
 * pública. Rota de webhook, callback de OAuth, healthcheck, página pública de
 * perfil e verificação de contrato: sim. Qualquer coisa que leia ou escreva
 * dado de um usuário identificado: não.
 *
 * O teste varre o grafo de módulos a partir do `AppModule`, então um módulo
 * novo entra na cobertura sozinho — não há lista de controllers para manter
 * desatualizada.
 */

type Ctor = new (...args: never[]) => unknown;

/** Descobre todos os controllers alcançáveis a partir do AppModule. */
function collectControllers(rootModule: unknown): Ctor[] {
  const seen = new Set<unknown>();
  const controllers = new Set<Ctor>();
  const queue: unknown[] = [rootModule];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    // `imports` aceita classe, DynamicModule (`{ module, ... }`) e
    // `forwardRef` (`{ forwardRef: () => Module }`). Normalizamos os três; o
    // que não for nenhum deles é ignorado em vez de derrubar a varredura.
    const target =
      typeof current === "object" && current !== null
        ? ((current as { module?: unknown }).module ??
          (current as { forwardRef?: () => unknown }).forwardRef?.() ??
          current)
        : current;

    if (target !== current && target && !seen.has(target)) {
      queue.push(target);
      continue;
    }

    if (typeof target !== "function" && typeof target !== "object") continue;

    for (const c of (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, target) ??
      []) as Ctor[]) {
      if (typeof c === "function") controllers.add(c);
    }

    for (const imported of (Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      target,
    ) ?? []) as unknown[]) {
      queue.push(imported);
    }
  }

  return [...controllers];
}

type Handler = {
  controller: string;
  method: string;
  route: string;
  isPublic: boolean;
};

function collectHandlers(controller: Ctor): Handler[] {
  const basePath = String(Reflect.getMetadata(PATH_METADATA, controller) ?? "");
  const proto = controller.prototype as Record<string, unknown>;

  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== "constructor")
    .map((name) => proto[name])
    .filter(
      (fn): fn is (...args: never[]) => unknown => typeof fn === "function",
    )
    .filter((fn) => Reflect.getMetadata(METHOD_METADATA, fn) !== undefined)
    .map((fn) => {
      const path = String(Reflect.getMetadata(PATH_METADATA, fn) ?? "");
      return {
        controller: controller.name,
        method: fn.name,
        route: `${basePath}/${path}`.replace(/\/+/g, "/").replace(/\/$/, ""),
        // `@Public()` na classe vale para todos os handlers dela — mesma
        // resolução que `reflector.getAllAndOverride` faz em runtime.
        isPublic:
          Reflect.getMetadata(IS_PUBLIC_KEY, fn) === true ||
          Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true,
      };
    });
}

/**
 * Toda rota anônima do sistema, com o motivo. `controller.método`.
 *
 * As quatro marcadas como "worker" NÃO são abertas: o `InternalTokenGuard`
 * continua exigindo o header `x-ai-*-token`, fail-closed. `@Public()` ali quer
 * dizer "sem JWT de usuário", porque quem chama é um processo, não uma pessoa.
 */
const ALLOWED_PUBLIC_HANDLERS: Record<string, string> = {
  // ── Infra ──────────────────────────────────────────────────────────────────
  "HealthController.health": "healthcheck do Docker/load balancer",

  // ── Nascimento de sessão: não há JWT a exigir antes de a conta existir ──────
  "AuthController.register": "cadastro do músico/público (throttle 5/min)",
  "AuthController.registerEstablishment": "cadastro do estabelecimento (web)",
  "AuthController.verifyEmailLegacy":
    "link LEGADO nos e-mails já enviados; hoje só redireciona para a página do web",
  "AuthController.verifyEmailStatus":
    "consulta (não consome) o token do e-mail; é o que a página do web lê",
  "AuthController.confirmEmail":
    "confirma o e-mail; a credencial é o próprio token, não há JWT a exigir",
  "AuthController.resendVerification":
    "reenvia o link; quem pede ainda não tem sessão (throttle 3/min)",

  // ── Webhooks e callbacks OAuth ─────────────────────────────────────────────
  // Autenticados por assinatura/token do provedor, nunca por JWT. Ficam em
  // controllers separados de propósito: um `@Public()` solto num controller com
  // `@UseGuards` expõe rota autenticada sem querer.
  "AsaasWebhookController.handleEvent": "webhook Asaas (token constant-time)",
  "MercadoPagoWebhookController.handleEvent": "webhook MP (HMAC x-signature)",
  "MercadoPagoCallbackController.callback": "callback OAuth do Mercado Pago",
  "SpotifyCallbackController.callback": "callback OAuth do Spotify",
  "GoogleCalendarCallbackController.callback":
    "callback OAuth do Google Calendar",

  // ── Rotas de worker: sem JWT de usuário, COM token interno ─────────────────
  // 🔴 Não são abertas. `InternalTokenGuard` continua exigindo o header
  // `x-ai-*-token` e é fail-closed (sem token configurado, 403). `@Public()`
  // aqui significa "quem chama é um processo, não uma pessoa".
  "AiAudioController.updateSeparationProgress": "worker de separação de stems",
  "AiCifraController.updateProgress": "worker MIR (progresso)",
  "AiCifraController.complete": "worker MIR (conclusão)",
  "AiCifraController.fail": "worker MIR (falha)",

  // ── Catálogo público: o funil de aquisição do produto ──────────────────────
  // O QR leva um estranho a um perfil sem que ele tenha conta. Estas rotas têm
  // soft-auth: com Bearer válido o dono vê os campos completos, sem token o
  // estranho vê a versão sem PII (ver `PublicMusicianPresenter`).
  "MusiciansController.findAll": "busca pública de músicos",
  "MusiciansController.findOne": "perfil público do músico (destino do QR)",
  "EstablishmentsController.findAll": "busca pública de estabelecimentos",
  "EstablishmentsController.findOne": "perfil público do local (CPF mascarado)",
  "BandsController.findAll": "busca pública de bandas",
  "BandsController.findOne": "perfil público da banda",
  "EventsController.listEvents": "agenda pública de shows",
  "EventsController.listActiveEvents": "shows acontecendo agora",
  "EventsController.getEvent": "página pública do evento",
  "EventsController.listPerformers": "line-up público do evento",
  "EventsDiscoveryController.findAll": "descoberta de eventos por proximidade",
  "PublicRepertoireController.list": "repertório público do músico",
  "RepertoirePublicController.getShared": "repertório compartilhado por link",
  "RepertoirePublicController.getSharedChordSheet":
    "cifra de repertório compartilhado",
  "MusicianRatingsController.list": "avaliações públicas do músico",
  "EstablishmentRatingsController.list": "avaliações públicas do local",
  "PlansController.listPlans": "catálogo de planos (paywall antes de assinar)",

  // ── Gamificação: ranking é público por desenho de produto ──────────────────
  "GamificationController.leaderboard": "leaderboard público",
  "GamificationController.listRankings": "rankings públicos",
  "GamificationController.listBadges": "catálogo de badges",
  "GamificationController.getBadge": "badge individual",

  // ── Agenda: free/busy sem PII, para exibir disponibilidade antes do login ──
  "CalendarController.getFreeBusy": "intervalos ocupados, sem PII",
  "CalendarController.getMonthSlots": "slots do mês, sem PII",

  // ── Verificação de contrato ────────────────────────────────────────────────
  // Existe para um terceiro conferir a autenticidade do documento sem conta.
  // Nomes saem mascarados; a entropia do código é o que impede enumerar.
  "ContractVerificationController.verify": "verificação pública de contrato",
};

/**
 * As rotas que `@Public()` libera do JWT mas que continuam autenticadas por
 * token de processo. O valor esperado é o par exato — trocar o `envKey` por um
 * que não existe na config faria o guard responder 403 sempre (fail-closed,
 * mas a pipeline de IA para); trocar o `headerName` faria o worker mandar um
 * header que ninguém lê.
 */
const WORKER_HANDLERS: Record<string, { envKey: string; headerName: string }> =
  {
    "AiAudioController.updateSeparationProgress": {
      envKey: "AI_AUDIO_PROGRESS_TOKEN",
      headerName: "x-ai-audio-progress-token",
    },
    "AiCifraController.updateProgress": {
      envKey: "AI_CIFRA_PROGRESS_TOKEN",
      headerName: "x-ai-cifra-progress-token",
    },
    "AiCifraController.complete": {
      envKey: "AI_CIFRA_PROGRESS_TOKEN",
      headerName: "x-ai-cifra-progress-token",
    },
    "AiCifraController.fail": {
      envKey: "AI_CIFRA_PROGRESS_TOKEN",
      headerName: "x-ai-cifra-progress-token",
    },
  };

describe("Cobertura de autenticação das rotas HTTP (AUTH-2)", () => {
  const controllers = collectControllers(AppModule);
  const handlers = controllers.flatMap(collectHandlers);

  it("encontra os controllers do AppModule (guarda contra varredura vazia)", () => {
    // Sem esta âncora, um erro na varredura faria o teste passar por não achar
    // nada — o pior resultado possível para um teste de segurança.
    expect(controllers.length).toBeGreaterThanOrEqual(40);
    expect(handlers.length).toBeGreaterThanOrEqual(200);
  });

  it("não tem rota @Public() fora da allowlist", () => {
    const unexpected = handlers
      .filter((h) => h.isPublic)
      .map((h) => `${h.controller}.${h.method}`)
      .filter((key) => !(key in ALLOWED_PUBLIC_HANDLERS))
      .sort();

    expect(unexpected).toEqual([]);
  });

  it("não tem entrada obsoleta na allowlist", () => {
    // Uma rota que deixou de ser pública tem que sair da lista, senão a lista
    // vira folclore e para de significar alguma coisa.
    const actual = new Set(
      handlers
        .filter((h) => h.isPublic)
        .map((h) => `${h.controller}.${h.method}`),
    );

    const stale = Object.keys(ALLOWED_PUBLIC_HANDLERS)
      .filter((key) => !actual.has(key))
      .sort();

    expect(stale).toEqual([]);
  });

  it("nenhuma rota de escrita é pública, exceto as de nascimento de sessão e as de máquina", () => {
    // O corte que importa: um GET público expõe leitura; um POST/PATCH/DELETE
    // público aceita ESCRITA anônima. As exceções são explícitas e poucas.
    const WRITE_EXCEPTIONS = new Set([
      "AuthController.register",
      "AuthController.registerEstablishment",
      // Prova de posse de e-mail — ver EMAIL_PROOF_HANDLERS abaixo.
      "AuthController.confirmEmail",
      "AuthController.resendVerification",
      "AsaasWebhookController.handleEvent",
      "MercadoPagoWebhookController.handleEvent",
      "AiAudioController.updateSeparationProgress",
      "AiCifraController.updateProgress",
      "AiCifraController.complete",
      "AiCifraController.fail",
    ]);

    const publicWrites = handlers
      .filter((h) => h.isPublic)
      .filter((h) => {
        const proto = (controllers.find((c) => c.name === h.controller) as Ctor)
          .prototype as Record<string, unknown>;
        const verb = Reflect.getMetadata(
          METHOD_METADATA,
          proto[h.method] as object,
        );
        // RequestMethod: 0 GET, 1 POST, 2 PUT, 3 DELETE, 4 PATCH
        return verb !== 0;
      })
      .map((h) => `${h.controller}.${h.method}`)
      .filter((key) => !WRITE_EXCEPTIONS.has(key))
      .sort();

    expect(publicWrites).toEqual([]);
  });

  /*
   * ────────────────────────────────────────────────────────────────────────
   * 🔴 As rotas de worker: `@Public()` sem token interno é rota ABERTA.
   * ────────────────────────────────────────────────────────────────────────
   *
   * A allowlist acima AFIRMA que estas quatro continuam autenticadas pelo
   * `InternalTokenGuard`. Até aqui isso era só um comentário: nada verificava,
   * e as quatro são POST — estão em `WRITE_EXCEPTIONS`, então perder o guard
   * não faria falhar nenhum dos testes anteriores. O resultado seria escrita
   * anônima no progresso/conclusão de job de IA, vinda de qualquer um que
   * alcance a rede.
   *
   * São DUAS asserções, e a segunda é a que quase ninguém escreve: o
   * `InternalTokenGuard` faz `if (!metadata) return true` — sem o decorator
   * `@InternalToken(...)` ele passa direto. Ou seja, `@UseGuards(...)` sozinho
   * é decorativo, e a falha é exatamente do tipo que este item existe para
   * pegar: silenciosa e aberta.
   */
  describe("rotas de worker continuam atrás do token interno", () => {
    const findHandler = (key: string) => {
      const [controllerName, methodName] = key.split(".");
      const controller = controllers.find((c) => c.name === controllerName);
      expect(controller).toBeDefined();
      const fn = (controller!.prototype as Record<string, unknown>)[methodName];
      expect(typeof fn).toBe("function");
      return { controller: controller!, fn: fn as object };
    };

    it.each(Object.keys(WORKER_HANDLERS))(
      "%s tem @UseGuards(InternalTokenGuard)",
      (key) => {
        const { controller, fn } = findHandler(key);
        const guards = [
          ...((Reflect.getMetadata(GUARDS_METADATA, fn) ?? []) as unknown[]),
          ...((Reflect.getMetadata(GUARDS_METADATA, controller) ??
            []) as unknown[]),
        ];

        expect(guards).toContain(InternalTokenGuard);
      },
    );

    it.each(Object.entries(WORKER_HANDLERS))(
      "%s declara @InternalToken com o env e o header certos",
      (key, expected) => {
        const { controller, fn } = findHandler(key);
        const metadata =
          Reflect.getMetadata(INTERNAL_TOKEN_KEY, fn) ??
          Reflect.getMetadata(INTERNAL_TOKEN_KEY, controller);

        // Sem esta metadata o guard acima retorna `true` sem olhar header
        // nenhum — o `@UseGuards` viraria decoração e a rota, aberta.
        expect(metadata).toEqual(expected);
      },
    );

    it("toda rota @Public() de escrita OU é nascimento de sessão, OU tem token interno", () => {
      // Fecha o outro lado: se alguém adicionar um `@Post()` público novo, ele
      // precisa cair num dos dois baldes explicitamente.
      const SESSION_BIRTH_OR_PROVIDER = new Set([
        "AuthController.register",
        "AuthController.registerEstablishment",
        "AsaasWebhookController.handleEvent",
        "MercadoPagoWebhookController.handleEvent",
      ]);

      /*
       * Terceiro balde, explícito em vez de embutido no primeiro: estas duas
       * não nascem sessão nenhuma e não são provedor. A credencial delas é o
       * TOKEN DO E-MAIL — alta entropia, uso único, TTL de 24h, guardado como
       * hash. Exigir JWT aqui seria exigir que a pessoa já estivesse logada
       * para provar que o e-mail é dela.
       *
       * `confirmEmail` é POST (e não GET) porque CONSOME o token: num GET, o
       * prefetch dos scanners de link de e-mail o queimaria antes do usuário
       * clicar. `resendVerification` responde sempre a mesma mensagem, exista
       * ou não conta — senão viraria oráculo de enumeração de cadastros.
       */
      const EMAIL_PROOF_HANDLERS = new Set([
        "AuthController.confirmEmail",
        "AuthController.resendVerification",
      ]);

      const publicWrites = handlers
        .filter((h) => h.isPublic)
        .filter((h) => {
          const proto = (
            controllers.find((c) => c.name === h.controller) as Ctor
          ).prototype as Record<string, unknown>;
          return (
            Reflect.getMetadata(METHOD_METADATA, proto[h.method] as object) !==
            0
          );
        })
        .map((h) => `${h.controller}.${h.method}`);

      const unaccounted = publicWrites
        .filter((key) => !SESSION_BIRTH_OR_PROVIDER.has(key))
        .filter((key) => !EMAIL_PROOF_HANDLERS.has(key))
        .filter((key) => !(key in WORKER_HANDLERS))
        .sort();

      expect(unaccounted).toEqual([]);
    });
  });
});
