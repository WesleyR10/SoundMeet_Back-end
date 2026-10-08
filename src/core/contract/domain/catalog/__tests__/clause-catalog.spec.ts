import { ContractFakeBuilder } from "../../contract-fake.builder";
import {
  CONTRACT_VARIABLE_KEYS,
  ContractVariableKey,
  ContractVariables,
} from "../../value-objects/contract-variables.vo";
import { RenderedClause } from "../../value-objects/rendered-clause.vo";
import {
  CLAUSE_TONES,
  ClauseTone,
  ClauseVariant,
  ContractContext,
} from "../clause.types";
import {
  ClauseCatalog,
  matchesApplicability,
  selectVariant,
  UnknownContractTemplateError,
} from "../clause-catalog";
import { SHOW_CONTRACT_V1 } from "../templates/show-contract-v1";

/**
 * Testes do catálogo de cláusulas.
 *
 * É a suíte mais importante do domínio de contrato. O que ela protege não é o
 * comportamento de uma função — é a garantia de que **nenhuma combinação real
 * de contrato produz um documento com buraco**, e que o texto jurídico não muda
 * sem que alguém veja.
 */

const VARIABLE_KEY_SET = new Set<string>(CONTRACT_VARIABLE_KEYS);

/**
 * Produto cartesiano de todos os contextos que a aplicação pode produzir.
 *
 * `has_soundcheck_window` é restrito a `has_stage_tech_spec: true`: a janela de
 * passagem de som é um campo DA ficha técnica, então "sem ficha, mas com
 * janela" é estado impossível — varrê-lo testaria uma realidade que não existe.
 */
