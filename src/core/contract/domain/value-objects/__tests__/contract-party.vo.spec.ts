import {
  ContractParty,
  ContractPartyProps,
  InvalidContractPartyError,
} from "../contract-party.vo";

function individual(
  overrides: Partial<ContractPartyProps> = {},
): ContractPartyProps {
  return {
    role: "contracted",
    kind: "individual",
    legal_name: "Ana Ribeiro",
    display_name: "Ana Ribeiro",
    document: "123.456.789-01",
    email: "Ana@Exemplo.com",
    phone: "+5511988880000",
    address: {
      street: "Rua das Acácias",
      number: "42",
      complement: null,
      neighborhood: "Vila Mariana",
      city: "São Paulo",
      state: "sp",
      zip_code: "04000000",
      country: "Brasil",
    },
    representative: null,
    ...overrides,
  };
}

function company(
  overrides: Partial<ContractPartyProps> = {},
): ContractPartyProps {
  return individual({
    role: "contractor",
    kind: "company",
    legal_name: "Bar do Zé Ltda.",
    display_name: "Bar do Zé",
    document: "12.345.678/0001-90",
    email: "contato@bardoze.com.br",
    representative: {
      name: "José da Silva",
      document: "987.654.321-00",
      title: "representante legal",
    },
    ...overrides,
  });
}

describe("ContractParty", () => {
  describe("normalização", () => {
    it("guarda o documento só com dígitos", () => {
      expect(new ContractParty(individual()).document).toBe("12345678901");
      expect(new ContractParty(company()).document).toBe("12345678000190");
    });

    it("normaliza email para minúsculas e UF para maiúsculas", () => {
      const party = new ContractParty(individual());

      expect(party.email).toBe("ana@exemplo.com");
      expect(party.address.state).toBe("SP");
    });

    it("formata o CEP", () => {
      expect(new ContractParty(individual()).address.zip_code).toBe(
        "04000-000",
      );
    });

    it("transforma texto vazio em null", () => {
      const party = new ContractParty(
        individual({ display_name: "   ", phone: "" }),
      );

      expect(party.display_name).toBeNull();
      expect(party.phone).toBeNull();
    });
  });

  describe("apresentação", () => {
    it("formata CPF e CNPJ como um contrato escreve", () => {
      expect(new ContractParty(individual()).formatted_document).toBe(
        "123.456.789-01",
      );
      expect(new ContractParty(company()).formatted_document).toBe(
        "12.345.678/0001-90",
      );
    });

    it("monta o endereço em uma linha", () => {
      expect(new ContractParty(individual()).formatted_address).toBe(
        "Rua das Acácias, 42 — Vila Mariana — São Paulo/SP — CEP 04000-000",
      );
    });

    it("inclui o complemento quando existe", () => {
      const party = new ContractParty(
        individual({
          address: { ...individual().address, complement: "apto 12" },
        }),
      );

      expect(party.formatted_address).toContain("apto 12");
    });

    /**
     * O nome artístico é como o contratante conhece o artista; o nome civil é
     * quem responde. As cláusulas usam o primeiro, a qualificação usa o segundo.
     */
    it("usa o nome de exibição como referência, caindo para o civil", () => {
      expect(
        new ContractParty(individual({ display_name: "Aninha Blues" }))
          .reference_name,
      ).toBe("Aninha Blues");
      expect(
        new ContractParty(individual({ display_name: null })).reference_name,
      ).toBe("Ana Ribeiro");
    });
  });

  describe("validação", () => {
    it("exige 11 dígitos para pessoa física", () => {
      expect(() => new ContractParty(individual({ document: "123" }))).toThrow(
        InvalidContractPartyError,
      );
    });

    it("exige 14 dígitos para pessoa jurídica", () => {
      expect(
        () => new ContractParty(company({ document: "12345678901" })),
      ).toThrow(InvalidContractPartyError);
    });

    /**
     * 🔴 Pessoa jurídica **não** exige representante nomeado na emissão.
     *
     * A plataforma não coleta hoje nome e CPF do representante legal do
     * estabelecimento. Exigi-lo aqui deixaria o contrato inalcançável para todo
     * estabelecimento já cadastrado — e preenchê-lo com um dado derivado (os
     * primeiros dígitos do CNPJ, por exemplo) seria fabricar documento num
     * instrumento que existe para provar fatos.
     *
     * O documento declara "representada por seu representante legal,
     * identificado no Anexo II", e o Anexo II traz quem de fato assinou, com
     * conta autenticada.
     */
    it("aceita pessoa jurídica sem representante nomeado", () => {
      const pj = new ContractParty(company({ representative: null }));

      expect(pj.representative).toBeNull();
      expect(pj.kind).toBe("company");
    });

    it("aceita representante sem CPF conhecido", () => {
      const pj = new ContractParty(
        company({
          representative: {
            name: "José da Silva",
            document: null,
            title: "representante legal",
          },
        }),
      );

      expect(pj.representative?.document).toBeNull();
      expect(pj.representative?.name).toBe("José da Silva");
    });

    it("permite representante para pessoa física (é o caso da banda)", () => {
      const banda = new ContractParty(
        individual({
          display_name: "Trio Maré",
          representative: {
            name: "Ana Ribeiro",
            document: "123.456.789-01",
            title: "líder da banda",
          },
        }),
      );

      expect(banda.representative?.title).toBe("líder da banda");
    });

    it("exige CPF de 11 dígitos do representante", () => {
      expect(
        () =>
          new ContractParty(
            company({
              representative: {
                name: "José",
                document: "123",
                title: "representante legal",
              },
            }),
          ),
      ).toThrow(/representative CPF/);
    });

    it.each([
      "street",
      "number",
      "neighborhood",
      "city",
      "state",
      "zip_code",
    ] as const)("exige o campo de endereço %s", (field) => {
      expect(
        () =>
          new ContractParty(
            individual({ address: { ...individual().address, [field]: "" } }),
          ),
      ).toThrow(InvalidContractPartyError);
    });

    it("exige nome e email plausíveis", () => {
      expect(() => new ContractParty(individual({ legal_name: "A" }))).toThrow(
        InvalidContractPartyError,
      );
      expect(
        () => new ContractParty(individual({ email: "semarroba" })),
      ).toThrow(InvalidContractPartyError);
    });

    it("recusa papel ou natureza desconhecidos", () => {
      expect(
        () => new ContractParty(individual({ role: "terceiro" as any })),
      ).toThrow(InvalidContractPartyError);
      expect(
        () => new ContractParty(individual({ kind: "cooperativa" as any })),
      ).toThrow(InvalidContractPartyError);
    });
  });

  describe("serialização", () => {
    it("faz round-trip por JSON preservando o conteúdo", () => {
      const original = new ContractParty(company());
      const round = ContractParty.fromJSON(original.toJSON());

      expect(round.toJSON()).toEqual(original.toJSON());
      expect(round.equals(original)).toBe(true);
    });

    it("recusa JSON que não é objeto", () => {
      expect(() => ContractParty.fromJSON(null)).toThrow(
        InvalidContractPartyError,
      );
      expect(() => ContractParty.fromJSON([])).toThrow(
        InvalidContractPartyError,
      );
      expect(() => ContractParty.fromJSON("texto")).toThrow(
        InvalidContractPartyError,
      );
    });
  });
});
