import {
  Address,
  AggregateRoot,
  CNPJ,
  CPF,
  Email,
  InvalidCNPJError,
  InvalidCPFError,
  Phone,
  QRCode,
  Rating,
  Uuid,
} from "../../shared/domain";
import { resolveVenueTimezone } from "../../shared/domain/brazil-timezone";
import { buildEstablishmentQrLink } from "../../shared/domain/value-objects/qr-code-link";
import { EstablishmentValidatorFactory } from "./establishment.validator";
import { EstablishmentFakeBuilder } from "./establishment-fake.builder";
import { EstablishmentProfile } from "./establishment-profile.aggregate";
import { EstablishmentCreatedEvent } from "./events/establishment-created.event";
import { EstablishmentEmailChangedEvent } from "./events/establishment-email-changed.event";
import { EstablishmentRatedEvent } from "./events/establishment-rated.event";
import { EstablishmentVerifiedEvent } from "./events/establishment-verified.event";

export type EstablishmentConstructorProps = {
  establishment_id?: EstablishmentId;
  name: string;
  description?: string | null;
  avatar?: string | null;
  avatar_key?: string | null;
  cover?: string | null;
  cover_key?: string | null;
  cnpj?: string | null;
  legal_representative_name?: string | null;
  legal_representative_document?: string | null;
  email: Email;
  phone?: Phone | null;
  website?: string | null;
  establishment_type: string;
  rating?: Rating;
  total_ratings?: number;
  qr_code?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
  profile?: EstablishmentProfile | null;
  created_at?: Date;
  updated_at?: Date;
};

export type EstablishmentCreateCommand = {
  name: string;
  description?: string | null;
  avatar?: string | null;
  cnpj?: string | null;
  email: string;
  phone?: string | null;
  website?: string | null;
  establishment_type: string;
  is_active?: boolean;
  profile?: EstablishmentProfile | null;
};

export class EstablishmentId extends Uuid {}

