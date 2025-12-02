import {
  AggregateRoot,
  Uuid,
  Email,
  Phone,
  AudienceLevel,
  AudiencePoints,
  AudiencePreferences,
} from "../../shared/domain";
import { ValueObject } from "../../shared/domain/value-object";
import { AudienceValidatorFactory } from "./audience.validator";
import { AudienceFakeBuilder } from "./audience-fake.builder";
import { MusicianQRCodeScannedEvent } from "./events/musician-qr-code-scanned.event";
import { MusicRequestMadeEvent } from "./events/music-request-made.event";
import { TipSentEvent } from "./events/tip-sent.event";
import { SongVotedEvent } from "./events/song-voted.event";
import { SocialMediaSharedEvent } from "./events/social-media-shared.event";
import { MusicianIndicatedEvent } from "./events/musician-indicated.event";
import { AudienceCreatedEvent } from "./events/audience-created.event";

import { AudienceUpdatedEvent } from "./events/audience-updated.event";
import { AudiencePreferencesUpdatedEvent } from "./events/audience-preferences-updated.event";
import { AudienceLevelUpgradedEvent } from "./events/audience-level-upgraded.event";
import { AudienceBadgeEarnedEvent } from "./events/audience-badge-earned.event";

export type AudienceConstructorProps = {
  id?: AudienceId;
  email: Email | string;
  name: string;
  nickname?: string | null;
  avatar?: string | null;
  phone?: Phone | string | null;
  points?: AudiencePoints | number | { total: number; monthly: number };
  level?:
    | AudienceLevel
    | number
    | { level: number; name: string; minPoints: number; maxPoints: number };
  preferences?: AudiencePreferences | any;
  badges?: string[];
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
};

export type AudienceCreateCommand = {
  email: string;
  name: string;
  nickname?: string | null;
  avatar?: string | null;
  phone?: string | null;
  favorite_genres?: string[];
  favorite_artists?: string[];
  preferred_languages?: string[];
  is_active?: boolean;
};

export class AudienceId extends Uuid {}

