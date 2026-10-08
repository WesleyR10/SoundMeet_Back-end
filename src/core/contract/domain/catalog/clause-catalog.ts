import { InvalidArgumentError } from "../../../shared/domain/errors/invalid-argument.error";
import { ContractVariables } from "../value-objects/contract-variables.vo";
import { RenderedClause } from "../value-objects/rendered-clause.vo";
import {
  ClauseApplicability,
  ClauseDefinition,
  ClauseVariant,
  ContractContext,
  ContractTemplate,
  DEFAULT_CLAUSE_TONE,
} from "./clause.types";
import { SHOW_CONTRACT_V1 } from "./templates/show-contract-v1";

/**
 * Resolução do catálogo: contexto + variáveis → cláusulas renderizadas.
 *
 * O catálogo nunca vê agregado. Recebe um `ContractContext` (fatos) e um
 * `ContractVariables` (dados já formatados), montados pela camada de aplicação,
 * e devolve o snapshot pronto para congelar.
 */

const TEMPLATES: readonly ContractTemplate[] = [SHOW_CONTRACT_V1];

export interface IClauseCatalog {
  getTemplate(version: string): ContractTemplate;
  render(
    template: ContractTemplate,
    context: ContractContext,
    variables: ContractVariables,
  ): RenderedClause[];
}

/** Uma variante é aplicável quando TODAS as condições declaradas batem. */
export function matchesApplicability(
  applicability: ClauseApplicability,
  context: ContractContext,
): boolean {
  if (
    applicability.target !== undefined &&
    applicability.target !== context.target
  ) {
    return false;
  }

  // `fee_min` inclusivo e `fee_max` exclusivo — é o que impede duas faixas
  // adjacentes de casarem no mesmo valor de fronteira.
  if (
    applicability.fee_min !== undefined &&
    context.fee < applicability.fee_min
  ) {
    return false;
  }
  if (
    applicability.fee_max !== undefined &&
    context.fee >= applicability.fee_max
  ) {
    return false;
  }

  const booleanConditions = [
    ["has_stage_tech_spec", applicability.has_stage_tech_spec],
    ["has_soundcheck_window", applicability.has_soundcheck_window],
    ["uses_escrow", applicability.uses_escrow],
    ["outdoor", applicability.outdoor],
    ["exclusivity_requested", applicability.exclusivity_requested],
    ["contractor_is_company", applicability.contractor_is_company],
    ["contracted_is_company", applicability.contracted_is_company],
  ] as const;

  for (const [key, expected] of booleanConditions) {
    if (expected !== undefined && context[key] !== expected) {
      return false;
    }
  }

  return true;
}

/**
 * Escolhe a variante de uma cláusula, ou `null` quando nenhuma se aplica.
 *
 * A cadeia é: aplicabilidade → tom pedido → tom padrão → **nada**.
 *
 * 🔴 O último elo é deliberado e não pode virar "qualquer variante". A cláusula
 * `conduta` só tem redação no tom `rigoroso`; um fallback genérico a
 * empurraria para dentro de todo contrato formal, que é exatamente o oposto do
 * que ela documenta. "Nenhuma variante se aplica" é uma resposta legítima —
 * para cláusula opcional significa omitir, e para obrigatória significa falhar.
 */
export function selectVariant(
  clause: ClauseDefinition,
  context: ContractContext,
): ClauseVariant | null {
  const applicable = clause.variants.filter((variant) =>
    matchesApplicability(variant.applicability, context),
  );

  if (applicable.length === 0) return null;

  return (
    applicable.find((variant) => variant.tone === context.tone) ??
    applicable.find((variant) => variant.tone === DEFAULT_CLAUSE_TONE) ??
    null
  );
}

export class ClauseCatalog implements IClauseCatalog {
  getTemplate(version: string): ContractTemplate {
    const template = TEMPLATES.find((item) => item.version === version);
    if (!template) {
      throw new UnknownContractTemplateError(
        `Unknown contract template version: ${version}`,
      );
    }
    return template;
  }

  render(
    template: ContractTemplate,
    context: ContractContext,
    variables: ContractVariables,
  ): RenderedClause[] {
    const rendered: RenderedClause[] = [];

    for (const clause of template.clauses) {
      const variant = selectVariant(clause, context);

      if (!variant) {
        /*
         * Cláusula obrigatória sem variante aplicável é buraco no contrato.
         * Falhar aqui, alto, é o comportamento correto: um documento
         * silenciosamente incompleto seria assinado sem ninguém perceber, e só
         * apareceria no litígio — quando não há mais o que fazer.
         */
        if (clause.required) {
          throw new UnresolvableClauseError(
            `A cláusula obrigatória "${clause.key}" não tem variante aplicável a este contrato`,
          );
        }
        continue;
      }

      rendered.push(
        new RenderedClause({
          number: rendered.length + 1,
          key: clause.key,
          variant_id: variant.variant_id,
          category: clause.category,
          title: variant.title,
          body: variant.body(variables),
        }),
      );
    }

    return rendered;
  }
}

export class UnknownContractTemplateError extends InvalidArgumentError {
  constructor(message?: string) {
    super(message ?? "Unknown contract template");
    this.name = "UnknownContractTemplateError";
  }
}

export class UnresolvableClauseError extends InvalidArgumentError {
  constructor(message?: string) {
    super(message ?? "Unresolvable contract clause");
    this.name = "UnresolvableClauseError";
  }
}
