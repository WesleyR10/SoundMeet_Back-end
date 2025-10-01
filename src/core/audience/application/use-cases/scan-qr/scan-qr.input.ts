import { IsNotEmpty, IsString, IsOptional, IsObject } from "class-validator";

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
  id: string;

  @IsString()
  @IsNotEmpty()
  qr_code: string;

  @IsString()
  @IsOptional()
  musician_id?: string;

  @IsString()
  @IsOptional()
  establishment_id?: string;

  @IsString()
  @IsOptional()
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
