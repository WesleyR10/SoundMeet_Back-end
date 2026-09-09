import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";

import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../global-config";

/**
 * 🔴 INP-1 — a regressão que faz a AUSÊNCIA do alarme falhar alto.
 *
 * `whitelist: true` já impedia o mass-assignment antes deste item: o campo
 * extra some do corpo e nunca chega ao handler. O que faltava era a DETECÇÃO —
 * o descarte é silencioso por desenho, então ninguém nunca soube que alguém
 * tentou mandar `is_admin`, `balance` ou `plan_tier` num PATCH.
 *
 * `forbidNonWhitelisted` transforma a tentativa em 422 registrado. E é uma
 * linha só: apagá-la não quebra compilação, não quebra boot e — antes deste
 * arquivo — não quebrava teste nenhum, porque as três specs de DTO montavam o
 * próprio pipe e seguiam descrevendo o comportamento antigo. Este arquivo
 * existe para que a defesa não possa ser desligada em silêncio.
 */

class NestedDto {
  @IsString()
  keep: string;
}

class SampleDto {
  @IsUUID()
  id: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NestedDto)
  nested?: NestedDto;
}

const pipe = new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS);
const META: ArgumentMetadata = { type: "body", metatype: SampleDto };
const ID = "11111111-1111-4111-8111-111111111111";

describe("ValidationPipe global (INP-1)", () => {
  it("declara a política inteira — nenhuma opção pode sumir em silêncio", () => {
    expect(GLOBAL_VALIDATION_PIPE_OPTIONS).toMatchObject({
      // O contrato de erro do projeto é 422, não 400 — clientes tratam esse
      // código; mudá-lo quebraria o tratamento de erro dos dois frontends.
      errorHttpStatusCode: 422,
      transform: true,
      // A defesa: campo sem decorator nunca chega ao handler.
      whitelist: true,
      // O alarme: a tentativa vira 422 em vez de sumir.
      forbidNonWhitelisted: true,
    });
  });

  it("aceita um corpo que só tem campos declarados", async () => {
    await expect(pipe.transform({ id: ID, note: "ok" }, META)).resolves.toEqual(
      {
        id: ID,
        note: "ok",
      },
    );
  });

  it("🔴 recusa com 422 um campo não declarado, em vez de descartá-lo calado", async () => {
    await expect(
      pipe.transform({ id: ID, is_admin: true }, META),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("nomeia o campo recusado — é o que torna a tentativa investigável no log", async () => {
    // Um 422 genérico não serviria: o valor do item é saber O QUE foi tentado.
    await expect(
      pipe.transform({ id: ID, plan_tier: "PRO" }, META),
    ).rejects.toMatchObject({
      response: { message: ["property plan_tier should not exist"] },
    });
  });

  it("a recusa alcança o objeto ANINHADO, não só o topo", async () => {
    // `stageTechSpec.dimensions` do estabelecimento é exatamente esse caso: o
    // campo hostil viaja dentro de uma subestrutura validada.
    await expect(
      pipe.transform({ id: ID, nested: { keep: "x", injected: "y" } }, META),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("não vaza o valor enviado na mensagem de erro", async () => {
    // `validationError: { value: false }` — o corpo recusado pode conter senha
    // ou CPF, e a mensagem de erro vai para o log e para o cliente.
    let payload: unknown;
    try {
      await pipe.transform({ id: ID, secret: "s3nh4-do-usuario" }, META);
    } catch (error) {
      payload = (error as { getResponse: () => unknown }).getResponse();
    }

    expect(JSON.stringify(payload)).not.toContain("s3nh4-do-usuario");
  });
});

/**
 * 🔴 Guarda de compilador.
 *
 * `forbidNonWhitelisted` reprova qualquer propriedade PRÓPRIA da instância que
 * não tenha decorator de validação. Isso torna o comportamento sensível a como
 * o compilador trata `campo: string;` (declaração sem inicializador):
 *
 *  - `tsc` com `useDefineForClassFields: false` (o `tsconfig.json` deste repo):
 *    não emite nada, a instância nasce sem a propriedade;
 *  - `SWC` com o default: emite `_define_property(this, "campo", void 0)`, e a
 *    propriedade passa a EXISTIR com valor `undefined`.
 *
 * Com `whitelist` sozinho a diferença era inócua (a propriedade era removida
 * nos dois casos). Com `forbidNonWhitelisted` ela decide se um corpo LEGÍTIMO
 * é aceito ou recusado — e o repo compila com os dois: `npm run build` usa
 * `--builder tsc`, o Jest usa `@swc/jest`, e o `nest-cli.json` declara
 * `"builder": "swc"`. O `.swcrc` fixa `useDefineForClassFields: false` para que
 * os dois concordem; este teste é o que faz a divergência voltar a falhar.
 */
describe("Semântica de campo de classe (tsc ↔ SWC)", () => {
  class OnlyDeclared {
    declarado?: string | null;
  }

  it("campo declarado sem inicializador não vira propriedade da instância", () => {
    expect(Object.getOwnPropertyNames(new OnlyDeclared())).toEqual([]);
  });
});
