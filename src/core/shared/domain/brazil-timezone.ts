/**
 * Fuso horário de um endereço no Brasil.
 *
 * 🔴 O servidor roda em UTC. Toda regra que fala em "hoje" ou mostra um
 * horário de show precisa do fuso da CASA, não do processo: meia-noite UTC é
 * 21h em Brasília e 20h em Manaus — no meio do show.
 *
 * O Brasil tem quatro fusos e nenhum horário de verão desde 2019. O estado
 * decide o fuso em todos os casos, menos dois:
 * - **Amazonas**: 11 municípios do oeste seguem o horário do Acre (UTC-5,
 *   Lei 12.876/2013); o resto, o de Manaus (UTC-4).
 * - **Pernambuco**: Fernando de Noronha é UTC-2; o continente, UTC-3.
 *
 * Os nomes são os da tz database (`/usr/share/zoneinfo/zone.tab`), e não
 * offsets fixos, para que uma volta do horário de verão seja resolvida pela
 * atualização do tzdata, sem mudar código.
 */

/** Fuso usado quando o endereço não resolve (estado ausente ou fora do país). */
export const DEFAULT_BRAZIL_TIMEZONE = "America/Sao_Paulo";

const TIMEZONE_BY_UF: Readonly<Record<string, string>> = {
  AC: "America/Rio_Branco",
  AL: "America/Maceio",
  AP: "America/Belem",
  AM: "America/Manaus",
  BA: "America/Bahia",
  CE: "America/Fortaleza",
  DF: "America/Sao_Paulo",
  ES: "America/Sao_Paulo",
  GO: "America/Sao_Paulo",
  MA: "America/Fortaleza",
  MT: "America/Cuiaba",
  MS: "America/Campo_Grande",
  MG: "America/Sao_Paulo",
  PA: "America/Belem",
  PB: "America/Fortaleza",
  PR: "America/Sao_Paulo",
  PE: "America/Recife",
  PI: "America/Fortaleza",
  RJ: "America/Sao_Paulo",
  RN: "America/Fortaleza",
  RS: "America/Sao_Paulo",
  RO: "America/Porto_Velho",
  RR: "America/Boa_Vista",
  SC: "America/Sao_Paulo",
  SP: "America/Sao_Paulo",
  SE: "America/Maceio",
  TO: "America/Araguaina",
};

/** O cadastro aceita o estado por extenso; a chave é o nome sem acento. */
const UF_BY_STATE_NAME: Readonly<Record<string, string>> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

/**
 * Municípios do Amazonas no horário do Acre (UTC-5). A lei define a fronteira
 * por uma linha (Tabatinga–Porto Acre); a lista é a aplicação dela por
 * município. Tabatinga fica em UTC-4.
 */
const AMAZONAS_WEST_CITIES: ReadonlySet<string> = new Set([
  "amatura",
  "atalaia do norte",
  "benjamin constant",
  "boca do acre",
  "eirunepe",
  "envira",
  "guajara",
  "ipixuna",
  "itamarati",
  "pauini",
  "sao paulo de olivenca",
]);

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toUf(state: string): string | null {
  const trimmed = state.trim();
  if (/^[a-z]{2}$/i.test(trimmed)) {
    const uf = trimmed.toUpperCase();
    return uf in TIMEZONE_BY_UF ? uf : null;
  }
  return UF_BY_STATE_NAME[normalize(trimmed)] ?? null;
}

/**
 * Fuso pelo endereço, ou `null` quando o estado não é reconhecido (vazio ou
 * fora do Brasil). Quem chama decide o fallback — ver `resolveVenueTimezone`.
 */
export function timezoneForBrazilianAddress(address: {
  state?: string | null;
  city?: string | null;
}): string | null {
  if (!address.state) return null;
  const uf = toUf(address.state);
  if (!uf) return null;

  const city = address.city ? normalize(address.city) : "";
  if (uf === "AM" && AMAZONAS_WEST_CITIES.has(city)) {
    return "America/Eirunepe";
  }
  if (uf === "PE" && city === "fernando de noronha") {
    return "America/Noronha";
  }
  return TIMEZONE_BY_UF[uf];
}

export function isValidIanaTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fuso de uma casa de show.
 *
 * 1. **O endereço**, quando o estado é brasileiro. É o dado objetivo: o fuso
 *    declarado no horário de funcionamento vem pré-preenchido com São Paulo no
 *    painel, e uma casa de Manaus que não o trocou ficaria uma hora errada.
 * 2. O fuso declarado, para endereço que não resolve (fora do Brasil). `UTC`
 *    é o default da coluna, não uma escolha, e é ignorado.
 * 3. São Paulo — o fuso da maior parte da população, e nunca UTC.
 */
export function resolveVenueTimezone(input: {
  state?: string | null;
  city?: string | null;
  declared_timezone?: string | null;
}): string {
  const fromAddress = timezoneForBrazilianAddress(input);
  if (fromAddress) return fromAddress;

  const declared = input.declared_timezone?.trim();
  if (declared && declared !== "UTC" && isValidIanaTimezone(declared)) {
    return declared;
  }
  return DEFAULT_BRAZIL_TIMEZONE;
}

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function wallClockAt(instant: Date, timezone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Diferença, em ms, entre o relógio local e o UTC naquele instante. */
function offsetMs(instant: Date, timezone: string): number {
  const w = wallClockAt(instant, timezone);
  const asUtc = Date.UTC(
    w.year,
    w.month - 1,
    w.day,
    w.hour,
    w.minute,
    w.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Instante em que o relógio local marca aquela data e hora. `Date.UTC`
 * normaliza dia 32 e afins, então "amanhã" é só `day + 1`. Duas passadas
 * acertam o offset também na virada de horário de verão.
 */
function instantForWallClock(
  wall: { year: number; month: number; day: number; hour: number },
  timezone: string,
): Date {
  const naive = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour);
  let guess = naive - offsetMs(new Date(naive), timezone);
  guess = naive - offsetMs(new Date(guess), timezone);
  return new Date(guess);
}

/**
 * Janela do "dia" que contém `now`, no fuso dado, com o dia começando em
 * `startHour` (hora local).
 *
 * Com `startHour = 0` é o dia do calendário. Com 6 é o dia da NOITE: um show
 * das 22h às 2h fica inteiro no mesmo dia, e a virada acontece de manhã, com a
 * casa fechada.
 */
export function localDayWindow(
  now: Date,
  timezone: string,
  startHour: number,
): { start: Date; end: Date } {
  const wall = wallClockAt(now, timezone);
  const dayOffset = wall.hour < startHour ? -1 : 0;
  const start = instantForWallClock(
    {
      year: wall.year,
      month: wall.month,
      day: wall.day + dayOffset,
      hour: startHour,
    },
    timezone,
  );
  const end = instantForWallClock(
    {
      year: wall.year,
      month: wall.month,
      day: wall.day + dayOffset + 1,
      hour: startHour,
    },
    timezone,
  );
  return { start, end };
}
