import { numeroComExtenso } from "../../contract-format";
import { ClauseDefinition } from "../clause.types";
import { plural, req } from "../clause-helpers";

/**
 * Direitos sobre imagem, exclusividade e dados pessoais.
 *
 * As três cláusulas em que o excesso produz nulidade: autorização de imagem sem
 * finalidade e prazo, não concorrência sem limite, e tratamento de dados sem
 * base legal. Os tetos aqui não são conservadorismo — são o que mantém a
 * cláusula de pé.
 */

export const DIREITO_IMAGEM_CLAUSE: ClauseDefinition = {
  key: "direito_imagem",
  category: "direitos",
  required: true,
  legal_note:
    "CC art. 20: o uso da imagem depende de autorização, e autorização sem " +
    "finalidade, prazo e território definidos é atacável. A redação é recíproca " +
    "porque o interesse é mútuo (o bar divulga a atração, o artista divulga o " +
    "show). Uma variante restritiva — para o artista com contrato de imagem " +
    "junto a terceiros — é a próxima adição natural, e entra quando existir o " +
    "campo de preferência que a selecione: variante que nenhum contexto real " +
    "consegue escolher é código morto disfarçado de opção.",
  variants: [
    {
      variant_id: "direito_imagem.reciproca.formal",
      tone: "formal",
      applicability: {},
      consumes: ["imagem_prazo_meses", "local_nome", "contratado_nome"],
      title: "Do direito de imagem",
      body: (v) => `
        As partes autorizam-se reciprocamente, de forma gratuita e não
        exclusiva, a captar e utilizar imagem, voz e nome uma da outra em
        registros da apresentação, exclusivamente para finalidade de divulgação
        institucional das próprias atividades, em meios digitais e impressos, em
        território nacional, pelo prazo de
        ${numeroComExtenso(v.imagem_prazo_meses)}
        ${plural(v.imagem_prazo_meses, "mês", "meses")} contados da data da
        apresentação.

        Parágrafo primeiro. A autorização abrange a divulgação da apresentação de
        ${v.contratado_nome} em ${v.local_nome} e não alcança o uso em
        publicidade paga de terceiros, o licenciamento a terceiros, a
        comercialização de qualquer registro nem a associação a marcas, o que
        dependerá de autorização específica e escrita.

        Parágrafo segundo. Nenhuma das partes poderá utilizar os registros de
        forma que exponha a outra a situação vexatória, ofensiva ou que
        distorça o contexto original.
      `,
    },
  ],
};

export const EXCLUSIVIDADE_RAIO_CLAUSE: ClauseDefinition = {
  key: "exclusividade_raio",
  category: "direitos",
  required: false,
  legal_note:
    "🔴 Restrição à liberdade profissional (CF art. 5º, XIII). Só é sustentável " +
    "se limitada em TEMPO, ESPAÇO e ATIVIDADE, e com contrapartida — por isso " +
    "os tetos são validados em código (`assertExclusivityWithinLegalCap`), não " +
    "apenas escritos. Cláusula opcional e ausente por padrão: exclusividade " +
    "imposta em show de bar é exatamente o tipo de excesso que derruba o " +
    "contrato inteiro por má-fé.",
  variants: [
    {
      variant_id: "exclusividade_raio.opt_in.formal",
      tone: "formal",
      applicability: { exclusivity_requested: true },
      consumes: [
        "exclusividade_raio_km",
        "exclusividade_dias",
        "local_nome",
        "cache_formatado",
      ],
      title: "Da exclusividade territorial temporária",
      body: (v) => {
        const raio = req(v.exclusividade_raio_km, "exclusividade_raio_km");
        const dias = req(v.exclusividade_dias, "exclusividade_dias");

        return `
          Como contrapartida do valor de ${v.cache_formatado} ora ajustado, o
          CONTRATADO obriga-se a não realizar apresentação musical aberta ao
          público, com a mesma formação, em raio de ${numeroComExtenso(raio)}
          ${plural(raio, "quilômetro", "quilômetros")} de ${v.local_nome}, no
          período de ${numeroComExtenso(dias)} ${plural(dias, "dia", "dias")}
          anteriores e ${numeroComExtenso(dias)} ${plural(dias, "dia", "dias")}
          posteriores à data da apresentação.

          Parágrafo primeiro. A restrição é limitada em tempo, espaço e
          atividade, não alcançando ensaios, gravações, aulas, apresentações
          privadas, participações como convidado nem qualquer outra atividade
          profissional do CONTRATADO.

          Parágrafo segundo. Compromissos já assumidos pelo CONTRATADO antes da
          celebração deste contrato ficam expressamente ressalvados.
        `;
      },
    },
  ],
};

