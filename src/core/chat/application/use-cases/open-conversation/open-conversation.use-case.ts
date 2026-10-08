import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { Conversation } from "../../../domain/conversation.aggregate";
import { IConversationRepository } from "../../../domain/conversation.repository";

/**
 * 🔴 Exatamente UMA das duas origens.
 *
 * Os dois campos são opcionais no tipo porque cada chamador conhece só a sua
 * porta — o handler de `InquiryCreatedEvent` passa a inquiry, o de
 * `BookingProposedEvent` passa o booking. Quem recusa nenhuma ou as duas é o
 * próprio use case, antes de tocar o repositório.
 */
export type OpenConversationInput = {
  inquiry_id?: string | null;
  booking_id?: string | null;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
};

export type OpenConversationOutput = {
  conversation_id: string;
  already_existed: boolean;
};

/**
 * Abre o canal de uma negociação — ou devolve o que já existe.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DUAS PORTAS, UMA CONVERSA (17/set/2026)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Até aqui só `InquiryCreatedEvent` chegava neste use case, e a razão não era
 * de produto: `conversations.inquiry_id` era NOT NULL, então uma conversa
 * literalmente não conseguia existir sem uma inquiry. A consequência é que
 * "propor um show" — a porta que manda data e cachê — deixava o artista sem
 * onde responder "pode ser 22h?". Ele só podia aceitar o número ou recusar
 * seco, e a UI do estabelecimento precisava AVISAR "não abre conversa".
 *
 * Hoje o `BookingProposedEvent` entra pela mesma porta.
 *
 * ⚠️ **Idempotente por desenho.** Os handlers de evento podem reentrar (retry
 * do emitter, replay de outbox), e as duas colunas são `@unique`: sem a leitura
 * antes do `insert`, a segunda execução levaria violação de constraint e o
 * `catch` do handler só a registraria no log — canal aberto uma vez, erro toda
 * vez depois.
 */
export class OpenConversationUseCase implements IUseCase<
  OpenConversationInput,
  OpenConversationOutput
> {
  constructor(private readonly convRepo: IConversationRepository) {}

  async execute(input: OpenConversationInput): Promise<OpenConversationOutput> {
    const inquiryId = input.inquiry_id ?? null;
    const bookingId = input.booking_id ?? null;

    if ((inquiryId === null) === (bookingId === null)) {
      /*
       * `InvalidArgumentError` e não `EntityValidationError`: aqui ainda não há
       * agregado, é o CONTRATO do use case que foi violado — quem chamou não
       * disse de que negociação a conversa nasce.
       */
      throw new InvalidArgumentError(
        "open-conversation requires exactly one of inquiry_id or booking_id",
      );
    }

    const existing = inquiryId
      ? await this.convRepo.findByInquiryId(inquiryId)
      : await this.convRepo.findByBookingId(bookingId!);

    if (existing) {
      return {
        conversation_id: existing.conversation_id.id,
        already_existed: true,
      };
    }

    const conv = Conversation.create({
      inquiry_id: inquiryId,
      booking_id: bookingId,
      establishment_id: input.establishment_id,
      musician_id: input.musician_id,
      band_id: input.band_id,
    });

    await this.convRepo.insert(conv);

    return {
      conversation_id: conv.conversation_id.id,
      already_existed: false,
    };
  }
}
