import {
  AggregateRoot,
  CNPJ,
  CPF,
  Email,
  InvalidCNPJError,
  InvalidCPFError,
  Phone,
  QRCode,
  QRCustomization,
  QRCustomizationPatch,
  Rating,
  Uuid,
} from "../../shared/domain";
import { Location } from "../../shared/domain/value-objects/location.vo";
import { PriceRange } from "../../shared/domain/value-objects/price-range.vo";
import { buildMusicianQrLink } from "../../shared/domain/value-objects/qr-code-link";
import { MusicianCreatedEvent } from "./events/musician-created.event";
import { MusicianEmailChangedEvent } from "./events/musician-email-changed.event";
import { MusicianVerifiedEvent } from "./events/musician-verified.event";
import { MusicianValidatorFactory } from "./musician.validator";
import { MusicianFakeBuilder } from "./musician-fake.builder";
import { MusicianProfile } from "./musician-profile.aggregate";
import { PresentationAudio } from "./value-objects/presentation-audio.vo";

export type MusicianConstructorProps = {
  musician_id?: MusicianId;
  email: string;
  name: string;
  stage_name?: string | null;
  bio?: string | null;
  avatar?: string | null;
  presentation_audio?: PresentationAudio | null;
  phone?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  genres: string[];
  instruments: string[];
  experience_years?: number;
  qr_code?: string | null;
  qr_customization?: QRCustomization;
  rating?: number;
  total_ratings?: number;
  is_active?: boolean;
  is_verified?: boolean;
  open_to_gigs?: boolean | null;
  accepts_requests_outside_repertoire?: boolean;
  profile?: MusicianProfile | null;
  push_token?: string | null;
  push_token_platform?: string | null;
  created_at?: Date;
  updated_at?: Date;
};

export type MusicianCreateCommand = {
  musician_id?: MusicianId;
  email: string;
  name: string;
  stage_name?: string | null;
  bio?: string | null;
  avatar?: string | null;
  phone?: string | null;
  cpf?: string | null;
  genres: string[];
  instruments: string[];
  experience_years?: number;
  is_active?: boolean;
  open_to_gigs?: boolean | null;
  profile?: MusicianProfile | null;
  /**
   * Base do link gravado no QR. Vem de `APP_URL` no use-case; o default do
   * `buildMusicianQrLink` cobre fakes e testes.
   */
  qr_base_url?: string;
};

export class MusicianId extends Uuid {}

