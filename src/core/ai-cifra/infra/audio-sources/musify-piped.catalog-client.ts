import axios, { AxiosInstance } from "axios";

export type MusifyCatalogStreamItem = {
  title: string;
  artist: string;
  youtube_video_id: string;
};

export type MusifyCatalogPlaylistItem = {
  playlist_id: string;
  title: string;
  url: string;
};

export class MusifyPipedCatalogClient {
  private constructor(private readonly https: AxiosInstance[]) {}

  static create(input: { baseURL: string; timeoutMs: number }) {
    const rawBaseURLs = `${input.baseURL}`
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const fallbackBaseURLs = [
      "https://pipedapi.tokhmi.xyz",
      "https://pipedapi.moomoo.me",
      "https://pipedapi.syncpundit.io",
      "https://api.looleh.xyz",
      "https://piped-api.lunar.icu",
    ];

    const baseURLs = Array.from(new Set([...rawBaseURLs, ...fallbackBaseURLs]));

    const https = baseURLs.map((baseURL) =>
      axios.create({
        baseURL,
        timeout: input.timeoutMs,
        maxRedirects: 3,
        headers: {
          Accept: "application/json",
        },
      }),
    );

    return new MusifyPipedCatalogClient(https);
  }

  async getTrending(input: { region: string; limit: number }) {
    let lastError: unknown = null;

    for (const http of this.https) {
      try {
        const response = await http.get<any[]>("/trending", {
          params: { region: input.region },
        });
        const streams = Array.isArray(response.data) ? response.data : [];
        const items: MusifyCatalogStreamItem[] = [];

        for (const s of streams) {
          if (items.length >= input.limit) break;
          const duration =
            typeof s?.duration === "number" && Number.isFinite(s.duration)
              ? s.duration
              : null;
          if (typeof duration === "number" && duration <= 0) continue;
          const youtubeVideoId = this.extractYoutubeVideoIdFromPipedUrl(
            String(s?.url ?? ""),
          );
          if (!youtubeVideoId) continue;
          const title = String(s?.title ?? "")
            .trim()
            .slice(0, 255);
          const uploader = String(s?.uploaderName ?? s?.uploader ?? "").trim();
          const artist = (uploader.length > 0 ? uploader : "Unknown").slice(
            0,
            255,
          );
          if (!title) continue;
          items.push({ title, artist, youtube_video_id: youtubeVideoId });
        }

        return items;
      } catch (e) {
        lastError = e;
      }
    }

    if (lastError) throw lastError;
    return [];
  }

  async getPlaylistItems(input: { playlistId: string; limit: number }) {
    if (!input.playlistId) {
      throw new Error("playlistId é obrigatório");
    }

    let lastError: unknown = null;
    for (const http of this.https) {
      try {
        const first = await http.get<any>(
          `/playlists/${encodeURIComponent(input.playlistId)}`,
        );
        const items: MusifyCatalogStreamItem[] = [];

        const collect = (streams: any[]) => {
          for (const s of streams ?? []) {
            if (items.length >= input.limit) break;
            const youtubeVideoId = this.extractYoutubeVideoIdFromPipedUrl(
              String(s?.url ?? ""),
            );
            if (!youtubeVideoId) continue;
            const title = String(s?.title ?? "")
              .trim()
              .slice(0, 255);
            const uploader = String(
              s?.uploaderName ?? s?.uploader ?? "",
            ).trim();
            const artist = (uploader.length > 0 ? uploader : "Unknown").slice(
              0,
              255,
            );
            if (!title) continue;
            items.push({ title, artist, youtube_video_id: youtubeVideoId });
          }
        };

        collect(
          Array.isArray(first.data?.relatedStreams)
            ? first.data.relatedStreams
            : [],
        );

        let nextpage =
          typeof first.data?.nextpage === "string" ? first.data.nextpage : "";
        while (items.length < input.limit && nextpage) {
          const next = await http.get<any>(
            `/nextpage/playlists/${encodeURIComponent(input.playlistId)}`,
            { params: { nextpage } },
          );
          collect(
            Array.isArray(next.data?.relatedStreams)
              ? next.data.relatedStreams
              : [],
          );
          nextpage =
            typeof next.data?.nextpage === "string" ? next.data.nextpage : "";
        }

        return items;
      } catch (e) {
        lastError = e;
      }
    }

    if (lastError) throw lastError;
    return [];
  }

