import { Contract } from "../../contract.aggregate";
import { ContractFakeBuilder } from "../../contract-fake.builder";
import { ContractVariables } from "../contract-variables.vo";

/**
 * O Anexo I dentro do snapshot — e a compatibilidade que isso exigiu.
 *
 * `ficha_tecnica_anexo` entrou em `ContractVariables` em 16/ago/2026 para pôr o
 * Anexo I dentro do `content_hash`. Até então o anexo era lido do perfil VIVO
 * na hora de renderizar e ficava de fora: o mesmo contrato reemitido depois de
 * o bar editar a ficha saía com anexo diferente e hash idêntico — enquanto a
 * cláusula `estrutura_tecnica.com_anexo` transforma "item declarado no Anexo I"
 * em inadimplemento.
 *
 * Acrescentar chave a um snapshot congelado é operação perigosa neste domínio:
 * `ContractModelMapper.toEntity` **recalcula** o hash na carga e recusa o
 * contrato se divergir. Uma chave nova que aparecesse como `null` na
 * serialização faria TODO contrato já emitido parar de carregar com
 * `LoadEntityError`. Este arquivo é o que garante que isso não acontece — e que
 * continua não acontecendo.
 */

const CONTEXTO_COM_FICHA = {
  ...ContractFakeBuilder.defaultContext(),
  has_stage_tech_spec: true,
};

const CONTEXTO_SEM_FICHA = {
  ...ContractFakeBuilder.defaultContext(),
  has_stage_tech_spec: false,
};

/** Reordena as chaves como o `jsonb` do Postgres: por tamanho, depois byte a byte. */
function comoJsonb(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comoJsonb);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
      .map((key) => [key, comoJsonb((value as Record<string, unknown>)[key])]),
  );
}

/** O hash exatamente como o mapper o recalcula na carga. */
function hashDe(variables: ContractVariables): string {
  return Contract.computeContentHash({
    template_version: "show-v1",
    contractor: ContractFakeBuilder.defaultContractor(),
    contracted: ContractFakeBuilder.defaultContracted(),
    variables,
    clauses: [],
  });
}

describe("ContractVariables — Anexo I no snapshot", () => {
  it("congela a ficha inteira, não só o resumo", () => {
    const variables = ContractFakeBuilder.variablesFor(CONTEXTO_COM_FICHA);

    expect(variables.ficha_tecnica_anexo).toMatchObject({
      hasPa: true,
      monitors: 4,
      backline: ["bateria", "cubo de guitarra"],
    });
    // O resumo continua existindo: é o que a cláusula interpola no corpo. O
    // anexo é a seção do documento. Papéis diferentes, não redundância.
    expect(variables.ficha_tecnica_resumo).toBeTruthy();
  });

  it("entra no content_hash — trocar a ficha muda o resumo criptográfico", () => {
    const original = ContractFakeBuilder.variablesFor(CONTEXTO_COM_FICHA);

    const adulterado = new ContractVariables({
      ...original.toJSON(),
      ficha_tecnica_anexo: {
        ...original.ficha_tecnica_anexo!,
        monitors: 1,
      },
    });

    // Era exatamente isto que falhava antes: o anexo mudava e o hash não.
    expect(hashDe(adulterado)).not.toBe(hashDe(original));
  });

  it("some da serialização quando não há ficha", () => {
    const variables = ContractFakeBuilder.variablesFor(CONTEXTO_SEM_FICHA);
    const json = variables.toJSON();

    expect("ficha_tecnica_anexo" in json).toBe(false);
    expect(JSON.stringify(json)).not.toContain("ficha_tecnica_anexo");
  });
});

