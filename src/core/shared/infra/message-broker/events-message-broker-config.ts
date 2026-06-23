import { TipCompletedIntegrationEvent } from "../../../payment/domain/events/tip-completed.event";
import { IIntegrationEvent } from "../../domain/events/domain-event.interface";

export type MessageBrokerEventConfig = {
  exchange: string;
  routing_key: string;
};

export const EVENTS_MESSAGE_BROKER_CONFIG: Record<
  string,
  MessageBrokerEventConfig
> = {
  [TipCompletedIntegrationEvent.name]: {
    exchange: "soundmeet.events",
    routing_key: "payment.tip.completed",
  },
};

export function resolveMessageBrokerConfig(
  event: IIntegrationEvent,
  defaultExchange: string,
): MessageBrokerEventConfig {
  const config = EVENTS_MESSAGE_BROKER_CONFIG[event.constructor.name];
  if (config) {
    return config;
  }

  const routing_key =
    (event as any)?.event_name?.toString?.() ?? event.constructor.name;
  return {
    exchange: defaultExchange,
    routing_key,
  };
}
