import { ApiProperty } from "@nestjs/swagger";

import {
  PaginationPresenter,
  PaginationPresenterProps,
} from "./pagination.presenter";

export abstract class CollectionPresenter {
  @ApiProperty({
    type: () => PaginationPresenter,
    example: { current_page: 1, per_page: 25, last_page: 1, total: 0 },
  })
  meta: PaginationPresenterProps;

  constructor(props: PaginationPresenterProps) {
    const toInt = (value: any) => {
      const num =
        typeof value === "number" ? value : Number.parseInt(String(value), 10);
      return Number.isFinite(num) ? num : 0;
    };

    this.meta = {
      current_page: toInt((props as any)?.current_page),
      per_page: toInt((props as any)?.per_page),
      last_page: toInt((props as any)?.last_page),
      total: toInt((props as any)?.total),
    };
  }

  abstract get data();
}
