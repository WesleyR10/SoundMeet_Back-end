import { ClauseDefinition } from "../clause.types";
import { req } from "../clause-helpers";

/**
 * Estrutura do local: passagem de som, palco e camarim.
 *
 * 🔑 **É onde a Ficha Técnica do Palco (A3/F1.2) paga.** A ficha que o dono da
 * casa preencheu deixa de ser informação de vitrine e vira **Anexo I do
 * contrato**, congelada no snapshot: se depois o bar disser que nunca teve
 * retorno, o documento assinado diz o contrário. Sem a ficha, a cláusula muda de
 * redação e joga a definição da estrutura para um prazo, em vez de fingir que
 * existe um anexo.
 */

export const PASSAGEM_SOM_CLAUSE: ClauseDefinition = {
  key: "passagem_som",
  category: "estrutura",
  required: true,
  legal_note:
    "Obrigação de fazer do CONTRATANTE. Passagem de som não realizada é a " +
    "causa mais comum de show ruim com culpa do local, e sem cláusula não há " +
    "o que alegar. A variante sem janela definida cria a obrigação de informar " +
    "com antecedência, em vez de simplesmente omitir o tema.",
  variants: [
    {
      variant_id: "passagem_som.com_janela.formal",
      tone: "formal",
      applicability: { has_soundcheck_window: true },
      consumes: ["passagem_som_janela", "data_show"],
      title: "Da passagem de som",
      body: (v) => `
        O CONTRATANTE disponibilizará o palco, os equipamentos de sonorização e,
        quando houver, o operador de som para a passagem de som no dia
        ${v.data_show}, na janela das
        ${req(v.passagem_som_janela, "passagem_som_janela")}.

        Parágrafo único. A não disponibilização da passagem de som na janela
        acordada não autoriza o CONTRATANTE a exigir do CONTRATADO qualquer
        compensação por eventual atraso ou prejuízo técnico dela decorrente.
      `,
    },
    {
      variant_id: "passagem_som.sem_janela.formal",
      tone: "formal",
      applicability: { has_soundcheck_window: false },
      consumes: ["data_show"],
      title: "Da passagem de som",
      body: (v) => `
        O CONTRATANTE disponibilizará o palco, os equipamentos de sonorização e,
        quando houver, o operador de som para a passagem de som no dia
        ${v.data_show}, em horário anterior ao início da apresentação, a ser
        informado ao CONTRATADO com antecedência mínima de 48 (quarenta e oito)
        horas.

        Parágrafo único. A não disponibilização da passagem de som não autoriza o
        CONTRATANTE a exigir do CONTRATADO qualquer compensação por eventual
        atraso ou prejuízo técnico dela decorrente.
      `,
    },
  ],
};

export const ESTRUTURA_TECNICA_CLAUSE: ClauseDefinition = {
  key: "estrutura_tecnica",
  category: "estrutura",
  required: true,
  legal_note:
    "Aloca ao CONTRATANTE a estrutura declarada e ao CONTRATADO o instrumental " +
    "próprio. Com Ficha Técnica preenchida, o Anexo I integra o contrato e " +
    "torna a declaração vinculante — é o principal ganho prático do A3. Sem " +
    "ficha, o contrato não pode afirmar o que existe no local, então cria uma " +
    "obrigação de informar com prazo.",
  variants: [
    {
      variant_id: "estrutura_tecnica.com_anexo.formal",
      tone: "formal",
      applicability: { has_stage_tech_spec: true },
      consumes: ["ficha_tecnica_resumo", "local_nome"],
      title: "Da estrutura técnica",
      body: (v) => `
        O CONTRATANTE declara que ${v.local_nome} dispõe da estrutura técnica
        descrita no Anexo I — Ficha Técnica do Palco, que integra este
        instrumento para todos os fins, e obriga-se a disponibilizá-la em
        condições de uso na data da apresentação.

        Parágrafo primeiro. Resumo da estrutura declarada:
        ${req(v.ficha_tecnica_resumo, "ficha_tecnica_resumo")}. O detalhamento
        completo consta do Anexo I.

        Parágrafo segundo. Cabe ao CONTRATADO o instrumental próprio e tudo o
        que não estiver expressamente declarado no Anexo I.

        Parágrafo terceiro. A ausência, no dia da apresentação, de item
        declarado no Anexo I constitui inadimplemento do CONTRATANTE e não
        autoriza desconto no valor contratado.
      `,
    },
    {
      variant_id: "estrutura_tecnica.sem_anexo.formal",
      tone: "formal",
      applicability: { has_stage_tech_spec: false },
      consumes: ["local_nome"],
      title: "Da estrutura técnica",
      body: (v) => `
        O CONTRATANTE obriga-se a informar ao CONTRATADO, por escrito e com
        antecedência mínima de 5 (cinco) dias da apresentação, a estrutura
        técnica disponível em ${v.local_nome}, incluindo sistema de sonorização,
        retornos de palco, microfones, equipamento de palco disponível e
        alimentação elétrica.

        Parágrafo primeiro. Cabe ao CONTRATADO o instrumental próprio e tudo o
        que não for expressamente informado como disponível pelo CONTRATANTE.

        Parágrafo segundo. Não prestada a informação no prazo, o CONTRATADO
        poderá rescindir este contrato sem qualquer penalidade, comunicando o
        CONTRATANTE.
      `,
    },
  ],
};

export const CAMARIM_ALIMENTACAO_CLAUSE: ClauseDefinition = {
  key: "camarim_alimentacao",
  category: "estrutura",
  required: false,
  legal_note:
    "Cláusula de cortesia, faixa de cachê acima de R$ 500. Deliberadamente " +
    "ausente em contratações menores: exigir camarim de um bar de bairro em " +
    "show de R$ 300 produz cláusula que ninguém cumpre, e cláusula descumprida " +
    "por rotina enfraquece o contrato inteiro.",
  variants: [
    {
      variant_id: "camarim_alimentacao.basica.formal",
      tone: "formal",
      applicability: { fee_min: 500, fee_max: 2000 },
      consumes: ["contratado_e_banda"],
      title: "Do camarim e da alimentação",
      body: (v) => `
        O CONTRATANTE disponibilizará ao CONTRATADO
        ${v.contratado_e_banda ? "e aos integrantes do grupo" : ""} espaço
        reservado para preparação e guarda de pertences, bem como água potável
        durante toda a permanência no local.
      `,
    },
    {
      variant_id: "camarim_alimentacao.completa.formal",
      tone: "formal",
      applicability: { fee_min: 2000 },
      consumes: ["contratado_e_banda", "duracao_formatada"],
      title: "Do camarim e da alimentação",
      body: (v) => `
        O CONTRATANTE disponibilizará ao CONTRATADO
        ${v.contratado_e_banda ? "e a todos os integrantes do grupo" : ""}:

        (a) camarim ou espaço reservado, com acesso restrito, para preparação e
        guarda de pertences;

        (b) água potável durante toda a permanência no local;

        (c) refeição ou lanche compatível com o horário, considerada a duração
        de ${v.duracao_formatada} da apresentação e o tempo de montagem e
        desmontagem.
      `,
    },
  ],
};
