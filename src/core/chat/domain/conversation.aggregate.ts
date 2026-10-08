import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import {
  ConversationValidatorFactory,
  validateNegotiationOrigin,
} from "./conversation.validator";
import { ConversationFakeBuilder } from "./conversation-fake.builder";

export type ConversationConstructorProps = {
  conversation_id?: ConversationId;
  /** Ver `ConversationCreateCommand` — exatamente um dos dois. */
  inquiry_id: string | null;
  booking_id: string | null;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  created_at?: Date;
  updated_at?: Date;
};

/**
 * 🔴 **Exatamente UMA das duas origens.**
 *
 * A conversa pertence à NEGOCIAÇÃO, e uma negociação nasce de duas portas:
 * `Inquiry` ("conversar sobre uma data", que é uma pergunta) ou `Booking`
 * ("propor um show", que é uma oferta com data e cachê). Até 17/set/2026 só a
 * primeira abria canal, e a consequência era de produto: quem recebia uma
 * proposta não tinha onde responder "pode ser 22h?" — só aceitar o número ou
 * recusar seco.
 *
 * Quem recusa nenhuma ou as duas é `validateNegotiationOrigin`, e o banco
 * repete a regra numa CHECK.
 */
export type ConversationCreateCommand = {
  inquiry_id: string | null;
  booking_id: string | null;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
};

export class ConversationId extends Uuid {}

export class Conversation extends AggregateRoot {
  conversation_id: ConversationId;
  inquiry_id: string | null;
  booking_id: string | null;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: ConversationConstructorProps) {
    super();
    this.conversation_id = props.conversation_id ?? new ConversationId();
    this.inquiry_id = props.inquiry_id;
    this.booking_id = props.booking_id;
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
    const valid = validator.validate(this.notification, this, fields);

    // A origem é invariante do AGREGADO, não de um campo — por isso roda
    // sempre, inclusive numa validação parcial por `fields`: uma conversa não
    // pode passar a valer sem saber de onde veio.
    validateNegotiationOrigin(this.notification, this);

    return valid && !this.notification.hasErrors();
  }

  /**
   * Política única de participação — usada por HTTP (send/get/mark-as-read) e
   * pelo WebSocket. Uma conversa pertence ao estabelecimento e ao músico OU à
   * banda da negociação que a abriu; ninguém mais lê nem escreve nela.
   *
   * `identities` aceita mais de um valor porque a identidade do ator depende do
   * papel: músico é o próprio `sub` do JWT, estabelecimento e banda vêm dos
   * claims `establishment_ids` / `band_ids`.
   */
  hasParticipant(...identities: (string | null | undefined)[]): boolean {
    return this.resolveParticipantId(...identities) !== null;
  }

  /**
   * Como `hasParticipant`, mas devolve a identidade exata que casou — a que
   * está de fato no registro, não a que o chamador passou. Necessário quando
   * o ator carrega várias identidades candidatas (ex.: dono com mais de um
   * estabelecimento, registerEstablishment permite até 3) e precisamos saber
   * qual delas é a participante real desta conversa específica, pra usar
   * como sender_id/reader_id em vez de assumir a 1ª identidade do JWT.
   */
  resolveParticipantId(
    ...identities: (string | null | undefined)[]
  ): string | null {
    for (const identity of identities) {
      if (!identity) continue;
      if (this.establishment_id === identity) return this.establishment_id;
      if (this.musician_id === identity) return this.musician_id;
      if (this.band_id === identity) return this.band_id;
    }
    return null;
  }

  static fake() {
    return ConversationFakeBuilder;
  }

  toJSON() {
    return {
      conversation_id: this.conversation_id.id,
      inquiry_id: this.inquiry_id,
      booking_id: this.booking_id,
      establishment_id: this.establishment_id,
      musician_id: this.musician_id,
      band_id: this.band_id,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
