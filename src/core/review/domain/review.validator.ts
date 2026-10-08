import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import {
  REVIEW_AUTHOR_TYPES,
  REVIEW_CONTEXT_TYPES,
  REVIEW_TARGET_TYPES,
} from "./review-types";

export class ReviewRules {
  // Estrela é inteiro de 1 a 5. O VO `Rating` NÃO serve aqui: aceita 0 e uma
  // casa decimal, porque foi feito para médias.
  @Max(5, { groups: ["rating"] })
  @Min(1, { groups: ["rating"] })
  @IsInt({ groups: ["rating"] })
  rating: number;

  @IsIn(REVIEW_TARGET_TYPES as unknown as string[], {
    groups: ["target_type"],
  })
  target_type: string;

  @IsNotEmpty({ groups: ["target_id"] })
  @IsString({ groups: ["target_id"] })
  target_id: string;

  @IsIn(REVIEW_AUTHOR_TYPES as unknown as string[], {
    groups: ["author_type"],
  })
  author_type: string;

  @IsNotEmpty({ groups: ["author_id"] })
  @IsString({ groups: ["author_id"] })
  author_id: string;

  @IsIn(REVIEW_CONTEXT_TYPES as unknown as string[], {
    groups: ["context_type"],
  })
  context_type: string;

  @IsNotEmpty({ groups: ["context_id"] })
  @IsString({ groups: ["context_id"] })
  context_id: string;

  @MaxLength(1000, { groups: ["comment"] })
  @IsOptional({ groups: ["comment"] })
  @IsString({ groups: ["comment"] })
  comment?: string | null;

  constructor(data: any) {
    Object.assign(this, {
      rating: data.rating,
      target_type: data.target_type,
      target_id: data.target_id,
      author_type: data.author_type,
      author_id: data.author_id,
      context_type: data.context_type,
      context_id: data.context_id,
      comment: data.comment,
    });
  }
}

export class ReviewValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "rating",
          "target_type",
          "target_id",
          "author_type",
          "author_id",
          "context_type",
          "context_id",
          "comment",
        ];
    return super.validate(notification, new ReviewRules(data), newFields);
  }
}

export class ReviewValidatorFactory {
  static create() {
    return new ReviewValidator();
  }
}
