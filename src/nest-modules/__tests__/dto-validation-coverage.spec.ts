import {
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import { getMetadataStorage } from "class-validator";

import { AppModule } from "../../app.module";

/**
 * 🔴 Um DTO sem NENHUM decorator de validação não dá erro — ele apaga o input.
 *
 * O `ValidationPipe` global roda com `whitelist: true`: toda propriedade sem
 * metadata de validação é REMOVIDA antes de o handler ver. Se a classe inteira
 * não tem decorator, o handler recebe `{}` — e a rota responde 200 fazendo
 * silenciosamente nada com o que o cliente mandou.
 *
 * Foi o caso de `RecommendMusiciansDto` (achado em 01/set/2026): ele declarava
 * `implements Omit<RecommendMusiciansInput, "audience_id">`, e **`implements` é
 * contrato de TIPO — some na compilação e não carrega metadata para o runtime**.
 * Só `extends` de classe herda validação. Resultado: `page`, `per_page` e
 * `only_active` do carrossel "Pra você" chegavam `undefined` em toda
 * requisição; a paginação daquela rota nunca funcionou e o `only_active=true`
 * que o app manda nunca filtrou nada. Depois do INP-1 o mesmo defeito virou
 * 422 e derrubou o carrossel.
 *
 * Este teste varre o grafo de módulos a partir do `AppModule` — módulo novo
 * entra sozinho — e exige que toda classe usada em `@Body()`/`@Query()` tenha
 * pelo menos uma propriedade validada.
 *
 * ⚠️ **Se falhar num DTO novo, não adicione exceção.** Ou a classe deve
 * `extends` o input do core (que tem os decorators), ou ela precisa dos seus.
 * Um `implements` é o sintoma clássico.
 */

type Ctor = new (...args: never[]) => unknown;

function collectControllers(rootModule: unknown): Ctor[] {
  const seen = new Set<unknown>();
  const controllers = new Set<Ctor>();
  const queue: unknown[] = [rootModule];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

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

/** RouteParamtypes do Nest: 3 = @Body, 4 = @Query. */
const VALIDATED_SOURCES: Record<number, string> = { 3: "@Body", 4: "@Query" };
const PRIMITIVES: unknown[] = [String, Number, Boolean, Object, Array];

type Target = { dto: string; source: string; where: string; props: number };

function collectTargets(controllers: Ctor[]): Target[] {
  const storage = getMetadataStorage();
  const targets = new Map<string, Target>();

  for (const controller of controllers) {
    const proto = controller.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === "constructor") continue;
      const fn = proto[name];
      if (typeof fn !== "function") continue;
      if (Reflect.getMetadata(METHOD_METADATA, fn) === undefined) continue;

      const args = Reflect.getMetadata(
        ROUTE_ARGS_METADATA,
        controller,
        name,
      ) as Record<string, { data?: unknown }> | undefined;
      if (!args) continue;

      const paramTypes = (Reflect.getMetadata(
        "design:paramtypes",
        proto,
        name,
      ) ?? []) as unknown[];

      for (const key of Object.keys(args)) {
        const [rawSource, rawIndex] = key.split(":");
        const source = VALIDATED_SOURCES[Number(rawSource)];
        // `@Body("campo")` / `@Query("campo")` entregam escalar, não classe.
        if (!source || args[key].data) continue;

        const metatype = paramTypes[Number(rawIndex)];
        if (typeof metatype !== "function") continue;
        if (PRIMITIVES.includes(metatype)) continue;

        const dto = (metatype as Ctor).name;
        const props = new Set(
          storage
            .getTargetValidationMetadatas(metatype, dto, true, false)
            .map((m) => m.propertyName),
        );
        targets.set(dto, {
          dto,
          source,
          where: `${controller.name}.${name}`,
          props: props.size,
        });
      }
    }
  }
  return [...targets.values()];
}

describe("Cobertura de validação dos DTOs de entrada", () => {
  const controllers = collectControllers(AppModule);
  const targets = collectTargets(controllers);

  it("encontra os DTOs (guarda contra varredura vazia)", () => {
    // Sem esta âncora, um erro na varredura faria o teste passar por não achar
    // nada — o pior resultado possível.
    expect(controllers.length).toBeGreaterThanOrEqual(40);
    expect(targets.length).toBeGreaterThanOrEqual(80);
  });

  it("🔴 nenhum DTO de @Body()/@Query() fica sem propriedade validada", () => {
    const mudos = targets
      .filter((t) => t.props === 0)
      .map((t) => `${t.dto} (${t.source} em ${t.where})`)
      .sort();

    expect(mudos).toEqual([]);
  });
});

describe("`implements` não carrega validação para o runtime", () => {
  it("classe que só declara `implements` de um tipo não registra metadata", () => {
    // A prova do mecanismo, para o comentário acima não virar folclore.
    type Contrato = { campo?: string };
    class SoImplements implements Contrato {
      campo?: string;
    }

    const metas = getMetadataStorage().getTargetValidationMetadatas(
      SoImplements,
      "SoImplements",
      true,
      false,
    );

    expect(metas).toHaveLength(0);
  });
});
