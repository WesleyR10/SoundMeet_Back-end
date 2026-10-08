import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import React from "react";

import { StageTechSpecJSON } from "../../../shared/domain/value-objects/stage-tech-spec.vo";
import {
  ContractCertificateRenderInput,
  ContractRenderInput,
} from "../../application/ports/contract-renderer.port";
import { ContractPartyJSON } from "../../domain/value-objects/contract-party.vo";

/**
 * O documento em si, como componentes React.
 *
 * Fica separado do adapter (`react-pdf-contract.renderer.ts`) porque este
 * arquivo é **layout** e aquele é **integração**: o adapter conhece a porta e o
 * `renderToBuffer`, este conhece tipografia e paginação. Trocar de biblioteca
 * de PDF um dia troca os dois; mudar o desenho do contrato troca só este.
 *
 * Sem fonte externa de propósito: Helvetica é embutida no PDF e cobre o
 * português inteiro em WinAnsi. Registrar um TTF traria +200 KB por documento e
 * uma dependência de rede no boot, sem ganho legível.
 */

const COLORS = {
  ink: "#111827",
  muted: "#6B7280",
  rule: "#D1D5DB",
  accent: "#111827",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: COLORS.ink,
    lineHeight: 1.55,
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 8,
    color: COLORS.muted,
    textAlign: "center",
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
  },
  clauseTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 4,
  },
  paragraph: {
    marginBottom: 5,
    textAlign: "justify",
  },
  partyBlock: {
    marginBottom: 8,
  },
  partyRole: {
    fontFamily: "Helvetica-Bold",
  },
  rule: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.rule,
    marginVertical: 10,
  },
  specRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  specLabel: {
    width: 150,
    color: COLORS.muted,
  },
  specValue: {
    flex: 1,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    fontSize: 7,
    color: COLORS.muted,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.rule,
    paddingTop: 6,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureSlot: {
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.rule,
  },
  signatureName: {
    fontFamily: "Helvetica-Bold",
  },
  mono: {
    fontFamily: "Courier",
    fontSize: 7.5,
  },
});

/** Cada parágrafo do corpo vira um `<Text>` — o VO já refluiu o texto. */
function Paragraphs({ body }: { body: string }) {
  return (
    <>
      {body.split("\n\n").map((paragraph, index) => (
        <Text key={index} style={styles.paragraph}>
          {paragraph}
        </Text>
      ))}
    </>
  );
}

function PartyQualification({
  label,
  party,
}: {
  label: string;
  party: ContractPartyJSON;
}) {
  const documento =
    party.kind === "company"
      ? `CNPJ nº ${formatDocument(party)}`
      : `CPF nº ${formatDocument(party)}`;

  /*
   * Sem representante nomeado, o documento diz a verdade: quem assinou está no
   * Anexo II, com conta autenticada, data, IP e agente de acesso. Inventar um
   * nome aqui seria falsificar a qualificação da parte.
   */
  const representante = !party.representative
    ? party.kind === "company"
      ? ", neste ato representada por seu representante legal, identificado no Anexo II — Certificado de Assinatura"
      : ""
    : party.representative.document
      ? `, neste ato representada por ${party.representative.name}, CPF nº ${formatCpf(party.representative.document)}, na qualidade de ${party.representative.title}`
      : `, neste ato representada por ${party.representative.name}, na qualidade de ${party.representative.title}`;

  const nomeFantasia =
    party.display_name && party.display_name !== party.legal_name
      ? ` (“${party.display_name}”)`
      : "";

  return (
    <View style={styles.partyBlock}>
      <Text style={styles.paragraph}>
        <Text style={styles.partyRole}>{label}: </Text>
        {party.legal_name}
        {nomeFantasia}, inscrit{party.kind === "company" ? "a" : "o"} no{" "}
        {documento}, com endereço em {formatAddress(party)}, e-mail{" "}
        {party.email}
        {representante}.
      </Text>
    </View>
  );
}

function formatDocument(party: ContractPartyJSON): string {
  return party.kind === "company"
    ? party.document.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        "$1.$2.$3/$4-$5",
      )
    : formatCpf(party.document);
}

