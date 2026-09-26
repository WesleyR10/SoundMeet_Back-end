/**
 * Série diária de `establishment_analytics` para o painel web — só dado de
 * desenvolvimento.
 *
 * ## Por que existe
 *
 * O seed gravava TRÊS linhas (os três dias anteriores ao seed). Com isso a tela
 * de Analytics não tinha como exercer nada do que ela promete: o seletor de
 * 7/30/90 dias devolvia a mesma coisa nos três, a comparação com o período
 * anterior nunca tinha base, e o "ritmo da semana" tinha três barras de sete.
 * É o padrão que o `CLAUDE.md` do backend registra — o que o seed não escreve
 * vira feature intestável, em silêncio.
 *
 * ## ⚠️ É uma PROJEÇÃO sintética, não um reflexo dos eventos semeados
 *
 * Em produção cada linha nasce de `calculateDailyMetrics` (eventos, check-ins e
 * bookings do dia). Aqui não existem 180 dias de eventos por trás — semear os
 * agregados de verdade custaria centenas de eventos, bookings e presenças só
 * para alimentar um gráfico. A tabela é um read model, e é isso que o seed
 * preenche direto, exatamente como as três linhas antigas já faziam.
 * Consequência: o job noturno (`recalculate-establishment-analytics.job.ts`)
 * reescreve a linha de ONTEM com o valor real, que no seed é quase sempre zero.
 *
 * ## Determinística por construção
 *
 * Mesmo `days` ⇒ mesma forma, relativa a HOJE, em qualquer execução. O
 * gerador pseudoaleatório é semeado por constante e percorrido na ordem dos
 * dias — nunca `Math.random()`, senão cada `--reset` desenharia outra casa e
 * uma captura de tela deixaria de ser comparável com a anterior.
 *
 * Fica fora de `seed.ts` para ser pura e reutilizável: nada aqui toca Prisma.
 */

export interface SeedAnalyticsDay {
  /** Meia-noite UTC — a coluna é `@db.Date` e o repositório trunca em UTC. */
  date: Date;
  events_hosted: number;
  total_attendees: number;
  musicians_hired: number;
  total_spent: number;
  /**
   * Instantâneo da nota da CASA naquele dia (`calculateDailyMetrics` lê
   * `establishment.rating`), não média das avaliações do dia. Por isso vem
   * preenchido também nos dias sem show.
   */
  avg_rating: number;
}

/**
 * Perfil de um bar de blues e rock aberto todo dia: quinta é a noite do blues,
 * sexta e sábado enchem, segunda quase nunca tem palco.
 * Índice = `getUTCDay()` (0 = domingo).
 */
const WEEKDAY_PROFILE = [
  { chance: 0.55, crowd: 70, fee: 600 }, // dom
  { chance: 0.05, crowd: 28, fee: 450 }, // seg
  { chance: 0.15, crowd: 34, fee: 450 }, // ter
  { chance: 0.35, crowd: 48, fee: 500 }, // qua
  { chance: 0.9, crowd: 82, fee: 650 }, // qui
  { chance: 1, crowd: 118, fee: 800 }, // sex
  { chance: 1, crowd: 142, fee: 900 }, // sáb
] as const;

/** Semana sem palco (dias atrás) — dá à onda um vale que o olho encontra. */
const QUIET_WEEK = { from: 58, to: 64 };

/** Noite de festival (dias atrás): o pico que o "noite mais cheia" deve achar. */
const FESTIVAL_NIGHT = 12;

/** mulberry32 — pequeno, uniforme o bastante e sem dependência. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/**
 * `days` linhas, de `days` dias atrás até ONTEM (inclusive), em ordem
 * cronológica. Hoje fica sem linha de propósito: é o que acontece em produção
 * até o primeiro booking do dia ou o job da madrugada seguinte.
 */
export function buildEstablishmentAnalyticsSeries(options: {
  days: number;
  now?: Date;
}): SeedAnalyticsDay[] {
  const now = options.now ?? new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const random = seededRandom(20_260_915);
  const series: SeedAnalyticsDay[] = [];

  for (let daysAgo = options.days; daysAgo >= 1; daysAgo -= 1) {
    const date = new Date(todayUtc - daysAgo * 86_400_000);
    const profile = WEEKDAY_PROFILE[date.getUTCDay()]!;

    // Crescimento lento ao longo da série (0.78 → 1.12): é o que faz a
    // comparação com o período anterior ter sinal, em vez de oscilar em torno
    // de zero.
    const progress = 1 - daysAgo / options.days;
    const trend = 0.78 + 0.34 * progress;

    // Nota da casa subindo devagar, com duas casas — como `rating` é gravado.
    const rating = Math.min(5, Math.round((4.3 + 0.4 * progress + (random() - 0.5) * 0.06) * 100) / 100);

    // Os sorteios acontecem SEMPRE, com ou sem show: pular um sorteio num dia
    // de folga deslocaria a sequência inteira e mudaria todos os dias seguintes.
    const rollShow = random();
    const rollCrowd = random();
    const rollLineup = random();
    const rollFee = random();

    const isQuiet = daysAgo >= QUIET_WEEK.from && daysAgo <= QUIET_WEEK.to;
    const isFestival = daysAgo === FESTIVAL_NIGHT;
    const hasShow = isFestival || (!isQuiet && rollShow < profile.chance);

    if (!hasShow) {
      series.push({
        date,
        events_hosted: 0,
        total_attendees: 0,
        musicians_hired: 0,
        total_spent: 0,
        avg_rating: rating,
      });
      continue;
    }

    // Sábado às vezes tem abertura + atração principal.
    const events = isFestival ? 2 : date.getUTCDay() === 6 && rollLineup > 0.72 ? 2 : 1;
    const musicians = isFestival ? 3 : events + (rollLineup > 0.55 ? 1 : 0);
    const crowd = isFestival
      ? 238
      : Math.round(profile.crowd * trend * (0.8 + 0.4 * rollCrowd) * (events === 2 ? 1.25 : 1));
    const fee = roundTo(profile.fee * (0.85 + 0.35 * rollFee), 50) * musicians;

    series.push({
      date,
      events_hosted: events,
      total_attendees: crowd,
      musicians_hired: musicians,
      total_spent: fee,
      avg_rating: rating,
    });
  }

  return series;
}
