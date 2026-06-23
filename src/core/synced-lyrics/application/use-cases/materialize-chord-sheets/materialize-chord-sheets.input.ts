import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from "class-validator";
import { validateSync } from "class-validator";

export type MaterializeChordSheetsInputConstructorProps = {
  musician_id: string;
  music_library_ids: string[];
  force?: boolean;
};

export class MaterializeChordSheetsInput {
  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @IsUUID("4", { each: true })
  music_library_ids: string[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  force?: boolean;

  constructor(props?: MaterializeChordSheetsInputConstructorProps) {
    if (!props) return;
    this.musician_id = props.musician_id;
    this.music_library_ids = props.music_library_ids;
    this.force = props.force;
  }
}

export class ValidateMaterializeChordSheetsInput {
  static validate(input: MaterializeChordSheetsInput) {
    return validateSync(input);
  }
}
