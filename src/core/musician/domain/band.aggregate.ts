import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { BandValidatorFactory } from "./band.validator";
import { BandFakeBuilder } from "./band-fake.builder";

export class BandId extends Uuid {}

export type BandMemberProps = {
  member_id?: Uuid; // ID do relacionamento, opcional na criação
  musician_id: Uuid;
  role: string; // "leader", "member"
  instrument: string;
  joined_at: Date;
};

export type BandConstructorProps = {
  band_id?: BandId;
  name: string;
  description?: string | null;
  avatar?: string | null;
  genres: string[];
  members?: BandMemberProps[];
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
  is_active?: boolean;
};

export class Band extends AggregateRoot {
  band_id: BandId;
  name: string;
  description: string | null;
  avatar: string | null;
  genres: string[];
  members: BandMemberProps[];
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
    this.members = props.members ?? [];
    this.is_active = props.is_active ?? true;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): Uuid {
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

  addMember(musician_id: Uuid, role: string, instrument: string): void {
    if (this.members.some((m) => m.musician_id.equals(musician_id))) {
      throw new EntityValidationError([
        {
          musician_id: ["Musician is already a member of this band"],
        },
      ]);
    }

    this.members.push({
      musician_id,
      role,
      instrument,
      joined_at: new Date(),
    });
    this.updated_at = new Date();
  }

  removeMember(musician_id: Uuid): void {
    const initialLength = this.members.length;
    this.members = this.members.filter(
      (m) => !m.musician_id.equals(musician_id),
    );

    if (this.members.length === initialLength) {
      throw new EntityValidationError([
        {
          musician_id: ["Musician is not a member of this band"],
        },
      ]);
    }
    this.updated_at = new Date();
  }

  updateMemberRole(musician_id: Uuid, role: string): void {
    const member = this.members.find((m) => m.musician_id.equals(musician_id));
    if (!member) {
      throw new EntityValidationError([
        {
          musician_id: ["Musician is not a member of this band"],
        },
      ]);
    }
    member.role = role;
    this.updated_at = new Date();
  }

  toJSON() {
    return {
      band_id: this.band_id.id,
      name: this.name,
      description: this.description,
      avatar: this.avatar,
      genres: this.genres,
      members: this.members.map((m) => ({
        member_id: m.member_id?.id,
        musician_id: m.musician_id.id,
        role: m.role,
        instrument: m.instrument,
        joined_at: m.joined_at,
      })),
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
