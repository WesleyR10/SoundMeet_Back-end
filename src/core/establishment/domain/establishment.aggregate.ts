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
import { ValueObject } from "../../shared/domain/value-object";
import { EstablishmentValidatorFactory } from "./establishment.validator";
import { EstablishmentFakeBuilder } from "./establishment-fake.builder";
import { EstablishmentCreatedEvent } from "./events/establishment-created.event";
import { EstablishmentRatedEvent } from "./events/establishment-rated.event";
import { EstablishmentVerifiedEvent } from "./events/establishment-verified.event";

export type EstablishmentConstructorProps = {
  id?: EstablishmentId;
  name: string;
  description?: string | null;
  avatar?: string | null;
  cnpj?: string | null;
  email: Email;
  phone?: Phone | null;
  website?: string | null;
  address: Address;
  establishment_type: string;
  rating?: Rating;
  total_ratings?: number;
  qr_code?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
  created_at?: Date;
};

export type EstablishmentCreateCommand = {
  name: string;
  description?: string | null;
  avatar?: string | null;
  cnpj?: string | null;
  email: string;
  phone?: string | null;
  website?: string | null;
  address: {
    street: string;
    number: string;
    city: string;
    state: string;
    zipCode: string;
    neighborhood?: string;
  };
  establishment_type: string;
  is_active?: boolean;
};

export class EstablishmentId extends Uuid {}

export class Establishment extends AggregateRoot {
  id: EstablishmentId;
  name: string;
  description: string | null;
  avatar: string | null;
  cnpj: CNPJ | null;
  email: Email;
  phone: Phone | null;
  website: string | null;
  address: Address;
  establishment_type: string;
  rating: Rating;
  total_ratings: number;
  qr_code: QRCode | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;

  constructor(props: EstablishmentConstructorProps) {
    super();
    this.id = props.id ?? new EstablishmentId();
    this.name = props.name;
    this.description = props.description ?? null;
    this.avatar = props.avatar ?? null;
    this.cnpj = props.cnpj ? new CNPJ(props.cnpj) : null;
    this.email = props.email;
    this.phone = props.phone ?? null;
    this.website = props.website ?? null;
    this.address = props.address;
    this.establishment_type = props.establishment_type;
    this.rating = props.rating ?? new Rating(0);
    this.total_ratings = props.total_ratings ?? 0;
    this.qr_code = props.qr_code
      ? new QRCode({
          code: props.qr_code,
          url: `https://soundmeet.app/establishment/${this.id.id}`,
        })
      : null;
    this.is_active = props.is_active ?? true;
    this.is_verified = props.is_verified ?? false;
    this.created_at = props.created_at ?? new Date();
  }

  static create(command: EstablishmentCreateCommand): Establishment {
    const establishment = new Establishment({
      name: command.name,
      description: command.description,
      avatar: command.avatar,
      cnpj: command.cnpj,
      email: new Email(command.email),
      phone: command.phone ? new Phone(command.phone) : null,
      website: command.website,
      address: new Address({
        street: command.address.street,
        number: command.address.number,
        city: command.address.city,
        state: command.address.state,
        zipCode: command.address.zipCode,
        neighborhood: command.address.neighborhood || "", // Default empty if not provided
      }),
      establishment_type: command.establishment_type,
      is_active: command.is_active,
    });
    establishment.validate(["name", "email", "address", "establishment_type"]);
    establishment.generateQRCode();
    establishment.applyEvent(
      new EstablishmentCreatedEvent({
        establishment_id: establishment.id,
        name: establishment.name,
        email: establishment.email,
        cnpj: establishment.cnpj,
        phone: establishment.phone,
        address: establishment.address,
        description: establishment.description,
        avatar: establishment.avatar,
        cover: null, // Assuming cover is not in command yet
        rating: establishment.rating,
        is_active: establishment.is_active,
        is_verified: establishment.is_verified,
        created_at: establishment.created_at,
      }),
    );
    return establishment;
  }

  changeName(name: string): void {
    this.name = name;
    this.validate(["name"]);
  }

  changeDescription(description: string | null): void {
    this.description = description;
  }

  changeAvatar(avatar: string | null): void {
    this.avatar = avatar;
  }

  changeCnpj(cnpj: string): void {
    try {
      this.cnpj = new CNPJ(cnpj);
      this.validate(["cnpj"]);
    } catch (error) {
      if (error instanceof InvalidCNPJError) {
        this.notification.addError(error.message, "cnpj");
      } else {
        throw error;
      }
    }
  }

  changeEmail(email: string): void {
    this.email = new Email(email);
    this.validate(["email"]);
  }

  changePhone(phone: string | null): void {
    this.phone = phone ? new Phone(phone) : null;
    this.validate(["phone"]);
  }

  changeWebsite(website: string | null): void {
    this.website = website;
  }

  changeAddress(
    street: string,
    number: string,
    city: string,
    state: string,
    zipCode: string,
    neighborhood?: string,
  ): void {
    this.address = new Address({
      street,
      number,
      city,
      state,
      zipCode,
      neighborhood: neighborhood || this.address.neighborhood,
    });
    this.validate(["address"]);
  }

  changeEstablishmentType(establishment_type: string): void {
    this.establishment_type = establishment_type;
    this.validate(["establishment_type"]);
  }

  generateQRCode(): void {
    const qrData = `soundmeet://establishment/${this.id.id}`;
    this.qr_code = new QRCode({
      code: qrData,
      url: `https://soundmeet.app/establishment/${this.id.id}`,
    });
  }

  addRating(ratingValue: number, ratedBy: Uuid, comment?: string | null): void {
    const rating = new Rating(ratingValue);

    // Atualiza a média de ratings usando o método estático average para arredondamento correto
    const totalScore = this.rating.value * this.total_ratings;
    this.total_ratings += 1;
    const newAverage = (totalScore + ratingValue) / this.total_ratings;
    this.rating = new Rating(Math.round(newAverage * 10) / 10); // Arredonda para 1 casa decimal

    this.applyEvent(
      new EstablishmentRatedEvent(
        this.id,
        new Rating(ratingValue),
        comment ?? null,
        ratedBy,
      ),
    );
  }

  activate(): void {
    this.is_active = true;
  }

  deactivate(): void {
    this.is_active = false;
  }

  verify(): void {
    this.is_verified = true;
    this.applyEvent(
      new EstablishmentVerifiedEvent({
        establishment_id: this.id,
        verified_at: new Date(),
      }),
    );
  }

  unverify(): void {
    this.is_verified = false;
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
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return EstablishmentFakeBuilder;
  }

  get entity_id(): ValueObject {
    return this.id;
  }

  toJSON() {
    return {
      establishment_id: this.id.id,
      name: this.name,
      description: this.description,
      avatar: this.avatar,
      cnpj: this.cnpj?.toJSON() || null,
      email: this.email.value,
      phone: this.phone ? this.phone.value : null,
      website: this.website,
      address: this.address.toJSON(),
      establishment_type: this.establishment_type,
      rating: this.rating.value,
      total_ratings: this.total_ratings,
      qr_code: this.qr_code?.code || null,
      is_active: this.is_active,
      is_verified: this.is_verified,
      created_at: this.created_at,
      is_highly_rated: this.isHighlyRated,
      is_popular: this.isPopular,
      is_bar: this.isBar,
      is_restaurant: this.isRestaurant,
      is_club: this.isClub,
    };
  }
}
