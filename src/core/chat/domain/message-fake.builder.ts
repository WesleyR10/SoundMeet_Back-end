import { v4 as uuidv4 } from "uuid";

import { Message, MessageId, SenderType } from "./message.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class MessageFakeBuilder<TBuild = any> {
  private _id: PropOrFactory<MessageId> | undefined = undefined;
  private _conversation_id: PropOrFactory<string> = (_index) => uuidv4();
  private _sender_id: PropOrFactory<string> = (_index) => uuidv4();
  private _sender_type: PropOrFactory<SenderType> = (_index) => "musician";
  private _content: PropOrFactory<string> = (_index) =>
    "Mensagem de teste";

  private countObjs: number;

  static aMessage() {
    return new MessageFakeBuilder<Message>();
  }

  static theMessages(countObjs: number) {
    return new MessageFakeBuilder<Message[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
  }

  withMessageId(valueOrFactory: PropOrFactory<MessageId>) {
    this._id = valueOrFactory;
    return this;
  }

  withConversationId(valueOrFactory: PropOrFactory<string>) {
    this._conversation_id = valueOrFactory;
    return this;
  }

  withSenderId(valueOrFactory: PropOrFactory<string>) {
    this._sender_id = valueOrFactory;
    return this;
  }

  fromEstablishment() {
    this._sender_type = "establishment";
    return this;
  }

  fromBand() {
    this._sender_type = "band";
    return this;
  }

  withContent(valueOrFactory: PropOrFactory<string>) {
    this._content = valueOrFactory;
    return this;
  }

  build(): TBuild {
    const messages = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const msg = new Message({
          message_id: !this._id
            ? new MessageId()
            : this.callFactory(this._id, index),
          conversation_id: this.callFactory(this._conversation_id, index),
          sender_id: this.callFactory(this._sender_id, index),
          sender_type: this.callFactory(this._sender_type, index),
          content: this.callFactory(this._content, index),
        });
        msg.validate();
        return msg;
      });
    return this.countObjs === 1 ? (messages[0] as any) : (messages as any);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
