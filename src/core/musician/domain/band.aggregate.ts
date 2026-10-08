import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { Location } from "../../shared/domain/value-objects/location.vo";
import { PriceRange } from "../../shared/domain/value-objects/price-range.vo";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { BandValidatorFactory } from "./band.validator";
import { BandFakeBuilder } from "./band-fake.builder";
import {
  BAND_MEMBER_ROLES,
  BandMemberRole,
  parseBandMemberRole,
} from "./band-member-role";
import {
  BandInviteAcceptedEvent,
  BandInviteDeclinedEvent,
} from "./events/band-invite-responded.event";
import { BandMemberInvitedEvent } from "./events/band-member-invited.event";

export type { BandMemberRole } from "./band-member-role";

export class BandId extends Uuid {}

/**
 * Mesmo músico? Compara o ID, nunca o value object.
 *
 * 🔴 `ValueObject.equals` exige a MESMA CLASSE dos dois lados. O mapper do
 * Prisma monta os integrantes com `Uuid`; os use-cases chegam com `MusicianId`
 * (`new MusicianId(input.musician_id)`). Com `.equals`, `Uuid` nunca era igual
 * a `MusicianId`, e em produção:
 *
 *  - aceitar e recusar convite respondiam 422 "No invite found";
 *  - remover integrante respondia 422 "not a member of this band";
 *  - convidar quem já estava na banda não era barrado aqui e estourava na
 *    constraint única do banco.
 *
 * Os testes passavam porque o repositório em memória devolve a MESMA instância
 * que o teste criou — com `MusicianId` dos dois lados. O defeito só existe
 * depois de uma ida ao banco. Há e2e contra Postgres travando isto
 * (`test/musician/band-membership.e2e-spec.ts`).
 */
const sameMusician = (a: Uuid, b: Uuid): boolean => a.id === b.id;

export type BandMemberStatus = "pending" | "accepted" | "declined";

export type BandMemberProps = {
  member_id?: Uuid; // ID do relacionamento, opcional na criação
  musician_id: Uuid;
  role: BandMemberRole;
  instrument: string;
  status: BandMemberStatus;
  joined_at: Date;
  responded_at: Date | null;
};

export type BandConstructorProps = {
  band_id?: BandId;
  name: string;
  description?: string | null;
  avatar?: string | null;
  genres: string[];
  formed_in?: number | null;
  qr_code?: string | null;
  members?: BandMemberProps[];
  priceRange?: PriceRange | null;
  address?: Location | null;
  open_to_gigs?: boolean | null;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
};

export type BandCreateCommand = {
  name: string;
  description?: string | null;
  avatar?: string | null;
  genres: string[];
  formed_in?: number | null;
  members?: BandMemberProps[];
  priceRange?: PriceRange | null;
  address?: Location | null;
  open_to_gigs?: boolean | null;
  is_active?: boolean;
};

export class Band extends AggregateRoot {
  band_id: BandId;
  name: string;
  description: string | null;
  avatar: string | null;
  genres: string[];
  /**
   * Ano de formação — o "tempo de estrada" da banda.
   *
   * Equivale ao `experience_years` do músico solo, e existe porque a mesma
   * pergunta ("há quanto tempo tocam juntos?") era respondida no perfil do
   * solo e ficava em branco no da banda.
   *
   * 🔴 `null` NUNCA vira um número derivado de `created_at`. Aquilo é
   * "cadastrada na SoundMeet desde", que é outro fato — compor um a partir do
   * outro fabricaria informação de credencial. Ausente é ausente.
   */
  formed_in: number | null;
  qr_code: string | null;
  members: BandMemberProps[];
  priceRange: PriceRange | null;
  address: Location | null;
  open_to_gigs: boolean | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(props: BandConstructorProps) {
    super();
    this.band_id = props.band_id ?? new BandId();
    this.name = props.name;
    this.description = props.description ?? null;
    this.avatar = props.avatar ?? null;
    this.genres = props.genres;
    this.formed_in = props.formed_in ?? null;
    this.qr_code = props.qr_code ?? null;
    this.members = (props.members ?? []).map((member) => ({
      ...member,
      member_id: member.member_id ?? new Uuid(),
      // Papel desconhecido cai para "member": na dúvida, menos privilégio.
      role: parseBandMemberRole(member.role) ?? "member",
      status: member.status ?? "accepted",
      responded_at: member.responded_at ?? null,
    }));
    this.priceRange = props.priceRange ?? null;
    this.address = props.address ?? null;
    // Nunca default true — consentimento explícito do líder.
    this.open_to_gigs = props.open_to_gigs ?? null;
    this.is_active = props.is_active ?? true;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): BandId {
    return this.band_id;
  }