export class Audience extends AggregateRoot {
  id: AudienceId;
  email: Email;
  name: string;
  nickname: string | null;
  avatar: string | null;
  phone: Phone | null;
  points: AudiencePoints;
  level: AudienceLevel;
  preferences: AudiencePreferences;
  badges: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(props: AudienceConstructorProps) {
    super();
    this.id = props.id ?? new AudienceId();

    // Handle email - create Email value object consistently
    this.email =
      props.email instanceof Email ? props.email : new Email(props.email);

    this.name = props.name;
    this.nickname = props.nickname ?? null;
    this.avatar = props.avatar ?? null;

    // Handle phone - create Phone value object consistently
    this.phone = props.phone
      ? props.phone instanceof Phone
        ? props.phone
        : new Phone(props.phone)
      : null;

    // Handle points - use AudiencePoints value object
    if (props.points instanceof AudiencePoints) {
      this.points = props.points;
    } else if (typeof props.points === "object" && props.points !== null) {
      this.points = AudiencePoints.fromData(
        props.points.total,
        props.points.monthly,
        new Date(),
      );
    } else {
      this.points = AudiencePoints.fromData(
        typeof props.points === "number" ? props.points : 0,
        0,
        new Date(),
      );
    }

    // Handle level - use AudienceLevel value object
    if (props.level instanceof AudienceLevel) {
      this.level = props.level;
    } else if (typeof props.level === "object" && props.level !== null) {
      this.level = AudienceLevel.create(props.level.level);
    } else {
      this.level = AudienceLevel.create(
        typeof props.level === "number" ? props.level : 1,
      );
    }

    // Handle preferences - use AudiencePreferences value object
    if (props.preferences instanceof AudiencePreferences) {
      this.preferences = props.preferences;
    } else if (props.preferences && typeof props.preferences === "object") {
      this.preferences = new AudiencePreferences({
        favoriteGenres:
          props.preferences.favoriteGenres ||
          props.preferences.favorite_genres ||
          [],
        favoriteArtists:
          props.preferences.favoriteArtists ||
          props.preferences.favorite_artists ||
          [],
        preferredLanguages: props.preferences.preferredLanguages ||
          props.preferences.preferred_languages || ["pt-BR"],
        location: props.preferences.location || null,
        socialLinks: props.preferences.socialLinks || props.preferences.social_links || null,
        notificationSettings: props.preferences.notificationSettings ||
          props.preferences.notification_settings || {
            pushNotifications: true,
            emailNotifications: true,
            smsNotifications: false,
            musicRequestNotifications: true,
            tipNotifications: true,
            eventNotifications: true,
            rankingNotifications: true,
          },
        privacySettings: props.preferences.privacySettings ||
          props.preferences.privacy_settings || {
            profileVisibility: "public",
            showRealName: true,
            showLocation: false,
            showFavoriteGenres: true,
            showFavoriteArtists: true,
            showTipHistory: false,
            showRanking: true,
          },
        musicDiscoverySettings: props.preferences.musicDiscoverySettings ||
          props.preferences.discovery_settings || {
            enableSmartSuggestions: true,
            discoverySensitivity: "medium",
            includeNewGenres: true,
            includeInternationalMusic: true,
            maxSuggestionsPerSession: 10,
          },
      });
    } else {
      // Create default preferences
      this.preferences = new AudiencePreferences({
        favoriteGenres: [],
        favoriteArtists: [],
        preferredLanguages: ["pt-BR"],
        location: null,
        socialLinks: null,
        notificationSettings: {
          pushNotifications: true,
          emailNotifications: true,
          smsNotifications: false,
          musicRequestNotifications: true,
          tipNotifications: true,
          eventNotifications: true,
          rankingNotifications: true,
        },
        privacySettings: {
          profileVisibility: "public",
          showRealName: true,
          showLocation: false,
          showFavoriteGenres: true,
          showFavoriteArtists: true,
          showTipHistory: false,
          showRanking: true,
        },
        musicDiscoverySettings: {
          enableSmartSuggestions: true,
          discoverySensitivity: "medium",
          includeNewGenres: true,
          includeInternationalMusic: true,
          maxSuggestionsPerSession: 10,
        },
      });
    }

    this.badges = props.badges ?? [];
    this.is_active = props.is_active ?? true;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): ValueObject {
    return this.id;
  }

  // Convenience getters for value objects
  get emailValue(): string {
    return this.email.value;
  }

  get phoneValue(): string | null {
    return this.phone?.value ?? null;
  }

  // Convenience getters for preferences
  get favorite_genres(): string[] {
    return this.preferences.favoriteGenres;
  }

  get favorite_artists(): string[] {
    return this.preferences.favoriteArtists;
  }

  get preferred_languages(): string[] {
    return this.preferences.preferredLanguages;
  }

  get notification_settings(): any {
    return this.preferences.notificationSettings;
  }

  get privacy_settings(): any {
    return this.preferences.privacySettings;
  }

  get discovery_settings(): any {
    return this.preferences.musicDiscoverySettings;
  }

