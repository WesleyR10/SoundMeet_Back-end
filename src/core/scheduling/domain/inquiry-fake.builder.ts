import { Chance } from "chance";
import { v4 as uuidv4 } from "uuid";

import { InquiryStatus } from "../../shared/domain/value-objects/inquiry-status.vo";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { Inquiry, InquiryId } from "./inquiry.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class InquiryFakeBuilder<TBuild = any> {
  private _inquiry_id: PropOrFactory<InquiryId> | undefined = undefined;
  private _establishment_id: PropOrFactory<string> = (_index) => uuidv4();
  private _musician_id: PropOrFactory<string | null> = (_index) => uuidv4();
  private _band_id: PropOrFactory<string | null> = (_index) => null;
  private _event_id: PropOrFactory<string | null> = (_index) => null;
  private _subject: PropOrFactory<string | null> = (_index) =>
    this.chance.sentence({ words: 5 });
  private _initial_message: PropOrFactory<string | null> = (_index) =>
    this.chance.paragraph({ sentences: 2 });
  private _status: PropOrFactory<InquiryStatus> = (_index) =>
    InquiryStatus.open();
  private _expires_at: PropOrFactory<Date | null> = (_index) =>
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  private _accepted_at: PropOrFactory<Date | null> = (_index) => null;
  private _rejected_at: PropOrFactory<Date | null> = (_index) => null;
  private _rejection_reason: PropOrFactory<string | null> = (_index) => null;
  private _converted_at: PropOrFactory<Date | null> = (_index) => null;
  private _booking_id: PropOrFactory<string | null> = (_index) => null;
  private _created_at: PropOrFactory<Date> = (_index) => new Date();
  private _updated_at: PropOrFactory<Date> = (_index) => new Date();

  private countObjs;
  private chance: Chance.Chance;

  static anInquiry() {
    return new InquiryFakeBuilder<Inquiry>();
  }

  static theInquiries(countObjs: number) {
    return new InquiryFakeBuilder<Inquiry[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withInquiryId(valueOrFactory: PropOrFactory<InquiryId>) {
    this._inquiry_id = valueOrFactory;
    return this;
  }

  withEstablishmentId(valueOrFactory: PropOrFactory<string | Uuid>) {
    this._establishment_id =
      typeof valueOrFactory === "function"
        ? (index: number) => {
            const result = valueOrFactory(index);
            return result instanceof Uuid ? result.id : result;
          }
        : valueOrFactory instanceof Uuid
          ? valueOrFactory.id
          : valueOrFactory;
    return this;
  }

  withMusicianId(valueOrFactory: PropOrFactory<string | Uuid | null>) {
    this._musician_id =
      typeof valueOrFactory === "function"
        ? (index: number) => {
            const result = valueOrFactory(index);
            if (result === null) return null;
            return result instanceof Uuid ? result.id : result;
          }
        : valueOrFactory instanceof Uuid
          ? valueOrFactory.id
          : valueOrFactory;
    return this;
  }

  withBandId(valueOrFactory: PropOrFactory<string | Uuid | null>) {
    this._band_id =
      typeof valueOrFactory === "function"
        ? (index: number) => {
            const result = valueOrFactory(index);
            if (result === null) return null;
            return result instanceof Uuid ? result.id : result;
          }
        : valueOrFactory instanceof Uuid
          ? valueOrFactory.id
          : valueOrFactory;
    return this;
  }

  open() {
    this._status = () => InquiryStatus.open();
    this._accepted_at = () => null;
    this._rejected_at = () => null;
    this._converted_at = () => null;
    this._booking_id = () => null;
    return this;
  }

  accepted() {
    this._status = () => InquiryStatus.accepted();
    this._accepted_at = () => new Date();
    return this;
  }

  rejected() {
    this._status = () => InquiryStatus.rejected();
    this._rejected_at = () => new Date();
    this._rejection_reason = () => this.chance.sentence({ words: 6 });
    return this;
  }

  converted() {
    this._status = () => InquiryStatus.converted();
    this._converted_at = () => new Date();
    this._booking_id = () => uuidv4();
    return this;
  }

  expired() {
    this._status = () => InquiryStatus.expired();
    return this;
  }

  build(): TBuild {
    const inquiries = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const inquiry = new Inquiry({
          inquiry_id: !this._inquiry_id
            ? undefined
            : this.callFactory(this._inquiry_id, index),
          establishment_id: this.callFactory(this._establishment_id, index),
          musician_id: this.callFactory(this._musician_id, index),
          band_id: this.callFactory(this._band_id, index),
          event_id: this.callFactory(this._event_id, index),
          subject: this.callFactory(this._subject, index),
          initial_message: this.callFactory(this._initial_message, index),
          status: this.callFactory(this._status, index),
          expires_at: this.callFactory(this._expires_at, index),
          accepted_at: this.callFactory(this._accepted_at, index),
          rejected_at: this.callFactory(this._rejected_at, index),
          rejection_reason: this.callFactory(this._rejection_reason, index),
          converted_at: this.callFactory(this._converted_at, index),
          booking_id: this.callFactory(this._booking_id, index),
          created_at: this.callFactory(this._created_at, index),
          updated_at: this.callFactory(this._updated_at, index),
        });
        inquiry.validate();
        return inquiry;
      });

    return this.countObjs === 1 ? (inquiries[0] as any) : (inquiries as any);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
