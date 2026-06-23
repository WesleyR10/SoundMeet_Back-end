import { Chance } from "chance";

import { Uuid } from "../../shared/domain";
import { MusicLibrary, MusicLibraryId } from "./music-library.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class MusicLibraryFakeBuilder<TBuild = any> {
  private _music_library_id: PropOrFactory<MusicLibraryId> | undefined =
    undefined;
  private _musician_id: PropOrFactory<Uuid> = (_index) => new Uuid();
  private _title: PropOrFactory<string> = (_index) =>
    this.chance.sentence({ words: 3 });
  private _artist: PropOrFactory<string> = (_index) => this.chance.name();
  private _genre: PropOrFactory<string | null> = (_index) => "Rock";
  private _key: PropOrFactory<string | null> = (_index) => "C";
  private _bpm: PropOrFactory<number | null> = (_index) =>
    this.chance.integer({ min: 60, max: 180 });
  private _lyrics: PropOrFactory<string | null> = (_index) => null;
  private _notes: PropOrFactory<string | null> = (_index) => null;
  private _difficulty: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 1, max: 5 });
  private _is_favorite: PropOrFactory<boolean> = (_index) => false;
  private _source: PropOrFactory<string | null> = (_index) => null;
  private _source_id: PropOrFactory<string | null> = (_index) => null;
  private _created_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;

  static aMusicLibrary() {
    return new MusicLibraryFakeBuilder<MusicLibrary>();
  }

  static theMusicLibraries(countObjs: number) {
    return new MusicLibraryFakeBuilder<MusicLibrary[]>(countObjs);
  }

  private chance: Chance.Chance;

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withMusicLibraryId(valueOrFactory: PropOrFactory<MusicLibraryId>) {
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

  withGenre(valueOrFactory: PropOrFactory<string | null>) {
    this._genre = valueOrFactory;
    return this;
  }

  withKey(valueOrFactory: PropOrFactory<string | null>) {
    this._key = valueOrFactory;
    return this;
  }

  withBpm(valueOrFactory: PropOrFactory<number | null>) {
    this._bpm = valueOrFactory;
    return this;
  }

  withLyrics(valueOrFactory: PropOrFactory<string | null>) {
    this._lyrics = valueOrFactory;
    return this;
  }

  withNotes(valueOrFactory: PropOrFactory<string | null>) {
    this._notes = valueOrFactory;
    return this;
  }

  withDifficulty(valueOrFactory: PropOrFactory<number>) {
    this._difficulty = valueOrFactory;
    return this;
  }

  withSource(
    valueOrFactory: PropOrFactory<string | null>,
    sourceId?: PropOrFactory<string | null>,
  ) {
    this._source = valueOrFactory;
    if (sourceId !== undefined) {
      this._source_id = sourceId;
    }
    return this;
  }

  favorite() {
    this._is_favorite = true;
    return this;
  }

  notFavorite() {
    this._is_favorite = false;
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  withInvalidTitleEmpty(value: "" = "") {
    this._title = value;
    return this;
  }

  withInvalidTitleTooLong(value?: string) {
    this._title = value ?? this.chance.word({ length: 256 });
    return this;
  }

  withInvalidArtistEmpty(value: "" = "") {
    this._artist = value;
    return this;
  }

  withInvalidDifficultyTooLow(value: number = 0) {
    this._difficulty = value;
    return this;
  }

  withInvalidDifficultyTooHigh(value: number = 6) {
    this._difficulty = value;
    return this;
  }

  build(): TBuild {
    const musicLibraries = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const entity = new MusicLibrary({
          music_library_id: !this._music_library_id
            ? undefined
            : this.callFactory(this._music_library_id, index),
          musician_id: this.callFactory(this._musician_id, index),
          title: this.callFactory(this._title, index),
          artist: this.callFactory(this._artist, index),
          genre: this.callFactory(this._genre, index),
          key: this.callFactory(this._key, index),
          bpm: this.callFactory(this._bpm, index),
          lyrics: this.callFactory(this._lyrics, index),
          notes: this.callFactory(this._notes, index),
          difficulty: this.callFactory(this._difficulty, index),
          is_favorite: this.callFactory(this._is_favorite, index),
          source: this.callFactory(this._source, index),
          source_id: this.callFactory(this._source_id, index),
          ...(this._created_at && {
            created_at: this.callFactory(this._created_at, index),
          }),
        });
        entity.validate();
        return entity;
      });
    return this.countObjs === 1
      ? (musicLibraries[0] as any)
      : (musicLibraries as any);
  }

  get music_library_id() {
    return this.getValue("music_library_id");
  }

  get musician_id() {
    return this.getValue("musician_id");
  }

  get title() {
    return this.getValue("title");
  }

  get artist() {
    return this.getValue("artist");
  }

  get genre() {
    return this.getValue("genre");
  }

  get key() {
    return this.getValue("key");
  }

  get bpm() {
    return this.getValue("bpm");
  }

  get lyrics() {
    return this.getValue("lyrics");
  }

  get notes() {
    return this.getValue("notes");
  }

  get difficulty() {
    return this.getValue("difficulty");
  }

  get is_favorite() {
    return this.getValue("is_favorite");
  }

  get source() {
    return this.getValue("source");
  }

  get source_id() {
    return this.getValue("source_id");
  }

  get created_at() {
    return this.getValue("created_at");
  }

  private getValue(prop: any) {
    const optional = ["music_library_id", "created_at"];
    const privateProp = `_${prop}` as keyof this;
    if (!this[privateProp] && optional.includes(prop)) {
      throw new Error(
        `Property ${prop} not have a factory, use 'with' methods`,
      );
    }
    return this.callFactory(this[privateProp], 0);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
