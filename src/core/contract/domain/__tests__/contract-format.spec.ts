import {
  formatarDataExtenso,
  formatarDiaSemana,
  formatarDuracao,
  formatarHora,
  formatarMoeda,
  inteiroPorExtenso,
  numeroComExtenso,
  valorPorExtenso,
} from "../contract-format";

const TZ = "America/Sao_Paulo";

describe("contract-format", () => {
  describe("formatarMoeda", () => {
    it("formata em reais", () => {
      expect(formatarMoeda(1500)).toBe("R$ 1.500,00");
      expect(formatarMoeda(300.5)).toBe("R$ 300,50");
      expect(formatarMoeda(0)).toBe("R$ 0,00");
    });

    /**
     * O `Intl` separa "R$" do número com espaço não-quebrável (U+00A0). No PDF
     * é invisível, mas quebra comparação de string e atrapalha quem copia o
     * valor do documento.
     */
    it("normaliza o espaço não-quebrável do Intl", () => {
      expect(formatarMoeda(1500)).not.toContain(" ");
      expect(formatarMoeda(1500).charCodeAt(2)).toBe(32);
    });
  });

  describe("datas", () => {
    it("escreve a data por extenso no fuso informado", () => {
      // 12/09/2026 03:00 UTC é ainda dia 12 em São Paulo (UTC-3, meia-noite).
      expect(formatarDataExtenso(new Date("2026-09-12T03:00:00Z"), TZ)).toBe(
        "12 de setembro de 2026",
      );
    });

    /**
     * 🔴 A razão de o fuso ser argumento obrigatório: o servidor roda em UTC no
     * contêiner. Sem fuso explícito, o mesmo instante vira dois dias diferentes
     * dependendo de onde o código executa — e um contrato com a data errada é
     * um contrato inútil.
     */
    it("respeita o fuso na virada do dia", () => {
      const meiaNoiteEmSaoPaulo = new Date("2026-09-12T02:59:00Z");

      expect(formatarDataExtenso(meiaNoiteEmSaoPaulo, TZ)).toBe(
        "11 de setembro de 2026",
      );
      expect(formatarDataExtenso(meiaNoiteEmSaoPaulo, "UTC")).toBe(
        "12 de setembro de 2026",
      );
    });

    it("escreve o dia da semana", () => {
      expect(formatarDiaSemana(new Date("2026-09-12T15:00:00Z"), TZ)).toBe(
        "sábado",
      );
    });

    it("escreve a hora em 24h", () => {
      expect(formatarHora(new Date("2026-09-13T00:00:00Z"), TZ)).toBe("21:00");
    });
  });

  describe("formatarDuracao", () => {
    it.each([
      [150, "2h30"],
      [180, "3h"],
      [45, "45min"],
      [60, "1h"],
      [65, "1h05"],
      [0, "0min"],
    ])("%i minutos → %s", (minutos, esperado) => {
      expect(formatarDuracao(minutos)).toBe(esperado);
    });
  });

  describe("inteiroPorExtenso", () => {
    it.each([
      [0, "zero"],
      [1, "um"],
      [15, "quinze"],
      [21, "vinte e um"],
      [100, "cem"],
      [101, "cento e um"],
      [200, "duzentos"],
      [999, "novecentos e noventa e nove"],
      [1000, "mil"],
      [1500, "mil e quinhentos"],
      [2500, "dois mil e quinhentos"],
      [1_000_000, "um milhão"],
      [2_000_000, "dois milhões"],
    ])("%i → %s", (valor, esperado) => {
      expect(inteiroPorExtenso(valor)).toBe(esperado);
    });

    /**
     * A conjunção "e" só liga o último grupo quando ele é menor que cem ou é
     * centena redonda. É o que separa "mil e quinhentos" de
     * "mil, duzentos e cinquenta".
     */
    it("aplica a regra da conjunção entre grupos", () => {
      expect(inteiroPorExtenso(1250)).toBe("mil, duzentos e cinquenta");
      expect(inteiroPorExtenso(1200)).toBe("mil e duzentos");
      expect(inteiroPorExtenso(1_500_000)).toBe("um milhão e quinhentos mil");
    });

    it("recusa valor fora da faixa suportada", () => {
      expect(() => inteiroPorExtenso(1_000_000_000_000)).toThrow(RangeError);
    });
  });

  describe("valorPorExtenso", () => {
    it.each([
      [1500, "mil e quinhentos reais"],
      [1, "um real"],
      [0, "zero reais"],
      [300, "trezentos reais"],
      [0.5, "cinquenta centavos"],
      [1500.5, "mil e quinhentos reais e cinquenta centavos"],
      [1500.01, "mil e quinhentos reais e um centavo"],
    ])("%d → %s", (valor, esperado) => {
      expect(valorPorExtenso(valor)).toBe(esperado);
    });

    it("usa 'de reais' quando a escala é redonda", () => {
      expect(valorPorExtenso(1_000_000)).toBe("um milhão de reais");
      expect(valorPorExtenso(2_000_000)).toBe("dois milhões de reais");
      // Com grupo abaixo do milhão, não leva "de".
      expect(valorPorExtenso(1_500_000)).toBe(
        "um milhão e quinhentos mil reais",
      );
    });

    /**
     * O extenso prevalece sobre o algarismo em caso de divergência (é o que a
     * cláusula de pagamento diz), então ele não pode errar por arredondamento
     * de ponto flutuante.
     */
    it("não perde centavos por arredondamento binário", () => {
      expect(valorPorExtenso(0.29)).toBe("vinte e nove centavos");
      expect(valorPorExtenso(1.07)).toBe("um real e sete centavos");
      expect(valorPorExtenso(19.99)).toBe(
        "dezenove reais e noventa e nove centavos",
      );
    });
  });

  describe("numeroComExtenso", () => {
    it("escreve número e extenso, como um contrato faz com prazos", () => {
      expect(numeroComExtenso(2)).toBe("2 (dois)");
      expect(numeroComExtenso(72)).toBe("72 (setenta e dois)");
      expect(numeroComExtenso(15)).toBe("15 (quinze)");
    });

    /**
     * 🔴 A regressão que motivou o gênero. A janela padrão de cancelamento é
     * 72 horas, então **todo** contrato emitido saía com "setenta e dois horas"
     * — e o extenso é justamente a parte que prevalece sobre o algarismo em
     * caso de divergência.
     */
    it("concorda com o substantivo feminino", () => {
      expect(numeroComExtenso(72, "feminino")).toBe("72 (setenta e duas)");
      expect(numeroComExtenso(1, "feminino")).toBe("1 (uma)");
      expect(numeroComExtenso(2, "feminino")).toBe("2 (duas)");
      expect(numeroComExtenso(24, "feminino")).toBe("24 (vinte e quatro)");
    });
  });

  describe("gênero do numeral", () => {
    it("flexiona apenas um, dois e as centenas de 200 a 900", () => {
      // Invariáveis: dezenas, `cem`, `cento` e os demais numerais.
      expect(inteiroPorExtenso(100, "feminino")).toBe("cem");
      expect(inteiroPorExtenso(101, "feminino")).toBe("cento e uma");
      expect(inteiroPorExtenso(200, "feminino")).toBe("duzentas");
      expect(inteiroPorExtenso(932, "feminino")).toBe(
        "novecentas e trinta e duas",
      );
      expect(inteiroPorExtenso(40, "feminino")).toBe("quarenta");
    });

    /**
     * `mil` é invariável e não impõe gênero próprio, então o multiplicador
     * concorda com o substantivo contado. Já `milhão` É substantivo masculino,
     * e o numeral concorda com ele — não com o que vem depois.
     */
    it("distingue mil (invariável) de milhão (substantivo masculino)", () => {
      expect(inteiroPorExtenso(2000, "feminino")).toBe("duas mil");
      expect(inteiroPorExtenso(1000, "feminino")).toBe("mil");
      expect(inteiroPorExtenso(2_000_000, "feminino")).toBe("dois milhões");
    });

    it("mantém o masculino como padrão", () => {
      expect(inteiroPorExtenso(72)).toBe("setenta e dois");
      expect(inteiroPorExtenso(200)).toBe("duzentos");
      // `valorPorExtenso` conta reais e centavos, ambos masculinos.
      expect(valorPorExtenso(2)).toBe("dois reais");
      expect(valorPorExtenso(200)).toBe("duzentos reais");
    });
  });
});
