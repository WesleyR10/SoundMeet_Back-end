import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import {
  AiCifraUpload,
  AiCifraUploadId,
  AiCifraUploadStatus,
} from "./ai-cifra-upload.aggregate";

export type AiCifraUploadFilter = {
  musician_id?: string | null;
  status?: AiCifraUploadStatus | null;
  updated_at_lte?: Date | null;
};

export class AiCifraUploadSearchParams extends DefaultSearchParams<AiCifraUploadFilter> {
  private constructor(
    props: SearchParamsConstructorProps<AiCifraUploadFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<AiCifraUploadFilter> = {}) {
    return new AiCifraUploadSearchParams(props);
  }

  get filter(): AiCifraUploadFilter | null {
    return this._filter;
  }

  protected set filter(value: AiCifraUploadFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const dateFrom = (date: any): Date | null => {
      if (!date) return null;
      if (date instanceof Date) return date;
      const parsed = new Date(date);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const filter = {
      ...(_value &&
        _value.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value && _value.status && { status: _value.status }),
      ...(dateFrom((_value as any)?.updated_at_lte) && {
        updated_at_lte: dateFrom((_value as any)?.updated_at_lte)!,
      }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class AiCifraUploadSearchResult extends DefaultSearchResult<AiCifraUpload> {}

export interface IAiCifraUploadRepository extends ISearchableRepository<
  AiCifraUpload,
  AiCifraUploadId,
  AiCifraUploadFilter,
  AiCifraUploadSearchParams,
  AiCifraUploadSearchResult
> {}
