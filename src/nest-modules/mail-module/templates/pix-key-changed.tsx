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

export type PixKeyChangedProps = {
  name: string;
  /** Data/hora legível da alteração (já formatada pelo chamador). */
  changedAt: string;
  /** Horas de carência antes de o saque para a nova chave ser liberado. */
  cooldownHours: number;
};

/**
 * Alerta de segurança: a chave PIX de recebimento foi alterada.
 *
 * O ponto é o caminho de negação — "se não foi você" — porque este email é a
 * metade que USA a janela de carência: ele chega enquanto o saque para a nova
 * chave ainda está bloqueado, dando tempo de o dono reagir a uma troca que não
 * fez.
 */
export function PixKeyChanged({
  name,
  changedAt,
  cooldownHours,
}: PixKeyChangedProps) {
  return (
    <Html>
      <Head />
      <Preview>Sua chave PIX de recebimento foi alterada</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🔐 Sua chave PIX foi alterada</Heading>
          <Text style={text}>Olá, {name}!</Text>
          <Text style={text}>
            A chave PIX de recebimento da sua carteira SoundMeet foi alterada em{" "}
            <strong>{changedAt}</strong>.
          </Text>
          <Section style={alertBox}>
            <Text style={alertText}>
              Por segurança, saques para a nova chave só serão liberados em
              aproximadamente {cooldownHours}h.
            </Text>
          </Section>
          <Text style={text}>
            <strong>Se foi você</strong>, nenhuma ação é necessária — o saque
            fica disponível assim que o prazo passar.
          </Text>
          <Text style={text}>
            <strong>Se não foi você</strong>, sua conta pode ter sido acessada
            por outra pessoa. Troque sua senha imediatamente e entre em contato
            com o suporte antes que o prazo termine.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            Este é um aviso automático de segurança do SoundMeet. Você recebeu
            porque a chave de recebimento da sua conta mudou.
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
const alertBox = {
  backgroundColor: "#fef2f2",
  borderLeft: "4px solid #dc2626",
  borderRadius: "4px",
  margin: "24px 0",
  padding: "12px 16px",
};
const alertText = { color: "#991b1b", fontSize: "15px", lineHeight: "22px" };
const hr = { borderColor: "#e6ebf1", margin: "32px 0" };
const footer = { color: "#8898aa", fontSize: "13px", lineHeight: "20px" };
