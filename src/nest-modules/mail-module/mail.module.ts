import { Global, Module } from "@nestjs/common";

import { MailEventHandler } from "./mail-event.handler";
import { MailService } from "./mail.service";

@Global()
@Module({
  providers: [MailService, MailEventHandler],
  exports: [MailService],
})
export class MailModule {}
