import { Global, Module } from "@nestjs/common";

import { MailService } from "./mail.service";
import { MailEventHandler } from "./mail-event.handler";

@Global()
@Module({
  providers: [MailService, MailEventHandler],
  exports: [MailService],
})
export class MailModule {}
