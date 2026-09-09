import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export type ContractSignatureChallengeProps = {
  partyName: string;
  /** "CONTRATANTE" ou "CONTRATADO", como consta no documento. */
  roleLabel: string;
  code: string;
  expiresInMinutes: number;
  verificationCode: string;
};

/**
 * Código de uso único para assinar o contrato.
 *
 * 🔴 **Sem botão e sem link.** Um e-mail de segundo fator com link clicável é o
 * gabarito do phishing: treina o usuário a clicar em "assine aqui" vindo de
 * e-mail, que é exatamente como o golpe chega depois. O código é digitado na
 * tela que a pessoa já tinha aberto.
 *
 * O código de verificação do contrato aparece para a parte conferir que o
 * e-mail se refere ao documento que ela está assinando, e não a outro.
 */
export function ContractSignatureChallenge({
  partyName,
  roleLabel,
  code,
  expiresInMinutes,
  verificationCode,
}: ContractSignatureChallengeProps) {
  return (
    <Html>
      <Head />
      <Preview>Seu código para assinar o contrato no SoundMeet</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>SoundMeet</Heading>
          <Text style={text}>Olá, {partyName}!</Text>
          <Text style={text}>
            Você está assinando, como <strong>{roleLabel}</strong>, o contrato
            de código <strong>{verificationCode}</strong>. Use o código abaixo
            para concluir:
          </Text>
          <Section style={codeContainer}>
            <Text style={codeStyle}>{code}</Text>
          </Section>
          <Text style={text}>
            O código expira em <strong>{expiresInMinutes} minutos</strong> e
            vale para uma única assinatura.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            A SoundMeet nunca pede este código por telefone, WhatsApp ou e-mail.
            Se você não está assinando nenhum contrato agora, ignore esta
            mensagem e não compartilhe o código com ninguém.
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
const codeContainer = { textAlign: "center" as const, margin: "32px 0" };
const codeStyle = {
  backgroundColor: "#f4f4f5",
  borderRadius: "6px",
  color: "#1a1a1a",
  fontSize: "32px",
  fontWeight: "bold",
  letterSpacing: "8px",
  padding: "16px 24px",
};
const hr = { borderColor: "#e6ebf1", margin: "32px 0" };
const footer = { color: "#8898aa", fontSize: "12px" };
