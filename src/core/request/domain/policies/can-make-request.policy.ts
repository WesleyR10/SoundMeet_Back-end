import {
  presenceRefusalMessage,
  PresenceVerdict,
  PresenceVerifier,
} from "../../../events/domain/presence";
import { IPolicy } from "../../../shared/domain/policies/policy.interface";
import { PolicyResult } from "../../../shared/domain/policies/policy-result";
import { Request } from "../request.aggregate";

/*
 * 🔴 As mensagens abaixo chegam CRUAS ao fã (o app mostra `extractApiMessage`
 * de um 422). Por isso em português e dizendo o que fazer — até 28/set/2026
 * estavam em inglês ("Daily request limit of 5 exceeded for this event").
 */
export type CanMakeRequestPolicyContext = {
  event_status: string;
  is_musician_performer: boolean;
  is_audience_attendee: boolean;
  /**
   * Veredito da leitura de GPS enviada COM ESTE pedido. Reverificada a cada
   * pedido, não herdada do check-in: o fã pode ter saído do bar e continuado
   * pedindo do caminho de casa.
   */
  presence: PresenceVerdict;
  requests_today_in_event: number;
  max_requests_per_user_per_event: number;
  has_pending_request_for_musician: boolean;
  recent_requests: Request[];
  candidate: Request;
  /** Piso configurável do destaque pago (`REQUEST_BOOST_MIN_AMOUNT`). */
  min_boost_amount: number;
  /**
   * O músico tem conta do provedor vinculada. Só é consultado quando o
   * candidato traz destaque — pedido comum não depende disso.
   */
  musician_accepts_tips: boolean;
};

export class EventMustBeActivePolicy implements IPolicy<CanMakeRequestPolicyContext> {
  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    if (context.event_status === "active") {
      return PolicyResult.ok();
    }

    return PolicyResult.fail([
      {
        event_id: ["Este evento não está acontecendo agora."],
      },
    ]);
  }
}

export class MusicianMustBePerformerPolicy implements IPolicy<CanMakeRequestPolicyContext> {
  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    if (context.is_musician_performer) {
      return PolicyResult.ok();
    }

    return PolicyResult.fail([
      {
        musician_id: ["Este artista não está tocando neste evento."],
      },
    ]);
  }
}

/**
 * O fã está NO SHOW — registrado como presente e, neste pedido, dentro do raio
 * da casa.
 *
 * 🔴 Até out/2026 bastava `is_audience_attendee`, e o registro de presença não
 * verificava nada: quem abria a Home no sofá pedia música (e destaque pago) em
 * qualquer show do país. Gorjeta NÃO passa por aqui de propósito — não mexe
 * na fila nem no palco.
 */
export class AudienceMustBePresentPolicy implements IPolicy<CanMakeRequestPolicyContext> {
  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    if (!context.is_audience_attendee) {
      return PolicyResult.fail([
        {
          audience_id: [
            "Abra o show pelo app, no local, para fazer o check-in antes de pedir uma música.",
          ],
        },
      ]);
    }

    if (!PresenceVerifier.isAccepted(context.presence)) {
      return PolicyResult.fail([
        { location: [presenceRefusalMessage(context.presence)!] },
      ]);
    }

    return PolicyResult.ok();
  }
}

export class DailyRequestLimitPolicy implements IPolicy<CanMakeRequestPolicyContext> {
  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    if (
      context.requests_today_in_event < context.max_requests_per_user_per_event
    ) {
      return PolicyResult.ok();
    }

    return PolicyResult.fail([
      {
        audience_id: [
          `Você já fez ${context.max_requests_per_user_per_event} pedidos hoje neste evento — é o limite por pessoa.`,
        ],
      },
    ]);
  }
}

export class NoPendingRequestForMusicianPolicy implements IPolicy<CanMakeRequestPolicyContext> {
  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    if (!context.has_pending_request_for_musician) {
      return PolicyResult.ok();
    }

    return PolicyResult.fail([
      {
        musician_id: [
          "Você já tem um pedido esperando a resposta deste artista. Assim que ele responder, dá pra pedir outra.",
        ],
      },
    ]);
  }
}

export class AntiSpamSimilarRecentRequestPolicy implements IPolicy<CanMakeRequestPolicyContext> {
  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    const hasSimilarRecentRequest = context.recent_requests.some((request) =>
      context.candidate.isSimilarTo(request),
    );

    if (!hasSimilarRecentRequest) {
      return PolicyResult.ok();
    }

    return PolicyResult.fail([
      {
        song_title: ["Você pediu essa música há pouco. Espere um pouco antes de pedir de novo."],
      },
    ]);
  }
}

/**
 * Piso do destaque pago.
 *
 * Existe para impedir que R$0,50 ocupe o topo da fila: a ordenação é por valor,
 * então sem piso o destaque vira grátis na prática. O número mora em config
 * (`REQUEST_BOOST_MIN_AMOUNT`), não aqui — reajustar piso não pode custar
 * mudança de domínio.
 */
export class BoostMinimumAmountPolicy implements IPolicy<CanMakeRequestPolicyContext> {
  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    const boost = context.candidate.boost;
    if (!boost || boost.amount.amount >= context.min_boost_amount) {
      return PolicyResult.ok();
    }

    return PolicyResult.fail([
      {
        boost: [
          `O destaque mínimo é de R$ ${context.min_boost_amount.toFixed(2).replace(".", ",")}.`,
        ],
      },
    ]);
  }
}

/**
 * 🔴 Sem conta do provedor vinculada, o músico não tem para onde receber.
 *
 * Barrado aqui, na criação, e não no aceite: ver o raciocínio em
 * `domain/ports/tip-eligibility.port.ts`.
 */
export class MusicianAcceptsTipsPolicy implements IPolicy<CanMakeRequestPolicyContext> {
  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    if (!context.candidate.boost || context.musician_accepts_tips) {
      return PolicyResult.ok();
    }

    return PolicyResult.fail([
      {
        boost: [
          "Este artista ainda não pode receber pagamentos — mande o pedido sem destaque.",
        ],
      },
    ]);
  }
}

export class CanMakeRequestPolicy implements IPolicy<CanMakeRequestPolicyContext> {
  private readonly policies: Array<IPolicy<CanMakeRequestPolicyContext>>;

  constructor(
    policies: Array<IPolicy<CanMakeRequestPolicyContext>> = [
      new EventMustBeActivePolicy(),
      new MusicianMustBePerformerPolicy(),
      new AudienceMustBePresentPolicy(),
      new DailyRequestLimitPolicy(),
      new NoPendingRequestForMusicianPolicy(),
      new AntiSpamSimilarRecentRequestPolicy(),
      new BoostMinimumAmountPolicy(),
      new MusicianAcceptsTipsPolicy(),
    ],
  ) {
    this.policies = policies;
  }

  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    return this.policies.reduce(
      (result, policy) => result.merge(policy.evaluate(context)),
      PolicyResult.ok(),
    );
  }
}
