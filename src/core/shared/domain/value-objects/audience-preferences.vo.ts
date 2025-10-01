import { ValueObject } from "../value-object";
import { EntityValidationError } from "../validators/validation.error";

export type AudiencePreferencesProps = {
  favoriteGenres: string[];
  favoriteArtists: string[];
  preferredLanguages: string[];
  notificationSettings: NotificationSettings;
  privacySettings: PrivacySettings;
  musicDiscoverySettings: MusicDiscoverySettings;
};

export type NotificationSettings = {
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  musicRequestNotifications: boolean;
  tipNotifications: boolean;
  eventNotifications: boolean;
  rankingNotifications: boolean;
};

export type PrivacySettings = {
  profileVisibility: "public" | "friends" | "private";
  showRealName: boolean;
  showLocation: boolean;
  showFavoriteGenres: boolean;
  showFavoriteArtists: boolean;
  showTipHistory: boolean;
  showRanking: boolean;
};

export type MusicDiscoverySettings = {
  enableSmartSuggestions: boolean;
  discoverySensitivity: "low" | "medium" | "high";
  includeNewGenres: boolean;
  includeInternationalMusic: boolean;
  maxSuggestionsPerSession: number;
};

export class AudiencePreferences extends ValueObject {
  readonly favoriteGenres: string[];
  readonly favoriteArtists: string[];
  readonly preferredLanguages: string[];
  readonly notificationSettings: NotificationSettings;
  readonly privacySettings: PrivacySettings;
  readonly musicDiscoverySettings: MusicDiscoverySettings;

  private static readonly VALID_GENRES = [
    "Rock",
    "Pop",
    "Jazz",
    "Blues",
    "Country",
    "Folk",
    "Classical",
    "Electronic",
    "Hip Hop",
    "R&B",
    "Reggae",
    "Punk",
    "Metal",
    "Alternative",
    "Indie",
    "Funk",
    "Soul",
    "Gospel",
    "Latin",
    "World Music",
    "Instrumental",
    "Acoustic",
    "MPB",
    "Sertanejo",
    "Forró",
    "Bossa Nova",
    "Samba",
    "Pagode",
    "Axé",
    "Reggaeton",
  ];

  private static readonly VALID_LANGUAGES = [
    "pt-BR",
    "en-US",
    "es-ES",
    "fr-FR",
    "it-IT",
    "de-DE",
    "ja-JP",
    "ko-KR",
  ];

  constructor(props: AudiencePreferencesProps) {
    super();
    this.favoriteGenres = props.favoriteGenres;
    this.favoriteArtists = props.favoriteArtists;
    this.preferredLanguages = props.preferredLanguages;
    this.notificationSettings = props.notificationSettings;
    this.privacySettings = props.privacySettings;
    this.musicDiscoverySettings = props.musicDiscoverySettings;
    this.validate();
  }

