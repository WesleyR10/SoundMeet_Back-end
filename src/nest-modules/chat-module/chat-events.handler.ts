import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { InquiryCreatedEvent } from "../../core/scheduling/domain/events/inquiry-created.event";
import { OpenConversationUseCase } from "../../core/chat/application/use-cases";

@Injectable()
export class ChatEventsHandler {
  private readonly logger = new Logger(ChatEventsHandler.name);

  constructor(
    private readonly openConversationUseCase: OpenConversationUseCase,
  ) {}

  @OnEvent(InquiryCreatedEvent.name)
  async handleInquiryCreated(event: InquiryCreatedEvent): Promise<void> {
    try {
      await this.openConversationUseCase.execute({
        inquiry_id: event.aggregate_id.id,
        establishment_id: event.establishment_id,
        musician_id: event.musician_id,
        band_id: event.band_id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to open conversation for inquiry ${event.aggregate_id.id}`,
        error,
      );
    }
  }
}