  static create(command: AudienceCreateCommand): Audience {
    const preferences = new AudiencePreferences({
      favoriteGenres: command.favorite_genres || [],
      favoriteArtists: command.favorite_artists || [],
      preferredLanguages: command.preferred_languages || ["pt-BR"],
      notificationSettings: {
        pushNotifications: true,
        emailNotifications: true,
        smsNotifications: false,
        musicRequestNotifications: true,
        tipNotifications: true,
        eventNotifications: true,
        rankingNotifications: true,
      },
      privacySettings: {
        profileVisibility: "public",
        showRealName: true,
        showLocation: false,
        showFavoriteGenres: true,
        showFavoriteArtists: true,
        showTipHistory: false,
        showRanking: true,
      },
      musicDiscoverySettings: {
        enableSmartSuggestions: true,
        discoverySensitivity: "medium",
        includeNewGenres: true,
        includeInternationalMusic: true,
        maxSuggestionsPerSession: 10,
      },
    });

    const audience = new Audience({
      email: command.email,
      name: command.name,
      nickname: command.nickname,
      avatar: command.avatar,
      phone: command.phone,
      preferences,
      is_active: command.is_active,
    });

    audience.validate(["name", "email"]);
    audience.applyEvent(new AudienceCreatedEvent({
      audience_id: audience.id,
      name: audience.name,
      email: audience.email,
      phone: audience.phone,
      avatar: audience.avatar,
      favorite_genres: audience.favorite_genres,
      totalPoints: audience.totalPoints,
      currentLevel: audience.currentLevel,
      badges: audience.badges,
      is_active: audience.is_active,
      created_at: audience.created_at,
    }));
    return audience;
  }

  private dispatchUpdateEvent(): void {
    this.applyEvent(new AudienceUpdatedEvent({
      audience_id: this.id,
      name: this.name,
      email: this.email.value,
      nickname: this.nickname,
      avatar: this.avatar,
      phone: this.phone ? this.phone.value : null,
      updated_at: this.updated_at
    }));
  }

  changeName(name: string): void {
    this.name = name;
    this.updated_at = new Date();
    this.validate(["name"]);
    this.dispatchUpdateEvent();
  }

  changeEmail(email: string): void {
    try {
      this.email = new Email(email);
      this.updated_at = new Date();
      this.validate();
      this.dispatchUpdateEvent();
    } catch (error) {
      throw error;
    }
  }

  changeNickname(nickname: string | null): void {
    this.nickname = nickname;
    this.updated_at = new Date();
    this.dispatchUpdateEvent();
  }

  changeAvatar(avatar: string | null): void {
    this.avatar = avatar;
    this.updated_at = new Date();
    this.dispatchUpdateEvent();
  }

  changePhone(phone: string | null): void {
    this.phone = phone ? new Phone(phone) : null;
    this.updated_at = new Date();
    this.dispatchUpdateEvent();
  }

  private dispatchPreferencesEvent(): void {
    this.applyEvent(new AudiencePreferencesUpdatedEvent({
      audience_id: this.id,
      favorite_genres: this.favorite_genres,
      favorite_artists: this.favorite_artists,
      preferred_languages: this.preferred_languages,
      updated_at: this.updated_at
    }));
  }

  updatePreferences(
    preferences: Partial<{
      favorite_genres: string[];
      favorite_artists: string[];
      preferred_languages: string[];
      notification_settings: any;
      privacy_settings: any;
      discovery_settings: any;
    }>,
  ): void {
    let updatedPreferences = this.preferences;

    if (preferences.favorite_genres) {
      updatedPreferences = new AudiencePreferences({
        ...updatedPreferences.toJSON(),
        favoriteGenres: preferences.favorite_genres,
      });
    }

    if (preferences.favorite_artists) {
      updatedPreferences = new AudiencePreferences({
        ...updatedPreferences.toJSON(),
        favoriteArtists: preferences.favorite_artists,
      });
    }

    if (preferences.preferred_languages) {
      updatedPreferences = new AudiencePreferences({
        ...updatedPreferences.toJSON(),
        preferredLanguages: preferences.preferred_languages,
      });
    }

    if (preferences.notification_settings) {
      updatedPreferences = updatedPreferences.updateNotificationSettings(
        preferences.notification_settings,
      );
    }

    if (preferences.privacy_settings) {
      updatedPreferences = updatedPreferences.updatePrivacySettings(
        preferences.privacy_settings,
      );
    }

    if (preferences.discovery_settings) {
      updatedPreferences = updatedPreferences.updateMusicDiscoverySettings(
        preferences.discovery_settings,
      );
    }

    this.preferences = updatedPreferences;
    this.updated_at = new Date();
    this.dispatchPreferencesEvent();
  }

