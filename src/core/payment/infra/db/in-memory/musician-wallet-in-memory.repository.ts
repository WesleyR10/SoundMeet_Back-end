import { Uuid } from "@core/shared/domain/value-objects";

import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { MusicianWallet } from "../../../domain/musician-wallet.aggregate";
import {
  IMusicianWalletRepository,
  MusicianWalletFilter,
  MusicianWalletSearchParams,
  MusicianWalletSearchResult,
} from "../../../domain/repositories/musician-wallet.repository";

export class MusicianWalletInMemoryRepository
  extends InMemorySearchableRepository<
    MusicianWallet,
    Uuid,
    MusicianWalletFilter
  >
  implements IMusicianWalletRepository
{
  sortableFields: string[] = ["created_at"];

  getEntity(): new (...args: any[]) => MusicianWallet {
    return MusicianWallet;
  }

  async search(
    props: MusicianWalletSearchParams,
  ): Promise<MusicianWalletSearchResult> {
    const result = await super.search(props);
    return new MusicianWalletSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: MusicianWallet[],
    filter: MusicianWalletFilter | null,
  ): Promise<MusicianWallet[]> {
    if (!filter) {
      return items;
    }

    return items.filter((item) => {
      if (filter.musician_id && item.musician_id.id !== filter.musician_id) {
        return false;
      }
      return true;
    });
  }

  protected applySort(
    items: MusicianWallet[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "created_at", "desc");
  }

  async findByMusicianId(musicianId: string): Promise<MusicianWallet | null> {
    return (
      this.items.find((item) => item.musician_id.id === musicianId) || null
    );
  }
}
