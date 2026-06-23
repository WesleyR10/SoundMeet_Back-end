import axios, { AxiosInstance } from "axios";
import https from "https";

import {
  GeniusFindPlainLyricsInput,
  GeniusPlainLyrics,
  IGeniusClient,
} from "../../application/ports/genius-client.interface";

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\u00a0/g, " ");
}

function stripTagsPreserveBreaks(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/?p\b[^>]*>/gi, "\n")
    .replace(/<\/?div\b[^>]*>/gi, "\n");

  const noTags = withBreaks.replace(/<[^>]+>/g, "");

  return decodeHtmlEntities(noTags)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .trim();
}

function normalizeForMatch(input: string): string {
  return String(input ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, (m) => {
      const inner = String(m ?? "").slice(1, -1);
      if (/\b(acoustic|acustico)\b/i.test(inner)) {
        return ` ${inner} `;
      }
      return " ";
    })
    .replace(/\[[^\]]*\]/g, (m) => {
      const inner = String(m ?? "").slice(1, -1);
      if (/\b(acoustic|acustico)\b/i.test(inner)) {
        return ` ${inner} `;
      }
      return " ";
    })
    .replace(/\s*(?:ft\.?|feat\.?|featuring)\b.*$/i, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreHit(input: GeniusFindPlainLyricsInput, hit: any): number {
  const title = typeof hit?.result?.title === "string" ? hit.result.title : "";
  const fullTitle =
    typeof hit?.result?.full_title === "string" ? hit.result.full_title : "";
  const artist =
    typeof hit?.result?.primary_artist?.name === "string"
      ? hit.result.primary_artist.name
      : "";

  const wantTitle = normalizeForMatch(input.title);
  const wantArtist = normalizeForMatch(input.artist ?? "");
  const gotTitle = normalizeForMatch(title);
  const gotFullTitle = normalizeForMatch(fullTitle);
  const gotArtist = normalizeForMatch(artist);

  let score = 0;
  if (
    wantTitle &&
    (gotTitle === wantTitle || gotFullTitle.includes(wantTitle))
  ) {
    score += 4;
  } else if (
    wantTitle &&
    (gotTitle.includes(wantTitle) || wantTitle.includes(gotTitle))
  ) {
    score += 2;
  }

  if (wantArtist) {
    if (gotArtist === wantArtist) score += 3;
    else if (gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist))
      score += 2;
  }

  const isLyricsState =
    typeof hit?.type === "string" && hit.type.toLowerCase() === "song";
  if (isLyricsState) score += 1;

  return score;
}

export class GeniusHttpClient implements IGeniusClient {
  constructor(
    private readonly apiHttp: AxiosInstance,
    private readonly pageHttp: AxiosInstance,
  ) {}

  async findPlainLyrics(
    input: GeniusFindPlainLyricsInput,
  ): Promise<GeniusPlainLyrics | null> {
    const q = `${String(input.title ?? "").trim()} ${String(
      input.artist ?? "",
    ).trim()}`.trim();
    if (!q) return null;

    const response = await this.apiHttp.get("/search", {
      params: { q },
    });

    const hits = response?.data?.response?.hits;
    const list = Array.isArray(hits) ? hits : [];
    if (!list.length) return null;

    const scored = list
      .map((h: any) => ({ hit: h, score: scoreHit(input, h) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = scored[0]?.hit?.result;
    if (!best) return null;

    const songId = typeof best.id === "number" ? best.id : null;
    const url = typeof best.url === "string" ? best.url : "";
    if (!songId || !url) return null;

    const html = await this.pageHttp.get(url).then((r) => String(r.data ?? ""));

    const chunks: string[] = [];
    const regex =
      /<div[^>]*data-lyrics-container=\"true\"[^>]*>([\s\S]*?)<\/div>/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html))) {
      if (match[1]) chunks.push(match[1]);
    }

    const raw = chunks.length ? chunks.join("\n") : "";
    const lyrics = raw ? stripTagsPreserveBreaks(raw) : "";
    if (!lyrics.trim()) return null;

    return {
      lyrics,
      meta: {
        song_id: songId,
        url,
        full_title:
          typeof best.full_title === "string" ? best.full_title : undefined,
        primary_artist_name:
          typeof best?.primary_artist?.name === "string"
            ? best.primary_artist.name
            : undefined,
      },
    };
  }

  static create(config: {
    accessToken: string;
    timeoutMs: number;
  }): GeniusHttpClient {
    const httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      keepAliveMsecs: 15_000,
    });

    const apiHttp = axios.create({
      baseURL: "https://api.genius.com",
      timeout: config.timeoutMs,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "soundmeet-backend (genius;lyrics-fallback)",
      },
      httpsAgent,
      family: 4,
    });

    const pageHttp = axios.create({
      timeout: config.timeoutMs,
      headers: {
        "User-Agent": "soundmeet-backend (genius;lyrics-fallback)",
      },
      httpsAgent,
      family: 4,
    });

    return new GeniusHttpClient(apiHttp, pageHttp);
  }
}

export class GeniusNoopClient implements IGeniusClient {
  async findPlainLyrics(_input: GeniusFindPlainLyricsInput) {
    return null;
  }
}
