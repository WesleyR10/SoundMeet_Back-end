import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export type ScanQRInput = {
  id: string;
  qr_code: string;
  musician_id?: string;
  establishment_id?: string;
  event_id?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  metadata?: Record<string, any>;
};

export class ScanQRInputValidator {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @IsString()
  @IsNotEmpty()
  qr_code: string;

  @IsString()
  @IsOptional()
  @IsUUID()
  musician_id?: string;

  @IsString()
  @IsOptional()
  @IsUUID()
  establishment_id?: string;

  @IsString()
  @IsOptional()
  @IsUUID()
  event_id?: string;

  @IsObject()
  @IsOptional()
  location?: {
    latitude: number;
    longitude: number;
  };

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  constructor(props: ScanQRInput) {
    Object.assign(this, props);
  }
}