  updateFavoriteGenres(genres: string[]): void {
    this.preferences = new AudiencePreferences({
      ...this.preferences.toJSON(),
      favoriteGenres: genres,
    });
    this.updated_at = new Date();
    this.dispatchPreferencesEvent();
  }

  updateFavoriteArtists(artists: string[]): void {
    this.preferences = new AudiencePreferences({
      ...this.preferences.toJSON(),
      favoriteArtists: artists,
    });
    this.updated_at = new Date();
    this.dispatchPreferencesEvent();
  }

  updateNotificationSettings(settings: any): void {
    this.preferences = this.preferences.updateNotificationSettings(settings);
    this.updated_at = new Date();
    this.dispatchPreferencesEvent();
  }

  updatePrivacySettings(settings: any): void {
    this.preferences = this.preferences.updatePrivacySettings(settings);
    this.updated_at = new Date();
    this.dispatchPreferencesEvent();
  }

  updateDiscoverySettings(settings: any): void {
    this.preferences = this.preferences.updateMusicDiscoverySettings(settings);
    this.updated_at = new Date();
    this.dispatchPreferencesEvent();
  }

  // Points management methods
  addPoints(points: number): void {
    // For direct point addition, we need to create a new AudiencePoints instance
    const now = new Date();
    const isNewMonth = this.points.isNewMonth(now);
    const newMonthly = isNewMonth ? points : this.points.monthly + points;

    this.points = AudiencePoints.fromData(
      this.points.total + points,
      newMonthly,
      now,
    );
    this.updateLevel();
    this.updated_at = new Date();
  }

  addPointsForAction(
    action:
      | "scan_qr_code"
      | "make_request"
      | "correct_guess"
      | "send_tip"
      | "share_social"
      | "indicate_musician"
      | "attend_event"
      | "vote_song"
      | "complete_profile",
  ): void {
    this.points = this.points.addPoints(action);
    this.updateLevel();
    this.updated_at = new Date();
  }

  addMonthlyPoints(points: number): void {
    this.addPoints(points);
  }

  resetMonthlyPoints(): void {
    this.points = this.points.resetMonthlyPoints();
    this.updated_at = new Date();
  }

  updateLevel(): void {
    const newLevel = AudienceLevel.fromPoints(this.points.total);
    if (newLevel.level !== this.level.level) {
      this.level = newLevel;
      this.applyEvent(new AudienceLevelUpgradedEvent({
        audience_id: this.id,
        new_level: this.level.level,
        new_level_name: this.level.name,
        total_points: this.points.total,
        occurred_at: new Date()
      }));
    }
  }

  // Badge management
  addBadge(badge: string): void {
    if (!this.badges.includes(badge)) {
      this.badges.push(badge);
      this.updated_at = new Date();
      this.applyEvent(new AudienceBadgeEarnedEvent({
        audience_id: this.id,
        badge: badge,
        earned_at: new Date()
      }));
    }
  }

  getBadges(): string[] {
    return [...this.badges];
  }

  // Business methods for audience interactions
  scanMusicianQRCode(musicianId: string, musicianName: string): void {
    this.addPointsForAction("scan_qr_code");

    // Atribuir badge "iniciante" se for o primeiro scan
    if (!this.badges.includes("iniciante")) {
      this.addBadge("iniciante");
    }

    this.applyEvent(new MusicianQRCodeScannedEvent(this.id, musicianId));
  }

  canMakeRequest(): boolean {
    return this.level.level >= 1; // Basic level requirement
  }

  makeMusicRequest(
    musicianId: string,
    songTitle: string,
    artist: string,
  ): void {
    if (!this.canMakeRequest()) {
      throw new Error("Insufficient level to make music requests");
    }

    this.addPointsForAction("make_request");
    this.applyEvent(
      new MusicRequestMadeEvent(this.id, musicianId, songTitle, artist),
    );
  }

