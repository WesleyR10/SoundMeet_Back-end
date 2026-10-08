import { AggregateRoot, Uuid } from "../../shared/domain";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { FollowValidatorFactory } from "./follow.validator";
import { FollowFakeBuilder } from "./follow-fake.builder";
import { FollowTargetType } from "./follow-types";

export * from "./follow-types";

export type FollowConstructorProps = {
  follow_id?: FollowId;
  audience_id: string;
  target_type: FollowTargetType;
  target_id: string;
  notifications_enabled?: boolean;
  created_at?: Date;
  updated_at?: Date;
};

export type FollowCreateCommand = {
  audience_id: string;
  target_type: FollowTargetType;
  target_id: string;
};

export class FollowId extends Uuid {}

/**
 * Um fã seguindo um músico ou uma casa, para saber dos próximos shows.
 *
 * ⚠️ **Unicidade por (fã, tipo, alvo), garantida no banco.** Seguir de novo
 * quem já se segue é o mesmo vínculo — o use-case devolve o existente, e o
 * índice único é a defesa real contra dois toques simultâneos.
 *
 * ⚠️ **Quem é seguido não vê a lista de quem o segue.** Só a contagem sai
 * (`GET /follows/summary`). Lista de seguidores de um bar é lista de clientes
 * com nome — dado que o produto não precisa expor.
 *
 * `notifications_enabled` desliga os avisos de UM vínculo sem desfazê-lo: o
 * fã pode querer acompanhar a casa no app sem receber push dela.
 */
export class Follow extends AggregateRoot {
  follow_id: FollowId;
  audience_id: string;
  target_type: FollowTargetType;
  target_id: string;
  notifications_enabled: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(props: FollowConstructorProps) {
    super();
    this.follow_id = props.follow_id ?? new FollowId();
    this.audience_id = props.audience_id;
    this.target_type = props.target_type;
    this.target_id = props.target_id;
    this.notifications_enabled = props.notifications_enabled ?? true;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): FollowId {
    return this.follow_id;
  }

  static create(command: FollowCreateCommand): Follow {
    const follow = new Follow({
      audience_id: command.audience_id,
      target_type: command.target_type,
      target_id: command.target_id,
    });

    follow.validate();
    if (follow.notification.hasErrors()) {
      throw new EntityValidationError(follow.notification.toJSON());
    }

    return follow;
  }

  validate(fields?: string[]): void {
    const validator = FollowValidatorFactory.create();
    validator.validate(this.notification, this, fields);
  }

  enableNotifications(): void {
    this.notifications_enabled = true;
    this.updated_at = new Date();
  }

  disableNotifications(): void {
    this.notifications_enabled = false;
    this.updated_at = new Date();
  }

  static fake(): typeof FollowFakeBuilder {
    return FollowFakeBuilder;
  }

  toJSON() {
    return {
      follow_id: this.follow_id.id,
      audience_id: this.audience_id,
      target_type: this.target_type,
      target_id: this.target_id,
      notifications_enabled: this.notifications_enabled,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
