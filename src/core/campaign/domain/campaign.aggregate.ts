import { AggregateRoot, Uuid } from "../../shared/domain";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { CampaignValidatorFactory } from "./campaign.validator";
import { CampaignFakeBuilder } from "./campaign-fake.builder";

export enum CampaignStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  SENT = "sent",
  CANCELLED = "cancelled",
}

export type CampaignConstructorProps = {
  campaign_id?: CampaignId;
  establishment_id: string;
  title: string;
  description?: string | null;
  start_date: Date;
  end_date: Date;
  target_genres: string[];
  status?: CampaignStatus;
  created_at?: Date;
  updated_at?: Date;
};

export type CampaignCreateCommand = {
  establishment_id: string;
  title: string;
  description?: string | null;
  start_date: Date;
  end_date: Date;
  target_genres?: string[];
};

export class CampaignId extends Uuid {}

export class Campaign extends AggregateRoot {
  campaign_id: CampaignId;
  establishment_id: string;
  title: string;
  description: string | null;
  start_date: Date;
  end_date: Date;
  target_genres: string[];
  status: CampaignStatus;
  created_at: Date;
  updated_at: Date;

  constructor(props: CampaignConstructorProps) {
    super();
    this.campaign_id = props.campaign_id ?? new CampaignId();
    this.establishment_id = props.establishment_id;
    this.title = props.title;
    this.description = props.description ?? null;
    this.start_date = props.start_date;
    this.end_date = props.end_date;
    this.target_genres = props.target_genres ?? [];
    this.status = props.status ?? CampaignStatus.DRAFT;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): CampaignId {
    return this.campaign_id;
  }

  static create(command: CampaignCreateCommand): Campaign {
    const campaign = new Campaign({
      establishment_id: command.establishment_id,
      title: command.title,
      description: command.description ?? null,
      start_date: command.start_date,
      end_date: command.end_date,
      target_genres: command.target_genres ?? [],
    });
    campaign.validate();
    if (campaign.notification.hasErrors()) {
      throw new EntityValidationError(campaign.notification.toJSON());
    }
    return campaign;
  }

  validate(fields?: string[]): void {
    const validator = CampaignValidatorFactory.create();
    validator.validate(this.notification, this, fields);
  }

  activate(): void {
    this.status = CampaignStatus.ACTIVE;
    this.touch();
  }

  markSent(): void {
    this.status = CampaignStatus.SENT;
    this.touch();
  }

  cancel(): void {
    this.status = CampaignStatus.CANCELLED;
    this.touch();
  }

  private touch(): void {
    this.updated_at = new Date();
  }

  static fake(): typeof CampaignFakeBuilder {
    return CampaignFakeBuilder;
  }

  toJSON() {
    return {
      campaign_id: this.campaign_id.id,
      establishment_id: this.establishment_id,
      title: this.title,
      description: this.description,
      start_date: this.start_date,
      end_date: this.end_date,
      target_genres: this.target_genres,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
