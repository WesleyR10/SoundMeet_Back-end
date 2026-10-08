import { Transform } from "class-transformer";

import {
  BandMemberOutput,
  BandOutput,
} from "../../core/musician/application/use-cases/common/band-output";
import { DissolveBandOutput } from "../../core/musician/application/use-cases/dissolve-band/dissolve-band.use-case";
import { BandIdentityOutput } from "../../core/musician/application/use-cases/list-band-identities/list-band-identities.use-case";
import { ListBandsOutput } from "../../core/musician/application/use-cases/list-bands/list-bands.use-case";
import { MyBandOutput } from "../../core/musician/application/use-cases/list-my-bands/list-my-bands.use-case";
import { CollectionPresenter } from "../shared-module/collection.presenter";

/**
 * A banda vista POR DENTRO: integrante aceito ou admin.
 *
 * Traz o endereço completo (o líder edita) e todos os convites, inclusive os
 * pendentes e os recusados (o líder cancela e reconvida).
 */
export class BandPresenter {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  genres: string[];
  /** Ano de formação; `null` quando a banda não declarou. */
  formed_in: number | null;
  members: BandOutput["members"];
  priceRange: BandOutput["priceRange"];
  address: BandOutput["address"];
  open_to_gigs: boolean | null;
  is_active: boolean;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: BandOutput) {
    this.id = output.id;
    this.name = output.name;
    this.description = output.description;
    this.avatar = output.avatar;
    this.genres = output.genres;
    this.formed_in = output.formed_in;
    this.members = output.members;
    this.priceRange = output.priceRange;
    this.address = output.address;
    this.open_to_gigs = output.open_to_gigs;
    this.is_active = output.is_active;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

/** Um integrante, como terceiros o veem. */
export class PublicBandMemberPresenter {
  member_id: string;
  musician_id: string;
  role: string;
  instrument: string;
  status: BandMemberOutput["status"];
  @Transform(({ value }: { value: Date }) => value.toISOString())
  joined_at: Date;

  constructor(member: BandMemberOutput) {
    this.member_id = member.member_id;
    this.musician_id = member.musician_id;
    this.role = member.role;
    this.instrument = member.instrument;
    this.status = member.status;
    this.joined_at = member.joined_at;
  }
}

/** Onde a banda fica, para terceiros: cidade e estado, nada mais. */
export type PublicBandAddress = {
  city: string | null;
  state: string | null;
};

/**
 * A banda vista DE FORA: busca, perfil público, qualquer um que não seja
 * integrante aceito.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ALLOWLIST, CAMPO A CAMPO — E NÃO UMA CÓPIA DO OUTPUT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Até out/2026 só existia o `BandPresenter`, e ele saía em `GET /bands` e
 * `GET /bands/:id`, as duas anônimas. Verificado por HTTP, sem token:
 *
 * - **Endereço inteiro** — rua, número, CEP e latitude/longitude exatas. O
 *   app preenche por CEP; é, na maioria dos casos, a casa de alguém. O painel
 *   do estabelecimento só lê cidade e estado.
 * - **Convites pendentes e recusados**, com o id do músico e a data da
 *   resposta: qualquer um via que o Carlos recusou entrar na Blues Duo. O web
 *   filtrava `accepted` no cliente — depois de o dado já ter saído.
 *
 * Aqui cada campo é copiado por nome. Campo novo no `BandOutput` NÃO sai por
 * herança: só entra se for escrito neste construtor. `band.presenter.spec.ts`
 * trava a lista de chaves.
 *
 * ⚠️ `priceRange` e `address` mantêm o nome (camelCase e singular, fora do
 * padrão do resto da API): o adapter do web lê exatamente essas chaves.
 */
export class PublicBandPresenter {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  genres: string[];
  formed_in: number | null;
  /** Só integrantes ACEITOS — convite em aberto não é da conta de terceiros. */
  members: PublicBandMemberPresenter[];
  priceRange: BandOutput["priceRange"];
  address: PublicBandAddress | null;
  open_to_gigs: boolean | null;
  is_active: boolean;

  constructor(output: BandOutput) {
    this.id = output.id;
    this.name = output.name;
    this.description = output.description;
    this.avatar = output.avatar;
    this.genres = output.genres;
    this.formed_in = output.formed_in;
    this.members = output.members
      .filter((member) => member.status === "accepted")
      .map((member) => new PublicBandMemberPresenter(member));
    this.priceRange = output.priceRange;
    this.address = output.address
      ? { city: output.address.city, state: output.address.state }
      : null;
    this.open_to_gigs = output.open_to_gigs;
    this.is_active = output.is_active;
  }
}

/**
 * Um item de "Minhas bandas".
 *
 * Banda que integro sai na visão de integrante. Convite PENDENTE sai na visão
 * pública mais a MINHA linha — preciso ver para o que fui convidado, mas ainda
 * não sou da banda: o endereço completo e os outros convites em aberto
 * continuam fora.
 */
export function presentMyBand(
  item: MyBandOutput,
  musician_id: string,
): BandPresenter | PublicBandPresenter {
  if (item.membership_status === "accepted") {
    return new BandPresenter(item.band);
  }

  const presenter = new PublicBandPresenter(item.band);
  const mine = item.band.members.find(
    (member) => member.musician_id === musician_id,
  );
  if (mine) {
    presenter.members = [
      ...presenter.members,
      new PublicBandMemberPresenter(mine),
    ];
  }
  return presenter;
}

/** Nome, foto e o que toca — a resposta de `GET /bands/identities`. */
export class BandIdentityPresenter {
  id: string;
  display_name: string;
  avatar: string | null;
  genres: string[];
  instruments: string[];

  constructor(output: BandIdentityOutput) {
    this.id = output.id;
    this.display_name = output.display_name;
    this.avatar = output.avatar;
    this.genres = output.genres;
    this.instruments = output.instruments;
  }
}

/** O que aconteceu com a banda em `DELETE /bands/:id`. */
export class DissolveBandPresenter {
  outcome: DissolveBandOutput["outcome"];

  constructor(output: DissolveBandOutput) {
    this.outcome = output.outcome;
  }
}

export class BandCollectionPresenter extends CollectionPresenter {
  data: PublicBandPresenter[];

  constructor(output: ListBandsOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new PublicBandPresenter(i));
  }
}
