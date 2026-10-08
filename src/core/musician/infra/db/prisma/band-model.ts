import { JsonValue } from "./musician-model";

export type CurrencyDb = "BRL" | "USD" | "EUR";

export type BandMemberStatusDb = "pending" | "accepted" | "declined";

export type BandMemberRoleDb = "leader" | "member";

export type BandMemberModel = {
  id: string;
  musicianId: string;
  role: BandMemberRoleDb;
  instrument: string;
  status: BandMemberStatusDb;
  joinedAt: Date;
  responded_at: Date | null;
};

export type BandModel = {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  genres: string[];
  formed_in: number | null;
  qr_code: string | null;
  price_model: string | null;
  // ⚠️ `Decimal(12,2)` no banco: na LEITURA o Prisma entrega um objeto
  // `Decimal`, não um número — o tipo abaixo vale para a escrita. Quem lê
  // converte com `Number(...)` (ver `BandModelMapper.toEntity`).
  price_min: number | null;
  price_max: number | null;
  price_currency: CurrencyDb | null;
  price_notes: string | null;
  open_to_gigs: boolean | null;
  address: JsonValue | null;
  location_lat: number | null;
  location_lng: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  members?: BandMemberModel[];
};