  static create(props: BandCreateCommand): Band {
    const band = new Band({
      ...props,
      members: props.members ?? [],
    });
    band.validate();
    return band;
  }

  validate(fields?: string[]): boolean {
    const validator = BandValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return BandFakeBuilder;
  }

  changeName(name: string): void {
    this.name = name;
    this.validate(["name"]);
    this.updated_at = new Date();
  }

  changeDescription(description: string | null): void {
    this.description = description;
    this.updated_at = new Date();
  }

  changeAvatar(avatar: string | null): void {
    this.avatar = avatar;
    this.updated_at = new Date();
  }

  generateQRCode(code: string): void {
    this.qr_code = code;
    this.updated_at = new Date();
  }

  updateGenres(genres: string[]): void {
    this.genres = genres;
    this.validate(["genres"]);
    this.updated_at = new Date();
  }

  /**
   * Declara (ou apaga) o ano de formação.
   *
   * Aceita `null` porque desinformar é uma operação legítima: quem digitou o
   * ano errado precisa conseguir voltar ao estado "não informado", e não ficar
   * preso a um número falso por não haver caminho de volta.
   */
  changeFormedIn(formed_in: number | null): void {
    this.formed_in = formed_in;
    this.validate(["formed_in"]);
    this.updated_at = new Date();
  }

  activate(): void {
    this.is_active = true;
    this.updated_at = new Date();
  }

  deactivate(): void {
    this.is_active = false;
    this.updated_at = new Date();
  }

  /**
   * Banda dissolvida que tem histórico (shows, contratos, gorjetas).
   *
   * Apagar a linha não é opção: `bookings.bandId` e `inquiries.bandId` são
   * `ON DELETE SET NULL` sob a CHECK "músico OU banda", então o DELETE falha —
   * e onde não falha (`event_musicians`, `contracts`, `performances`) deixa o
   * registro do estabelecimento apontando para ninguém. Arquivada, a banda
   * some da busca e não recebe proposta nem convite, e o nome continua nos
   * shows que ela fez.
   *
   * Convite em aberto e convite recusado saem junto: não há mais banda para
   * entrar. Quem já era integrante continua na lista, que é parte do histórico.
   */
  archive(): void {
    this.is_active = false;
    this.open_to_gigs = false;
    this.members = this.members.filter((m) => m.status === "accepted");
    this.updated_at = new Date();
  }

  /** `is_active` de banda só fica falso pela dissolução — ver `archive()`. */
  get isArchived(): boolean {
    return !this.is_active;
  }

  private pushMember(
    musician_id: Uuid,
    role: BandMemberRole,
    instrument: string,
    status: BandMemberStatus,
    responded_at: Date | null,
  ): void {
    this.members.push({
      member_id: new Uuid(),
      musician_id,
      role,
      instrument,
      status,
      joined_at: new Date(),
      responded_at,
    });
    this.updated_at = new Date();
  }

  /**
   * Traduz o papel vindo de fora (DTO, seed, importação) e registra o erro de
   * validação em vez de deixar a string crua entrar no agregado.
   */
  private resolveRole(role: string): BandMemberRole | null {
    const parsed = parseBandMemberRole(role);
    if (!parsed) {
      this.notification.addError(
        `Role must be one of: ${BAND_MEMBER_ROLES.join(", ")}`,
        "role",
      );
    }
    return parsed;
  }