export class Establishment extends AggregateRoot {
  establishment_id: EstablishmentId;
  name: string;
  description: string | null;
  /**
   * Foto de perfil (logo) — URL pública e a chave do objeto que a produziu.
   *
   * Mesmo par da capa, e pelo mesmo motivo: sem a chave, trocar a foto deixa o
   * objeto anterior no bucket sem nada apontando para ele. `avatar_key` é
   * `null` também quando `avatar` veio de fora (as linhas gravadas pelo PATCH
   * antigo, que aceitava URL em texto livre) — ali não há objeto nosso a apagar.
   */
  avatar: string | null;
  avatar_key: string | null;
  /**
   * Capa do espaço — URL pública, e a chave do objeto que a produziu.
   *
   * ⚠️ **`cover_key` não é redundância da URL.** Sem a chave, trocar a capa
   * deixaria o arquivo anterior no bucket sem nada apontando para ele: pago
   * todo mês, invisível para sempre. O `avatar` tinha exatamente esse defeito
   * até 18/set/2026; `menu_pdfs`, que guarda `{ url, key }`, não tem. Seguimos o segundo.
   *
   * Fora de `EstablishmentCreateCommand` de propósito: a capa nasce no upload,
   * e até lá o cliente renderiza a capa gerada pela marca. `null` aqui é o
   * estado normal de quem acabou de se cadastrar, não uma pendência.
   */
  cover: string | null;
  cover_key: string | null;
  cnpj: CNPJ | null;
  /**
   * Quem assina pela pessoa jurídica — nome e CPF.
   *
   * Existe porque PJ não age sozinha: a qualificação de um contrato diz
   * "Bar do Zé Ltda., CNPJ nº …, neste ato representada por João da Silva,
   * CPF nº …". Sem estes dois campos o contrato remetia ao Anexo II, o que é
   * honesto mas mais fraco.
   *
   * Fora de `EstablishmentCreateCommand` de propósito: o cadastro já entregue
   * não pede esses dados, e travá-lo agora quebraria o fluxo do web. São
   * preenchidos em configurações do perfil, e a emissão do contrato lista a
   * ausência como pendência acionável.
   */
  legal_representative_name: string | null;
  legal_representative_document: CPF | null;
  email: Email;
  phone: Phone | null;
  website: string | null;
  establishment_type: string;
  rating: Rating;
  total_ratings: number;
  qr_code: QRCode | null;
  is_active: boolean;
  is_verified: boolean;
  profile: EstablishmentProfile | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: EstablishmentConstructorProps) {
    super();
    this.establishment_id = props.establishment_id ?? new EstablishmentId();
    this.name = props.name;
    this.description = props.description ?? null;
    this.avatar = props.avatar ?? null;
    this.avatar_key = props.avatar_key ?? null;
    this.cover = props.cover ?? null;
    this.cover_key = props.cover_key ?? null;
    if (props.cnpj) {
      try {
        this.cnpj = new CNPJ(props.cnpj);
      } catch (error) {
        const message =
          error instanceof InvalidCNPJError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Invalid cnpj";
        this.notification.addError(message, "cnpj");
        this.cnpj = null;
      }
    } else {
      this.cnpj = null;
    }
    this.legal_representative_name =
      props.legal_representative_name?.trim() || null;
    if (props.legal_representative_document) {
      try {
        this.legal_representative_document = new CPF(
          props.legal_representative_document,
        );
      } catch (error) {
        const message =
          error instanceof InvalidCPFError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Invalid legal representative document";
        this.notification.addError(message, "legal_representative_document");
        this.legal_representative_document = null;
      }
    } else {
      this.legal_representative_document = null;
    }
    this.email = props.email;
    this.phone = props.phone ?? null;
    this.website = props.website ?? null;
    this.establishment_type = props.establishment_type;
    this.rating = props.rating ?? new Rating(0);
    this.total_ratings = props.total_ratings ?? 0;
    // `url` é o próprio `code` — ver a nota equivalente em `Musician`.
    this.qr_code = props.qr_code
      ? new QRCode({ code: props.qr_code, url: props.qr_code })
      : null;
    this.is_active = props.is_active ?? true;
    this.is_verified = props.is_verified ?? false;
    this.profile = props.profile ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  static create(command: EstablishmentCreateCommand): Establishment {
    const emailOrError = Email.create(command.email);
    const phoneOrError = command.phone ? Phone.create(command.phone) : null;
    const establishment = new Establishment({
      name: command.name,
      description: command.description,
      avatar: command.avatar,
      cnpj: command.cnpj,
      email: emailOrError.ok,
      phone: !phoneOrError
        ? null
        : phoneOrError.isFail()
          ? null
          : phoneOrError.ok,
      website: command.website,
      establishment_type: command.establishment_type,
      is_active: command.is_active,
      profile: command.profile ?? null,
    });
    if (emailOrError.isFail()) {
      establishment.notification.setError(emailOrError.error.message, "email");
    }
    if (phoneOrError?.isFail()) {
      establishment.notification.setError(phoneOrError.error.message, "phone");
    }
    establishment.validate(["name", "email", "establishment_type"]);
    establishment.generateQRCode();
    establishment.applyEvent(
      new EstablishmentCreatedEvent({
        establishment_id: establishment.establishment_id,
        name: establishment.name,
        email: establishment.email,
        cnpj: establishment.cnpj,
        phone: establishment.phone,
        description: establishment.description,
        avatar: establishment.avatar,
        qr_code: establishment.qr_code,
        rating: establishment.rating,
        total_ratings: establishment.total_ratings,
        is_active: establishment.is_active,
        is_verified: establishment.is_verified,
        created_at: establishment.created_at,
      }),
    );
    return establishment;
  }

  ensureProfile(location: Address): EstablishmentProfile {
    if (!this.profile) {
      this.profile = EstablishmentProfile.create({
        establishment_id: this.establishment_id,
        location,
      });
    }
    return this.profile;
  }

  removeProfile(): void {
    this.profile = null;
  }

  /**
   * Fuso IANA da casa — pelo endereço, depois o declarado no horário de
   * funcionamento, nunca `UTC` (ver `resolveVenueTimezone`). É o fuso de todo
   * horário de show mostrado ou impresso, e do "hoje" das regras do evento.
   */
  venueTimezone(): string {
    return resolveVenueTimezone({
      state: this.profile?.location?.state,
      city: this.profile?.location?.city,
      declared_timezone: this.profile?.operatingHours?.timezone,
    });
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

  /**
   * Troca a foto de perfil e devolve a chave da foto ANTERIOR, para quem chamou
   * apagar — mesmo contrato de `changeCover`, e pela mesma razão: é aqui que a
   * chave antiga deixa de ser alcançável.
   *
   * 🔴 Substituiu o `changeAvatar(url)` do PATCH, que gravava texto livre sem
   * chave. Duas portas para o mesmo campo — uma com chave, outra sem — fariam
   * a segunda apagar o vínculo com o objeto que a primeira subiu, e o arquivo
   * viraria lixo pago no bucket sem erro nenhum.
   */
  changeAvatar(avatar: string, avatarKey: string): string | null {
    const previousKey = this.avatar_key;
    this.avatar = avatar;
    this.avatar_key = avatarKey;
    this.updated_at = new Date();
    return previousKey && previousKey !== avatarKey ? previousKey : null;
  }

  /**
   * Volta para o ícone padrão. Devolve a chave a ser apagada — `null` quando a
   * URL antiga não era objeto nosso (ver `avatar_key`).
   */
  removeAvatar(): string | null {
    const previousKey = this.avatar_key;
    this.avatar = null;
    this.avatar_key = null;
    this.updated_at = new Date();
    return previousKey;
  }

  /**
   * Troca a capa e devolve a chave da capa ANTERIOR, para quem chamou apagar.
   *
   * 🔴 **O agregado não apaga objeto de storage — ele não conhece storage.**
   * Mas é aqui que a chave antiga deixa de ser alcançável, e devolvê-la é o
   * que impede o caso-padrão de virar lixo no bucket: sem este retorno o
   * use-case teria de ler a chave antes de chamar o método, e "antes" é
   * exatamente o passo que alguém esquece numa segunda chamada.
   *
   * Devolve `null` quando não havia capa, ou quando a chave nova é a mesma —
   * apagar a chave recém-gravada deixaria o registro apontando para um objeto
   * que não existe mais.
   */
  changeCover(cover: string, coverKey: string): string | null {
    const previousKey = this.cover_key;
    this.cover = cover;
    this.cover_key = coverKey;
    this.updated_at = new Date();
    return previousKey && previousKey !== coverKey ? previousKey : null;
  }

  /** Volta para a capa gerada pela marca. Devolve a chave a ser apagada. */
  removeCover(): string | null {
    const previousKey = this.cover_key;
    this.cover = null;
    this.cover_key = null;
    this.updated_at = new Date();
    return previousKey;
  }

  changeCnpj(cnpj: string): void {
    try {
      this.cnpj = new CNPJ(cnpj);
      this.validate(["cnpj"]);
      this.updated_at = new Date();
    } catch (error) {
      const message =
        error instanceof InvalidCNPJError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Invalid cnpj";
      this.notification.addError(message, "cnpj");
      return;
    }
  }

  /**
   * Define quem assina pela pessoa jurídica.
   *
   * Invariante: CPF sem nome é recusado — o documento imprime o nome, e um CPF
   * solto não qualifica ninguém. O contrário é aceito: nome sem CPF ainda
   * produz uma qualificação melhor que a remissão ao Anexo II, e a plataforma
   * não deve exigir o CPF de quem não quer dá-lo.
   *
   * Passar os dois como `null` limpa o representante — o contrato volta a
   * remeter ao Anexo II.
   */
  changeLegalRepresentative(
    name: string | null,
    document: string | null,
  ): void {
    const cleanName = name?.trim() || null;

    if (!cleanName && document) {
      this.notification.addError(
        "Legal representative name is required when a document is informed",
        "legal_representative_name",
      );
      return;
    }

    if (!document) {
      this.legal_representative_name = cleanName;
      this.legal_representative_document = null;
      this.updated_at = new Date();
      return;
    }

    try {
      this.legal_representative_document = new CPF(document);
      this.legal_representative_name = cleanName;
      this.updated_at = new Date();
    } catch (error) {
      const message =
        error instanceof InvalidCPFError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Invalid legal representative document";
      this.notification.addError(message, "legal_representative_document");
    }
  }

  /**
   * PEDE a troca de e-mail — o e-mail atual continua valendo até o dono do
   * endereço novo clicar no link (`VerifyEmailService`), que só então troca o
   * banco E o login no Keycloak.
   *
   * 🔴 Até out/2026 este método (então `changeEmail`) gravava o endereço novo
   * na hora: o perfil passava a exibir um e-mail que ninguém provou ter, o
   * `email_verified_at` do endereço ANTIGO continuava liberando o saque, e o
   * login seguia no antigo — banco e Keycloak divergindo para sempre.
   */
  requestEmailChange(email: string): void {
    const emailOrError = Email.create(email);
    if (emailOrError.isFail()) {
      this.notification.setError(emailOrError.error.message, "email");
      return;
    }
    this.applyEvent(
      new EstablishmentEmailChangedEvent({
        establishment_id: this.establishment_id,
        new_email: emailOrError.ok.value,
        name: this.name,
      }),
    );
  }

  changePhone(phone: string | null): void {
    if (!phone) {
      this.phone = null;
      this.validate(["phone"]);
      this.updated_at = new Date();
      return;
    }
    const phoneOrError = Phone.create(phone);
    if (phoneOrError.isFail()) {
      this.notification.addError(phoneOrError.error.message, "phone");
      return;
    }
    this.phone = phoneOrError.ok;
    this.validate(["phone"]);
    this.updated_at = new Date();
  }

  changeWebsite(website: string | null): void {
    this.website = website;
    this.updated_at = new Date();
  }

  changeEstablishmentType(establishment_type: string): void {
    this.establishment_type = establishment_type;
    this.validate(["establishment_type"]);
    this.updated_at = new Date();
  }

  /**
   * (Re)gera o QR permanente da casa. Mesma decisão do músico: URL https em vez
   * do esquema `soundmeet://`, para funcionar na câmera de quem não tem o app.
   * Ver `qr-code-link.ts`.
   */
  generateQRCode(baseUrl?: string): void {
    const link = buildEstablishmentQrLink(this.establishment_id.id, baseUrl);
    this.qr_code = new QRCode({ code: link, url: link });
    this.updated_at = new Date();
  }

  addRating(ratingValue: number, ratedBy: Uuid, comment?: string | null): void {
    const rating = new Rating(ratingValue);

    // Atualiza a média de ratings usando o método estático average para arredondamento correto
    const totalScore = this.rating.value * this.total_ratings;
    this.total_ratings += 1;
    const newAverage = (totalScore + ratingValue) / this.total_ratings;
    this.rating = new Rating(Math.round(newAverage * 10) / 10); // Arredonda para 1 casa decimal
    this.updated_at = new Date();

    this.applyEvent(
      new EstablishmentRatedEvent(
        this.establishment_id,
        new Rating(ratingValue),
        comment ?? null,
        ratedBy,
      ),
    );
  }

  /**
   * Reescreve a projeção a partir do ledger de avaliações (`reviews`,
   * Bloco 9.3), em vez de incrementar — ver `Musician.syncRatingProjection`
   * para o motivo completo. `addRating` acima segue existindo para o fluxo
   * legado por evento de domínio.
   */
  syncRatingProjection(average: number, total: number): void {
    if (total < 0 || average < 0 || average > 5) {
      this.notification.addError("Invalid rating projection", "rating");
      return;
    }

    this.rating = new Rating(Math.round(average * 10) / 10);
    this.total_ratings = total;
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

  verify(): void {
    this.is_verified = true;
    this.updated_at = new Date();
    this.applyEvent(
      new EstablishmentVerifiedEvent({
        establishment_id: this.establishment_id,
        verified_at: new Date(),
      }),
    );
  }

  unverify(): void {
    this.is_verified = false;
    this.updated_at = new Date();
  }

  get isHighlyRated(): boolean {
    return this.rating.isGood && this.total_ratings >= 10;
  }

  get isPopular(): boolean {
    return this.total_ratings >= 50;
  }

  get isBar(): boolean {
    return this.establishment_type === "bar";
  }

  get isRestaurant(): boolean {
    return this.establishment_type === "restaurant";
  }

  get isClub(): boolean {
    return this.establishment_type === "club";
  }

  validate(fields?: string[]): boolean {
    const validator = EstablishmentValidatorFactory.create();
    const sanitizedFields = fields?.length
      ? fields.filter(
          (field) =>
            !(
              (field === "email" && this.notification.errors.has("email")) ||
              (field === "phone" && this.notification.errors.has("phone"))
            ),
        )
      : fields;
    return validator.validate(this.notification, this, sanitizedFields);
  }

  static fake() {
    return EstablishmentFakeBuilder;
  }

  get entity_id(): EstablishmentId {
    return this.establishment_id;
  }

  toJSON() {
    return {
      establishment_id: this.establishment_id.id,
      name: this.name,
      description: this.description,
      avatar: this.avatar,
      avatar_key: this.avatar_key,
      cover: this.cover,
      cover_key: this.cover_key,
      cnpj: this.cnpj?.toJSON() || null,
      legal_representative_name: this.legal_representative_name,
      legal_representative_document:
        this.legal_representative_document?.value || null,
      email: this.email.value,
      phone: this.phone ? this.phone.value : null,
      website: this.website,
      establishment_type: this.establishment_type,
      rating: this.rating.value,
      total_ratings: this.total_ratings,
      qr_code: this.qr_code?.code || null,
      is_active: this.is_active,
      is_verified: this.is_verified,
      profile: this.profile ? this.profile.toJSON() : null,
      created_at: this.created_at,
      updated_at: this.updated_at,
      is_highly_rated: this.isHighlyRated,
      is_popular: this.isPopular,
      is_bar: this.isBar,
      is_restaurant: this.isRestaurant,
      is_club: this.isClub,
    };
  }
}