export const LGPD_CLAUSE: ClauseDefinition = {
  key: "lgpd",
  category: "direitos",
  required: true,
  legal_note:
    "Lei 13.709/2018 (LGPD). A base legal do tratamento entre as partes é a " +
    "execução de contrato (art. 7º, V) — não consentimento, que seria revogável " +
    "e tornaria o documento instável. Declara também a minimização: no " +
    "instrumento entra apenas o necessário à qualificação das partes. " +
    "🔑 A plataforma é CONTROLADORA, não operadora (corrigido em 15/ago/2026). " +
    "Operador age sob instrução de um controlador; a SoundMeet decidiu " +
    "sozinha que o contrato seria gerado na confirmação do booking, quais " +
    "dados entram nele, por quanto tempo guardar e que haveria página de " +
    "verificação — todas decisões de finalidade, que é o que define o " +
    "controlador (art. 5º, VI). Chamar-se de operadora não afastaria obrigação " +
    "nenhuma (rótulo não muda fato) e ainda sinalizaria desconhecimento ou " +
    "tentativa de esquiva perante a ANPD. Cada parte é controladora dos dados " +
    "que recebe da outra para executar o contrato — controladores " +
    "independentes, cada um por sua finalidade. " +
    "⚠️ Confirmar com advogado se o arranjo é de controladores independentes " +
    "ou de controladoria conjunta (art. 5º, VI c/c art. 42, §1º, II). " +
    "O prazo de 5 anos vem da prescrição da pretensão contratual (CC art. 206, " +
    "§5º, I) e cobre também a janela trabalhista do art. 11 da CLT — o " +
    "contrato é justamente a prova CONTRA a alegação de vínculo, e precisa " +
    "existir enquanto essa ação for possível.",
  variants: [
    {
      variant_id: "lgpd.padrao.formal",
      tone: "formal",
      applicability: {},
      consumes: ["plataforma_nome"],
      title: "Da proteção de dados pessoais",
      body: (v) => `
        As partes tratam os dados pessoais constantes deste instrumento
        exclusivamente para a execução do contrato e o cumprimento de obrigações
        legais e regulatórias, com fundamento no art. 7º, incisos II e V, da Lei
        nº 13.709/2018, limitando-se aos dados necessários à qualificação das
        partes e à comprovação do ajuste.

        Parágrafo primeiro. As partes obrigam-se a não compartilhar tais dados
        com terceiros para finalidade diversa, salvo por determinação legal ou
        de autoridade competente, e a adotar medidas de segurança compatíveis.

        Parágrafo segundo. Cada parte é controladora dos dados pessoais que
        recebe da outra para a execução deste contrato, respondendo pelo
        tratamento que der a eles.

        Parágrafo terceiro. A ${v.plataforma_nome} é controladora dos dados que
        trata para as finalidades próprias da plataforma, entre elas a geração,
        a guarda, a disponibilização e a verificação de integridade deste
        instrumento e da respectiva trilha de auditoria, que mantém pelo prazo
        de 5 (cinco) anos contados da data da apresentação, e envia cópia do
        instrumento assinado às partes.
      `,
    },
  ],
};