function formatCpf(document: string): string {
  return document.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function formatAddress(party: ContractPartyJSON): string {
  const { street, number, complement, neighborhood, city, state, zip_code } =
    party.address;
  return [
    `${street}, ${number}`,
    complement,
    neighborhood,
    `${city}/${state}`,
    `CEP ${zip_code}`,
  ]
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(" — ");
}

function Footer({
  verificationCode,
  contentHash,
  verificationUrl,
}: {
  verificationCode: string;
  contentHash: string;
  verificationUrl: string;
}) {
  return (
    <View style={styles.footer} fixed>
      <View style={styles.footerRow}>
        <Text>
          Código de verificação {verificationCode} — confira em{" "}
          {verificationUrl}
        </Text>
        <Text
          render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`}
        />
      </View>
      <Text style={styles.mono}>SHA-256 {contentHash}</Text>
    </View>
  );
}

/**
 * Linhas do Anexo I.
 *
 * ⚠️ **Espelhado em `soundmeet-web/src/features/contract/domain/stage-spec-rows.ts`.**
 * Os dois renderizam o MESMO anexo do MESMO snapshot congelado — se a ordem, os
 * rótulos ou a formatação divergirem, quem leu o contrato no painel e quem leu o
 * PDF viram documentos diferentes, num instrumento cuja cláusula transforma
 * "item declarado no Anexo I" em inadimplemento. Há teste de paridade nos dois
 * lados; mexeu aqui, mexa lá.
 *
 * Exportado só para o teste — o componente é o único consumidor de produção.
 */
export const STAGE_SPEC_LABELS: {
  key: keyof StageTechSpecJSON;
  label: string;
  format: (value: any) => string | null;
}[] = [
  {
    key: "hasPa",
    label: "Sistema de PA",
    format: (v) => (v === null ? null : v ? "Sim" : "Não"),
  },
  {
    key: "mixerChannels",
    label: "Canais na mesa",
    format: (v) => (v === null ? null : String(v)),
  },
  {
    key: "monitors",
    label: "Retornos de palco",
    format: (v) => (v === null ? null : String(v)),
  },
  {
    key: "hasMicrophones",
    label: "Microfones",
    format: (v) => (v === null ? null : String(v)),
  },
  {
    key: "backline",
    label: "Backline",
    format: (v: string[]) => (v && v.length > 0 ? v.join(", ") : null),
  },
  {
    key: "dimensions",
    label: "Dimensões do palco",
    format: (v) =>
      v
        ? [
            v.widthM ? `${v.widthM} m de largura` : null,
            v.depthM ? `${v.depthM} m de profundidade` : null,
            v.heightM ? `${v.heightM} m de altura` : null,
          ]
            .filter(Boolean)
            .join(" × ") || null
        : null,
  },
  {
    key: "power",
    label: "Energia",
    format: (v) =>
      v
        ? [
            v.outlets ? `${v.outlets} tomadas` : null,
            v.voltage ? `${v.voltage}` : null,
          ]
            .filter(Boolean)
            .join(" — ") || null
        : null,
  },
  {
    key: "hasSoundEngineer",
    label: "Operador de som",
    format: (v) => (v === null ? null : v ? "Sim" : "Não"),
  },
  {
    key: "hasParking",
    label: "Estacionamento",
    format: (v) => (v === null ? null : v ? "Sim" : "Não"),
  },
  {
    key: "soundcheckWindow",
    label: "Janela de passagem de som",
    format: (v) => v ?? null,
  },
  { key: "notes", label: "Observações", format: (v) => v ?? null },
];

function StageTechSpecAnnex({ spec }: { spec: StageTechSpecJSON }) {
  const rows = STAGE_SPEC_LABELS.map(({ key, label, format }) => ({
    label,
    value: format(spec[key]),
  })).filter((row): row is { label: string; value: string } =>
    Boolean(row.value),
  );

  return (
    <View break>
      <Text style={styles.sectionTitle}>ANEXO I — FICHA TÉCNICA DO PALCO</Text>
      <Text style={styles.paragraph}>
        Estrutura declarada pelo CONTRATANTE. Integra este instrumento para
        todos os fins; a ausência, no dia da apresentação, de item aqui
        declarado constitui inadimplemento.
      </Text>
      <View style={styles.rule} />
      {rows.map((row) => (
        <View key={row.label} style={styles.specRow}>
          <Text style={styles.specLabel}>{row.label}</Text>
          <Text style={styles.specValue}>{row.value}</Text>
        </View>
      ))}
      {rows.length === 0 && (
        <Text style={styles.paragraph}>
          Nenhum item foi declarado pelo CONTRATANTE.
        </Text>
      )}
    </View>
  );
}

export function ContractDocument({ input }: { input: ContractRenderInput }) {
  return (
    <Document
      title={`${input.template_title} — ${input.verification_code}`}
      author={input.variables.plataforma_nome}
      subject="Contrato de prestação de serviços artísticos musicais"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{input.template_title.toUpperCase()}</Text>
        <Text style={styles.subtitle}>
          Instrumento particular · versão {input.template_version} · emitido em{" "}
          {input.variables.emitido_em}
        </Text>

        <Text style={styles.sectionTitle}>DAS PARTES</Text>
        <PartyQualification label="CONTRATANTE" party={input.contractor} />
        <PartyQualification label="CONTRATADO" party={input.contracted} />
        <Text style={styles.paragraph}>
          As partes acima qualificadas têm entre si justo e contratado o
          seguinte:
        </Text>

        <View style={styles.rule} />

        {input.clauses.map((clause) => (
          <View key={clause.variant_id} wrap={false}>
            <Text style={styles.clauseTitle}>
              CLÁUSULA {clause.number}ª — {clause.title.toUpperCase()}
            </Text>
            <Paragraphs body={clause.body} />
          </View>
        ))}

        <View style={styles.signatureSlot} wrap={false}>
          <Text style={styles.sectionTitle}>DA ASSINATURA</Text>
          <Text style={styles.paragraph}>
            Este instrumento é assinado eletronicamente pelas partes na
            plataforma {input.variables.plataforma_nome}. A identificação dos
            signatários, o instante de cada aceite e a respectiva trilha de
            auditoria constam do Anexo II — Certificado de Assinatura, emitido
            após a manifestação de ambas as partes.
          </Text>
          <Text style={styles.paragraph}>
            {input.variables.comarca}, {input.variables.emitido_em}.
          </Text>
        </View>

        {/*
          O anexo vem do snapshot congelado, não do perfil vivo — é o que o põe
          dentro do `content_hash`. Ausente (nunca `null`) quando a casa não
          preencheu a ficha; nesse caso a cláusula de estrutura já escolheu a
          variante que não referencia anexo nenhum, e imprimir um anexo vazio
          contradiria o próprio texto.
        */}
        {input.variables.ficha_tecnica_anexo && (
          <StageTechSpecAnnex spec={input.variables.ficha_tecnica_anexo} />
        )}

        <Footer
          verificationCode={input.verification_code}
          contentHash={input.content_hash}
          verificationUrl={input.verification_url}
        />
      </Page>
    </Document>
  );
}

const IP_SOURCE_LABEL: Record<string, string> = {
  direct: "conexão direta",
  proxied: "por proxy da plataforma",
  unknown: "origem não determinada",
};

const ROLE_LABEL: Record<string, string> = {
  contractor: "CONTRATANTE",
  contracted: "CONTRATADO",
};

export function ContractCertificateDocument({
  input,
}: {
  input: ContractCertificateRenderInput;
}) {
  return (
    <Document
      title={`Certificado de assinatura — ${input.verification_code}`}
      author={input.variables.plataforma_nome}
      subject="Certificado de assinatura eletrônica"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          ANEXO II — CERTIFICADO DE ASSINATURA ELETRÔNICA
        </Text>
        <Text style={styles.subtitle}>
          Emitido por {input.variables.plataforma_nome} · código{" "}
          {input.verification_code}
        </Text>

        <Text style={styles.paragraph}>
          Este certificado registra as manifestações de aceite do documento “
          {input.template_title}”, versão {input.template_version}, celebrado
          entre {input.contractor.legal_name} e {input.contracted.legal_name}.
        </Text>

        <Text style={styles.sectionTitle}>DOCUMENTO ASSINADO</Text>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Resumo criptográfico</Text>
          <Text style={[styles.specValue, styles.mono]}>
            SHA-256 {input.content_hash}
          </Text>
        </View>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Verificação pública</Text>
          <Text style={styles.specValue}>{input.verification_url}</Text>
        </View>
        <Text style={styles.paragraph}>
          Qualquer alteração no conteúdo do documento produz resumo distinto e
          é, por isso, detectável.
        </Text>

        <Text style={styles.sectionTitle}>MANIFESTAÇÕES DE ACEITE</Text>
        {input.signatures.map((signature) => (
          <View key={signature.role} style={styles.signatureSlot} wrap={false}>
            <Text style={styles.signatureName}>
              {ROLE_LABEL[signature.role] ?? signature.role} —{" "}
              {signature.signer_name}
            </Text>
            {signature.signer_document && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>CPF</Text>
                <Text style={styles.specValue}>
                  {formatCpf(signature.signer_document)}
                </Text>
              </View>
            )}
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>E-mail</Text>
              <Text style={styles.specValue}>{signature.signer_email}</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Identificador da conta</Text>
              <Text style={[styles.specValue, styles.mono]}>
                {signature.signer_user_id}
              </Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Data e hora do aceite</Text>
              <Text style={styles.specValue}>{signature.signed_at}</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Endereço de rede</Text>
              <Text style={styles.specValue}>
                {signature.ip ?? "não registrado"} (
                {IP_SOURCE_LABEL[signature.ip_source] ?? signature.ip_source})
              </Text>
            </View>
            {signature.forwarded_for && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Cadeia de encaminhamento</Text>
                <Text style={[styles.specValue, styles.mono]}>
                  {signature.forwarded_for}
                </Text>
              </View>
            )}
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Agente de acesso</Text>
              <Text style={styles.specValue}>
                {signature.user_agent ?? "não registrado"}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.rule} />
        <Text style={styles.paragraph}>
          As partes reconheceram expressamente a validade da assinatura
          eletrônica deste instrumento, nos termos do art. 10, §2º, da Medida
          Provisória nº 2.200-2/2001.
        </Text>
        <Text style={styles.paragraph}>
          O endereço de rede identificado como “por proxy da plataforma”
          corresponde à infraestrutura que intermediou a requisição, e não
          necessariamente à conexão do signatário. O registro reflete o que foi
          observado pelo servidor.
        </Text>

        <Footer
          verificationCode={input.verification_code}
          contentHash={input.content_hash}
          verificationUrl={input.verification_url}
        />
      </Page>
    </Document>
  );
}
