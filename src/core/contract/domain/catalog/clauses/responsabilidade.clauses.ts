import { ClauseDefinition } from "../clause.types";

/**
 * Alocação de responsabilidades — quem responde pelo quê.
 *
 * É o bloco de maior valor prático do contrato. Cada cláusula aqui existe
 * porque, sem ela, a responsabilidade cai em cima de quem tiver menos poder de
 * negociação na hora do problema — normalmente o músico.
 */

export const DIREITOS_AUTORAIS_ECAD_CLAUSE: ClauseDefinition = {
  key: "direitos_autorais_ecad",
  category: "responsabilidade",
  required: true,
  legal_note:
    "🔑 Lei 9.610/1998, art. 68: a execução pública de obras musicais em local " +
    "de frequência coletiva depende de autorização prévia e o recolhimento ao " +
    "ECAD cabe a quem promove o evento — o estabelecimento. É a cláusula mais " +
    "barata e mais valiosa do documento inteiro: sem ela, a cobrança bate no " +
    "músico, que não tem como se defender. O roteiro de ECAD como feature está " +
    "fora do roadmap por decisão de produto; a alocação de responsabilidade, não.",
  variants: [
    {
      variant_id: "direitos_autorais_ecad.padrao.formal",
      tone: "formal",
      applicability: {},
      consumes: ["plataforma_nome"],
      title: "Dos direitos autorais e do ECAD",
      body: (v) => `
        A execução pública de obras musicais no estabelecimento constitui
        obrigação do CONTRATANTE, na qualidade de promotor do evento, nos termos
        do art. 68 da Lei nº 9.610/1998, cabendo-lhe exclusivamente a obtenção
        das autorizações necessárias e o recolhimento dos direitos autorais
        devidos ao ECAD — Escritório Central de Arrecadação e Distribuição.

        Parágrafo primeiro. O CONTRATANTE isenta o CONTRATADO de qualquer
        responsabilidade, cobrança, multa ou ônus decorrente da execução pública
        das obras, obrigando-se a reembolsá-lo de imediato caso venha a ser
        acionado a esse título.

        Parágrafo segundo. A ${v.plataforma_nome} não intermedia, não recolhe e
        não fiscaliza direitos autorais, não lhe cabendo qualquer
        responsabilidade a esse título.

        Parágrafo terceiro. O CONTRATADO declara que as obras de sua autoria
        eventualmente executadas são de sua titularidade ou que possui a devida
        autorização para executá-las.
      `,
    },
  ],
};

export const LICENCAS_SEGURANCA_CLAUSE: ClauseDefinition = {
  key: "licencas_seguranca",
  category: "responsabilidade",
  required: true,
  legal_note:
    "Alvará de funcionamento, autorização para som ao vivo, limites municipais " +
    "de ruído (a 'lei do silêncio' é municipal e varia), segurança e brigada " +
    "são obrigações do explorador do estabelecimento. Sem esta cláusula, a " +
    "interdição do local no meio do show vira discussão sobre quem perde o " +
    "cachê.",
  variants: [
    {
      variant_id: "licencas_seguranca.padrao.formal",
      tone: "formal",
      applicability: {},
      consumes: ["local_nome"],
      title: "Das licenças, da segurança e da adequação do local",
      body: (v) => `
        É de responsabilidade exclusiva do CONTRATANTE manter ${v.local_nome} em
        situação regular perante as autoridades competentes, incluindo alvará de
        funcionamento, autorização para realização de música ao vivo,
        observância dos limites municipais de emissão sonora, condições de
        segurança, prevenção de incêndio, controle de lotação e fornecimento
        regular de energia elétrica.

        Parágrafo primeiro. A impossibilidade de realização da apresentação por
        irregularidade do local, interdição, embargo ou reclamação de vizinhança
        é imputável ao CONTRATANTE e equipara-se a cancelamento por ele
        promovido, com as consequências previstas na cláusula de cancelamento.

        Parágrafo segundo. O CONTRATADO não responde por danos causados a
        terceiros no local da apresentação, salvo quando decorrentes de conduta
        dolosa ou culposa comprovadamente sua ou de seus integrantes.
      `,
    },
  ],
};

export const EQUIPAMENTOS_DANOS_CLAUSE: ClauseDefinition = {
  key: "equipamentos_danos",
  category: "responsabilidade",
  required: true,
  legal_note:
    "Guarda e dano recíproco. O ponto sensível é o instrumento deixado no " +
    "local antes ou depois do show, situação corriqueira e quase nunca " +
    "acordada — a cláusula exige acordo escrito em vez de presumir a guarda.",
  variants: [
    {
      variant_id: "equipamentos_danos.padrao.formal",
      tone: "formal",
      applicability: {},
      consumes: [],
      title: "Dos equipamentos e dos danos",
      body: () => `
        Cada parte responde pelos danos que causar, por si ou por seus prepostos,
        aos equipamentos e instalações da outra, obrigando-se ao reparo ou à
        indenização correspondente.

        Parágrafo primeiro. O CONTRATANTE não assume a guarda dos instrumentos e
        equipamentos do CONTRATADO, salvo mediante acordo escrito específico que
        delimite período e condições.

        Parágrafo segundo. O CONTRATADO obriga-se a utilizar os equipamentos
        disponibilizados pelo CONTRATANTE de forma diligente e conforme sua
        destinação, respondendo por danos decorrentes de uso inadequado.
      `,
    },
  ],
};

