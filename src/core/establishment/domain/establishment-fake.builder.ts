import { Chance } from "chance";

import { CNPJ } from "../../shared/domain/value-objects/cnpj.vo";
import { Email } from "../../shared/domain/value-objects/email.vo";
import { Phone } from "../../shared/domain/value-objects/phone.vo";
import { Rating } from "../../shared/domain/value-objects/rating.vo";
import { Establishment, EstablishmentId } from "./establishment.aggregate";
import { EstablishmentProfile } from "./establishment-profile.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class EstablishmentFakeBuilder<TBuild = any> {
  private _establishment_id: PropOrFactory<EstablishmentId> | undefined =
    undefined;
  private _name: PropOrFactory<string> = (_index) => this.chance.company();
  private _description: PropOrFactory<string | null> = (_index) => null;
  private _avatar: PropOrFactory<string | null> = (_index) => null;
  private _cnpj: PropOrFactory<string | null> = (_index) =>
    this.generateValidCNPJ();
  private _email: PropOrFactory<string> = (_index) => this.chance.email();
  private _phone: PropOrFactory<string | null> = (_index) => null;
  private _website: PropOrFactory<string | null> = (_index) =>
    this.chance.url();
  private _establishment_type: PropOrFactory<string> = (_index) =>
    this.chance.pickone([
      "bar",
      "restaurant",
      "club",
      "pub",
      "cafe",
      "hotel",
      "theater",
      "other",
    ]);
  private _rating: PropOrFactory<number> = (_index) => 0;
  private _total_ratings: PropOrFactory<number> = (_index) => 0;
  private _is_active: PropOrFactory<boolean> = (_index) => true;
  private _is_verified: PropOrFactory<boolean> = (_index) => false;
  private _with_profile: PropOrFactory<boolean> = (_index) => false;
  private _profile: PropOrFactory<EstablishmentProfile | null> | undefined =
    undefined;
  private _created_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;
  private chance: Chance.Chance;

  static anEstablishment() {
    return new EstablishmentFakeBuilder<Establishment>();
  }

  static theEstablishments(countObjs: number) {
    return new EstablishmentFakeBuilder<Establishment[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withEstablishmentId(valueOrFactory: PropOrFactory<EstablishmentId>): this {
    this._establishment_id = valueOrFactory;
    return this;
  }

  withName(valueOrFactory: PropOrFactory<string>): this {
    this._name = valueOrFactory;
    return this;
  }

  withDescription(valueOrFactory: PropOrFactory<string | null>): this {
    this._description = valueOrFactory;
    return this;
  }

  withAvatar(valueOrFactory: PropOrFactory<string | null>): this {
    this._avatar = valueOrFactory;
    return this;
  }

  withCnpj(valueOrFactory: PropOrFactory<string | null>): this {
    this._cnpj = valueOrFactory;
    return this;
  }

  withEmail(valueOrFactory: PropOrFactory<string>) {
    this._email = valueOrFactory;
    return this;
  }

  withPhone(valueOrFactory: PropOrFactory<string | null>) {
    this._phone = valueOrFactory;
    return this;
  }

  withWebsite(valueOrFactory: PropOrFactory<string | null>): this {
    this._website = valueOrFactory;
    return this;
  }

  withEstablishmentType(valueOrFactory: PropOrFactory<string>): this {
    this._establishment_type = valueOrFactory;
    return this;
  }

  withRating(valueOrFactory: PropOrFactory<number>) {
    this._rating = valueOrFactory;
    return this;
  }

  withTotalRatings(valueOrFactory: PropOrFactory<number>): this {
    this._total_ratings = valueOrFactory;
    return this;
  }

  activate(): this {
    this._is_active = true;
    return this;
  }

  deactivate(): this {
    this._is_active = false;
    return this;
  }

  verify(): this {
    this._is_verified = true;
    return this;
  }

  unverify(): this {
    this._is_verified = false;
    return this;
  }

  withIsVerified(valueOrFactory: PropOrFactory<boolean>): this {
    this._is_verified = valueOrFactory;
    return this;
  }

  withcreated_at(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  withInvalidNameEmpty(value?: any): this {
    this._name = value;
    return this;
  }

  withInvalidNameTooLong(value?: string) {
    this._name = value ?? this.chance.word({ length: 256 });
    return this;
  }

  withInvalidEmailEmpty(value?: any): this {
    this._email = value;
    return this;
  }

  withInvalidEmailNotAnEmail(value?: string): this {
    this._email = value ?? "invalid-email";
    return this;
  }

  withInvalidCnpjEmpty(value?: any): this {
    this._cnpj = value;
    return this;
  }

  withIsActive(valueOrFactory: PropOrFactory<boolean>): this {
    this._is_active = valueOrFactory;
    return this;
  }

  withProfile(valueOrFactory?: PropOrFactory<EstablishmentProfile | null>) {
    this._with_profile = true;
    if (valueOrFactory !== undefined) {
      this._profile = valueOrFactory;
    }
    return this;
  }

  build(): TBuild {
    const establishments = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const emailValue = this.callFactory(this._email, index);
        const phoneValue = this.callFactory(this._phone, index);
        const ratingValue = this.callFactory(this._rating, index);

        const establishmentId = !this._establishment_id
          ? new EstablishmentId()
          : this.callFactory(this._establishment_id, index);

        const withProfile = this.callFactory(this._with_profile, index);
        const profile = withProfile
          ? this._profile
            ? this.callFactory(this._profile, index)
            : EstablishmentProfile.fake()
                .aProfile()
                .withEstablishmentId(establishmentId)
                .build()
          : null;

        if (profile && !profile.establishment_id.equals(establishmentId)) {
          profile.establishment_id = establishmentId;
          profile.validate(["establishment_id"]);
        }

        const establishment = new Establishment({
          establishment_id: establishmentId,
          name: this.callFactory(this._name, index),
          description: this.callFactory(this._description, index),
          avatar: this.callFactory(this._avatar, index),
          cnpj: this.callFactory(this._cnpj, index),
          email: new Email(emailValue),
          phone: phoneValue ? new Phone(phoneValue) : null,
          website: this.callFactory(this._website, index),
          establishment_type: this.callFactory(this._establishment_type, index),
          rating: new Rating(ratingValue),
          total_ratings: this.callFactory(this._total_ratings, index),
          is_active: this.callFactory(this._is_active, index),
          is_verified: this.callFactory(this._is_verified, index),
          profile,
          ...(this._created_at && {
            created_at: this.callFactory(this._created_at, index),
            updated_at: this.callFactory(this._created_at, index),
          }),
        });
        establishment.validate();
        establishment.generateQRCode();
        return establishment;
      });
    return this.countObjs === 1
      ? (establishments[0] as any)
      : (establishments as TBuild);
  }

  get establishment_id(): EstablishmentId {
    return this.getValue("establishment_id");
  }

  get name(): string {
    return this.getValue("name");
  }

  get description(): string | null {
    return this.getValue("description");
  }

  get avatar(): string | null {
    return this.getValue("avatar");
  }

  get cnpj(): string | null {
    return this.getValue("cnpj");
  }

  get email() {
    return this.getValue("email");
  }

  get phone() {
    return this.getValue("phone");
  }

  get website() {
    return this.getValue("website");
  }

  get establishment_type() {
    return this.getValue("establishment_type");
  }

  get rating() {
    return this.getValue("rating");
  }

  get total_ratings(): number {
    return this.getValue("total_ratings");
  }

  get is_active(): boolean {
    return this.getValue("is_active");
  }

  get is_verified(): boolean {
    return this.getValue("is_verified");
  }

  get created_at(): Date {
    return this.getValue("created_at");
  }

  private getValue(prop: any) {
    const optional = ["establishment_id", "created_at"];
    const privateProp = `_${prop}` as keyof this;
    if (!this[privateProp] && optional.includes(prop)) {
      throw new Error(
        `Property ${prop} not have a factory, use 'with' methods`,
      );
    }
    return this.callFactory(this[privateProp], 0);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }

  private generateValidCNPJ(): string {
    // Usar apenas CNPJs válidos comprovados sem formatação
    const validCNPJs = [
      "84244955000184", // CNPJ válido conhecido
      "90441272000110", // CNPJ válido conhecido
      "88226299000148", // CNPJ válido conhecido
    ];

    // Selecionar um CNPJ válido aleatoriamente da lista
    const randomIndex = this.chance.integer({
      min: 0,
      max: validCNPJs.length - 1,
    });
    return validCNPJs[randomIndex];
  }
}
