import { numeroComExtenso } from "../../contract-format";
import { ClauseDefinition } from "../clause.types";
import { lista } from "../clause-helpers";

/**
 * Objeto e condições de tempo da apresentação.
 *
 * Estas duas cláusulas são a espinha do contrato: descrevem o que foi
 * contratado e quando. Todas as demais só fazem sentido se estas estiverem
 * certas.
 */

export const OBJETO_CLAUSE: ClauseDefinition = {
  key: "objeto",
  category: "objeto",
  required: true,
  legal_note:
    "Contrato de prestação de serviços (CC art. 593 e ss.). A redação afirma " +
    "autonomia, eventualidade e ausência de exclusividade porque é o conjunto " +
    "que afasta os requisitos do vínculo empregatício (CLT art. 3º). Em " +
    "contratação de banda, o líder figura como representante: banda não tem " +
    "personalidade jurídica e quem responde precisa ser uma pessoa identificada.",
  variants: [
    {
      variant_id: "objeto.solo.formal",
      tone: "formal",
      applicability: { target: "musician" },
      consumes: ["local_nome", "duracao_formatada"],
      title: "Do objeto",
      body: (v) => `
        O presente instrumento particular tem por objeto a prestação de serviços
        artísticos musicais pelo CONTRATADO ao CONTRATANTE, consistente na
        realização de 1 (uma) apresentação musical ao vivo em ${v.local_nome},
        com duração de ${v.duracao_formatada}.

        Parágrafo primeiro. Os serviços são prestados em caráter autônomo,
        eventual e sem exclusividade, com meios, técnica, instrumental e
        repertório de livre escolha do CONTRATADO, respeitado o perfil do
        estabelecimento previamente informado.

        Parágrafo segundo. A apresentação poderá ser executada em blocos, com
        intervalos, desde que observado o tempo total de execução ora contratado.
      `,
    },
    {
      variant_id: "objeto.solo.direto",
      tone: "direto",
      applicability: { target: "musician" },
      consumes: ["local_nome", "duracao_formatada"],
      title: "Do objeto",
      body: (v) => `
        O CONTRATADO fará 1 (uma) apresentação musical ao vivo em
        ${v.local_nome}, com ${v.duracao_formatada} de duração.

        O CONTRATADO é profissional autônomo: escolhe o próprio repertório, usa
        os próprios meios e não tem exclusividade com o CONTRATANTE. A
        apresentação pode ser dividida em blocos, desde que o tempo total seja
        cumprido.
      `,
    },
    {
      variant_id: "objeto.banda.formal",
      tone: "formal",
      applicability: { target: "band" },
      consumes: [
        "local_nome",
        "duracao_formatada",
        "contratado_nome",
        "contratado_integrantes",
      ],
      title: "Do objeto",
      body: (v) => `
        O presente instrumento particular tem por objeto a prestação de serviços
        artísticos musicais pelo CONTRATADO ao CONTRATANTE, consistente na
        realização de 1 (uma) apresentação musical ao vivo em ${v.local_nome},
        com duração de ${v.duracao_formatada}, pelo grupo musical
        ${v.contratado_nome}, com a seguinte formação:
        ${lista(v.contratado_integrantes)}.

        Parágrafo primeiro. Os serviços são prestados em caráter autônomo,
        eventual e sem exclusividade, com meios, técnica, instrumental e
        repertório de livre escolha do CONTRATADO.

        Parágrafo segundo. O CONTRATADO responde perante o CONTRATANTE pela
        atuação de todos os integrantes indicados, bem como por quaisquer
        obrigações trabalhistas, previdenciárias, fiscais ou de qualquer outra
        natureza decorrentes da relação entre o CONTRATADO e seus integrantes,
        nada podendo ser exigido do CONTRATANTE a esse título.

        Parágrafo terceiro. A apresentação poderá ser executada em blocos, com
        intervalos, desde que observado o tempo total de execução ora contratado.
      `,
    },
    {
      variant_id: "objeto.banda.direto",
      tone: "direto",
      applicability: { target: "band" },
      consumes: [
        "local_nome",
        "duracao_formatada",
        "contratado_nome",
        "contratado_integrantes",
      ],
      title: "Do objeto",
      body: (v) => `
        O grupo ${v.contratado_nome} fará 1 (uma) apresentação musical ao vivo em
        ${v.local_nome}, com ${v.duracao_formatada} de duração, na formação:
        ${lista(v.contratado_integrantes)}.

        O CONTRATADO responde pelos próprios integrantes, inclusive por qualquer
        obrigação trabalhista, previdenciária ou fiscal entre eles — nada disso
        pode ser cobrado do CONTRATANTE.

        A apresentação pode ser dividida em blocos, desde que o tempo total seja
        cumprido.
      `,
    },
  ],
};

