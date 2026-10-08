/**
 * Formatação pt-BR do contrato — funções puras, sem estado e sem infra.
 *
 * Vive no domínio porque "como um contrato brasileiro escreve um valor, uma
 * data e uma duração" é regra de negócio, não apresentação: o texto formatado
 * entra no snapshot congelado e é o que a parte assinou. Mudar a formatação
 * depois não pode reescrever contrato antigo — e não reescreve, porque o
 * resultado é congelado na emissão.
 *
 * Usa `Intl` do próprio Node (ICU completo) em vez de Luxon: são funções puras
 * de domínio, e o fuso chega sempre explícito como argumento. Data sem fuso
 * explícito é a classe de bug que o `soundmeet-web` já registrou — o servidor
 * roda em UTC no contêiner e discordaria do navegador sobre o mesmo show.
 */

const LOCALE = "pt-BR";

/**
 * `Intl` separa "R$" do número com espaço **não-quebrável** (U+00A0). Num PDF
 * isso é invisível, mas quebra comparação de string em teste e atrapalha quem
 * copia o valor do documento. Normalizado para espaço comum.
 */
function normalizarEspacos(value: string): string {
  return value.replace(/ /g, " ");
}

/** `1500` → `"R$ 1.500,00"`. */
export function formatarMoeda(valor: number): string {
  return normalizarEspacos(
    new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: "BRL",
    }).format(valor),
  );
}

/** `"12 de setembro de 2026"`. */
export function formatarDataExtenso(date: Date, timeZone: string): string {
  return normalizarEspacos(
    new Intl.DateTimeFormat(LOCALE, {
      timeZone,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date),
  );
}

/** `"sábado"`. */
export function formatarDiaSemana(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    weekday: "long",
  }).format(date);
}

/** `"21:00"`, no fuso informado. */
export function formatarHora(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** `150` → `"2h30"`; `180` → `"3h"`; `45` → `"45min"`. */
export function formatarDuracao(minutos: number): string {
  const total = Math.max(0, Math.round(minutos));
  const horas = Math.floor(total / 60);
  const resto = total % 60;

  if (horas === 0) return `${resto}min`;
  if (resto === 0) return `${horas}h`;
  return `${horas}h${String(resto).padStart(2, "0")}`;
}

// ── Número por extenso ──────────────────────────────────────────────────────
//
// Contrato brasileiro escreve o valor em algarismos E por extenso: é a defesa
// clássica contra adulteração de um dígito. Se os dois divergirem, prevalece o
// extenso — por isso ele não pode ser aproximado.

const UNIDADES = [
  "",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
];

const DEZ_A_DEZENOVE = [
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];

const DEZENAS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];

const CENTENAS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

const ESCALAS = [
  { singular: "", plural: "" },
  { singular: "mil", plural: "mil" },
  { singular: "milhão", plural: "milhões" },
  { singular: "bilhão", plural: "bilhões" },
];

/**
 * Gênero do substantivo que o numeral acompanha.
 *
 * Não é preciosismo de redação. "72 (setenta e dois) **horas**" está errado —
 * o numeral concorda com o substantivo, e o certo é "setenta e **duas** horas".
 * Num documento em que o extenso **prevalece** sobre o algarismo em caso de
 * divergência, erro de concordância cai justamente na parte que decide.
 *
 * Em português só flexionam `um`, `dois` e as centenas de 200 a 900 — `cem`,
 * `cento`, as dezenas e os demais numerais são invariáveis. Por isso as tabelas
 * abaixo cobrem só esses casos, em vez de duplicarem o alfabeto inteiro.
 */
export type GeneroNumeral = "masculino" | "feminino";

const UNIDADES_FEMININAS: Readonly<Record<number, string>> = {
  1: "uma",
  2: "duas",
};

const CENTENAS_FEMININAS = [
  "",
  // "cento" não flexiona: "cento e uma horas", nunca "centa".
  "cento",
  "duzentas",
  "trezentas",
  "quatrocentas",
  "quinhentas",
  "seiscentas",
  "setecentas",
  "oitocentas",
  "novecentas",
];

function unidadePorExtenso(n: number, genero: GeneroNumeral): string {
  return genero === "feminino" && UNIDADES_FEMININAS[n] !== undefined
    ? UNIDADES_FEMININAS[n]
    : UNIDADES[n];
}

function centenaPorExtenso(n: number, genero: GeneroNumeral): string {
  return genero === "feminino" ? CENTENAS_FEMININAS[n] : CENTENAS[n];
}