  async searchPlaylists(input: { query: string; limit: number }) {
    const query = input.query.trim();
    if (!query) {
      throw new Error("query é obrigatório");
    }

    let lastError: unknown = null;
    for (const http of this.https) {
      try {
        const response = await http.get<any>("/search", {
          params: {
            q: query,
            filter: "playlists",
          },
        });

        const items =
          Array.isArray(response.data?.items) && response.data.items.length > 0
            ? response.data.items
            : Array.isArray(response.data)
              ? response.data
              : [];

        const out: MusifyCatalogPlaylistItem[] = [];
        for (const it of items) {
          if (out.length >= input.limit) break;
          const url = String(it?.url ?? "").trim();
          const playlistId = this.extractPlaylistIdFromPipedUrl(url);
          if (!playlistId) continue;
          const title = String(it?.name ?? it?.title ?? "")
            .trim()
            .slice(0, 255);
          out.push({
            playlist_id: playlistId,
            title: title || playlistId,
            url,
          });
        }

        return out;
      } catch (e) {
        lastError = e;
      }
    }

    if (lastError) throw lastError;
    return [];
  }

  async searchPlaylistsItems(input: {
    query: string;
    playlistsLimit: number;
    limit: number;
  }) {
    const query = input.query.trim() || "Top Músicas Brasileiras";
    const playlistsLimit = Math.max(1, Math.min(20, input.playlistsLimit));
    const playlists = await this.searchPlaylists({
      query,
      limit: playlistsLimit,
    });

    const dedupe = new Set<string>();
    const out: MusifyCatalogStreamItem[] = [];

    for (const p of playlists) {
      if (out.length >= input.limit) break;
      const remaining = input.limit - out.length;
      const perPlaylistLimit = Math.max(1, Math.min(100, remaining));
      const playlistItems = await this.getPlaylistItems({
        playlistId: p.playlist_id,
        limit: perPlaylistLimit,
      });
      for (const item of playlistItems) {
        if (out.length >= input.limit) break;
        if (dedupe.has(item.youtube_video_id)) continue;
        dedupe.add(item.youtube_video_id);
        out.push(item);
      }
    }

    return out;
  }

  async searchVideos(input: { query: string; limit: number }) {
    const query = input.query.trim();
    if (!query) {
      throw new Error("query é obrigatório");
    }

    let lastError: unknown = null;
    for (const http of this.https) {
      try {
        const response = await http.get<any>("/search", {
          params: {
            q: query,
            filter: "videos",
          },
        });

        const items =
          Array.isArray(response.data?.items) && response.data.items.length > 0
            ? response.data.items
            : Array.isArray(response.data)
              ? response.data
              : [];

        const out: MusifyCatalogStreamItem[] = [];
        for (const it of items) {
          if (out.length >= input.limit) break;
          const youtubeVideoId = this.extractYoutubeVideoIdFromPipedUrl(
            String(it?.url ?? ""),
          );
          if (!youtubeVideoId) continue;
          const title = String(it?.title ?? "")
            .trim()
            .slice(0, 255);
          const uploader = String(
            it?.uploaderName ?? it?.uploader ?? "",
          ).trim();
          const artist = (uploader.length > 0 ? uploader : "Unknown").slice(
            0,
            255,
          );
          if (!title) continue;
          out.push({ title, artist, youtube_video_id: youtubeVideoId });
        }

        return out;
      } catch (e) {
        lastError = e;
      }
    }

    if (lastError) throw lastError;
    return [];
  }

  private extractYoutubeVideoIdFromPipedUrl(url: string) {
    if (typeof url !== "string") return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    const candidate = trimmed.startsWith("http")
      ? trimmed
      : `https://piped.local${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;

    try {
      const u = new URL(candidate);
      const v = u.searchParams.get("v");
      return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
    } catch {
      const match = trimmed.match(/[?&]v=([^&]+)/i);
      return match?.[1] ? String(match[1]).trim() : null;
    }
  }

  private extractPlaylistIdFromPipedUrl(url: string) {
    if (typeof url !== "string") return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    const candidate = trimmed.startsWith("http")
      ? trimmed
      : `https://piped.local${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;

    try {
      const u = new URL(candidate);
      const list = u.searchParams.get("list");
      return typeof list === "string" && list.trim().length > 0
        ? list.trim()
        : null;
    } catch {
      const match = trimmed.match(/[?&]list=([^&]+)/i);
      return match?.[1] ? String(match[1]).trim() : null;
    }
  }
}
