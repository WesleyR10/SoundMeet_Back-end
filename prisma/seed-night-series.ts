/**
 * A TURNÊ do Carlos (`musico3`, PRO) — seis meses de noites com set aberto,
 * só dado de desenvolvimento.
 *
 * ## Por que existe
 *
 * O Analytics do app (master do período, `GET /musicians/:id/analytics/nights`)
 * não tinha como ser olhado: o seed tinha UMA noite encerrada, da Maria, e o
 * João — o login do dia a dia — é FREE e leva 402. Sem várias noites de um
 * músico PAGO, o espectro, a comparação com o período anterior e os 7/30/90
 * dias devolviam a mesma coisa. É o padrão que o `CLAUDE.md` registra: o que o
 * seed não escreve vira feature intestável, em silêncio.
 *
 * ## Diferente da série do estabelecimento: aqui NADA é projeção
 *
 * `seed-analytics-series.ts` preenche um read model direto. Esta série gera o
 * ROTEIRO de eventos, sets, músicas, pedidos, gorjetas e presenças que o
 * `seed.ts` grava pelos agregados de verdade — o endpoint de noites calcula
 * sobre eles, igual faria em produção. Por isso o relatório de cada noite, a
 * setlist riscada, o currículo e a parada de pedidos batem com o master.
 *
 * ## Determinística e relativa a hoje
 *
 * Gerador semeado por constante, percorrido na ordem dos dias: o mesmo
 * `--reset` desenha a mesma turnê (capturas comparáveis). O período recente é
 * mais cheio que o anterior de propósito — é o que faz a mesa de canais
 * mostrar ▲ em vez de "estável".
 *
 * Pura: nada aqui toca Prisma.
 */

export const TOUR_DAYS = 180;
/** Plateia sintética (sem login) de onde saem presenças, pedidos e gorjetas. */
export const CROWD_POOL = 48;

export type TourRequest = {
  /** Índice na lista de músicas do repertório do Carlos. */
  song: number;
  outcome: "played" | "rejected" | "accepted";
  /** Índice na plateia. */
  fan: number;
};

export type TourTip = { minute: number; amount: number; fan: number };

export type TourNight = {
  daysAgo: number;
  /** Hora LOCAL de início. */
  hour: number;
  /** Índice da casa (0..3). */
  venue: number;
  /** Ordem em que as músicas foram tocadas — índice no repertório, ou `null` = fora da biblioteca. */
  songs: (number | null)[];
  /** Com setlist programada (o repertório "Noite de Jazz") ou improvisada. */
  withSetlist: boolean;
  /** Primeiro índice da plateia desta noite (as presenças giram pela plateia). */
  crowdStart: number;
  crowd: number;
  requests: TourRequest[];
  tips: TourTip[];
};

/** Chance de ter show e tamanho da casa, por dia da semana (0 = domingo). */
const WEEKDAY = [
  { chance: 0.25, crowd: 22 },
  { chance: 0.0, crowd: 0 },
  { chance: 0.05, crowd: 12 },
  { chance: 0.2, crowd: 16 },
  { chance: 0.45, crowd: 26 },
  { chance: 0.6, crowd: 36 },
  { chance: 0.55, crowd: 42 },
] as const;

const TIP_VALUES = [5, 10, 10, 15, 20, 20, 30, 50] as const;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param songCount tamanho do repertório (as músicas são índices nele)
 * @param today     hoje, para o dia da semana de cada noite
 */
export function buildCarlosTour(songCount: number, today: Date): TourNight[] {
  const rand = mulberry32(20260930);
  const nights: TourNight[] = [];
  let crowdCursor = 0;

  // Do mais antigo para o mais recente; nunca hoje nem ontem (não disputa com
  // os eventos de "agora" do seed).
  for (let daysAgo = TOUR_DAYS; daysAgo >= 2; daysAgo--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
    const profile = WEEKDAY[day.getDay()];
    // Tendência: a agenda e o público crescem, e o último mês é a temporada
    // cheia — é ele contra os 30 dias anteriores que a mesa de canais compara.
    const trend = daysAgo <= 30 ? 1.15 : 0.45 + 0.4 * (1 - daysAgo / TOUR_DAYS);
    if (rand() > profile.chance * (0.6 + 0.6 * trend)) continue;

    const crowd = Math.max(4, Math.min(CROWD_POOL, Math.round(profile.crowd * trend * (0.75 + rand() * 0.6))));
    const withSetlist = rand() > 0.2;

    // Setlist tocada: parte do repertório embaralhado, às vezes um bis e uma
    // canja fora da biblioteca.
    const order = Array.from({ length: songCount }, (_, i) => i).sort(() => rand() - 0.5);
    const length = Math.min(songCount, 7 + Math.floor(rand() * 5));
    const songs: (number | null)[] = order.slice(0, length);
    if (rand() > 0.55) songs.push(null);
    if (rand() > 0.7) songs.push(songs[0]);

    const played = songs.filter((s): s is number => s !== null);
    const requestCount = Math.round(crowd * (0.12 + rand() * 0.12));
    const requests: TourRequest[] = Array.from({ length: requestCount }, (_, i) => {
      const r = rand();
      const outcome = r < 0.62 ? "played" : r < 0.82 ? "rejected" : "accepted";
      // Pedido tocado é de uma música que TOCOU na noite; os outros, de qualquer uma do repertório.
      const song = outcome === "played"
        ? played[Math.floor(rand() * played.length)]
        : Math.floor(rand() * songCount);
      return { song, outcome, fan: (crowdCursor + i) % CROWD_POOL };
    });

    const minutes = songs.length * 12;
    const tipCount = Math.round(crowd * (0.1 + rand() * 0.14));
    const tips: TourTip[] = Array.from({ length: tipCount }, (_, i) => ({
      minute: 5 + Math.floor(rand() * Math.max(1, minutes - 5)),
      amount: TIP_VALUES[Math.floor(rand() * TIP_VALUES.length)],
      fan: (crowdCursor + i * 3) % CROWD_POOL,
    }));

    nights.push({
      daysAgo,
      hour: day.getDay() === 6 ? 22 : 21,
      venue: Math.floor(rand() * 4),
      songs,
      withSetlist,
      crowdStart: crowdCursor,
      crowd,
      requests,
      tips,
    });
    crowdCursor = (crowdCursor + 7) % CROWD_POOL;
  }

  return nights;
}

/** Nomes da plateia sintética — gente comum, não persona com login. */
export const CROWD_NAMES = [
  "Luiza", "Pedro", "Marina", "Tiago", "Camila", "Rafael", "Bianca", "Gustavo",
  "Larissa", "Felipe", "Juliana", "Mateus", "Fernanda", "Lucas", "Patrícia", "André",
] as const;

export const CROWD_SURNAMES = ["Alves", "Barros", "Costa", "Duarte", "Farias", "Gomes"] as const;
