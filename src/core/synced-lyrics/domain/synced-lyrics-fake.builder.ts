import { Chance } from "chance";

import { Uuid } from "../../shared/domain";
import { InvariantViolationError } from "../../shared/domain/errors/invariant-violation.error";
import { SyncedLyrics, SyncedLyricsId } from "./synced-lyrics.aggregate";
import { LrcParser } from "./value-objects/lrc.vo";

type PropOrFactory<T> = T | ((index: number) => T);

export class SyncedLyricsFakeBuilder<TBuild = any> {
  private _music_library_id: PropOrFactory<SyncedLyricsId> = (_index) =>
    new SyncedLyricsId();
  private _musician_id: PropOrFactory<Uuid> = (_index) => new Uuid();
  private _title: PropOrFactory<string> = (_index) =>
    `Song ${this.chance.word()} ${this.chance.integer({ min: 1, max: 999 })}`;
  private _artist: PropOrFactory<string> = (_index) =>
    `Artist ${this.chance.word()} ${this.chance.integer({ min: 1, max: 999 })}`;
  private _lrc_raw: PropOrFactory<string | null> = (_index) =>
    "[00:00.00]Hello\n[00:01.00]World\n";
  private _lrc_provider: PropOrFactory<string | null> = (_index) => "ugc";
  private _created_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;
  private chance: Chance.Chance;

  static aSyncedLyrics() {
    return new SyncedLyricsFakeBuilder<SyncedLyrics>();
  }

  static theSyncedLyrics(countObjs: number) {
    return new SyncedLyricsFakeBuilder<SyncedLyrics[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withMusicLibraryId(valueOrFactory: PropOrFactory<SyncedLyricsId>) {
    this._music_library_id = valueOrFactory;
    return this;
  }

  withMusicianId(valueOrFactory: PropOrFactory<Uuid>) {
    this._musician_id = valueOrFactory;
    return this;
  }

  withTitle(valueOrFactory: PropOrFactory<string>) {
    this._title = valueOrFactory;
    return this;
  }

  withArtist(valueOrFactory: PropOrFactory<string>) {
    this._artist = valueOrFactory;
    return this;
  }

  withLrcRaw(valueOrFactory: PropOrFactory<string | null>) {
    this._lrc_raw = valueOrFactory;
    return this;
  }

  withLrcProvider(valueOrFactory: PropOrFactory<string | null>) {
    this._lrc_provider = valueOrFactory;
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  build(): TBuild {
    const items = new Array(this.countObjs).fill(undefined).map((_, index) => {
      const musicLibraryId = this.callFactory(this._music_library_id, index);
      const raw = this.callFactory(this._lrc_raw, index);
      const provider = this.callFactory(this._lrc_provider, index);
      const parsed =
        raw && provider
          ? LrcParser.parse({ raw, provider, pipeline_version: 1 })
          : null;

      const entity = new SyncedLyrics({
        music_library_id: musicLibraryId,
        musician_id: this.callFactory(this._musician_id, index),
        title: this.callFactory(this._title, index),
        artist: this.callFactory(this._artist, index),
        lrc_raw: parsed?.isOk() ? parsed.ok.raw : null,
        lrc_provider: parsed?.isOk() ? parsed.ok.provider : null,
        lrc_hash: parsed?.isOk() ? parsed.ok.hash : null,
        lrc_pipeline_version: parsed?.isOk()
          ? parsed.ok.normalized.pipeline_version
          : 1,
        lrc_normalized: parsed?.isOk() ? parsed.ok.normalized : null,
        lrc_quality_flags: parsed?.isOk() ? parsed.ok.quality.flags : [],
        lrc_coverage_ms: parsed?.isOk() ? parsed.ok.quality.coverage_ms : null,
        lrc_has_word_timestamps: parsed?.isOk()
          ? parsed.ok.quality.has_word_timestamps
          : false,
        lrc_last_synced_at: parsed?.isOk() ? new Date() : null,
        ...(this._created_at && {
          created_at: this.callFactory(this._created_at, index),
        }),
      });
      entity.validate();
      return entity;
    });

    return this.countObjs === 1 ? (items[0] as any) : (items as any);
  }

  get music_library_id() {
    return this.getValue("music_library_id");
  }

  private getValue(prop: any) {
    const optional = ["created_at"];
    const privateProp = `_${prop}` as keyof this;
    if (!this[privateProp] && optional.includes(prop)) {
      throw new InvariantViolationError(
        `Property ${prop} not have a factory, use 'with' methods`,
      );
    }
    return this.callFactory(this[privateProp] as any, 0);
  }

  private callFactory<T>(factoryOrValue: PropOrFactory<T>, index: number): T {
    return typeof factoryOrValue === "function"
      ? (factoryOrValue as any)(index)
      : factoryOrValue;
  }
}
