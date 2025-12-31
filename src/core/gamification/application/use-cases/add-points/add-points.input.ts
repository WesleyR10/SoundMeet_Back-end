import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  validateSync,
} from "class-validator";

import { PointsSourceEnum } from "../../../domain/value-objects/points-source.vo";

export type AddPointsInputConstructorProps = {
  user_id: string;
  source: PointsSourceEnum;
  metadata?: Record<string, any>;
};

export class AddPointsInput {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsEnum(PointsSourceEnum)
  @IsNotEmpty()
  source: PointsSourceEnum;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  constructor(props: AddPointsInputConstructorProps) {
    if (!props) return;
    this.user_id = props.user_id;
    this.source = props.source;
    this.metadata = props.metadata;
  }
}

export class ValidateAddPointsInput {
  static validate(input: AddPointsInput) {
    return validateSync(input);
  }
}
