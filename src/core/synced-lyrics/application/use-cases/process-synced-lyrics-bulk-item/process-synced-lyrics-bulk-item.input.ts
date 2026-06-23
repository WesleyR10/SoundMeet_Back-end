import { Type } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from "class-validator";

export type ProcessSyncedLyricsBulkItemInput = {
  job_id: string;
  musician_id: string;
  music_library_id: string;
  force?: boolean;
};

export class ProcessSyncedLyricsBulkItemInputValidator {
  @IsUUID()
  @IsNotEmpty()
  job_id: string;

  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsUUID()
  @IsNotEmpty()
  music_library_id: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  force?: boolean;

  constructor(props: ProcessSyncedLyricsBulkItemInput) {
    Object.assign(this, props);
  }
}