  /** Uma banda tem no máximo um líder aceito. */
  private hasAcceptedLeader(): boolean {
    return this.leader !== null;
  }

  private rejectSecondLeader(): void {
    this.notification.addError(
      "Band already has a leader — use transferLeadership() to change it",
      "role",
    );
  }

  inviteMember(musician_id: Uuid, role: string, instrument: string): void {
    const parsedRole = this.resolveRole(role);
    if (!parsedRole) return;

    // Convite para líder já é barrado aqui: deixar entrar como pending só
    // adiaria o conflito para o aceite, quando o músico já teria sido avisado
    // de que assumiria a liderança.
    if (parsedRole === "leader" && this.hasAcceptedLeader()) {
      this.rejectSecondLeader();
      return;
    }

    const existing = this.members.find((m) =>
      sameMusician(m.musician_id, musician_id),
    );

    if (existing) {
      if (existing.status !== "declined") {
        this.notification.addError(
          "Musician is already a member or has a pending invite for this band",
          "musician_id",
        );
        return;
      }
      // Convite recusado não é um estado terminal — reativa a mesma linha em
      // vez de inserir uma nova (a constraint única de (bandId, musicianId)
      // no banco não permitiria duas linhas para o mesmo músico de qualquer
      // forma).
      existing.role = parsedRole;
      existing.instrument = instrument;
      existing.status = "pending";
      existing.responded_at = null;
      this.updated_at = new Date();
      this.applyInvitedEvent(musician_id, instrument);
      return;
    }

    this.pushMember(musician_id, parsedRole, instrument, "pending", null);
    this.applyInvitedEvent(musician_id, instrument);
  }

  private applyInvitedEvent(musician_id: Uuid, instrument: string): void {
    this.applyEvent(
      new BandMemberInvitedEvent({
        band_id: this.band_id,
        band_name: this.name,
        musician_id: musician_id.id,
        instrument,
      }),
    );
  }

  private transitionInvite(
    musician_id: Uuid,
    to: Extract<BandMemberStatus, "accepted" | "declined">,
  ): void {
    const member = this.members.find((m) =>
      sameMusician(m.musician_id, musician_id),
    );
    if (!member) {
      this.notification.addError(
        "No invite found for this musician",
        "musician_id",
      );
      return;
    }
    if (member.status !== "pending") {
      this.notification.addError("Invite is not pending", "status");
      return;
    }
    // Segunda barreira: o convite pode ter sido emitido quando a banda não
    // tinha líder e outro assumiu antes do aceite chegar.
    if (
      to === "accepted" &&
      member.role === "leader" &&
      this.hasAcceptedLeader()
    ) {
      this.rejectSecondLeader();
      return;
    }
    member.status = to;
    member.responded_at = new Date();
    this.updated_at = new Date();

    const props = {
      band_id: this.band_id,
      band_name: this.name,
      musician_id: musician_id.id,
      instrument: member.instrument,
      leader_musician_id: this.leader?.musician_id.id ?? null,
    };
    this.applyEvent(
      to === "accepted"
        ? new BandInviteAcceptedEvent(props)
        : new BandInviteDeclinedEvent(props),
    );
  }

  acceptInvite(musician_id: Uuid): void {
    this.transitionInvite(musician_id, "accepted");
  }

  declineInvite(musician_id: Uuid): void {
    this.transitionInvite(musician_id, "declined");
  }

  get acceptedMembers(): BandMemberProps[] {
    return this.members.filter((m) => m.status === "accepted");
  }

  /**
   * O líder da banda, ou null enquanto ninguém assumiu. Convite pendente não
   * lidera: quem foi convidado como "leader" e ainda não aceitou não
   * representa ninguém.
   */
  get leader(): BandMemberProps | null {
    return (
      this.members.find(
        (m) => m.role === "leader" && m.status === "accepted",
      ) ?? null
    );
  }

  /**
   * Quem decide em nome da banda. Compromisso com estabelecimento — aceitar ou
   * recusar convite, confirmar ou cancelar booking — vincula a banda inteira,
   * então é decisão do líder, não de qualquer integrante.
   */
  isLeader(musician_id: Uuid): boolean {
    return !!this.leader && sameMusician(this.leader.musician_id, musician_id);
  }

