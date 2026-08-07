import { SetMetadata } from "@nestjs/common";

export const OWNERSHIP_PARAM_KEY = "ownership_param";

export type OwnershipParamOptions = {
  /** Nome do path param que contém o id do recurso dono (ex.: "musician_id"). */
  param?: string;
  /**
   * Chave do body que contém o id do recurso dono (ex.: "establishment_id").
   * Para rotas de criação (POST sem path param de dono). Guards rodam antes
   * do ValidationPipe, então o valor lido aqui é o body cru — a comparação é
   * de igualdade contra as claims do JWT, não depende de validação prévia.
   */
  bodyKey?: string;
};

/**
 * Declara explicitamente de onde o ownership guard da rota deve resolver o id
 * do recurso. Sem este decorator, o guard cai no fallback por convenção de
 * nome de param ([entity]_id → [entity]Id → id) e nega acesso se nenhum for
 * encontrado (fail-closed).
 */
export const OwnershipParam = (options: OwnershipParamOptions) =>
  SetMetadata(OWNERSHIP_PARAM_KEY, options);