  sendTip(musicianId: string, amount: number, message?: string): void {
    this.points = this.points.addTipPoints(amount);
    this.updateLevel();
    this.applyEvent(new TipSentEvent(this.id, musicianId, amount, message));
  }

  voteForSong(requestId: string, vote: "up" | "down"): void {
    this.addPointsForAction("vote_song");
    this.applyEvent(new SongVotedEvent(this.id, requestId, vote));
  }

  shareOnSocialMedia(
    requestId: string,
    platform: string,
    message?: string,
  ): void {
    this.addPointsForAction("share_social");
    this.applyEvent(
      new SocialMediaSharedEvent(this.id, requestId, platform, message),
    );
  }

  indicateMusician(establishmentId: string, musicianId: string): void {
    this.addPointsForAction("indicate_musician");
    this.applyEvent(
      new MusicianIndicatedEvent(this.id, establishmentId, musicianId),
    );
  }

  attendEvent(eventId: string): void {
    this.addPointsForAction("attend_event");
    this.updated_at = new Date();
  }

  completeProfile(): void {
    if (this.isProfileComplete) {
      this.addPointsForAction("complete_profile");
    }
  }

  // Getters for computed properties - REMOVENDO DUPLICADOS

  activate(): void {
    this.is_active = true;
    this.updated_at = new Date();
  }

  deactivate(): void {
    this.is_active = false;
    this.updated_at = new Date();
  }

  get status(): string {
    return this.is_active ? "active" : "inactive";
  }

  get displayName(): string {
    return this.nickname || this.name;
  }

  get currentLevel(): number {
    return this.level.level;
  }

  get totalPoints(): number {
    return this.points.total;
  }

  get monthlyPoints(): number {
    return this.points.monthly;
  }

  get levelName(): string {
    return this.level.name;
  }

  get levelBenefits(): string[] {
    return this.level.benefits;
  }

  get pointsToNextLevel(): number {
    return this.level.getPointsToNextLevel();
  }

  get maxRequestsPerEvent(): number {
    return this.level.getMaxRequestsPerEvent();
  }

  get hasVipAccess(): boolean {
    return this.level.hasVipAccess();
  }

  get canAccessExclusiveContent(): boolean {
    return this.level.canAccessExclusiveContent();
  }

  get isActive(): boolean {
    return this.is_active;
  }

  get isProfileComplete(): boolean {
    return !!(
      this.name &&
      this.email &&
      this.preferences.favoriteGenres.length > 0 &&
      this.preferences.favoriteArtists.length > 0
    );
  }

  get isHighlyEngaged(): boolean {
    return this.points.monthly >= 100; // High monthly activity
  }

  get isNewUser(): boolean {
    const daysSinceCreation =
      (Date.now() - this.created_at.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation <= 7;
  }

  validate(fields?: string[]): boolean {
    const validator = AudienceValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake(): AudienceFakeBuilder<Audience> {
    return AudienceFakeBuilder.anAudience();
  }

  toJSON() {
    return {
      id: this.id.id,
      email: this.email.value,
      name: this.name,
      nickname: this.nickname,
      avatar: this.avatar,
      phone: this.phone?.value ?? null,
      points: {
        total: this.points.total,
        monthly: this.points.monthly,
        last_updated: this.points.lastUpdated,
      },
      level: {
        level: this.level.level,
        name: this.level.name,
        min_points: this.level.minPoints,
        max_points: this.level.maxPoints,
        benefits: this.level.benefits,
      },
      badges: this.badges,
      preferences: {
        favorite_genres: this.preferences.favoriteGenres,
        favorite_artists: this.preferences.favoriteArtists,
        preferred_languages: this.preferences.preferredLanguages,
        notification_settings: this.preferences.notificationSettings,
        privacy_settings: this.preferences.privacySettings,
        music_discovery_settings: this.preferences.musicDiscoverySettings,
      },
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
