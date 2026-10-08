import { Chance } from "chance";

import { Musician, MusicianId } from "./musician.aggregate";
import { PresentationAudio } from "./value-objects/presentation-audio.vo";

type PropOrFactory<T> = T | ((index: number) => T);

export class MusicianFakeBuilder<TBuild = any> {
  private _id: PropOrFactory<MusicianId> | undefined = undefined;
  private _name: PropOrFactory<string> = (_index) => this.chance.name();
  private _stage_name: PropOrFactory<string | null> = (_index) => null;
  private _email: PropOrFactory<string> = (_index) => this.chance.email();
  private _bio: PropOrFactory<string | null> = (_index) => null;
  private _avatar: PropOrFactory<string | null> = (_index) => null;
  private _presentation_audio: PropOrFactory<PresentationAudio | null> = (
    _index,
  ) => null;
  private _phone: PropOrFactory<string | null> = (_index) => null;
  private _cpf: PropOrFactory<string | null> = (_index) => null;
  private _cnpj: PropOrFactory<string | null> = (_index) => null;
  private _genres: PropOrFactory<string[]> = (_index) => ["Rock", "Pop"];
  private _instruments: PropOrFactory<string[]> = (_index) => [
    "Guitar",
    "Piano",
  ];
  private _experience_years: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 0, max: 50 });
  private _is_active: PropOrFactory<boolean> = (_index) => true;
  private _open_to_gigs: PropOrFactory<boolean | null> = (_index) => null;
  private _accepts_requests_outside_repertoire: PropOrFactory<boolean> = (
    _index,
  ) => true;
  private _created_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;

  static aMusician() {
    return new MusicianFakeBuilder<Musician>();
  }

  static theMusicians(countObjs: number) {
    return new MusicianFakeBuilder<Musician[]>(countObjs);
  }

  private chance: Chance.Chance;

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withMusicianId(valueOrFactory: PropOrFactory<MusicianId>) {
    this._id = valueOrFactory;
    return this;
  }

  withName(valueOrFactory: PropOrFactory<string>) {
    this._name = valueOrFactory;
    return this;
  }

  withStageName(valueOrFactory: PropOrFactory<string | null>) {
    this._stage_name = valueOrFactory;
    return this;
  }

  withEmail(valueOrFactory: PropOrFactory<string>) {
    this._email = valueOrFactory;
    return this;
  }

  withBio(valueOrFactory: PropOrFactory<string | null>) {
    this._bio = valueOrFactory;
    return this;
  }

  withAvatar(valueOrFactory: PropOrFactory<string | null>) {
    this._avatar = valueOrFactory;
    return this;
  }

  withPresentationAudio(
    valueOrFactory: PropOrFactory<PresentationAudio | null>,
  ) {
    this._presentation_audio = valueOrFactory;
    return this;
  }

  withPhone(valueOrFactory: PropOrFactory<string | null>) {
    this._phone = valueOrFactory;
    return this;
  }

  withCpf(valueOrFactory: PropOrFactory<string | null>) {
    this._cpf = valueOrFactory;
    return this;
  }

  /** Músico MEI. Use `generateValidCnpj()` para não colidir no índice único. */
  withCnpj(valueOrFactory: PropOrFactory<string | null>) {
    this._cnpj = valueOrFactory;
    return this;
  }

  withGenres(valueOrFactory: PropOrFactory<string[]>) {
    this._genres = valueOrFactory;
    return this;
  }

  withInstruments(valueOrFactory: PropOrFactory<string[]>) {
    this._instruments = valueOrFactory;
    return this;
  }

  withExperienceYears(valueOrFactory: PropOrFactory<number>) {
    this._experience_years = valueOrFactory;
    return this;
  }

  activate() {
    this._is_active = true;
    return this;
  }

  deactivate() {
    this._is_active = false;
    return this;
  }

  withOpenToGigs(valueOrFactory: PropOrFactory<boolean | null>) {
    this._open_to_gigs = valueOrFactory;
    return this;
  }

  withcreated_at(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    return this.withcreated_at(valueOrFactory);
  }

  withInvalidNameEmpty(value: "" = "") {
    this._name = value;
    return this;
  }

  withInvalidNameNotAString(value?: any) {
    this._name = value ?? 5;
    return this;
  }

  withInvalidNameTooLong(value?: string) {
    this._name = value ?? this.chance.word({ length: 256 });
    return this;
  }

  withInvalidEmailEmpty(value: "" = "") {
    this._email = value;
    return this;
  }

  withInvalidEmailNotAString(value?: any) {
    this._email = value ?? 5;
    return this;
  }

  withInvalidEmailFormat(value?: string) {
    this._email = value ?? "invalid-email";
    return this;
  }

  withInvalidStageNameTooLong(value?: string) {
    this._stage_name = value ?? this.chance.word({ length: 256 });
    return this;
  }

  withInvalidBioTooLong(value?: string) {
    this._bio = value ?? "a".repeat(1001);
    return this;
  }

  withInvalidGenresEmpty(value: string[] = []) {
    this._genres = value;
    return this;
  }

  withInvalidInstrumentsEmpty(value: string[] = []) {
    this._instruments = value;
    return this;
  }

  build(): TBuild {
    const musicians = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const musician = new Musician({
          musician_id: !this._id
            ? undefined
            : this.callFactory(this._id, index),
          name: this.callFactory(this._name, index),
          stage_name: this.callFactory(this._stage_name, index),
          email: this.callFactory(this._email, index),
          bio: this.callFactory(this._bio, index),
          avatar: this.callFactory(this._avatar, index),
          presentation_audio: this.callFactory(this._presentation_audio, index),
          phone: this.callFactory(this._phone, index),
          cpf: this.callFactory(this._cpf, index),
          cnpj: this.callFactory(this._cnpj, index),
          genres: this.callFactory(this._genres, index),
          instruments: this.callFactory(this._instruments, index),
          experience_years: this.callFactory(this._experience_years, index),
          is_active: this.callFactory(this._is_active, index),
          open_to_gigs: this.callFactory(this._open_to_gigs, index),
          accepts_requests_outside_repertoire: this.callFactory(
            this._accepts_requests_outside_repertoire,
            index,
          ),
          ...(this._created_at && {
            created_at: this.callFactory(this._created_at, index),
          }),
        });
        musician.validate();
        musician.generateQRCode();
        return musician;
      });
    return this.countObjs === 1 ? (musicians[0] as any) : (musicians as any);
  }

  get id() {
    return this.getValue("id");
  }

  get name() {
    return this.getValue("name");
  }

  get stage_name() {
    return this.getValue("stage_name");
  }

  get email() {
    return this.getValue("email");
  }

  get bio() {
    return this.getValue("bio");
  }

  get avatar() {
    return this.getValue("avatar");
  }

  get phone() {
    return this.getValue("phone");
  }

  get cpf() {
    return this.getValue("cpf");
  }

  get cnpj() {
    return this.getValue("cnpj");
  }

  get genres() {
    return this.getValue("genres");
  }

  get instruments() {
    return this.getValue("instruments");
  }

  get experience_years() {
    return this.getValue("experience_years");
  }

  get is_active() {
    return this.getValue("is_active");
  }

  get accepts_requests_outside_repertoire() {
    return this.getValue("accepts_requests_outside_repertoire");
  }

  get open_to_gigs() {
    return this.getValue("open_to_gigs");
  }

  get created_at() {
    return this.getValue("created_at");
  }

  private getValue(prop: any) {
    const optional = ["id", "created_at"];
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
