import { ValueObject } from "../value-object";

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "twitter"
  | "tiktok"
  | "youtube"
  | "spotify"
  | "linkedin";

export type SocialLinkData = {
  platform: SocialPlatform;
  username: string;
  url: string;
  isVerified?: boolean;
  followersCount?: number;
};

export type SocialLinksProps = {
  links: SocialLinkData[];
};

export class SocialLinks extends ValueObject {
  readonly links: SocialLinkData[];

  constructor(props: SocialLinksProps) {
    super();
    this.links = props.links || [];
    this.validate();
  }

  private validate(): void {
    if (!Array.isArray(this.links)) {
      throw new InvalidSocialLinksError("Links must be an array");
    }

    for (const link of this.links) {
      this.validateLink(link);
    }

    // Verificar se não há plataformas duplicadas
    const platforms = this.links.map((link) => link.platform);
    const uniquePlatforms = new Set(platforms);
    if (platforms.length !== uniquePlatforms.size) {
      throw new InvalidSocialLinksError("Duplicate platforms are not allowed");
    }
  }

  private validateLink(link: SocialLinkData): void {
    if (!link.platform) {
      throw new InvalidSocialLinksError("Platform is required");
    }

    if (!link.username || link.username.trim().length === 0) {
      throw new InvalidSocialLinksError("Username is required");
    }

    if (!link.url || link.url.trim().length === 0) {
      throw new InvalidSocialLinksError("URL is required");
    }

    if (!this.isValidUrl(link.url)) {
      throw new InvalidSocialLinksError("Invalid URL format");
    }

    if (!this.isValidPlatformUrl(link.platform, link.url)) {
      throw new InvalidSocialLinksError(
        `Invalid URL for platform ${link.platform}`,
      );
    }

    if (link.followersCount !== undefined && link.followersCount < 0) {
      throw new InvalidSocialLinksError(
        "Followers count must be greater than or equal to 0",
      );
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidPlatformUrl(platform: SocialPlatform, url: string): boolean {
    const platformDomains: Record<SocialPlatform, string[]> = {
      instagram: ["instagram.com", "www.instagram.com"],
      facebook: ["facebook.com", "www.facebook.com", "fb.com"],
      twitter: ["twitter.com", "www.twitter.com", "x.com", "www.x.com"],
      tiktok: ["tiktok.com", "www.tiktok.com"],
      youtube: ["youtube.com", "www.youtube.com", "youtu.be"],
      spotify: ["spotify.com", "www.spotify.com", "open.spotify.com"],
      linkedin: ["linkedin.com", "www.linkedin.com"],
    };

    try {
      const urlObj = new URL(url);
      const domains = platformDomains[platform];
      return domains.some((domain) => urlObj.hostname === domain);
    } catch {
      return false;
    }
  }

  static create(links: SocialLinkData[] = []): SocialLinks {
    return new SocialLinks({ links });
  }

  addLink(link: SocialLinkData): SocialLinks {
    const existingLinks = this.links.filter(
      (l) => l.platform !== link.platform,
    );
    return new SocialLinks({ links: [...existingLinks, link] });
  }

  removeLink(platform: SocialPlatform): SocialLinks {
    const filteredLinks = this.links.filter(
      (link) => link.platform !== platform,
    );
    return new SocialLinks({ links: filteredLinks });
  }

  updateLink(
    platform: SocialPlatform,
    updates: Partial<Omit<SocialLinkData, "platform">>,
  ): SocialLinks {
    const updatedLinks = this.links.map((link) => {
      if (link.platform === platform) {
        return { ...link, ...updates };
      }
      return link;
    });

    return new SocialLinks({ links: updatedLinks });
  }

  getLink(platform: SocialPlatform): SocialLinkData | undefined {
    return this.links.find((link) => link.platform === platform);
  }

  hasLink(platform: SocialPlatform): boolean {
    return this.links.some((link) => link.platform === platform);
  }

  getPlatforms(): SocialPlatform[] {
    return this.links.map((link) => link.platform);
  }

  getVerifiedLinks(): SocialLinkData[] {
    return this.links.filter((link) => link.isVerified === true);
  }

  getTotalFollowers(): number {
    return this.links.reduce((total, link) => {
      return total + (link.followersCount || 0);
    }, 0);
  }

  isEmpty(): boolean {
    return this.links.length === 0;
  }

  size(): number {
    return this.links.length;
  }

  toJSON() {
    return {
      links: this.links.map((link) => ({
        platform: link.platform,
        username: link.username,
        url: link.url,
        isVerified: link.isVerified || false,
        followersCount: link.followersCount || 0,
      })),
      platforms: this.getPlatforms(),
      totalFollowers: this.getTotalFollowers(),
      verifiedCount: this.getVerifiedLinks().length,
      isEmpty: this.isEmpty(),
      size: this.size(),
    };
  }
}

export class InvalidSocialLinksError extends Error {
  constructor(message?: string) {
    super(message || "Invalid social links");
    this.name = "InvalidSocialLinksError";
  }
}
