import { Chance } from "chance";
import { Badge, BadgeId, BadgeCategory, BadgeRarity } from "./badge.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class BadgeFakeBuilder<TBuild = any> {
  private _id: PropOrFactory<BadgeId> | undefined = undefined;
  private _name: PropOrFactory<string> = (_index) => this.chance.word();
  private _description: PropOrFactory<string> = (_index) =>
    this.chance.sentence();
  private _icon: PropOrFactory<string> = (_index) => "🏆";
  private _category: PropOrFactory<BadgeCategory> = (_index) => "engagement";
  private _requirement: PropOrFactory<Record<string, any>> = (_index) => ({
    type: "points",
    value: 100,
  });
  private _points: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 10, max: 1000 });
  private _rarity: PropOrFactory<BadgeRarity> = (_index) => "common";
  private _is_active: PropOrFactory<boolean> = (_index) => true;
  private _created_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;

  static aBadge() {
    return new BadgeFakeBuilder<Badge>();
  }

  static theBadges(countObjs: number) {
    return new BadgeFakeBuilder<Badge[]>(countObjs);
  }

  private chance: Chance.Chance;

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withBadgeId(valueOrFactory: PropOrFactory<BadgeId>) {
    this._id = valueOrFactory;
    return this;
  }

  withName(valueOrFactory: PropOrFactory<string>) {
    this._name = valueOrFactory;
    return this;
  }

  withDescription(valueOrFactory: PropOrFactory<string>) {
    this._description = valueOrFactory;
    return this;
  }

  withIcon(valueOrFactory: PropOrFactory<string>) {
    this._icon = valueOrFactory;
    return this;
  }

  withCategory(valueOrFactory: PropOrFactory<BadgeCategory>) {
    this._category = valueOrFactory;
    return this;
  }

  withRequirement(valueOrFactory: PropOrFactory<Record<string, any>>) {
    this._requirement = valueOrFactory;
    return this;
  }

  withPoints(valueOrFactory: PropOrFactory<number>) {
    this._points = valueOrFactory;
    return this;
  }

  withRarity(valueOrFactory: PropOrFactory<BadgeRarity>) {
    this._rarity = valueOrFactory;
    return this;
  }

  activate() {
    this._is_active = true;
    return this;
  }

  deactivate() {
    this._is_active = false;
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  withInvalidNameEmpty(value: "" = "") {
    this._name = value;
    return this;
  }

  withInvalidNameNotAString(value?: any) {
    this._name = value ?? 5;
    return this;
  }

  withInvalidNameTooLong(value?: string) {
    this._name = value ?? this.chance.word({ length: 256 });
    return this;
  }

  withInvalidDescriptionEmpty(value: "" = "") {
    this._description = value;
    return this;
  }

  withInvalidDescriptionNotAString(value?: any) {
    this._description = value ?? 5;
    return this;
  }

  withInvalidDescriptionTooLong(value?: string) {
    this._description = value ?? this.chance.word({ length: 1001 });
    return this;
  }

  withInvalidIconEmpty(value: "" = "") {
    this._icon = value;
    return this;
  }

  withInvalidCategoryEmpty(value: "" = "") {
    this._category = value as any;
    return this;
  }

  withInvalidRequirementEmpty(value: any = null) {
    this._requirement = value;
    return this;
  }

  withInvalidPointsNegative(value?: number) {
    this._points = value ?? -1;
    return this;
  }

  build(): TBuild {
    const badges = new Array(this.countObjs).fill(undefined).map((_, index) => {
      const badge = new Badge({
        id: !this._id ? undefined : this.callFactory(this._id, index),
        name: this.callFactory(this._name, index),
        description: this.callFactory(this._description, index),
        icon: this.callFactory(this._icon, index),
        category: this.callFactory(this._category, index),
        requirement: this.callFactory(this._requirement, index),
        points: this.callFactory(this._points, index),
        rarity: this.callFactory(this._rarity, index),
        is_active: this.callFactory(this._is_active, index),
        created_at: !this._created_at
          ? undefined
          : this.callFactory(this._created_at, index),
      });
      return badge;
    });
    return this.countObjs === 1 ? (badges[0] as any) : (badges as TBuild);
  }

  get id() {
    return this.getValue("id");
  }

  get name() {
    return this.getValue("name");
  }

  get description() {
    return this.getValue("description");
  }

  get icon() {
    return this.getValue("icon");
  }

  get category() {
    return this.getValue("category");
  }

  get requirement() {
    return this.getValue("requirement");
  }

  get points() {
    return this.getValue("points");
  }

  get rarity() {
    return this.getValue("rarity");
  }

  get is_active() {
    return this.getValue("is_active");
  }

  get created_at() {
    return this.getValue("created_at");
  }

  private getValue(prop: any) {
    const optional = ["id", "created_at"];
    const privateProp = `_${prop}` as keyof this;
    if (!this[privateProp] && optional.includes(prop)) {
      throw new Error(
        `Property ${prop} not have a factory, use 'with' methods`,
      );
    }
    return this.callFactory(this[privateProp] as any, 0);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
