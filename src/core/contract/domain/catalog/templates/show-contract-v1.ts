import { ContractTemplate } from "../clause.types";
import {
  CANCELAMENTO_REMARCACAO_CLAUSE,
  CASO_FORTUITO_CLAUSE,
} from "../clauses/cancelamento.clauses";
import {
  DIREITO_IMAGEM_CLAUSE,
  EXCLUSIVIDADE_RAIO_CLAUSE,
  LGPD_CLAUSE,
} from "../clauses/direitos.clauses";
import {
  CAMARIM_ALIMENTACAO_CLAUSE,
  ESTRUTURA_TECNICA_CLAUSE,
  PASSAGEM_SOM_CLAUSE,
} from "../clauses/estrutura.clauses";
import {
  ASSINATURA_ELETRONICA_CLAUSE,
  DISPOSICOES_GERAIS_CLAUSE,
  PAPEL_DA_PLATAFORMA_CLAUSE,
  RESOLUCAO_CONFLITOS_FORO_CLAUSE,
} from "../clauses/gerais.clauses";
import {
  DATA_HORARIO_DURACAO_CLAUSE,
  OBJETO_CLAUSE,
} from "../clauses/objeto.clauses";
import {
  CACHE_PAGAMENTO_CLAUSE,
  CUSTODIA_LIBERACAO_CLAUSE,
} from "../clauses/preco.clauses";
import {
  DIREITOS_AUTORAIS_ECAD_CLAUSE,
  EQUIPAMENTOS_DANOS_CLAUSE,
  LICENCAS_SEGURANCA_CLAUSE,
  TRIBUTOS_CLAUSE,
} from "../clauses/responsabilidade.clauses";
import {
  AUSENCIA_VINCULO_CLAUSE,
  CONDUTA_CLAUSE,
  SUBSTITUICAO_INTEGRANTES_CLAUSE,
} from "../clauses/vinculo.clauses";

/**
 * Template do contrato de apresentação musical — versão 1.
 *
 * ⚠️ **`version` é imutável.** Nova redação de qualquer cláusula deste template
 * exige `show-v2`, nunca edição in-place — senão um contrato assinado no ano
 * passado passaria a ser reconstruído com o texto de hoje, e o snapshot
 * congelado do agregado perderia o sentido.
 *
 * A ordem abaixo é a ordem do documento e foi escolhida na lógica de leitura de
 * um contrato brasileiro: o que foi contratado → quando → por quanto → em que
 * condições → o que acontece se der errado → quem responde pelo quê → direitos
 * → fechamento.
 */
export const SHOW_CONTRACT_V1: ContractTemplate = {
  version: "show-v1",
  title: "Contrato de Prestação de Serviços Artísticos Musicais",
  clauses: [
    // O que foi contratado, quando e por quanto.
    OBJETO_CLAUSE,
    DATA_HORARIO_DURACAO_CLAUSE,
    CACHE_PAGAMENTO_CLAUSE,
    /*
     * Só entra em contrato com custódia — e por isso NÃO desloca a numeração
     * dos contratos já emitidos, que nunca tiveram escrow. É o que permite
     * acrescentá-la sem abrir `show-v2`.
     */
    CUSTODIA_LIBERACAO_CLAUSE,

    // Em que condições — a Ficha Técnica do A3 entra aqui como Anexo I.
    PASSAGEM_SOM_CLAUSE,
    ESTRUTURA_TECNICA_CLAUSE,
    CAMARIM_ALIMENTACAO_CLAUSE,

    // O que acontece se der errado.
    CANCELAMENTO_REMARCACAO_CLAUSE,
    CASO_FORTUITO_CLAUSE,

    // Quem responde pelo quê.
    DIREITOS_AUTORAIS_ECAD_CLAUSE,
    LICENCAS_SEGURANCA_CLAUSE,
    EQUIPAMENTOS_DANOS_CLAUSE,
    TRIBUTOS_CLAUSE,

    // Natureza da relação e obrigações do contratado.
    AUSENCIA_VINCULO_CLAUSE,
    SUBSTITUICAO_INTEGRANTES_CLAUSE,
    CONDUTA_CLAUSE,

    // Direitos.
    DIREITO_IMAGEM_CLAUSE,
    EXCLUSIVIDADE_RAIO_CLAUSE,
    LGPD_CLAUSE,

    // Fechamento — as duas cláusulas que sustentam o produto vêm aqui.
    ASSINATURA_ELETRONICA_CLAUSE,
    PAPEL_DA_PLATAFORMA_CLAUSE,
    RESOLUCAO_CONFLITOS_FORO_CLAUSE,
    DISPOSICOES_GERAIS_CLAUSE,
  ],
};

/** Versão emitida por padrão. Trocar aqui é decisão de produto, não de deploy. */
export const CURRENT_CONTRACT_TEMPLATE_VERSION = SHOW_CONTRACT_V1.version;
