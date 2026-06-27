import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { ConversationFakeBuilder } from "./conversation-fake.builder";
import { ConversationValidatorFactory } from "./conversation.validator";

export type ConversationConstructorProps = {
  conversation_id?: ConversationId;
  inquiry_id: string;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  created_at?: Date;
  updated_at?: Date;
};

export type ConversationCreateCommand = {
  inquiry_id: string;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
};

export class ConversationId extends Uuid {}

export class Conversation extends AggregateRoot {
  conversation_id: ConversationId;
  inquiry_id: string;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: ConversationConstructorProps) {
    super();
    this.conversation_id = props.conversation_id ?? new ConversationId();
    this.inquiry_id = props.inquiry_id;
    this.establishment_id = props.establishment_id;
    this.musician_id = props.musician_id;
    this.band_id = props.band_id;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): ConversationId {
    return this.conversation_id;
  }

  static create(command: ConversationCreateCommand): Conversation {
    const conv = new Conversation(command);
    conv.validate();
    if (conv.notification.hasErrors()) {
      throw new EntityValidationError(conv.notification.toJSON());
    }
    return conv;
  }

  validate(fields?: string[]): boolean {
    const validator = ConversationValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return ConversationFakeBuilder;
  }

  toJSON() {
    return {
      conversation_id: this.conversation_id.id,
      inquiry_id: this.inquiry_id,
      establishment_id: this.establishment_id,
      musician_id: this.musician_id,
      band_id: this.band_id,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
