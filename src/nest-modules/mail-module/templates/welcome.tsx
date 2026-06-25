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

export type WelcomeProps = {
  name: string;
  role: "musician" | "establishment" | "audience";
  profileUrl: string;
};

const roleMessages: Record<WelcomeProps["role"], string> = {
  musician:
    "Crie seu perfil, conecte-se com estabelecimentos, receba pedidos musicais e gorjetas PIX em tempo real.",
  establishment:
    "Gerencie seus eventos, encontre músicos incríveis e encante seu público com experiências únicas.",
  audience:
    "Descubra músicos ao vivo, faça pedidos musicais e envie gorjetas PIX para seus artistas favoritos.",
};

export function Welcome({ name, role, profileUrl }: WelcomeProps) {
  return (
    <Html>
      <Head />
      <Preview>Bem-vindo ao SoundMeet, {name}!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🎵 Bem-vindo ao SoundMeet!</Heading>
          <Text style={text}>Olá, {name}!</Text>
          <Text style={text}>
            Sua conta foi criada com sucesso. {roleMessages[role]}
          </Text>
          <Section style={btnContainer}>
            <Button style={btn} href={profileUrl}>
              Completar meu perfil
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            Se você tiver dúvidas, entre em contato com nosso suporte.
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
