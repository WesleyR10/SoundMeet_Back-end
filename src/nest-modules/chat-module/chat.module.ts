import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { EstablishmentsModule } from "../establishments-module/establishments.module";
import { ChatController } from "./chat.controller";
import { ChatEventsHandler } from "./chat-events.handler";
import { ChatGateway } from "./chat.gateway";
import { CHAT_PROVIDERS } from "./chat.providers";

@Module({
  imports: [DatabaseModule, EstablishmentsModule],
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ChatEventsHandler,
    ...Object.values(CHAT_PROVIDERS.REPOSITORIES),
    ...Object.values(CHAT_PROVIDERS.USE_CASES),
  ],
  exports: [
    ChatGateway,
    CHAT_PROVIDERS.USE_CASES.OPEN_CONVERSATION.provide,
    CHAT_PROVIDERS.REPOSITORIES.CONVERSATION.provide,
  ],
})
export class ChatModule {}