  static createDefault(): AudiencePreferences {
    return new AudiencePreferences({
      favoriteGenres: [],
      favoriteArtists: [],
      preferredLanguages: ["pt-BR"],
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

  addFavoriteGenre(genre: string): AudiencePreferences {
    if (!AudiencePreferences.VALID_GENRES.includes(genre)) {
      throw new Error(`Invalid genre: ${genre}`);
    }

    if (this.favoriteGenres.includes(genre)) {
      return this;
    }

    return new AudiencePreferences({
      ...this.toJSON(),
      favoriteGenres: [...this.favoriteGenres, genre],
    });
  }

  removeFavoriteGenre(genre: string): AudiencePreferences {
    return new AudiencePreferences({
      ...this.toJSON(),
      favoriteGenres: this.favoriteGenres.filter((g) => g !== genre),
    });
  }

  addFavoriteArtist(artist: string): AudiencePreferences {
    if (!artist || artist.trim().length === 0) {
      throw new Error("Artist name cannot be empty");
    }

    const normalizedArtist = artist.trim();
    if (this.favoriteArtists.includes(normalizedArtist)) {
      return this;
    }

    return new AudiencePreferences({
      ...this.toJSON(),
      favoriteArtists: [...this.favoriteArtists, normalizedArtist],
    });
  }

  removeFavoriteArtist(artist: string): AudiencePreferences {
    return new AudiencePreferences({
      ...this.toJSON(),
      favoriteArtists: this.favoriteArtists.filter((a) => a !== artist),
    });
  }

  updateNotificationSettings(
    settings: Partial<NotificationSettings>,
  ): AudiencePreferences {
    return new AudiencePreferences({
      ...this.toJSON(),
      notificationSettings: {
        ...this.notificationSettings,
        ...settings,
      },
    });
  }

  updatePrivacySettings(
    settings: Partial<PrivacySettings>,
  ): AudiencePreferences {
    return new AudiencePreferences({
      ...this.toJSON(),
      privacySettings: {
        ...this.privacySettings,
        ...settings,
      },
    });
  }

  updateMusicDiscoverySettings(
    settings: Partial<MusicDiscoverySettings>,
  ): AudiencePreferences {
    return new AudiencePreferences({
      ...this.toJSON(),
      musicDiscoverySettings: {
        ...this.musicDiscoverySettings,
        ...settings,
      },
    });
  }

  hasGenrePreference(genre: string): boolean {
    return this.favoriteGenres.includes(genre);
  }

  hasArtistPreference(artist: string): boolean {
    return this.favoriteArtists.some(
      (a) =>
        a.toLowerCase().includes(artist.toLowerCase()) ||
        artist.toLowerCase().includes(a.toLowerCase()),
    );
  }

  getGenreCompatibilityScore(genres: string[]): number {
    if (this.favoriteGenres.length === 0 || genres.length === 0) {
      return 0.5; // Neutral score
    }

    const matches = genres.filter((genre) =>
      this.favoriteGenres.includes(genre),
    );
    return matches.length / Math.max(this.favoriteGenres.length, genres.length);
  }

  shouldReceiveNotification(type: keyof NotificationSettings): boolean {
    return this.notificationSettings[type] === true;
  }

  isProfileDataVisible(field: keyof PrivacySettings): boolean {
    if (this.privacySettings.profileVisibility === "private") {
      return false;
    }
    return this.privacySettings[field] === true;
  }

  getSuggestionLimit(): number {
    return this.musicDiscoverySettings.maxSuggestionsPerSession;
  }

  private validate(): void {
    // Validate genres
    const invalidGenres = this.favoriteGenres.filter(
      (genre) => !AudiencePreferences.VALID_GENRES.includes(genre),
    );
    if (invalidGenres.length > 0) {
      throw new EntityValidationError([
        { favorite_genres: [`Invalid genres: ${invalidGenres.join(", ")}`] },
      ]);
    }

    // Validate languages
    const invalidLanguages = this.preferredLanguages.filter(
      (lang) => !AudiencePreferences.VALID_LANGUAGES.includes(lang),
    );
    if (invalidLanguages.length > 0) {
      throw new EntityValidationError([
        {
          preferred_languages: [
            `Invalid languages: ${invalidLanguages.join(", ")}`,
          ],
        },
      ]);
    }

    // Validate artists
    if (
      this.favoriteArtists.some(
        (artist) => !artist || artist.trim().length === 0,
      )
    ) {
      throw new Error("Artist names cannot be empty");
    }

    // Validate notification settings
    if (!this.notificationSettings) {
      throw new Error("Notification settings are required");
    }

    // Validate privacy settings
    if (!this.privacySettings) {
      throw new Error("Privacy settings are required");
    }

    if (
      !["public", "friends", "private"].includes(
        this.privacySettings.profileVisibility,
      )
    ) {
      throw new Error("Invalid profile visibility setting");
    }

    // Validate music discovery settings
    if (!this.musicDiscoverySettings) {
      throw new Error("Music discovery settings are required");
    }

    if (
      !["low", "medium", "high"].includes(
        this.musicDiscoverySettings.discoverySensitivity,
      )
    ) {
      throw new Error("Invalid discovery sensitivity setting");
    }

    if (
      this.musicDiscoverySettings.maxSuggestionsPerSession < 1 ||
      this.musicDiscoverySettings.maxSuggestionsPerSession > 50
    ) {
      throw new Error("Max suggestions per session must be between 1 and 50");
    }
  }

  equals(other: AudiencePreferences): boolean {
    return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON());
  }

  toJSON() {
    return {
      favoriteGenres: this.favoriteGenres,
      favoriteArtists: this.favoriteArtists,
      preferredLanguages: this.preferredLanguages,
      notificationSettings: this.notificationSettings,
      privacySettings: this.privacySettings,
      musicDiscoverySettings: this.musicDiscoverySettings,
    };
  }
}
