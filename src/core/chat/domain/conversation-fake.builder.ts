import { v4 as uuidv4 } from "uuid";

import { Conversation, ConversationId } from "./conversation.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class ConversationFakeBuilder<TBuild = any> {
  private _id: PropOrFactory<ConversationId> | undefined = undefined;
  private _inquiry_id: PropOrFactory<string> = (_index) => uuidv4();
  private _establishment_id: PropOrFactory<string> = (_index) => uuidv4();
  private _musician_id: PropOrFactory<string | null> = (_index) => uuidv4();
  private _band_id: PropOrFactory<string | null> = (_index) => null;

  private countObjs: number;

  static aConversation() {
    return new ConversationFakeBuilder<Conversation>();
  }

  static theConversations(countObjs: number) {
    return new ConversationFakeBuilder<Conversation[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
  }

  withConversationId(valueOrFactory: PropOrFactory<ConversationId>) {
    this._id = valueOrFactory;
    return this;
  }

  withInquiryId(valueOrFactory: PropOrFactory<string>) {
    this._inquiry_id = valueOrFactory;
    return this;
  }

  withEstablishmentId(valueOrFactory: PropOrFactory<string>) {
    this._establishment_id = valueOrFactory;
    return this;
  }

  withMusicianId(valueOrFactory: PropOrFactory<string | null>) {
    this._musician_id = valueOrFactory;
    return this;
  }

  withBandId(valueOrFactory: PropOrFactory<string | null>) {
    this._band_id = valueOrFactory;
    return this;
  }

  build(): TBuild {
    const convs = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const conv = new Conversation({
          conversation_id: !this._id
            ? new ConversationId()
            : this.callFactory(this._id, index),
          inquiry_id: this.callFactory(this._inquiry_id, index),
          establishment_id: this.callFactory(this._establishment_id, index),
          musician_id: this.callFactory(this._musician_id, index),
          band_id: this.callFactory(this._band_id, index),
        });
        conv.validate();
        return conv;
      });
    return this.countObjs === 1 ? (convs[0] as any) : (convs as any);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
