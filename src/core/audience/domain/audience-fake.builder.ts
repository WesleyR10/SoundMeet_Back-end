import { Chance } from "chance";

import { Audience, AudienceId } from "./audience.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class AudienceFakeBuilder<TBuild = any> {
  private _id: PropOrFactory<AudienceId> | undefined = undefined;
  private _name: PropOrFactory<string> = () => this.chance.name();
  private _email: PropOrFactory<string> = () => this.chance.email();
  private _nickname: PropOrFactory<string | null> = () => null;
  private _avatar: PropOrFactory<string | null> = () => null;
  private _phone: PropOrFactory<string | null> = () => null;
  private _favorite_genres: PropOrFactory<string[]> = () => [
    "Rock",
    "Pop",
    "Jazz",
  ];

  private _favorite_artists: PropOrFactory<string[]> = () => [
    "The Beatles",
    "Queen",
  ];
  private _favorite_instruments: PropOrFactory<string[]> = () => [
    "Guitar",
    "Piano",
  ];
  private _is_active: PropOrFactory<boolean> = () => true;
  private _created_at: PropOrFactory<Date> | undefined = undefined;
  private _updated_at: PropOrFactory<Date> | undefined = undefined;
  // Gamification properties
  private _total_points: PropOrFactory<number> = () => 0;
  private _current_level: PropOrFactory<number> = () => 1;
  private _badges: PropOrFactory<string[]> = () => ["Iniciante", "Sugestor"];
  // Analytics properties
  private _total_scans: PropOrFactory<number> = () =>
    this.chance.integer({ min: 0, max: 100 });
  private _total_requests: PropOrFactory<number> = () =>
    this.chance.integer({ min: 0, max: 50 });
  private _total_tips: PropOrFactory<number> = () =>
    this.chance.integer({ min: 0, max: 1000 });
  private _total_social_shares: PropOrFactory<number> = () =>
    this.chance.integer({ min: 0, max: 20 });

  private countObjs;
  private chance: Chance.Chance;

  static aAudience() {
    return new AudienceFakeBuilder<Audience>();
  }

  static anAudience() {
    return new AudienceFakeBuilder<Audience>();
  }

  static anInactiveAudience() {
    return new AudienceFakeBuilder<Audience>().deactivate();
  }

  static theAudiences(countObjs: number) {
    return new AudienceFakeBuilder<Audience[]>(countObjs);
  }

  static aAudienceWithPoints(points: number) {
    return new AudienceFakeBuilder<Audience>().withTotalPoints(points);
  }

  static aTopFan() {
    return new AudienceFakeBuilder<Audience>()
      .withTotalPoints(5000)
      .withCurrentLevel(5)
      .withBadges([
        "Iniciante",
        "Sugestor",
        "Acertador",
        "Apoiador",
        "Super Fã",
      ])
      .withTotalScans(100)
      .withTotalRequests(50)
      .withTotalTips(2000)
      .withTotalSocialShares(25);
  }

  static anActiveSupporter(): Audience {
    return AudienceFakeBuilder.aAudience()
      .withName("Active Supporter")
      .withFavoriteGenres(["Pop", "Electronic"])
      .build();
  }

  static someAudiences(count: number): Audience[] {
    return Array.from({ length: count }, () =>
      AudienceFakeBuilder.aAudience().build(),
    );
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withId(valueOrFactory: PropOrFactory<AudienceId>) {
    this._id = valueOrFactory;
    return this;
  }

  withName(valueOrFactory: PropOrFactory<string>) {
    this._name = valueOrFactory;
    return this;
  }

  withEmail(valueOrFactory: PropOrFactory<string>) {
    this._email = valueOrFactory;
    return this;
  }

  withNickname(valueOrFactory: PropOrFactory<string | null>) {
    this._nickname = valueOrFactory;
    return this;
  }

  withAvatar(valueOrFactory: PropOrFactory<string | null>) {
    this._avatar = valueOrFactory;
    return this;
  }

  withPhone(valueOrFactory: PropOrFactory<string | null>) {
    this._phone = valueOrFactory;
    return this;
  }

  withFavoriteGenres(valueOrFactory: PropOrFactory<string[]>) {
    this._favorite_genres = valueOrFactory;
    return this;
  }

  withFavoriteArtists(valueOrFactory: PropOrFactory<string[]>) {
    this._favorite_artists = valueOrFactory;
    return this;
  }

  withFavoriteInstruments(valueOrFactory: PropOrFactory<string[]>) {
    this._favorite_instruments = valueOrFactory;
    return this;
  }

  withTotalPoints(valueOrFactory: PropOrFactory<number>) {
    this._total_points = valueOrFactory;
    return this;
  }

  withCurrentLevel(valueOrFactory: PropOrFactory<number>) {
    this._current_level = valueOrFactory;
    return this;
  }

  withBadges(valueOrFactory: PropOrFactory<string[]>) {
    this._badges = valueOrFactory;
    return this;
  }

  withTotalScans(valueOrFactory: PropOrFactory<number>) {
    this._total_scans = valueOrFactory;
    return this;
  }

  withTotalRequests(valueOrFactory: PropOrFactory<number>) {
    this._total_requests = valueOrFactory;
    return this;
  }

  withTotalTips(valueOrFactory: PropOrFactory<number>) {
    this._total_tips = valueOrFactory;
    return this;
  }

  withTotalSocialShares(valueOrFactory: PropOrFactory<number>) {
    this._total_social_shares = valueOrFactory;
    return this;
  }

  withIsActive(valueOrFactory: PropOrFactory<boolean>) {
    this._is_active = valueOrFactory;
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

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  withUpdatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._updated_at = valueOrFactory;
    return this;
  }

  // Métodos de validação para testes
  withInvalidNameEmpty(value: "" = ""): this {
    this._name = value;
    return this;
  }

  withInvalidNameTooLong(value?: string): this {
    this._name = value ?? "a".repeat(256);
    return this;
  }

  withInvalidEmailEmpty(value: "" = ""): this {
    this._email = value;
    return this;
  }

  withInvalidEmailFormat(value?: string): this {
    this._email = value ?? "invalid-email";
    return this;
  }

  withInvalidEmailTooLong(value?: string): this {
    this._email = value ?? "a".repeat(256);
    return this;
  }

  withInvalidFavoriteGenresEmpty(value: string[] = []): this {
    this._favorite_genres = value;
    return this;
  }

  build(): TBuild {
    const audiences = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const audience = new Audience({
          id: !this._id ? undefined : this.callFactory(this._id, index),
          name: this.callFactory(this._name, index),
          email: this.callFactory(this._email, index),
          nickname: this.callFactory(this._nickname, index),
          avatar: this.callFactory(this._avatar, index),
          phone: this.callFactory(this._phone, index),
          preferences: {
            favoriteGenres: this.callFactory(this._favorite_genres, index),
            favoriteArtists: this.callFactory(this._favorite_artists, index),
            favoriteInstruments: this.callFactory(
              this._favorite_instruments,
              index,
            ),
            preferredLanguages: ["pt-BR"],
            notificationSettings: {
              pushNotifications: true,
              emailNotifications: true,
              smsNotifications: false,
              eventReminders: true,
              musicianUpdates: true,
              promotionalOffers: false,
            },
            privacySettings: {
              profileVisibility: "public",
              showFavoriteGenres: true,
              showFavoriteArtists: true,
              allowMusicianContact: true,
              shareListeningHistory: false,
            },
            discoverySettings: {
              autoSuggestMusicians: true,
              showTrendingContent: true,
              personalizedRecommendations: true,
              exploreNewGenres: true,
            },
          },
          points: this.callFactory(this._total_points, index),
          level: this.callFactory(this._current_level, index),
          badges: this.callFactory(this._badges, index),
          is_active: this.callFactory(this._is_active, index),
          created_at: !this._created_at
            ? undefined
            : this.callFactory(this._created_at, index),
          updated_at: !this._updated_at
            ? undefined
            : this.callFactory(this._updated_at, index),
        });
        audience.validate();
        return audience;
      });
    return this.countObjs === 1 ? (audiences[0] as any) : (audiences as any);
  }

  get id() {
    return this.getValue("id");
  }

  get name() {
    return this.getValue("name");
  }

  get email() {
    return this.getValue("email");
  }

  get nickname() {
    return this.getValue("nickname");
  }

  get avatar() {
    return this.getValue("avatar");
  }

  get phone() {
    return this.getValue("phone");
  }

  get favorite_genres() {
    return this.getValue("favorite_genres");
  }

  get favorite_artists() {
    return this.getValue("favorite_artists");
  }

  get favorite_instruments() {
    return this.getValue("favorite_instruments");
  }

  get total_points() {
    return this.getValue("total_points");
  }

  get current_level() {
    return this.getValue("current_level");
  }

  get badges() {
    return this.getValue("badges");
  }

  get total_scans() {
    return this.getValue("total_scans");
  }

  get total_requests() {
    return this.getValue("total_requests");
  }

  get total_tips() {
    return this.getValue("total_tips");
  }

  get total_social_shares() {
    return this.getValue("total_social_shares");
  }

  get is_active() {
    return this.getValue("is_active");
  }

  get created_at() {
    return this.getValue("created_at");
  }

  get updated_at() {
    return this.getValue("updated_at");
  }

  private getValue(prop: any) {
    const optional = ["id", "created_at", "updated_at"];
    const privateProp = `_${prop}` as keyof this;
    if (!this[privateProp] && optional.includes(prop)) {
      throw new Error(
        `Property ${prop} not have a factory, use 'with' methods`,
      );
    }
    return this.callFactory(this[privateProp] as any, 0);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
