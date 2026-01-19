import { CNPJ, Email, Phone, QRCode, Rating } from "../../../shared/domain";
import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { EstablishmentId } from "../establishment.aggregate";

export type EstablishmentCreatedEventProps = {
  establishment_id: EstablishmentId;
  name: string;
  email: Email;
  cnpj: CNPJ | null;
  phone: Phone | null;
  description: string | null;
  avatar: string | null;
  qr_code: QRCode | null;
  rating: Rating;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
};

export class EstablishmentCreatedEvent implements IDomainEvent {
  readonly aggregate_id: EstablishmentId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly name: string;
  readonly email: Email;
  readonly cnpj: CNPJ | null;
  readonly phone: Phone | null;
  readonly description: string | null;
  readonly avatar: string | null;
  readonly qr_code: QRCode | null;
  readonly rating: Rating;
  readonly total_ratings: number;
  readonly is_active: boolean;
  readonly is_verified: boolean;
  readonly created_at: Date;

  constructor(props: EstablishmentCreatedEventProps) {
    this.aggregate_id = props.establishment_id;
    this.name = props.name;
    this.email = props.email;
    this.cnpj = props.cnpj;
    this.phone = props.phone;
    this.description = props.description;
    this.avatar = props.avatar;
    this.qr_code = props.qr_code;
    this.rating = props.rating;
    this.total_ratings = props.total_ratings;
    this.is_active = props.is_active;
    this.is_verified = props.is_verified;
    this.created_at = props.created_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
