import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

import { InquiryOutput } from "../../core/scheduling/application/use-cases/common/inquiry-output";
import { PaginationOutput } from "../../core/shared/application/pagination-output";
import { InquiryStatusEnum } from "../../core/shared/domain/value-objects/inquiry-status.vo";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class InquiryPresenter {
  id: string;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  event_id: string | null;
  subject: string | null;
  initial_message: string | null;
  status: InquiryStatusEnum;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  expires_at: Date | null;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  accepted_at: Date | null;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  rejected_at: Date | null;
  rejection_reason: string | null;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  converted_at: Date | null;
  booking_id: string | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: InquiryOutput) {
    this.id = output.id;
    this.establishment_id = output.establishment_id;
    this.musician_id = output.musician_id;
    this.band_id = output.band_id;
    this.event_id = output.event_id;
    this.subject = output.subject;
    this.initial_message = output.initial_message;
    this.status = output.status as InquiryStatusEnum;
    this.expires_at = output.expires_at;
    this.accepted_at = output.accepted_at;
    this.rejected_at = output.rejected_at;
    this.rejection_reason = output.rejection_reason;
    this.converted_at = output.converted_at;
    this.booking_id = output.booking_id;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class InquiryCollectionPresenter extends CollectionPresenter {
  @ApiProperty({ type: [InquiryPresenter] })
  data: InquiryPresenter[];

  constructor(output: PaginationOutput<InquiryOutput>) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new InquiryPresenter(i));
  }
}
