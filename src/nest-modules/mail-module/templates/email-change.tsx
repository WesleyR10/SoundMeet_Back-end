import {
  Body,
  Button,
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

export type EmailChangeProps = {
  name: string;
  newEmail: string;
  confirmationUrl: string;
};

export function EmailChange({ name, newEmail, confirmationUrl }: EmailChangeProps) {
  return (
    <Html>
      <Head />
      <Preview>Confirme seu novo email no SoundMeet</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>SoundMeet</Heading>
          <Text style={text}>Olá, {name}!</Text>
          <Text style={text}>
            Você solicitou a alteração do seu email para{" "}
            <strong>{newEmail}</strong>. Clique no botão abaixo para confirmar.
          </Text>
          <Section style={btnContainer}>
            <Button style={btn} href={confirmationUrl}>
              Confirmar novo email
            </Button>
          </Section>
          <Text style={text}>
            O link expira em <strong>24 horas</strong>. Seu email atual permanece
            ativo até a confirmação.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            Se você não solicitou esta alteração, ignore este email. Seu email não será
            alterado.
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
const btnContainer = { textAlign: "center" as const, margin: "32px 0" };
const btn = {
  backgroundColor: "#7c3aed",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  padding: "12px 24px",
  textDecoration: "none",
};
const hr = { borderColor: "#e6ebf1", margin: "32px 0" };
const footer = { color: "#8898aa", fontSize: "12px" };
