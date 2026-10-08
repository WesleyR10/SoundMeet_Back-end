import { Establishment } from "../establishment.aggregate";

/**
 * Representante legal — quem assina pela pessoa jurídica.
 *
 * O que estes testes protegem é a qualificação do contrato: "Bar do Zé Ltda.,
 * CNPJ nº …, neste ato representada por João da Silva, CPF nº …". A alternativa
 * que o código NÃO faz, e não pode voltar a fazer, é derivar esse CPF do CNPJ —
 * fabricar documento num instrumento probatório.
 */
describe("Establishment — representante legal", () => {
  const CPF_VALIDO = "52998224725";

  it("guarda nome e CPF", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    establishment.changeLegalRepresentative("João da Silva", CPF_VALIDO);

    expect(establishment.legal_representative_name).toBe("João da Silva");
    expect(establishment.legal_representative_document!.value).toBe(CPF_VALIDO);
    expect(establishment.notification.hasErrors()).toBe(false);
  });

  it("aceita CPF mascarado e guarda só os dígitos", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    establishment.changeLegalRepresentative("João da Silva", "529.982.247-25");

    expect(establishment.legal_representative_document!.value).toBe(CPF_VALIDO);
  });

  // Nome sem CPF ainda melhora a qualificação; o documento imprime o nome e
  // omite o CPF, em vez de remeter ao Anexo II.
  it("aceita nome sem CPF", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    establishment.changeLegalRepresentative("João da Silva", null);

    expect(establishment.legal_representative_name).toBe("João da Silva");
    expect(establishment.legal_representative_document).toBeNull();
    expect(establishment.notification.hasErrors()).toBe(false);
  });

  // CPF sem nome não qualifica ninguém — não há o que imprimir.
  it("recusa CPF sem nome", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    establishment.changeLegalRepresentative(null, CPF_VALIDO);

    expect(establishment.legal_representative_document).toBeNull();
    expect(establishment.notification.hasErrors()).toBe(true);
  });

  it("recusa nome em branco acompanhado de CPF", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    establishment.changeLegalRepresentative("   ", CPF_VALIDO);

    expect(establishment.legal_representative_document).toBeNull();
    expect(establishment.notification.hasErrors()).toBe(true);
  });

  it("recusa CPF com dígitos verificadores errados", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    establishment.changeLegalRepresentative("João da Silva", "52998224799");

    expect(establishment.legal_representative_document).toBeNull();
    expect(establishment.notification.hasErrors()).toBe(true);
  });

  // Troca de sócio é evento real.
  it("limpa o representante quando os dois vêm nulos", () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withLegalRepresentative("João da Silva", CPF_VALIDO)
      .build();

    establishment.changeLegalRepresentative(null, null);

    expect(establishment.legal_representative_name).toBeNull();
    expect(establishment.legal_representative_document).toBeNull();
    expect(establishment.notification.hasErrors()).toBe(false);
  });

  it("nasce sem representante — é dado de configuração, não de cadastro", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    expect(establishment.legal_representative_name).toBeNull();
    expect(establishment.legal_representative_document).toBeNull();
  });
});
