import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { Location } from "../../shared/domain/value-objects/location.vo";
import { PriceRange } from "../../shared/domain/value-objects/price-range.vo";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { BandValidatorFactory } from "./band.validator";
import { BandFakeBuilder } from "./band-fake.builder";

export class BandId extends Uuid {}

export type BandMemberStatus = "pending" | "accepted" | "declined";

export type BandMemberProps = {
  member_id?: Uuid; // ID do relacionamento, opcional na criação
  musician_id: Uuid;
  role: string; // "leader", "member"
  instrument: string;
  status: BandMemberStatus;
  joined_at: Date;
  responded_at: Date | null;
};

export type BandConstructorProps = {
  band_id?: BandId;
  name: string;
  description?: string | null;
  avatar?: string | null;
  genres: string[];
  qr_code?: string | null;
  members?: BandMemberProps[];
  priceRange?: PriceRange | null;
  address?: Location | null;
  open_to_gigs?: boolean | null;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
};

export type BandCreateCommand = {
  name: string;
  description?: string | null;
  avatar?: string | null;
  genres: string[];
  members?: BandMemberProps[];
  priceRange?: PriceRange | null;
  address?: Location | null;
  open_to_gigs?: boolean | null;
  is_active?: boolean;
};

export class Band extends AggregateRoot {
  band_id: BandId;
  name: string;
  description: string | null;
  avatar: string | null;
  genres: string[];
  qr_code: string | null;
  members: BandMemberProps[];
  priceRange: PriceRange | null;
  address: Location | null;
  open_to_gigs: boolean | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(props: BandConstructorProps) {
    super();
    this.band_id = props.band_id ?? new BandId();
    this.name = props.name;
    this.description = props.description ?? null;
    this.avatar = props.avatar ?? null;
    this.genres = props.genres;
    this.qr_code = props.qr_code ?? null;
    this.members = (props.members ?? []).map((member) => ({
      ...member,
      member_id: member.member_id ?? new Uuid(),
      status: member.status ?? "accepted",
      responded_at: member.responded_at ?? null,
    }));
    this.priceRange = props.priceRange ?? null;
    this.address = props.address ?? null;
    // Nunca default true — consentimento explícito do líder.
    this.open_to_gigs = props.open_to_gigs ?? null;
    this.is_active = props.is_active ?? true;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): BandId {
    return this.band_id;
  }

  static create(props: BandCreateCommand): Band {
    const band = new Band({
      ...props,
      members: props.members ?? [],
    });
    band.validate();
    return band;
  }

  validate(fields?: string[]): boolean {
    const validator = BandValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return BandFakeBuilder;
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

  generateQRCode(code: string): void {
    this.qr_code = code;
    this.updated_at = new Date();
  }

  updateGenres(genres: string[]): void {
    this.genres = genres;
    this.validate(["genres"]);
    this.updated_at = new Date();
  }

  activate(): void {
    this.is_active = true;
    this.updated_at = new Date();
  }

  deactivate(): void {
    this.is_active = false;
    this.updated_at = new Date();
  }

  private pushMember(
    musician_id: Uuid,
    role: string,
    instrument: string,
    status: BandMemberStatus,
    responded_at: Date | null,
  ): void {
    this.members.push({
      member_id: new Uuid(),
      musician_id,
      role,
      instrument,
      status,
      joined_at: new Date(),
      responded_at,
    });
    this.updated_at = new Date();
  }

  /**
   * @deprecated Adição unilateral sem convite/aceite. Use inviteMember() +
   * acceptInvite() — mantido só para não quebrar chamadores antigos.
   */
  addMember(musician_id: Uuid, role: string, instrument: string): void {
    if (this.members.some((m) => m.musician_id.equals(musician_id))) {
      this.notification.addError(
        "Musician is already a member of this band",
        "musician_id",
      );
      return;
    }
    this.pushMember(musician_id, role, instrument, "accepted", null);
  }

  inviteMember(musician_id: Uuid, role: string, instrument: string): void {
    const existing = this.members.find((m) =>
      m.musician_id.equals(musician_id),
    );

    if (existing) {
      if (existing.status !== "declined") {
        this.notification.addError(
          "Musician is already a member or has a pending invite for this band",
          "musician_id",
        );
        return;
      }
      // Convite recusado não é um estado terminal — reativa a mesma linha em
      // vez de inserir uma nova (a constraint única de (bandId, musicianId)
      // no banco não permitiria duas linhas para o mesmo músico de qualquer
      // forma).
      existing.role = role;
      existing.instrument = instrument;
      existing.status = "pending";
      existing.responded_at = null;
      this.updated_at = new Date();
      return;
    }

    this.pushMember(musician_id, role, instrument, "pending", null);
  }

  private transitionInvite(
    musician_id: Uuid,
    to: Extract<BandMemberStatus, "accepted" | "declined">,
  ): void {
    const member = this.members.find((m) => m.musician_id.equals(musician_id));
    if (!member) {
      this.notification.addError(
        "No invite found for this musician",
        "musician_id",
      );
      return;
    }
    if (member.status !== "pending") {
      this.notification.addError("Invite is not pending", "status");
      return;
    }
    member.status = to;
    member.responded_at = new Date();
    this.updated_at = new Date();
  }

  acceptInvite(musician_id: Uuid): void {
    this.transitionInvite(musician_id, "accepted");
  }

  declineInvite(musician_id: Uuid): void {
    this.transitionInvite(musician_id, "declined");
  }

  get acceptedMembers(): BandMemberProps[] {
    return this.members.filter((m) => m.status === "accepted");
  }

  removeMember(musician_id: Uuid): void {
    const initialLength = this.members.length;
    this.members = this.members.filter(
      (m) => !m.musician_id.equals(musician_id),
    );

    if (this.members.length === initialLength) {
      this.notification.addError(
        "Musician is not a member of this band",
        "musician_id",
      );
      return;
    }
    this.updated_at = new Date();
  }

  updateMemberRole(musician_id: Uuid, role: string): void {
    const member = this.members.find((m) => m.musician_id.equals(musician_id));
    if (!member) {
      this.notification.addError(
        "Musician is not a member of this band",
        "musician_id",
      );
      return;
    }
    member.role = role;
    this.updated_at = new Date();
  }

  changePriceRange(price: PriceRange | null): void {
    this.priceRange = price;
    this.updated_at = new Date();
  }

  changeAddress(address: Location | null): void {
    this.address = address;
    this.updated_at = new Date();
  }

  setOpenToGigs(value: boolean): void {
    this.open_to_gigs = value;
    this.updated_at = new Date();
  }

  toJSON() {
    return {
      band_id: this.band_id.id,
      name: this.name,
      description: this.description,
      avatar: this.avatar,
      genres: this.genres,
      qr_code: this.qr_code,
      members: this.members.map((m) => ({
        member_id: m.member_id?.id,
        musician_id: m.musician_id.id,
        role: m.role,
        instrument: m.instrument,
        status: m.status,
        joined_at: m.joined_at,
        responded_at: m.responded_at,
      })),
      priceRange: this.priceRange
        ? {
            model: this.priceRange.model,
            min: this.priceRange.min,
            max: this.priceRange.max,
            currency: this.priceRange.currency,
            notes: this.priceRange.notes,
          }
        : null,
      address: this.address?.toJSON() ?? null,
      open_to_gigs: this.open_to_gigs,
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
