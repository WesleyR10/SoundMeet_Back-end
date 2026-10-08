import { Chance } from "chance";

import { Uuid } from "../../shared/domain";
import {
  Performance,
  PerformanceId,
  PerformedSong,
} from "./performance.aggregate";
import { PerformanceStatus } from "./value-objects/performance-status.vo";

type PropOrFactory<T> = T | ((index: number) => T);

export class PerformanceFakeBuilder<TBuild = any> {
  private _performance_id: PropOrFactory<PerformanceId | undefined> = undefined;
  private _event_id: PropOrFactory<Uuid> = () => new Uuid();
  private _establishment_id: PropOrFactory<Uuid> = () => new Uuid();
  private _musician_id: PropOrFactory<Uuid> = () => new Uuid();
  private _band_id: PropOrFactory<Uuid | null> = null;
  private _status: PropOrFactory<PerformanceStatus> = () =>
    PerformanceStatus.live();
  private _started_at: PropOrFactory<Date> = () => new Date();
  private _ended_at: PropOrFactory<Date | null> = null;
  private _songs: PropOrFactory<PerformedSong[]> = () => [];
  private _count: number;
  private chance: Chance.Chance;
  private countObjs: number;

  static aPerformance() {
    return new PerformanceFakeBuilder<Performance>();
  }

  static thePerformances(count: number) {
    return new PerformanceFakeBuilder<Performance[]>(count);
  }

  private constructor(count: number = 1) {
    this._count = count;
    this.countObjs = count;
    this.chance = new Chance();
  }

  withPerformanceId(value: PropOrFactory<PerformanceId>) {
    this._performance_id = value;
    return this;
  }

  withEventId(value: PropOrFactory<Uuid>) {
    this._event_id = value;
    return this;
  }

  withEstablishmentId(value: PropOrFactory<Uuid>) {
    this._establishment_id = value;
    return this;
  }

  withMusicianId(value: PropOrFactory<Uuid>) {
    this._musician_id = value;
    return this;
  }

  withBandId(value: PropOrFactory<Uuid | null>) {
    this._band_id = value;
    return this;
  }

  withStartedAt(value: PropOrFactory<Date>) {
    this._started_at = value;
    return this;
  }

  withSongs(value: PropOrFactory<PerformedSong[]>) {
    this._songs = value;
    return this;
  }

  /**
   * Set encerrado, com `ended_at` coerente com `started_at`.
   *
   * Existe como atalho porque montar isso à mão em cada teste é onde nasce o
   * `ended_at < started_at` que a invariante 6 proíbe — a fixture não deveria
   * ser capaz de produzir estado que o agregado recusa.
   */
  ended(ended_at?: Date) {
    this._status = () => PerformanceStatus.ended();
    this._ended_at = (index: number) =>
      ended_at ??
      new Date(this._call(this._started_at, index).getTime() + 3_600_000);
    return this;
  }

  /** N músicas fechadas em sequência, cada uma com 4 minutos. */
  withPlayedSongs(count: number) {
    this._songs = (index: number) => {
      const base = this._call(this._started_at, index).getTime();
      return new Array(count).fill(undefined).map((_, i) => {
        const startedAt = new Date(base + i * 240_000);
        return new PerformedSong({
          performed_song_id: this.chance.guid({ version: 4 }),
          title: this.chance.sentence({ words: 3 }).replace(".", ""),
          artist: this.chance.name(),
          position: i + 1,
          started_at: startedAt,
          ended_at: new Date(startedAt.getTime() + 240_000),
        });
      });
    };
    return this;
  }

  build(): TBuild {
    const performances = new Array(this.countObjs).fill(undefined).map(
      (_, i) =>
        new Performance({
          performance_id: this._call(this._performance_id, i),
          event_id: this._call(this._event_id, i),
          establishment_id: this._call(this._establishment_id, i),
          musician_id: this._call(this._musician_id, i),
          band_id: this._call(this._band_id, i),
          status: this._call(this._status, i),
          started_at: this._call(this._started_at, i),
          ended_at: this._call(this._ended_at, i),
          songs: this._call(this._songs, i),
        }),
    );
    return (this.countObjs === 1 ? performances[0] : performances) as TBuild;
  }

  private _call<T>(prop: PropOrFactory<T>, index: number): T {
    return typeof prop === "function"
      ? (prop as (index: number) => T)(index)
      : prop;
  }
}
