import { IUseCase } from "../../../../shared/application/use-case.interface";
import { Conversation } from "../../../domain/conversation.aggregate";
import { IConversationRepository } from "../../../domain/conversation.repository";

export type OpenConversationInput = {
  inquiry_id: string;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
};

export type OpenConversationOutput = {
  conversation_id: string;
  already_existed: boolean;
};

export class OpenConversationUseCase
  implements IUseCase<OpenConversationInput, OpenConversationOutput>
{
  constructor(private readonly convRepo: IConversationRepository) {}

  async execute(input: OpenConversationInput): Promise<OpenConversationOutput> {
    const existing = await this.convRepo.findByInquiryId(input.inquiry_id);
    if (existing) {
      return {
        conversation_id: existing.conversation_id.id,
        already_existed: true,
      };
    }

    const conv = Conversation.create({
      inquiry_id: input.inquiry_id,
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
