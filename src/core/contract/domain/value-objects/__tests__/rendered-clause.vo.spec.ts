import {
  InvalidRenderedClauseError,
  RenderedClause,
  RenderedClauseProps,
} from "../rendered-clause.vo";

function clause(
  overrides: Partial<RenderedClauseProps> = {},
): RenderedClauseProps {
  return {
    number: 1,
    key: "objeto",
    variant_id: "objeto.solo.formal",
    category: "objeto",
    title: "Do objeto",
    body: "O presente instrumento tem por objeto a apresentação musical.",
    ...overrides,
  };
}

describe("RenderedClause", () => {
  describe("reflow de parágrafos", () => {
    /**
     * As cláusulas são template literals indentados no código-fonte. A
     * indentação do arquivo e a quebra na coluna 80 do editor não têm nada a
     * ver com onde o texto deve quebrar no documento — PDF e HTML refluem
     * sozinhos.
     */
    it("junta as linhas de um parágrafo e remove a indentação do fonte", () => {
      const rendered = new RenderedClause(
        clause({
          body: `
        O CONTRATANTE pagará ao CONTRATADO a quantia de
        R$ 1.500,00, em até 2 dias úteis.

        Parágrafo único. O pagamento é direto
        entre as partes.
      `,
        }),
      );

      expect(rendered.body).toBe(
        "O CONTRATANTE pagará ao CONTRATADO a quantia de R$ 1.500,00, em até 2 dias úteis.\n\n" +
          "Parágrafo único. O pagamento é direto entre as partes.",
      );
    });

    /**
     * Sobra de interpolação condicional (`${cond ? "e aos integrantes" : ""}`).
     * Num documento jurídico, espaço duplo parece exatamente o que é: erro de
     * montagem.
     */
    it("colapsa espaço duplo de interpolação condicional", () => {
      const rendered = new RenderedClause(
        clause({ body: "ao CONTRATADO  espaço reservado" }),
      );

      expect(rendered.body).toBe("ao CONTRATADO espaço reservado");
    });

    it("colapsa linhas em branco excedentes em uma só separação", () => {
      const rendered = new RenderedClause(
        clause({ body: "Primeiro.\n\n\n\nSegundo." }),
      );

      expect(rendered.body).toBe("Primeiro.\n\nSegundo.");
    });
  });

  describe("valores não resolvidos", () => {
    /**
     * 🔴 A última barreira antes de um contrato assinado dizer "undefined" para
     * o cliente. Vale para o corpo e para o título.
     */
    it.each(["undefined", "NaN", "[object Object]", "{{cache}}"])(
      "recusa corpo contendo %s",
      (marcador) => {
        expect(
          () => new RenderedClause(clause({ body: `Valor: ${marcador}` })),
        ).toThrow(InvalidRenderedClauseError);
      },
    );

    it("recusa título contendo valor não resolvido", () => {
      expect(
        () => new RenderedClause(clause({ title: "Do valor undefined" })),
      ).toThrow(InvalidRenderedClauseError);
    });

    it("não confunde texto jurídico legítimo com marcador", () => {
      // "nulidade" e "anulação" contêm 'nul', mas não os marcadores.
      expect(
        () =>
          new RenderedClause(
            clause({
              body: "A eventual nulidade de uma disposição não contamina as demais.",
            }),
          ),
      ).not.toThrow();
    });
  });

  describe("validação", () => {
    it("exige numeração positiva e inteira", () => {
      expect(() => new RenderedClause(clause({ number: 0 }))).toThrow(
        InvalidRenderedClauseError,
      );
      expect(() => new RenderedClause(clause({ number: 1.5 }))).toThrow(
        InvalidRenderedClauseError,
      );
    });

    it.each(["key", "variant_id", "category", "title", "body"] as const)(
      "exige o campo %s",
      (field) => {
        expect(() => new RenderedClause(clause({ [field]: "  " }))).toThrow(
          InvalidRenderedClauseError,
        );
      },
    );

    it("limita o tamanho do corpo", () => {
      expect(
        () => new RenderedClause(clause({ body: "a".repeat(20_001) })),
      ).toThrow(InvalidRenderedClauseError);
    });
  });

  describe("serialização", () => {
    it("faz round-trip por JSON", () => {
      const original = new RenderedClause(clause());
      const round = RenderedClause.fromJSON(original.toJSON());

      expect(round.toJSON()).toEqual(original.toJSON());
    });

    /**
     * `key`, `variant_id` e `category` são `string`, não a união literal do
     * catálogo — de propósito. Um contrato antigo com cláusula que saiu do
     * catálogo tem que continuar carregando.
     */
    it("reidrata cláusula cuja chave não existe mais no catálogo", () => {
      const antiga = RenderedClause.fromJSON({
        number: 3,
        key: "clausula_aposentada",
        variant_id: "clausula_aposentada.v0.formal",
        category: "gerais",
        title: "De algo que não existe mais",
        body: "Texto de um contrato de 2026.",
      });

      expect(antiga.key).toBe("clausula_aposentada");
    });

    it("recusa JSON que não é objeto", () => {
      expect(() => RenderedClause.fromJSON(null)).toThrow(
        InvalidRenderedClauseError,
      );
      expect(() => RenderedClause.fromJSON([])).toThrow(
        InvalidRenderedClauseError,
      );
    });
  });
});