export class Musician extends AggregateRoot {
  musician_id: MusicianId;
  email: Email;
  name: string;
  stage_name: string | null;
  bio: string | null;
  avatar: string | null;
  /**
   * Trecho de até 40s que o estabelecimento ouve antes de contratar.
   *
   * Fora de `MusicianCreateCommand` de propósito, como a capa do
   * estabelecimento: nasce no upload, e `null` é o estado normal de quem
   * acabou de se cadastrar — não uma pendência. Quem guarda a chave do objeto
   * é o próprio VO; ver o porquê em `presentation-audio.vo.ts`.
   */
  presentation_audio: PresentationAudio | null;
  phone: Phone | null;
  cpf: CPF | null;
  /**
   * CNPJ do MEI, quando o músico tem um.
   *
   * Deliberadamente ausente de `MusicianCreateCommand`: o cadastro continua
   * sendo de pessoa física, e o CNPJ entra depois, em configurações do perfil.
   * Quem o tem passa a ser qualificado como pessoa jurídica no contrato — o
   * que muda a cláusula de tributos, porque MEI não é contribuinte individual
   * e não sofre retenção previdenciária do tomador.
   */
  cnpj: CNPJ | null;
  genres: string[];
  instruments: string[];
  experience_years: number;
  qr_code: QRCode | null;
  rating: Rating;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  /**
   * O público pode pedir música FORA deste repertório?
   *
   * Não é preferência de busca: é a regra que `CreateRequestUseCase` aplica.
   * Com `false`, o pedido só passa acompanhado de um `library_id` desta
   * biblioteca — um switch que só filtrasse a busca do cliente prometeria
   * um limite que o campo de texto livre desfaz no primeiro toque.
   */
  accepts_requests_outside_repertoire: boolean;
  open_to_gigs: boolean | null;
  profile: MusicianProfile | null;
  push_token: string | null;
  push_token_platform: string | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: MusicianConstructorProps) {
    super();
    this.musician_id = props.musician_id ?? new MusicianId();
    const [email, errorEmail] = Email.create(props.email).asArray();
    this.email = email;
    errorEmail && this.notification.setError(errorEmail.message, "email");
    this.name = props.name;
    this.stage_name = props.stage_name ?? null;
    this.bio = props.bio ?? null;
    this.avatar = props.avatar ?? null;
    this.presentation_audio = props.presentation_audio ?? null;
    if (!props.phone) {
      this.phone = null;
    } else {
      const [phone, errorPhone] = Phone.create(props.phone).asArray();
      this.phone = phone;
      errorPhone && this.notification.setError(errorPhone.message, "phone");
    }
    if (props.cpf) {
      try {
        this.cpf = new CPF(props.cpf);
      } catch (error) {
        const message =
          error instanceof InvalidCPFError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Invalid cpf";
        this.notification.addError(message, "cpf");
        this.cpf = null;
      }
    } else {
      this.cpf = null;
    }
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
    this.genres = props.genres;
    this.instruments = props.instruments;
    this.experience_years = props.experience_years ?? 0;
    /*
     * `url` é o próprio `code` desde que o QR passou a gravar uma URL https.
     * Antes eram valores diferentes (`soundmeet://` no code, https no url), e
     * derivar o url de um padrão fixo aqui significava que uma linha antiga com
     * `soundmeet://` era relida com um url que não correspondia ao que estava
     * impresso no adesivo.
     */
    this.qr_code = props.qr_code
      ? new QRCode({
          code: props.qr_code,
          url: props.qr_code,
          customization: props.qr_customization,
        })
      : null;
    this.rating = new Rating(props.rating ?? 0);
    this.total_ratings = props.total_ratings ?? 0;
    this.is_active = props.is_active ?? true;
    this.is_verified = props.is_verified ?? false;
    // Nunca default true — consentimento explícito, decisão forçada no onboarding.
    this.open_to_gigs = props.open_to_gigs ?? null;
    /*
     * Aqui o default É true, ao contrário de `open_to_gigs`. Este campo não
     * expõe o músico a ninguém: descreve o comportamento que o produto já tem
     * (o fã pede o que quiser, o músico recusa o que não toca). Nascer `null`
     * obrigaria todo leitor a inventar a resposta.
     */
    this.accepts_requests_outside_repertoire =
      props.accepts_requests_outside_repertoire ?? true;
    this.profile = props.profile ?? null;
    this.push_token = props.push_token ?? null;
    this.push_token_platform = props.push_token_platform ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): MusicianId {
    return this.musician_id;
  }

  static create(props: MusicianCreateCommand): Musician {
    const musician = new Musician(props);
    musician.validate(["name", "email"]);
    musician.generateQRCode(props.qr_base_url);
    musician.applyEvent(
      new MusicianCreatedEvent({
        musician_id: musician.musician_id,
        email: musician.email,
        name: musician.name,
        stage_name: musician.stage_name,
        bio: musician.bio,
        avatar: musician.avatar,
        phone: musician.phone,
        genres: musician.genres,
        instruments: musician.instruments,
        experience_years: musician.experience_years,
        qr_code: musician.qr_code,
        rating: musician.rating,
        total_ratings: musician.total_ratings,
        is_active: musician.is_active,
        is_verified: musician.is_verified,
        created_at: musician.created_at,
      }),
    );
    return musician;
  }

  changeName(name: string): void {
    this.name = name;
    this.validate(["name"]);
  }

  changeStageName(stage_name: string | null): void {
    this.stage_name = stage_name;
  }

  changeBio(bio: string | null): void {
    this.bio = bio;
  }

  changeAvatar(avatar: string | null): void {
    this.avatar = avatar;
  }

  /**
   * Troca o áudio de apresentação e **devolve a chave do objeto anterior**,
   * para o chamador apagá-la do bucket.
   *
   * O retorno não é conveniência: é o que impede o arquivo antigo de ficar
   * órfão e cobrado para sempre — mesmo contrato de `Establishment.changeCover`.
   * A chave nunca é sobrescrita (é sempre um uuid novo) porque o CDN cacheia
   * por caminho: reaproveitar a chave continuaria servindo o áudio velho até
   * alguém invalidar o cache à mão.
   */
  changePresentationAudio(audio: PresentationAudio): string | null {
    const previousKey = this.presentation_audio?.object_key ?? null;
    this.presentation_audio = audio;
    this.updated_at = new Date();
    return previousKey && previousKey !== audio.object_key ? previousKey : null;
  }

  /** Remove o áudio. Devolve a chave a ser apagada do bucket. */
  removePresentationAudio(): string | null {
    const previousKey = this.presentation_audio?.object_key ?? null;
    this.presentation_audio = null;
    this.updated_at = new Date();
    return previousKey;
  }

  // Bookkeeping de device, não evento de negócio — não dispara domain event.
  // Último dispositivo registrado sobrescreve o anterior (sem histórico multi-device).
  registerPushToken(token: string, platform: string): void {
    this.push_token = token;
    this.push_token_platform = platform;
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
      new MusicianEmailChangedEvent({
        musician_id: this.musician_id,
        new_email: emailOrError.ok.value,
        name: this.name,
      }),
    );
  }

  changePhone(phone: string | null): void {
    if (!phone) {
      this.phone = null;
    } else {
      const [newPhone, errorPhone] = Phone.create(phone).asArray();
      this.phone = newPhone;
      errorPhone && this.notification.setError(errorPhone.message, "phone");
    }
  }

  changeCpf(cpf: string | null): void {
    if (!cpf) {
      this.cpf = null;
      return;
    }
    try {
      this.cpf = new CPF(cpf);
    } catch (error) {
      const message =
        error instanceof InvalidCPFError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Invalid cpf";
      this.notification.addError(message, "cpf");
      this.cpf = null;
    }
  }

  /**
   * Passar `null` remove o CNPJ e o músico volta a contratar como pessoa
   * física — é a saída de quem baixou o MEI, e por isso é permitido.
   */
  changeCnpj(cnpj: string | null): void {
    if (!cnpj) {
      this.cnpj = null;
      return;
    }
    try {
      this.cnpj = new CNPJ(cnpj);
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
  }

  updateGenres(genres: string[]): void {
    this.genres = genres;
    this.validate(["genres"]);
  }

  updateInstruments(instruments: string[]): void {
    this.instruments = instruments;
    this.validate(["instruments"]);
  }

  updateExperience(years: number): void {
    if (years < 0) {
      this.notification.addError(
        "Experience years cannot be negative",
        "experience_years",
      );
      return;
    }
    this.experience_years = years;
  }

  updatePriceRanges(priceRanges: PriceRange[]): void {
    this.ensureProfile().changePriceRanges(priceRanges);
    this.updated_at = new Date();
  }

  ensureIsActive(): void {
    if (!this.is_active) {
      this.notification.addError("Musician is not active", "is_active");
    }
  }

  ensureProfile(): MusicianProfile {
    if (!this.profile) {
      this.profile = MusicianProfile.create({
        musician_id: this.musician_id,
        location: new Location({}),
        instruments: this.instruments,
        genres: this.genres,
        experience: this.experience_years,
      });
    }
    return this.profile;
  }

  /**
   * (Re)gera o QR permanente do músico.
   *
   * O conteúdo é uma URL https (ver `qr-code-link.ts`): o esquema
   * `soundmeet://` não fazia nada na câmera de quem não tem o app, que é
   * justamente quem o adesivo de mesa precisa alcançar.
   *
   * `baseUrl` chega do use-case (config `APP_URL`) para que staging imprima QR
   * de staging; o default existe só para não quebrar fakes e testes.
   */
  generateQRCode(baseUrl?: string): void {
    const link = buildMusicianQrLink(this.musician_id.id, baseUrl);
    this.qr_code = new QRCode({ code: link, url: link });
  }

  customizeQRCode(patch: QRCustomizationPatch): void {
    if (!this.qr_code) {
      this.generateQRCode();
    }
    const current = this.qr_code!.customization ?? {};
    const merged: QRCustomization = { ...current };
    // Merge por chave (JSON merge patch) — customizar só a cor não pode apagar
    // um logo/label já salvo anteriormente (valor ausente = mantém). `null`
    // explícito remove a chave, permitindo reverter um campo ao padrão sem
    // afetar os demais (ver QRCustomizationPatch).
    (Object.keys(patch) as (keyof QRCustomizationPatch)[]).forEach((key) => {
      const value = patch[key];
      if (value === null) {
        delete merged[key];
      } else if (value !== undefined) {
        merged[key] = value;
      }
    });
    this.qr_code = new QRCode({
      code: this.qr_code!.code,
      url: this.qr_code!.url,
      expiresAt: this.qr_code!.expiresAt,
      customization: merged,
    });
  }

  addRating(rating: number): void {
    if (rating < 1 || rating > 5) {
      this.notification.addError("Rating must be between 1 and 5", "rating");
      return;
    }

    const totalScore = this.rating.value * this.total_ratings + rating;
    this.total_ratings += 1;
    const newAverage = totalScore / this.total_ratings;
    this.rating = new Rating(Math.round(newAverage * 10) / 10);
  }

  /**
   * Reescreve a projeção a partir do ledger de avaliações (`reviews`,
   * Bloco 9.3), em vez de incrementar.
   *
   * `addRating` acima só sabe somar — o que fica **errado** assim que alguém
   * reavalia (a nota antiga continuaria no acumulado) ou uma avaliação é
   * removida por moderação. Com o ledger como fonte de verdade, a média é
   * recalculada e simplesmente aplicada aqui.
   *
   * Mesmo par que gamificação já usa: `UserScore` (ledger) → `UserPoints`
   * (projeção).
   */
  syncRatingProjection(average: number, total: number): void {
    if (total < 0 || average < 0 || average > 5) {
      this.notification.addError("Invalid rating projection", "rating");
      return;
    }

    this.rating = new Rating(Math.round(average * 10) / 10);
    this.total_ratings = total;
  }

  activate(): void {
    this.is_active = true;
  }

  deactivate(): void {
    this.is_active = false;
  }

  verify(): void {
    this.is_verified = true;
    this.applyEvent(
      new MusicianVerifiedEvent({
        musician_id: this.musician_id,
        verified_at: new Date(),
      }),
    );
  }

  unverify(): void {
    this.is_verified = false;
  }

  setOpenToGigs(value: boolean): void {
    this.open_to_gigs = value;
    this.updated_at = new Date();
  }

  setAcceptsRequestsOutsideRepertoire(value: boolean): void {
    this.accepts_requests_outside_repertoire = value;
    this.updated_at = new Date();
  }

  get displayName(): string {
    return this.stage_name || this.name;
  }

  get isExperienced(): boolean {
    return this.experience_years >= 5;
  }

  get isHighlyRated(): boolean {
    return this.rating.isGood && this.total_ratings >= 10;
  }

  validate(fields?: string[]) {
    const validator = MusicianValidatorFactory.create();
    const sanitizedFields = fields?.length
      ? fields.filter(
          (field) =>
            !(
              (field === "email" && this.notification.errors.has("email")) ||
              (field === "phone" && this.notification.errors.has("phone")) ||
              (field === "cpf" && this.notification.errors.has("cpf")) ||
              (field === "cnpj" && this.notification.errors.has("cnpj"))
            ),
        )
      : fields;
    return validator.validate(this.notification, this, sanitizedFields);
  }

  static fake() {
    return MusicianFakeBuilder;
  }

  toJSON() {
    return {
      musician_id: this.musician_id.id,
      email: this.email.value,
      name: this.name,
      stage_name: this.stage_name,
      bio: this.bio,
      avatar: this.avatar,
      presentation_audio: this.presentation_audio?.toJSON() ?? null,
      phone: this.phone?.value || null,
      cpf: this.cpf?.value || null,
      cnpj: this.cnpj?.value || null,
      genres: this.genres,
      instruments: this.instruments,
      experience_years: this.experience_years,
      qr_code: this.qr_code?.code || null,
      qr_customization: this.qr_code?.customization ?? null,
      rating: this.rating.value,
      total_ratings: this.total_ratings,
      is_active: this.is_active,
      is_verified: this.is_verified,
      open_to_gigs: this.open_to_gigs,
      accepts_requests_outside_repertoire:
        this.accepts_requests_outside_repertoire,
      profile: this.profile?.toJSON() || null,
      created_at: this.created_at,
      updated_at: this.updated_at,
      display_name: this.displayName,
      is_experienced: this.isExperienced,
      is_highly_rated: this.isHighlyRated,
    };
  }
}
