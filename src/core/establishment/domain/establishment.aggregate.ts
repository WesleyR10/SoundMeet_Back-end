import {
  Address,
  AggregateRoot,
  CNPJ,
  Email,
  InvalidCNPJError,
  Phone,
  QRCode,
  Rating,
  Uuid,
} from "../../shared/domain";
import { EstablishmentValidatorFactory } from "./establishment.validator";
import { EstablishmentFakeBuilder } from "./establishment-fake.builder";
import { EstablishmentProfile } from "./establishment-profile.aggregate";
import { EstablishmentCreatedEvent } from "./events/establishment-created.event";
import { EstablishmentRatedEvent } from "./events/establishment-rated.event";
import { EstablishmentVerifiedEvent } from "./events/establishment-verified.event";

export type EstablishmentConstructorProps = {
  establishment_id?: EstablishmentId;
  name: string;
  description?: string | null;
  avatar?: string | null;
  cnpj?: string | null;
  email: Email;
  phone?: Phone | null;
  website?: string | null;
  establishment_type: string;
  rating?: Rating;
  total_ratings?: number;
  qr_code?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
  profile?: EstablishmentProfile | null;
  created_at?: Date;
  updated_at?: Date;
};

export type EstablishmentCreateCommand = {
  name: string;
  description?: string | null;
  avatar?: string | null;
  cnpj?: string | null;
  email: string;
  phone?: string | null;
  website?: string | null;
  establishment_type: string;
  is_active?: boolean;
  profile?: EstablishmentProfile | null;
};

export class EstablishmentId extends Uuid {}

