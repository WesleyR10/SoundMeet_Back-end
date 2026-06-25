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

export type BookingCancelledProps = {
  recipientName: string;
  otherPartyName: string;
  eventDate: string;
  reason?: string | null;
};

export function BookingCancelled({
  recipientName,
  otherPartyName,
  eventDate,
  reason,
}: BookingCancelledProps) {
  return (
    <Html>
      <Head />
      <Preview>Booking cancelado no SoundMeet</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>❌ Booking cancelado</Heading>
          <Text style={text}>Olá, {recipientName}!</Text>
          <Text style={text}>
            O booking com <strong>{otherPartyName}</strong> agendado para{" "}
            <strong>{eventDate}</strong> foi cancelado.
          </Text>
          {reason && (
            <Text style={text}>
              <strong>Motivo:</strong> {reason}
            </Text>
          )}
          <Hr style={hr} />
          <Text style={footer}>
            Acesse o SoundMeet para reagendar ou ver outras oportunidades.
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
const hr = { borderColor: "#e6ebf1", margin: "32px 0" };
const footer = { color: "#8898aa", fontSize: "12px" };
