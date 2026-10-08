import { IRepository } from "../../shared/domain/repository/repository-interface";
import { Subscription, SubscriptionId } from "./subscription.aggregate";

export interface ISubscriptionRepository extends IRepository<
  Subscription,
  SubscriptionId
> {
  findActiveMusicianSubscription(
    musician_id: string,
  ): Promise<Subscription | null>;
  findActiveEstablishmentSubscription(
    establishment_id: string,
  ): Promise<Subscription | null>;
  findAllByMusicianId(musician_id: string): Promise<Subscription[]>;
  findAllByEstablishmentId(establishment_id: string): Promise<Subscription[]>;
  findByGatewaySubscriptionId(
    gateway_subscription_id: string,
  ): Promise<Subscription | null>;

  /**
   * Ids dos músicos com assinatura PAGA vigente (`active` ou `trial`).
   *
   * Existe para a faixa "Em destaque" da busca de artistas poder ser montada
   * com UMA consulta, em vez de perguntar o plano de cada músico da página —
   * que é o N+1 que `ListMusiciansUseCase` evitaria por não carregar plano
   * nenhum.
   *
   * ⚠️ Exclui `FREE` **explicitamente**, mesmo o seed afirmando que tier
   * gratuito não gera linha: `plan_tier` é uma coluna String sem constraint,
   * então a invariante vive numa convenção e não no banco. Confiar nela aqui
   * faria um FREE com linha órfã comprar destaque de graça.
   *
   * Devolve só os ids: quem decide visibilidade (`open_to_gigs`, `is_active`)
   * é o repositório de músico, e este não deve opinar sobre isso.
   */
  findActivePaidMusicianIds(): Promise<string[]>;
}
