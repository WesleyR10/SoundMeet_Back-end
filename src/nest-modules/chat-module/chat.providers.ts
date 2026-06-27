import {
  GetConversationUseCase,
  ListConversationsUseCase,
  MarkAsReadUseCase,
  OpenConversationUseCase,
  SendMessageUseCase,
} from "../../core/chat/application/use-cases";
import { IConversationRepository } from "../../core/chat/domain/conversation.repository";
import { IMessageRepository } from "../../core/chat/domain/message.repository";
import { ConversationPrismaRepository } from "../../core/chat/infra/db/prisma/conversation-prisma.repository";
import { MessagePrismaRepository } from "../../core/chat/infra/db/prisma/message-prisma.repository";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const REPOSITORIES = {
  CONVERSATION: {
    provide: "IConversationRepository",
    useFactory: (prismaService: PrismaService): IConversationRepository => {
      return new ConversationPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  MESSAGE: {
    provide: "IMessageRepository",
    useFactory: (prismaService: PrismaService): IMessageRepository => {
      return new MessagePrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const USE_CASES = {
  OPEN_CONVERSATION: {
    provide: OpenConversationUseCase,
    useFactory: (convRepo: IConversationRepository): OpenConversationUseCase => {
      return new OpenConversationUseCase(convRepo);
    },
    inject: [REPOSITORIES.CONVERSATION.provide],
  },
  SEND_MESSAGE: {
    provide: SendMessageUseCase,
    useFactory: (
      convRepo: IConversationRepository,
      msgRepo: IMessageRepository,
    ): SendMessageUseCase => {
      return new SendMessageUseCase(convRepo, msgRepo);
    },
    inject: [REPOSITORIES.CONVERSATION.provide, REPOSITORIES.MESSAGE.provide],
  },
  GET_CONVERSATION: {
    provide: GetConversationUseCase,
    useFactory: (
      convRepo: IConversationRepository,
      msgRepo: IMessageRepository,
    ): GetConversationUseCase => {
      return new GetConversationUseCase(convRepo, msgRepo);
    },
    inject: [REPOSITORIES.CONVERSATION.provide, REPOSITORIES.MESSAGE.provide],
  },
  LIST_CONVERSATIONS: {
    provide: ListConversationsUseCase,
    useFactory: (convRepo: IConversationRepository): ListConversationsUseCase => {
      return new ListConversationsUseCase(convRepo);
    },
    inject: [REPOSITORIES.CONVERSATION.provide],
  },
  MARK_AS_READ: {
    provide: MarkAsReadUseCase,
    useFactory: (
      convRepo: IConversationRepository,
      msgRepo: IMessageRepository,
    ): MarkAsReadUseCase => {
      return new MarkAsReadUseCase(convRepo, msgRepo);
    },
    inject: [REPOSITORIES.CONVERSATION.provide, REPOSITORIES.MESSAGE.provide],
  },
};

export const CHAT_PROVIDERS = {
  REPOSITORIES,
  USE_CASES,
};
