import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export type ContractDocumentProps = {
  partyName: string;
  /** "CONTRATANTE" ou "CONTRATADO", como consta no documento. */
  roleLabel: string;
  counterpartyName: string;
  moment: "issued" | "signed";
  verificationCode: string;
  verificationUrl: string;
  contentHash: string;
  showDate: string;
  localName: string;
  feeFormatted: string;
};

/**
 * Entrega do contrato com o PDF anexo.
 *
 * 🔑 **O hash aparece no corpo, não só dentro do PDF.** Hash impresso apenas no
 * anexo prova pouco: se o arquivo foi adulterado, o hash dentro dele foi junto.
 * No corpo do e-mail, ele fica numa cópia que o destinatário guarda e que não
 * passa mais pelas nossas mãos — dá para conferir na página pública a qualquer
 * momento, inclusive anos depois.
 *
 * O link vai para a **verificação pública**, não para uma ação. Não há botão de
 * assinar: o e-mail de assinatura é outro, e treinar o usuário a assinar a
 * partir de link recebido é abrir a porta do phishing.
 */
export function ContractDocument({
  partyName,
  roleLabel,
  counterpartyName,
  moment,
  verificationCode,
  verificationUrl,
  contentHash,
  showDate,
  localName,
  feeFormatted,
}: ContractDocumentProps) {
  const assinado = moment === "signed";

  return (
    <Html>
      <Head />
      <Preview>
        {assinado
          ? `Contrato ${verificationCode} assinado pelas duas partes`
          : `Contrato ${verificationCode} emitido — falta assinar`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>SoundMeet</Heading>
          <Text style={text}>Olá, {partyName}!</Text>

          {assinado ? (
            <Text style={text}>
              O contrato do show foi <strong>assinado pelas duas partes</strong>
              . O documento completo, com o certificado de assinatura, está
              anexo a este e-mail — guarde-o.
            </Text>
          ) : (
            <Text style={text}>
              O contrato do show foi emitido e está anexo a este e-mail.{" "}
              <strong>Ele ainda precisa ser assinado pelas duas partes</strong>,
              pelo aplicativo ou pelo painel.
            </Text>
          )}

          <Section style={box}>
            <Row>
              <Text style={label}>Você é</Text>
              <Text style={value}>{roleLabel}</Text>
            </Row>
            <Row>
              <Text style={label}>Com</Text>
              <Text style={value}>{counterpartyName}</Text>
            </Row>
            <Row>
              <Text style={label}>Apresentação</Text>
              <Text style={value}>
                {showDate} — {localName}
              </Text>
            </Row>
            <Row>
              <Text style={label}>Valor</Text>
              <Text style={value}>{feeFormatted}</Text>
            </Row>
          </Section>

          <Text style={text}>
            Para conferir a autenticidade a qualquer momento, use o código{" "}
            <strong>{verificationCode}</strong> em{" "}
            <Link href={verificationUrl} style={link}>
              {verificationUrl}
            </Link>
            .
          </Text>

          <Text style={hashLabel}>
            Resumo criptográfico (SHA-256) do conteúdo:
          </Text>
          <Text style={hashStyle}>{contentHash}</Text>
          <Text style={footnote}>
            Qualquer alteração no documento produz um resumo diferente. Guarde
            este e-mail: ele é a sua cópia independente do instrumento.
          </Text>

          <Hr style={hr} />
          <Text style={footer}>
            A SoundMeet não é parte deste contrato. Ela fornece a ferramenta que
            o gerou, guarda o registro e mantém a sua integridade.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 48px 48px",
  maxWidth: "600px",
};
const h1 = { color: "#1a1a1a", fontSize: "24px", fontWeight: "bold" };
const text = { color: "#333", fontSize: "16px", lineHeight: "24px" };
const box = {
  backgroundColor: "#f4f4f5",
  borderRadius: "6px",
  margin: "24px 0",
  padding: "16px 20px",
};
const label = {
  color: "#8898aa",
  fontSize: "12px",
  margin: "0",
  textTransform: "uppercase" as const,
};
const value = { color: "#1a1a1a", fontSize: "15px", margin: "0 0 12px" };
const link = { color: "#7c3aed" };
const hashLabel = { color: "#8898aa", fontSize: "12px", margin: "24px 0 4px" };
const hashStyle = {
  color: "#1a1a1a",
  fontFamily: "monospace",
  fontSize: "12px",
  margin: "0",
  wordBreak: "break-all" as const,
};
const footnote = { color: "#8898aa", fontSize: "12px", margin: "8px 0 0" };
const hr = { borderColor: "#e6ebf1", margin: "32px 0" };
const footer = { color: "#8898aa", fontSize: "12px" };