describe("ContractVariables — compatibilidade do content_hash (🔴 não relaxar)", () => {
  /**
   * Um contrato gravado ANTES de `ficha_tecnica_anexo` existir: a coluna `Json`
   * simplesmente não tem a chave.
   */
  function snapshotAnteriorAMudanca(): Record<string, unknown> {
    const json = {
      ...ContractFakeBuilder.variablesFor(CONTEXTO_COM_FICHA).toJSON(),
    } as Record<string, unknown>;
    delete json.ficha_tecnica_anexo;
    return json;
  }

  it("contrato antigo continua carregando com o hash intacto", () => {
    const armazenado = snapshotAnteriorAMudanca();

    /*
     * Simula o ciclo real: o hash foi calculado na emissão, ANTES da chave
     * existir; o mapper reidrata o VO a partir do JSON do banco e recalcula.
     * Se divergir, `toEntity` lança `LoadEntityError` e o contrato — que pode
     * estar assinado pelas duas partes — some do sistema.
     */
    const naEmissao = hashDe(ContractVariables.fromJSON(armazenado));
    const naCarga = hashDe(ContractVariables.fromJSON(armazenado));

    expect(naCarga).toBe(naEmissao);
    expect(
      JSON.stringify(ContractVariables.fromJSON(armazenado).toJSON()),
    ).toBe(JSON.stringify(armazenado));
  });

  it("`null` no lugar da ausência não consegue quebrar o hash", () => {
    /*
     * 🔴 Este é o teste que protege a invariante inteira.
     *
     * `JSON.stringify` OMITE `undefined` e INCLUI `null`. Se um chamador
     * distraído — ou um "?? null" copiado dos campos vizinhos — fizesse a chave
     * chegar como `null`, o canônico ganharia `"ficha_tecnica_anexo":null` e
     * todo contrato antigo passaria a falhar na carga. O construtor apaga a
     * chave para qualquer valor que não seja objeto, então as duas formas
     * produzem exatamente o mesmo hash.
     */
    const armazenado = snapshotAnteriorAMudanca();

    const ausente = ContractVariables.fromJSON(armazenado);
    const comNull = ContractVariables.fromJSON({
      ...armazenado,
      ficha_tecnica_anexo: null,
    });

    expect(hashDe(comNull)).toBe(hashDe(ausente));
    expect("ficha_tecnica_anexo" in comNull.toJSON()).toBe(false);
  });

  it.each([null, undefined, "PA e 4 retornos", 42, ["bateria"]])(
    "valor não-objeto (%p) vira ausência, nunca entra no documento",
    (valor) => {
      const variables = ContractVariables.fromJSON({
        ...snapshotAnteriorAMudanca(),
        ficha_tecnica_anexo: valor,
      });

      // Array incluído de propósito: `typeof [] === "object"`, e um anexo que
      // fosse array renderizaria uma tabela vazia em vez de não renderizar nada.
      expect(variables.ficha_tecnica_anexo).toBeUndefined();
      expect("ficha_tecnica_anexo" in variables.toJSON()).toBe(false);
    },
  );

  it("o anexo sobrevive ao `jsonb`, que REORDENA as chaves (🔴 14/set/2026)", () => {
    /*
     * A coluna `variables` é `jsonb`, e o Postgres devolve as chaves de objeto
     * ordenadas por tamanho e depois byte a byte — não na ordem gravada.
     * `computeContentHash` é `JSON.stringify` sobre o `toJSON()`, que é
     * sensível à ordem. Com o anexo guardado verbatim, TODO contrato de casa
     * com ficha técnica parava de carregar logo depois de emitido, com
     * `LoadEntityError` de "integridade violada".
     *
     * Nenhum teste pegava: o repositório in-memory devolve o mesmo objeto, sem
     * round-trip de JSON. Só apareceu emitindo pelo use-case real contra
     * Postgres (seed de 14/set/2026).
     */
    const naEmissao = ContractFakeBuilder.variablesFor(CONTEXTO_COM_FICHA);
    const doBanco = comoJsonb(naEmissao.toJSON()) as Record<string, unknown>;

    // Pré-condição: a simulação reordena o anexo de fato.
    expect(Object.keys(doBanco.ficha_tecnica_anexo as object)).not.toEqual(
      Object.keys(naEmissao.ficha_tecnica_anexo!),
    );
    expect(hashDe(ContractVariables.fromJSON(doBanco))).toBe(hashDe(naEmissao));
  });

  it("a chave está na whitelist canônica — sem isso ela sumiria do snapshot", () => {
    // `CONTRACT_VARIABLE_KEYS` é o que `toJSON` percorre. Uma chave fora dela
    // existiria no tipo e desapareceria do documento, em silêncio.
    const comFicha = ContractFakeBuilder.variablesFor(CONTEXTO_COM_FICHA);

    expect(Object.keys(comFicha.toJSON())).toContain("ficha_tecnica_anexo");
  });
});