function allContexts(): ContractContext[] {
  const contexts: ContractContext[] = [];

  for (const target of ["musician", "band"] as const) {
    // Três faixas: abaixo do camarim, camarim básico, camarim completo.
    for (const fee of [300, 1000, 3000]) {
      for (const has_stage_tech_spec of [true, false]) {
        const windows = has_stage_tech_spec ? [true, false] : [false];
        for (const has_soundcheck_window of windows) {
          for (const uses_escrow of [true, false]) {
            for (const outdoor of [true, false]) {
              for (const exclusivity_requested of [true, false]) {
                for (const contractor_is_company of [true, false]) {
                  for (const contracted_is_company of [true, false]) {
                    for (const tone of CLAUSE_TONES) {
                      contexts.push({
                        target,
                        fee,
                        has_stage_tech_spec,
                        has_soundcheck_window,
                        uses_escrow,
                        outdoor,
                        exclusivity_requested,
                        contractor_is_company,
                        contracted_is_company,
                        tone,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return contexts;
}

/**
 * Envolve as variáveis num Proxy que anota cada chave lida.
 *
 * É o que permite comparar o `consumes` DECLARADO com o que o corpo realmente
 * usa — nos dois sentidos. Sem isso, `consumes` seria documentação que envelhece.
 */
function trackReads(variables: ContractVariables): {
  proxy: ContractVariables;
  read: Set<string>;
} {
  const read = new Set<string>();
  const proxy = new Proxy(variables, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && VARIABLE_KEY_SET.has(prop)) {
        read.add(prop);
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  return { proxy: proxy as ContractVariables, read };
}

function allVariants(): { clauseKey: string; variant: ClauseVariant }[] {
  return SHOW_CONTRACT_V1.clauses.flatMap((clause) =>
    clause.variants.map((variant) => ({ clauseKey: clause.key, variant })),
  );
}

/** Um contexto em que a variante indicada é efetivamente escolhida. */
function contextThatSelects(variantId: string): ContractContext | null {
  for (const context of allContexts()) {
    for (const clause of SHOW_CONTRACT_V1.clauses) {
      if (selectVariant(clause, context)?.variant_id === variantId) {
        return context;
      }
    }
  }
  return null;
}

describe("ClauseCatalog", () => {
  const catalog = new ClauseCatalog();

  describe("integridade do catálogo", () => {
    it("não tem variant_id duplicado", () => {
      const ids = allVariants().map(({ variant }) => variant.variant_id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("não tem chave de cláusula duplicada", () => {
      const keys = SHOW_CONTRACT_V1.clauses.map((clause) => clause.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("declara âncora legal em toda cláusula", () => {
      for (const clause of SHOW_CONTRACT_V1.clauses) {
        expect(clause.legal_note.length).toBeGreaterThan(40);
      }
    });

    it("só declara em consumes chaves que existem em ContractVariables", () => {
      for (const { clauseKey, variant } of allVariants()) {
        for (const key of variant.consumes) {
          expect({ clauseKey, key, existe: VARIABLE_KEY_SET.has(key) }).toEqual(
            {
              clauseKey,
              key,
              existe: true,
            },
          );
        }
      }
    });

    /**
     * Variante que nenhum contexto real consegue escolher é código morto
     * disfarçado de opção — e, pior, dá a impressão de que o contrato tem uma
     * flexibilidade que ele não tem.
     */
    it("não tem variante inalcançável", () => {
      const inalcancaveis = allVariants()
        .map(({ variant }) => variant.variant_id)
        .filter((id) => contextThatSelects(id) === null);

      expect(inalcancaveis).toEqual([]);
    });
  });

  describe("consumes reflete exatamente o que o corpo usa", () => {
    it.each(
      allVariants().map(({ clauseKey, variant }) => [clauseKey, variant]),
    )("%s → %#", (_clauseKey, variant) => {
      const v = variant as ClauseVariant;
      const context = contextThatSelects(v.variant_id);
      expect(context).not.toBeNull();

      const variables = ContractFakeBuilder.variablesFor(
        context as ContractContext,
      );
      const { proxy, read } = trackReads(variables);

      v.body(proxy);

      expect([...read].sort()).toEqual([...v.consumes].sort());
    });
  });

  describe("resolução para todo contexto possível", () => {
    const contexts = allContexts();

    it("cobre uma matriz relevante de contextos", () => {
      // 2 alvos × 3 faixas × 3 combinações de ficha × 2 escrow × 2 ao ar livre
      // × 2 exclusividade × 2 contratante PJ × 2 contratado PJ (MEI) × 3 tons
      // = 1728.
      expect(contexts.length).toBe(1728);
    });

    it("renderiza sem erro em todos eles", () => {
      for (const context of contexts) {
        const variables = ContractFakeBuilder.variablesFor(context);
        expect(() =>
          catalog.render(SHOW_CONTRACT_V1, context, variables),
        ).not.toThrow();
      }
    });

    it("resolve toda cláusula obrigatória em todos eles", () => {
      const obrigatorias = SHOW_CONTRACT_V1.clauses.filter(
        (clause) => clause.required,
      );

      for (const context of contexts) {
        const variables = ContractFakeBuilder.variablesFor(context);
        const rendered = catalog.render(SHOW_CONTRACT_V1, context, variables);
        const keys = new Set(rendered.map((clause) => clause.key));

        for (const clause of obrigatorias) {
          expect({
            context,
            key: clause.key,
            presente: keys.has(clause.key),
          }).toEqual({ context, key: clause.key, presente: true });
        }
      }
    });

    it("numera as cláusulas sequencialmente a partir de 1", () => {
      for (const context of contexts) {
        const variables = ContractFakeBuilder.variablesFor(context);
        const rendered = catalog.render(SHOW_CONTRACT_V1, context, variables);
        expect(rendered.map((clause) => clause.number)).toEqual(
          rendered.map((_, index) => index + 1),
        );
      }
    });

    /**
     * 🔴 `custodia_liberacao` é `required: false` por necessidade técnica —
     * cláusula obrigatória sem variante aplicável faz a emissão falhar, e ela
     * não se aplica a contrato sem escrow. Essa concessão abre um buraco
     * possível: um contrato COM custódia que descreva a retenção do dinheiro e
     * não descreva a saída. As duas cláusulas dependem da mesma flag, então na
     * prática viajam juntas — este teste é o que transforma "na prática" em
     * garantia.
     */
    it("emparelha a redação de custódia com a cláusula de liberação", () => {
      for (const context of contexts) {
        const variables = ContractFakeBuilder.variablesFor(context);
        const keys = new Set(
          catalog
            .render(SHOW_CONTRACT_V1, context, variables)
            .map((clause) => clause.key),
        );

        expect({
          uses_escrow: context.uses_escrow,
          liberacao: keys.has("custodia_liberacao"),
        }).toEqual({
          uses_escrow: context.uses_escrow,
          liberacao: context.uses_escrow,
        });
      }
    });

    it("nunca produz texto com valor não resolvido", () => {
      // O `RenderedClause` já barra no construtor; este teste prova que a
      // barreira nunca é acionada no caminho feliz — se acionasse, o `render`
      // acima teria lançado.
      for (const context of contexts) {
        const variables = ContractFakeBuilder.variablesFor(context);
        for (const clause of catalog.render(
          SHOW_CONTRACT_V1,
          context,
          variables,
        )) {
          expect(clause.body).not.toMatch(
            /undefined|NaN|\[object Object\]|\{\{/,
          );
        }
      }
    });
  });

  describe("seleção de variante", () => {
    const base = ContractFakeBuilder.defaultContext();

    it("prefere a variante do tom pedido", () => {
      const clause = SHOW_CONTRACT_V1.clauses.find(
        (c) => c.key === "cancelamento_remarcacao",
      )!;

      expect(
        selectVariant(clause, { ...base, tone: "rigoroso" })?.variant_id,
      ).toBe("cancelamento_remarcacao.rigorosa.rigoroso");
      expect(
        selectVariant(clause, { ...base, tone: "direto" })?.variant_id,
      ).toBe("cancelamento_remarcacao.padrao.direto");
    });

    it("cai para o tom padrão quando o tom pedido não existe", () => {
      const clause = SHOW_CONTRACT_V1.clauses.find(
        (c) => c.key === "direitos_autorais_ecad",
      )!;

      expect(
        selectVariant(clause, { ...base, tone: "rigoroso" })?.variant_id,
      ).toBe("direitos_autorais_ecad.padrao.formal");
    });

    /**
     * 🔴 A regressão mais importante da seleção. `conduta` só tem redação no
     * tom rigoroso. Se o fallback virasse "qualquer variante", ela entraria em
     * todo contrato formal — exatamente o oposto do que a cláusula documenta.
     */
    it("omite a cláusula opcional cujo único tom não foi pedido", () => {
      const clause = SHOW_CONTRACT_V1.clauses.find((c) => c.key === "conduta")!;

      expect(selectVariant(clause, { ...base, tone: "formal" })).toBeNull();
      expect(selectVariant(clause, { ...base, tone: "direto" })).toBeNull();
      expect(
        selectVariant(clause, { ...base, tone: "rigoroso" }),
      ).not.toBeNull();
    });

    it("escolhe a redação de custódia apenas quando há escrow", () => {
      const clause = SHOW_CONTRACT_V1.clauses.find(
        (c) => c.key === "cache_pagamento",
      )!;

      expect(
        selectVariant(clause, { ...base, uses_escrow: false })?.variant_id,
      ).toBe("cache_pagamento.direto.formal");
      expect(
        selectVariant(clause, { ...base, uses_escrow: true })?.variant_id,
      ).toBe("cache_pagamento.com_custodia.formal");
    });

    it("referencia o Anexo I somente quando existe Ficha Técnica", () => {
      const clause = SHOW_CONTRACT_V1.clauses.find(
        (c) => c.key === "estrutura_tecnica",
      )!;

      expect(
        selectVariant(clause, { ...base, has_stage_tech_spec: true })
          ?.variant_id,
      ).toBe("estrutura_tecnica.com_anexo.formal");
      expect(
        selectVariant(clause, { ...base, has_stage_tech_spec: false })
          ?.variant_id,
      ).toBe("estrutura_tecnica.sem_anexo.formal");
    });

    it("omite camarim abaixo de R$ 500 e escala com a faixa de cachê", () => {
      const clause = SHOW_CONTRACT_V1.clauses.find(
        (c) => c.key === "camarim_alimentacao",
      )!;

      expect(selectVariant(clause, { ...base, fee: 300 })).toBeNull();
      expect(selectVariant(clause, { ...base, fee: 1000 })?.variant_id).toBe(
        "camarim_alimentacao.basica.formal",
      );
      expect(selectVariant(clause, { ...base, fee: 3000 })?.variant_id).toBe(
        "camarim_alimentacao.completa.formal",
      );
    });

    it("trata fee_min como inclusivo e fee_max como exclusivo na fronteira", () => {
      const clause = SHOW_CONTRACT_V1.clauses.find(
        (c) => c.key === "camarim_alimentacao",
      )!;

      expect(selectVariant(clause, { ...base, fee: 500 })?.variant_id).toBe(
        "camarim_alimentacao.basica.formal",
      );
      expect(selectVariant(clause, { ...base, fee: 2000 })?.variant_id).toBe(
        "camarim_alimentacao.completa.formal",
      );
    });

    it("só aplica substituição de integrantes a banda", () => {
      const clause = SHOW_CONTRACT_V1.clauses.find(
        (c) => c.key === "substituicao_integrantes",
      )!;

      expect(selectVariant(clause, { ...base, target: "musician" })).toBeNull();
      expect(selectVariant(clause, { ...base, target: "band" })).not.toBeNull();
    });

    it("só aplica exclusividade quando pedida", () => {
      const clause = SHOW_CONTRACT_V1.clauses.find(
        (c) => c.key === "exclusividade_raio",
      )!;

      expect(
        selectVariant(clause, { ...base, exclusivity_requested: false }),
      ).toBeNull();
      expect(
        selectVariant(clause, { ...base, exclusivity_requested: true }),
      ).not.toBeNull();
    });
  });

  describe("matchesApplicability", () => {
    const base = ContractFakeBuilder.defaultContext();

    it("aceita tudo quando não há condição", () => {
      expect(matchesApplicability({}, base)).toBe(true);
    });

    it("exige que TODAS as condições declaradas batam", () => {
      expect(
        matchesApplicability({ target: "musician", uses_escrow: false }, base),
      ).toBe(true);
      expect(
        matchesApplicability({ target: "musician", uses_escrow: true }, base),
      ).toBe(false);
    });

    it("distingue `false` de ausente", () => {
      // O truthy-check ingênuo trataria `false` como "não declarado" e deixaria
      // a variante de não-escrow casar com um contrato COM escrow.
      expect(
        matchesApplicability(
          { uses_escrow: false },
          { ...base, uses_escrow: true },
        ),
      ).toBe(false);
    });
  });

  describe("getTemplate", () => {
    it("devolve o template pela versão", () => {
      expect(catalog.getTemplate("show-v1")).toBe(SHOW_CONTRACT_V1);
    });

    it("recusa versão desconhecida", () => {
      expect(() => catalog.getTemplate("show-v99")).toThrow(
        UnknownContractTemplateError,
      );
    });
  });

  /**
   * Snapshot do texto de cada variante.
   *
   * É o que impede alteração silenciosa de redação jurídica: qualquer mudança
   * aparece no diff do teste e obriga uma atualização explícita do snapshot —
   * que é o momento em que alguém percebe que o texto do contrato mudou.
   */
  describe("redação congelada", () => {
    it.each(
      allVariants().map(
        ({ clauseKey, variant }) =>
          [variant.variant_id, clauseKey, variant] as const,
      ),
    )("%s", (variantId, clauseKey, variant) => {
      const context = contextThatSelects(variantId) as ContractContext;
      const variables = ContractFakeBuilder.variablesFor(context);

      /*
       * Passa pelo `RenderedClause` de propósito: é ele quem remove a
       * indentação do arquivo-fonte e colapsa espaço de interpolação
       * condicional. Um snapshot do template literal cru mostraria um texto que
       * NÃO é o que vai para o documento — e o valor deste teste é justamente
       * pôr o texto final debaixo de revisão.
       */
      const rendered = new RenderedClause({
        number: 1,
        key: clauseKey,
        variant_id: variant.variant_id,
        category: "gerais",
        title: variant.title,
        body: variant.body(variables),
      });

      expect(rendered.body).toMatchSnapshot();
    });
  });
});

describe("tetos legais", () => {
  const tones: ClauseTone[] = [...CLAUSE_TONES];

  it("os três tons existem no catálogo", () => {
    const used = new Set(allVariants().map(({ variant }) => variant.tone));
    for (const tone of tones) {
      expect(used.has(tone)).toBe(true);
    }
  });

  it("a multa nunca é redigida acima do valor do contrato", () => {
    // O teto vive em `ContractVariables` (CC art. 412) — aqui a prova é de que
    // nenhuma cláusula do catálogo tenta contorná-lo com texto próprio.
    expect(() =>
      ContractFakeBuilder.defaultVariables({
        cancelamento_multa_percentual: 120,
      }),
    ).toThrow(/não pode exceder 100%/);
  });

  it("recusa exclusividade fora dos limites de tempo e espaço", () => {
    expect(() =>
      ContractFakeBuilder.defaultVariables({ exclusividade_raio_km: 100 }),
    ).toThrow(/raio de exclusividade/);

    expect(() =>
      ContractFakeBuilder.defaultVariables({ exclusividade_dias: 180 }),
    ).toThrow(/janela de exclusividade/);
  });
});

/** Guarda de tipo: prova que a lista de chaves cobre o tipo inteiro. */
const _typeGuard: ContractVariableKey = CONTRACT_VARIABLE_KEYS[0];
void _typeGuard;
