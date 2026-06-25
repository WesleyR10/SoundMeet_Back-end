import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

export type BookingConfirmedProps = {
  recipientName: string;
  otherPartyName: string;
  role: "musician" | "establishment";
  eventDate: string;
  startTime: string;
  endTime: string;
  fee: string;
  location?: string | null;
};

export function BookingConfirmed({
  recipientName,
  otherPartyName,
  role,
  eventDate,
  startTime,
  endTime,
  fee,
  location,
}: BookingConfirmedProps) {
  const roleLabel = role === "musician" ? "estabelecimento" : "músico";

  return (
    <Html>
      <Head />
      <Preview>Booking confirmado no SoundMeet</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>✅ Booking confirmado!</Heading>
          <Text style={text}>Olá, {recipientName}!</Text>
          <Text style={text}>
            Seu booking com <strong>{otherPartyName}</strong> ({roleLabel}) foi
            confirmado.
          </Text>
          <Container style={detailsBox}>
            <Text style={detailRow}>
              <strong>Data:</strong> {eventDate}
            </Text>
            <Text style={detailRow}>
              <strong>Horário:</strong> {startTime} – {endTime}
            </Text>
            <Text style={detailRow}>
              <strong>Cachê:</strong> {fee}
            </Text>
            {location && (
              <Text style={detailRow}>
                <strong>Local:</strong> {location}
              </Text>
            )}
          </Container>
          <Hr style={hr} />
          <Text style={footer}>
            Acesse o SoundMeet para ver todos os detalhes do booking.
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
const detailsBox = {
  backgroundColor: "#f8f4ff",
  borderRadius: "8px",
  margin: "16px 0",
  padding: "16px 20px",
};
const detailRow = { color: "#333", fontSize: "15px", margin: "6px 0" };
const hr = { borderColor: "#e6ebf1", margin: "32px 0" };
const footer = { color: "#8898aa", fontSize: "12px" };