/** 1 a 999. */
function ateNovecentosENoventaENove(n: number, genero: GeneroNumeral): string {
  if (n === 100) return "cem";

  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];

  if (centena > 0) partes.push(centenaPorExtenso(centena, genero));

  if (resto > 0) {
    if (resto < 10) {
      partes.push(unidadePorExtenso(resto, genero));
    } else if (resto < 20) {
      partes.push(DEZ_A_DEZENOVE[resto - 10]);
    } else {
      const dezena = Math.floor(resto / 10);
      const unidade = resto % 10;
      partes.push(
        unidade > 0
          ? `${DEZENAS[dezena]} e ${unidadePorExtenso(unidade, genero)}`
          : DEZENAS[dezena],
      );
    }
  }

  return partes.join(" e ");
}

export function inteiroPorExtenso(
  valor: number,
  genero: GeneroNumeral = "masculino",
): string {
  const n = Math.floor(Math.abs(valor));
  if (n === 0) return "zero";
  if (n >= 1_000_000_000_000) {
    throw new RangeError("Valor fora da faixa suportada por extenso");
  }

  const grupos: { valor: number; escala: number }[] = [];
  let resto = n;
  let escala = 0;

  while (resto > 0) {
    const grupo = resto % 1000;
    if (grupo > 0) grupos.unshift({ valor: grupo, escala });
    resto = Math.floor(resto / 1000);
    escala += 1;
  }

  const textos = grupos.map(({ valor: v, escala: e }) => {
    if (e === 0) return ateNovecentosENoventaENove(v, genero);
    /*
     * "mil", nunca "um mil" — e o multiplicador concorda com o substantivo
     * contado, porque "mil" é invariável e não impõe gênero próprio: "duas mil
     * horas", não "dois mil horas".
     */
    if (e === 1)
      return v === 1 ? "mil" : `${ateNovecentosENoventaENove(v, genero)} mil`;
    /*
     * De "milhão" para cima o numeral concorda com o SUBSTANTIVO DA ESCALA, que
     * é masculino: "dois milhões de horas", nunca "duas milhões".
     */
    const nome = v === 1 ? ESCALAS[e].singular : ESCALAS[e].plural;
    return `${ateNovecentosENoventaENove(v, "masculino")} ${nome}`;
  });

  if (textos.length === 1) return textos[0];

  /*
   * A conjunção "e" liga o último grupo quando o VALOR dele é menor que cem ou
   * é centena redonda — independente da escala:
   *
   *   1.500      → "mil e quinhentos"              (500 é centena redonda)
   *   1.250      → "mil, duzentos e cinquenta"     (250 não é)
   *   1.500.000  → "um milhão e quinhentos mil"    (o grupo é 500, na escala mil)
   *   1.001.000  → "um milhão e mil"               (o grupo é 1)
   */
  const ultimo = grupos[grupos.length - 1];
  const ligaComE = ultimo.valor < 100 || ultimo.valor % 100 === 0;
  const cabeca = textos.slice(0, -1).join(", ");
  const cauda = textos[textos.length - 1];

  return ligaComE ? `${cabeca} e ${cauda}` : `${cabeca}, ${cauda}`;
}

/** `1500` → `"mil e quinhentos reais"`; `1500.5` → `"… e cinquenta centavos"`. */
export function valorPorExtenso(valor: number): string {
  const emCentavos = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(emCentavos / 100);
  const centavos = emCentavos % 100;

  const partes: string[] = [];

  if (reais > 0) {
    // "um milhão DE reais", mas "um milhão e quinhentos mil reais".
    const escalaRedonda = reais >= 1_000_000 && reais % 1_000_000 === 0;
    const unidade = escalaRedonda ? "de reais" : reais === 1 ? "real" : "reais";
    partes.push(`${inteiroPorExtenso(reais)} ${unidade}`);
  }

  if (centavos > 0) {
    partes.push(
      `${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`,
    );
  }

  if (partes.length === 0) return "zero reais";

  return partes.join(" e ");
}

/**
 * `2` → `"2 (dois)"`; `72, "feminino"` → `"72 (setenta e duas)"`.
 *
 * Número seguido do extenso entre parênteses é como contrato brasileiro escreve
 * prazos e quantidades, pela mesma razão do valor: um dígito trocado fica
 * visível.
 *
 * ⚠️ **Passe o gênero do substantivo que vem depois.** O padrão masculino cobre
 * "dias", "meses", "minutos" e "quilômetros"; "horas" exige `"feminino"`.
 */
export function numeroComExtenso(
  valor: number,
  genero: GeneroNumeral = "masculino",
): string {
  return `${valor} (${inteiroPorExtenso(valor, genero)})`;
}
