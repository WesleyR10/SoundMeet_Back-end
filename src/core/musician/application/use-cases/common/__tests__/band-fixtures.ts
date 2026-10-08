import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import {
  Band,
  BandMemberProps,
  BandMemberRole,
  BandMemberStatus,
} from "../../../../domain/band.aggregate";

/** Uma linha de integrante para montar bandas de teste. */
export const bandMember = (
  musician_id: Uuid,
  role: BandMemberRole = "member",
  status: BandMemberStatus = "accepted",
  instrument = "guitar",
): BandMemberProps => ({
  musician_id,
  role,
  instrument,
  status,
  joined_at: new Date(),
  responded_at: status === "pending" ? null : new Date(),
});

/**
 * Banda com um líder aceito — o estado em que toda banda real nasce.
 * `others` são linhas extras (integrantes, convites pendentes ou recusados).
 */
export const bandLedBy = (leader: Uuid, others: BandMemberProps[] = []): Band =>
  Band.fake()
    .aBand()
    .withMembers([bandMember(leader, "leader"), ...others])
    .build();