  /** A linha do músico na banda, em qualquer estado de convite. */
  findMember(musician_id: Uuid): BandMemberProps | null {
    return (
      this.members.find((m) => sameMusician(m.musician_id, musician_id)) ?? null
    );
  }

  /**
   * Integrante de fato: convite ACEITO. É quem enxerga a banda por dentro
   * (endereço completo, convites em aberto); convidado pendente ainda é
   * terceiro para esse fim.
   */
  isAcceptedMember(musician_id: Uuid): boolean {
    return this.findMember(musician_id)?.status === "accepted";
  }

  /**
   * Única forma de trocar quem lidera. Rebaixar e promover em uma operação só
   * evita o estado intermediário sem líder (banda que não consegue aceitar
   * show) e o de dois líderes.
   */
  transferLeadership(from_musician_id: Uuid, to_musician_id: Uuid): void {
    const currentLeader = this.leader;
    if (
      !currentLeader ||
      !sameMusician(currentLeader.musician_id, from_musician_id)
    ) {
      this.notification.addError(
        "Only the current leader can transfer leadership",
        "musician_id",
      );
      return;
    }

    if (sameMusician(from_musician_id, to_musician_id)) {
      this.notification.addError(
        "Musician is already the leader of this band",
        "musician_id",
      );
      return;
    }

    const successor = this.members.find((m) =>
      sameMusician(m.musician_id, to_musician_id),
    );
    if (!successor) {
      this.notification.addError(
        "Musician is not a member of this band",
        "musician_id",
      );
      return;
    }
    // Convite pendente/recusado não assume: a pessoa nem confirmou que faz
    // parte da banda, quanto mais que aceita responder por ela.
    if (successor.status !== "accepted") {
      this.notification.addError(
        "Only an accepted member can become the leader",
        "status",
      );
      return;
    }

    currentLeader.role = "member";
    successor.role = "leader";
    this.updated_at = new Date();
  }

  removeMember(musician_id: Uuid): void {
    const target = this.members.find((m) =>
      sameMusician(m.musician_id, musician_id),
    );

    if (!target) {
      this.notification.addError(
        "Musician is not a member of this band",
        "musician_id",
      );
      return;
    }

    // Tirar o líder deixaria a banda sem quem aceite show ou confirme booking,
    // e sem caminho de volta pela API. Sair é permitido quando ele é o último
    // que restou — aí a banda está vazia e o caso é deletá-la.
    const isSoleRemainingMember = this.members.length === 1;
    if (this.isLeader(musician_id) && !isSoleRemainingMember) {
      this.notification.addError(
        "Transfer leadership before removing the leader from the band",
        "musician_id",
      );
      return;
    }

    this.members = this.members.filter(
      (m) => !sameMusician(m.musician_id, musician_id),
    );
    this.updated_at = new Date();
  }

  changePriceRange(price: PriceRange | null): void {
    this.priceRange = price;
    this.updated_at = new Date();
  }

  changeAddress(address: Location | null): void {
    this.address = address;
    this.updated_at = new Date();
  }

  setOpenToGigs(value: boolean): void {
    this.open_to_gigs = value;
    this.updated_at = new Date();
  }

  toJSON() {
    return {
      band_id: this.band_id.id,
      name: this.name,
      description: this.description,
      avatar: this.avatar,
      genres: this.genres,
      qr_code: this.qr_code,
      members: this.members.map((m) => ({
        member_id: m.member_id?.id,
        musician_id: m.musician_id.id,
        role: m.role,
        instrument: m.instrument,
        status: m.status,
        joined_at: m.joined_at,
        responded_at: m.responded_at,
      })),
      priceRange: this.priceRange
        ? {
            model: this.priceRange.model,
            min: this.priceRange.min,
            max: this.priceRange.max,
            currency: this.priceRange.currency,
            notes: this.priceRange.notes,
          }
        : null,
      address: this.address?.toJSON() ?? null,
      open_to_gigs: this.open_to_gigs,
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
