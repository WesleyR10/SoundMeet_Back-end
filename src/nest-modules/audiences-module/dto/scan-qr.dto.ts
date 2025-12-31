import { OmitType } from "@nestjs/swagger";

import { ScanQRInputValidator } from "../../../core/audience/application/use-cases/scan-qr/scan-qr.input";

export class ScanQRInputWithoutId extends OmitType(ScanQRInputValidator, [
  "id",
] as const) {}

export class ScanQRDto extends ScanQRInputWithoutId {}