export const TRIBUTOS_CLAUSE: ClauseDefinition = {
  key: "tributos",
  category: "responsabilidade",
  required: true,
  legal_note:
    "🔑 A cláusula ALOCA responsabilidade tributária; a plataforma não EXECUTA " +
    "nenhuma obrigação fiscal — não retém, não recolhe, não emite nota e não " +
    "presta informação por ninguém. A distinção é o ponto: dizer de quem é a " +
    "obrigação custa uma cláusula e protege as duas partes; assumir a " +
    "obrigação criaria um passivo que a SoundMeet não tem e não quer. " +
    "Por isso o texto fala em 'retenções exigidas pela legislação vigente', " +
    "sem citar percentual nem mecanismo: ele repete o que a lei já impõe ao " +
    "contratante, em vez de afirmar uma regra fiscal que pode mudar. " +
    "⚠️ Confirmar com contador: a retenção previdenciária na fonte é " +
    "obrigação da EMPRESA que contrata contribuinte individual (art. 4º da " +
    "Lei 10.666/2003); pessoa física em geral não retém, e há hipóteses de " +
    "equiparação a empresa (IN RFB 971). ISS retido segue legislação " +
    "municipal. " +
    "🔑 São TRÊS variantes porque a retenção depende dos dois lados. " +
    "`contratado_pj` cobre o músico com CNPJ de MEI: pessoa jurídica não é " +
    "contribuinte individual nessa relação, emite nota e recolhe pelo DAS, " +
    "então NÃO há retenção previdenciária — e por isso ela não olha a " +
    "natureza do contratante, enquanto as outras duas precisam declarar " +
    "`contracted_is_company: false` para não colidir. " +
    "A variante `contratante_pf` é COSTURA, não opção viva: hoje " +
    "`Establishment` só tem CNPJ (não existe campo de CPF), então nenhum " +
    "contrato real a seleciona. Ela existe pronta para o dia em que a " +
    "plataforma aceitar estabelecimento pessoa física — apagar texto jurídico " +
    "já escrito para satisfazer pureza de código sairia mais caro que mantê-lo.",
  variants: [
    /*
     * MEI primeiro, e de propósito: quando o CONTRATADO é pessoa jurídica a
     * retenção previdenciária não existe, seja o contratante PF ou PJ — então
     * esta variante não precisa olhar o outro lado, enquanto as duas abaixo
     * precisam declarar `contracted_is_company: false` para não colidirem
     * com ela. Sem essa exclusão, o contrato de um músico MEI mandaria o bar
     * reter INSS de quem não é contribuinte individual.
     */
    {
      variant_id: "tributos.contratado_pj.formal",
      tone: "formal",
      applicability: { contracted_is_company: true },
      consumes: ["plataforma_nome"],
      title: "Dos tributos e da nota fiscal",
      body: (v) => `
        Cada parte é responsável pelos tributos que lhe sejam legalmente
        atribuídos em razão deste contrato.

        Parágrafo primeiro. Sendo o CONTRATADO pessoa jurídica, a remuneração
        será paga contra a emissão do documento fiscal correspondente, cabendo
        ao próprio CONTRATADO o recolhimento dos tributos incidentes sobre sua
        atividade, na forma do regime a que estiver submetido. Não há retenção
        de contribuição previdenciária na fonte, por não se tratar de
        contratação de contribuinte individual.

        Parágrafo segundo. Eventual retenção de Imposto Sobre Serviços observará
        a legislação do município do local da apresentação, quando exigível do
        CONTRATANTE.

        Parágrafo terceiro. A emissão de documento fiscal compete ao CONTRATADO,
        não cabendo à ${v.plataforma_nome} emiti-lo, recolher tributos ou
        prestar informação fiscal por qualquer das partes.
      `,
    },
    {
      variant_id: "tributos.contratante_pj.formal",
      tone: "formal",
      applicability: {
        contractor_is_company: true,
        contracted_is_company: false,
      },
      consumes: ["plataforma_nome"],
      title: "Dos tributos e das retenções",
      body: (v) => `
        Cada parte é responsável pelos tributos que lhe sejam legalmente
        atribuídos em razão deste contrato.

        Parágrafo primeiro. Sendo o CONTRATANTE pessoa jurídica e o CONTRATADO
        contribuinte individual, o CONTRATANTE efetuará as retenções na fonte
        exigidas pela legislação vigente, notadamente a contribuição
        previdenciária, deduzindo-as do valor a ser pago e recolhendo-as nos
        prazos legais, com a devida comprovação ao CONTRATADO.

        Parágrafo segundo. Eventual retenção de Imposto Sobre Serviços observará
        a legislação do município do local da apresentação.

        Parágrafo terceiro. A emissão de documento fiscal, quando exigível,
        compete a quem a legislação atribuir, não cabendo à ${v.plataforma_nome}
        emiti-lo, recolher tributos ou prestar informação fiscal por qualquer
        das partes.
      `,
    },
    {
      variant_id: "tributos.contratante_pf.formal",
      tone: "formal",
      applicability: {
        contractor_is_company: false,
        contracted_is_company: false,
      },
      consumes: ["plataforma_nome"],
      title: "Dos tributos",
      body: (v) => `
        Cada parte é responsável pelos tributos que lhe sejam legalmente
        atribuídos em razão deste contrato, arcando o CONTRATADO com a
        tributação incidente sobre a remuneração recebida.

        Parágrafo único. A emissão de documento fiscal, quando exigível, compete
        a quem a legislação atribuir, não cabendo à ${v.plataforma_nome}
        emiti-lo, recolher tributos ou prestar informação fiscal por qualquer das
        partes.
      `,
    },
  ],
};
