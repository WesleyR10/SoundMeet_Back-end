import { ISearchableRepository } from "../../../shared/domain/repository/repository-interface";
import { SearchParams } from "../../../shared/domain/repository/search-params";
import { SearchResult } from "../../../shared/domain/repository/search-result";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { MusicianWallet } from "../musician-wallet.aggregate";

export type MusicianWalletFilter = {
  musician_id?: string;
  is_active?: boolean;
};

export class MusicianWalletSearchParams extends SearchParams<MusicianWalletFilter> {}

export class MusicianWalletSearchResult extends SearchResult<MusicianWallet> {}

export interface IMusicianWalletRepository extends ISearchableRepository<
  MusicianWallet,
  Uuid,
  MusicianWalletFilter,
  MusicianWalletSearchParams,
  MusicianWalletSearchResult
> {
  findByMusicianId(musicianId: string): Promise<MusicianWallet | null>;
}