export class Establishment extends AggregateRoot {
  establishment_id: EstablishmentId;
  name: string;
  description: string | null;
  avatar: string | null;
  cnpj: CNPJ | null;
  email: Email;
  phone: Phone | null;
  website: string | null;
  establishment_type: string;
  rating: Rating;
  total_ratings: number;
  qr_code: QRCode | null;
  is_active: boolean;
  is_verified: boolean;
  profile: EstablishmentProfile | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: EstablishmentConstructorProps) {
    super();
    this.establishment_id = props.establishment_id ?? new EstablishmentId();
    this.name = props.name;
    this.description = props.description ?? null;
    this.avatar = props.avatar ?? null;
    if (props.cnpj) {
      try {
        this.cnpj = new CNPJ(props.cnpj);
      } catch (error) {
        const message =
          error instanceof InvalidCNPJError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Invalid cnpj";
        this.notification.addError(message, "cnpj");
        this.cnpj = null;
      }
    } else {
      this.cnpj = null;
    }
    this.email = props.email;
    this.phone = props.phone ?? null;
    this.website = props.website ?? null;
    this.establishment_type = props.establishment_type;
    this.rating = props.rating ?? new Rating(0);
    this.total_ratings = props.total_ratings ?? 0;
    this.qr_code = props.qr_code
      ? new QRCode({
          code: props.qr_code,
          url: `https://soundmeet.app/establishment/${this.establishment_id.id}`,
        })
      : null;
    this.is_active = props.is_active ?? true;
    this.is_verified = props.is_verified ?? false;
    this.profile = props.profile ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  static create(command: EstablishmentCreateCommand): Establishment {
    const emailOrError = Email.create(command.email);
    const phoneOrError = command.phone ? Phone.create(command.phone) : null;
    const establishment = new Establishment({
      name: command.name,
      description: command.description,
      avatar: command.avatar,
      cnpj: command.cnpj,
      email: emailOrError.ok,
      phone: !phoneOrError
        ? null
        : phoneOrError.isFail()
          ? null
          : phoneOrError.ok,
      website: command.website,
      establishment_type: command.establishment_type,
      is_active: command.is_active,
      profile: command.profile ?? null,
    });
    if (emailOrError.isFail()) {
      establishment.notification.setError(emailOrError.error.message, "email");
    }
    if (phoneOrError?.isFail()) {
      establishment.notification.setError(phoneOrError.error.message, "phone");
    }
    establishment.validate(["name", "email", "establishment_type"]);
    establishment.generateQRCode();
    establishment.applyEvent(
      new EstablishmentCreatedEvent({
        establishment_id: establishment.establishment_id,
        name: establishment.name,
        email: establishment.email,
        cnpj: establishment.cnpj,
        phone: establishment.phone,
        description: establishment.description,
        avatar: establishment.avatar,
        qr_code: establishment.qr_code,
        rating: establishment.rating,
        total_ratings: establishment.total_ratings,
        is_active: establishment.is_active,
        is_verified: establishment.is_verified,
        created_at: establishment.created_at,
      }),
    );
    return establishment;
  }

  ensureProfile(location: Address): EstablishmentProfile {
    if (!this.profile) {
      this.profile = EstablishmentProfile.create({
        establishment_id: this.establishment_id,
        location,
      });
    }
    return this.profile;
  }

  removeProfile(): void {
    this.profile = null;
  }

  changeName(name: string): void {
    this.name = name;
    this.validate(["name"]);
    this.updated_at = new Date();
  }

  changeDescription(description: string | null): void {
    this.description = description;
    this.updated_at = new Date();
  }

  changeAvatar(avatar: string | null): void {
    this.avatar = avatar;
    this.updated_at = new Date();
  }

  changeCnpj(cnpj: string): void {
    try {
      this.cnpj = new CNPJ(cnpj);
      this.validate(["cnpj"]);
      this.updated_at = new Date();
    } catch (error) {
      const message =
        error instanceof InvalidCNPJError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Invalid cnpj";
      this.notification.addError(message, "cnpj");
      return;
    }
  }

  changeEmail(email: string): void {
    const emailOrError = Email.create(email);
    this.email = emailOrError.ok;
    emailOrError.isFail() &&
      this.notification.setError(emailOrError.error.message, "email");
    this.validate(["email"]);
    this.updated_at = new Date();
  }

  changePhone(phone: string | null): void {
    if (!phone) {
      this.phone = null;
      this.validate(["phone"]);
      this.updated_at = new Date();
      return;
    }
    const phoneOrError = Phone.create(phone);
    if (phoneOrError.isFail()) {
      this.notification.addError(phoneOrError.error.message, "phone");
      return;
    }
    this.phone = phoneOrError.ok;
    this.validate(["phone"]);
    this.updated_at = new Date();
  }

  changeWebsite(website: string | null): void {
    this.website = website;
    this.updated_at = new Date();
  }

  changeEstablishmentType(establishment_type: string): void {
    this.establishment_type = establishment_type;
    this.validate(["establishment_type"]);
    this.updated_at = new Date();
  }

  generateQRCode(): void {
    const qrData = `soundmeet://establishment/${this.establishment_id.id}`;
    this.qr_code = new QRCode({
      code: qrData,
      url: `https://soundmeet.app/establishment/${this.establishment_id.id}`,
    });
    this.updated_at = new Date();
  }

  addRating(ratingValue: number, ratedBy: Uuid, comment?: string | null): void {
    const rating = new Rating(ratingValue);

    // Atualiza a média de ratings usando o método estático average para arredondamento correto
    const totalScore = this.rating.value * this.total_ratings;
    this.total_ratings += 1;
    const newAverage = (totalScore + ratingValue) / this.total_ratings;
    this.rating = new Rating(Math.round(newAverage * 10) / 10); // Arredonda para 1 casa decimal
    this.updated_at = new Date();

    this.applyEvent(
      new EstablishmentRatedEvent(
        this.establishment_id,
        new Rating(ratingValue),
        comment ?? null,
        ratedBy,
      ),
    );
  }

  activate(): void {
    this.is_active = true;
    this.updated_at = new Date();
  }

  deactivate(): void {
    this.is_active = false;
    this.updated_at = new Date();
  }

  verify(): void {
    this.is_verified = true;
    this.updated_at = new Date();
    this.applyEvent(
      new EstablishmentVerifiedEvent({
        establishment_id: this.establishment_id,
        verified_at: new Date(),
      }),
    );
  }

  unverify(): void {
    this.is_verified = false;
    this.updated_at = new Date();
  }

  get isHighlyRated(): boolean {
    return this.rating.isGood && this.total_ratings >= 10;
  }

  get isPopular(): boolean {
    return this.total_ratings >= 50;
  }

  get isBar(): boolean {
    return this.establishment_type === "bar";
  }

  get isRestaurant(): boolean {
    return this.establishment_type === "restaurant";
  }

  get isClub(): boolean {
    return this.establishment_type === "club";
  }

  validate(fields?: string[]): boolean {
    const validator = EstablishmentValidatorFactory.create();
    const sanitizedFields = fields?.length
      ? fields.filter(
          (field) =>
            !(
              (field === "email" && this.notification.errors.has("email")) ||
              (field === "phone" && this.notification.errors.has("phone"))
            ),
        )
      : fields;
    return validator.validate(this.notification, this, sanitizedFields);
  }

  static fake() {
    return EstablishmentFakeBuilder;
  }

  get entity_id(): EstablishmentId {
    return this.establishment_id;
  }

  toJSON() {
    return {
      establishment_id: this.establishment_id.id,
      name: this.name,
      description: this.description,
      avatar: this.avatar,
      cnpj: this.cnpj?.toJSON() || null,
      email: this.email.value,
      phone: this.phone ? this.phone.value : null,
      website: this.website,
      establishment_type: this.establishment_type,
      rating: this.rating.value,
      total_ratings: this.total_ratings,
      qr_code: this.qr_code?.code || null,
      is_active: this.is_active,
      is_verified: this.is_verified,
      profile: this.profile ? this.profile.toJSON() : null,
      created_at: this.created_at,
      updated_at: this.updated_at,
      is_highly_rated: this.isHighlyRated,
      is_popular: this.isPopular,
      is_bar: this.isBar,
      is_restaurant: this.isRestaurant,
      is_club: this.isClub,
    };
  }
}