export const DATA_HORARIO_DURACAO_CLAUSE: ClauseDefinition = {
  key: "data_horario_duracao",
  category: "prazo",
  required: true,
  legal_note:
    "Fixa a obrigação principal no tempo. O fuso horário é explícito porque " +
    "'21:00' sem fuso é ambíguo entre servidor (UTC no contêiner) e cliente — " +
    "é a mesma classe de bug que o soundmeet-web já registrou. A hora " +
    "adicional depende de concordância expressa: prorrogação imposta seria " +
    "trabalho não contratado.",
  variants: [
    {
      variant_id: "data_horario_duracao.padrao.formal",
      tone: "formal",
      applicability: {},
      consumes: [
        "data_show",
        "dia_semana",
        "hora_inicio",
        "hora_fim",
        "fuso_horario",
        "local_endereco",
        "tolerancia_atraso_minutos",
        "hora_extra_valor_formatado",
      ],
      title: "Da data, do horário e da duração",
      body: (v) => `
        A apresentação ocorrerá no dia ${v.data_show} (${v.dia_semana}), com
        início às ${v.hora_inicio} e término previsto para ${v.hora_fim},
        considerado o fuso horário de ${v.fuso_horario}, no endereço
        ${v.local_endereco}.

        Parágrafo primeiro. O CONTRATADO deverá comparecer ao local com
        antecedência suficiente para montagem, conferência e ajuste de
        equipamentos.

        Parágrafo segundo. Admite-se tolerância de
        ${numeroComExtenso(v.tolerancia_atraso_minutos)} minutos para o início da
        apresentação, sem qualquer penalidade, hipótese em que o término será
        postergado na mesma medida.

        Parágrafo terceiro. A prorrogação da apresentação além do tempo
        contratado dependerá de concordância expressa do CONTRATADO e será
        remunerada à razão de ${v.hora_extra_valor_formatado} por hora adicional
        ou fração, paga nas mesmas condições do valor principal.
      `,
    },
    {
      variant_id: "data_horario_duracao.padrao.direto",
      tone: "direto",
      applicability: {},
      consumes: [
        "data_show",
        "dia_semana",
        "hora_inicio",
        "hora_fim",
        "fuso_horario",
        "local_endereco",
        "tolerancia_atraso_minutos",
        "hora_extra_valor_formatado",
      ],
      title: "Da data, do horário e da duração",
      body: (v) => `
        Data: ${v.data_show} (${v.dia_semana}). Horário: das ${v.hora_inicio} às
        ${v.hora_fim}, fuso de ${v.fuso_horario}. Local: ${v.local_endereco}.

        O CONTRATADO chega com antecedência para montar e testar os
        equipamentos. Há tolerância de
        ${numeroComExtenso(v.tolerancia_atraso_minutos)} minutos no início, sem
        penalidade — o término é adiado na mesma medida.

        Tocar além do horário só com o aceite do CONTRATADO, e custa
        ${v.hora_extra_valor_formatado} por hora adicional ou fração.
      `,
    },
  ],
};
