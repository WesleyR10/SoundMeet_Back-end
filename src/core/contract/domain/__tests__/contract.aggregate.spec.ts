import { Uuid } from "../../../shared/domain";
import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { Contract } from "../contract.aggregate";
import { ContractSignCommand } from "../contract.aggregate";
import { ContractFakeBuilder } from "../contract-fake.builder";
import { ContractAnnulledEvent } from "../events/contract-annulled.event";
import { ContractIssuedEvent } from "../events/contract-issued.event";
import { ContractSignedEvent } from "../events/contract-signed.event";
import { ContractParty } from "../value-objects/contract-party.vo";

const NOW = new Date("2026-08-15T14:00:00Z");

function signCommand(
  overrides: Partial<ContractSignCommand> = {},
): ContractSignCommand {
  return {
    role: "contractor",
    signer_user_id: "9f0f0000-0000-4000-8000-000000000001",
    signed_at: NOW,
    ip: "203.0.113.10",
    ip_source: "direct",
    forwarded_for: null,
    user_agent: "Mozilla/5.0",
    ...overrides,
  };
}

describe("Contract", () => {
  describe("emissão", () => {
    it("nasce issued e emite ContractIssuedEvent", () => {
      const contract = ContractFakeBuilder.aContract().build();

      expect(contract.status).toBe("issued");
      expect(contract.signatures).toEqual([]);
      expect(contract.signed_at).toBeNull();

      const created = Contract.create({
        booking_id: new Uuid().id,
        establishment_id: new Uuid().id,
        musician_id: new Uuid().id,
        template_version: contract.template_version,
        contractor: contract.contractor,
        contracted: contract.contracted,
        clauses: contract.clauses,
        variables: contract.variables,
        verification_code: "ABC123",
      });

      const events = Array.from(created.events);
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ContractIssuedEvent);
    });

    it("recusa contrato sem contratado, e recusa os dois ao mesmo tempo", () => {
      const base = ContractFakeBuilder.aContract().build();
      const command = {
        booking_id: new Uuid().id,
        establishment_id: new Uuid().id,
        template_version: base.template_version,
        contractor: base.contractor,
        contracted: base.contracted,
        clauses: base.clauses,
        variables: base.variables,
        verification_code: "ABC123",
      };

      expect(() => Contract.create(command)).toThrow(EntityValidationError);
      expect(() =>
        Contract.create({
          ...command,
          musician_id: new Uuid().id,
          band_id: new Uuid().id,
        }),
      ).toThrow(EntityValidationError);
    });

    it("recusa contrato sem cláusulas", () => {
      const base = ContractFakeBuilder.aContract().build();

      expect(() =>
        Contract.create({
          booking_id: new Uuid().id,
          establishment_id: new Uuid().id,
          musician_id: new Uuid().id,
          template_version: base.template_version,
          contractor: base.contractor,
          contracted: base.contracted,
          clauses: [],
          variables: base.variables,
          verification_code: "ABC123",
        }),
      ).toThrow(EntityValidationError);
    });
  });

  describe("content_hash", () => {
    it("é determinístico para o mesmo conteúdo", () => {
      const a = ContractFakeBuilder.aContract().build();
      const b = ContractFakeBuilder.aContract().build();

      // Ids e código de verificação diferem; o conteúdo, não.
      expect(a.content_hash).toBe(b.content_hash);
      expect(a.content_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("muda quando qualquer parte do conteúdo muda", () => {
      const base = ContractFakeBuilder.aContract().build();
      const outro = ContractFakeBuilder.aContract()
        .withVariables(
          ContractFakeBuilder.defaultVariables({
            cache_formatado: "R$ 9.999,00",
          }),
        )
        .build();

      expect(outro.content_hash).not.toBe(base.content_hash);
    });

    /**
     * O hash é do CONTEÚDO, não do arquivo: dois contratos idênticos em
     * cláusulas e variáveis têm o mesmo hash mesmo com documentos distintos no
     * storage. É o que permite conferir o texto sem depender do PDF.
     */
    it("ignora o documento armazenado", () => {
      const semDocumento = ContractFakeBuilder.aContract().build();
      const comDocumento = ContractFakeBuilder.aContract()
        .withDocumentKey("contracts/a/b/c/contrato-r1.pdf")
        .build();

      expect(comDocumento.content_hash).toBe(semDocumento.content_hash);
    });
  });

  describe("assinatura", () => {
    it("a primeira assinatura deixa o contrato parcialmente assinado", () => {
      const contract = ContractFakeBuilder.aContract().build();

      contract.sign(signCommand({ role: "contractor" }));

      expect(contract.notification.hasErrors()).toBe(false);
      expect(contract.status).toBe("partially_signed");
      expect(contract.signed_at).toBeNull();
      expect(Array.from(contract.events)).toHaveLength(0);
    });

    it("a segunda assinatura fecha o contrato e emite ContractSignedEvent", () => {
      const contract = ContractFakeBuilder.aContract().build();

      contract.sign(signCommand({ role: "contractor" }));
      contract.sign(signCommand({ role: "contracted" }));

      expect(contract.status).toBe("signed");
      expect(contract.signed_at).toEqual(NOW);
      expect(contract.isFullySigned).toBe(true);

      const events = Array.from(contract.events);
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ContractSignedEvent);
    });

    it("recusa a segunda assinatura do mesmo lado", () => {
      const contract = ContractFakeBuilder.aContract().build();

      contract.sign(signCommand({ role: "contractor" }));
      contract.sign(signCommand({ role: "contractor" }));

      expect(contract.notification.hasErrors()).toBe(true);
      expect(contract.signatures).toHaveLength(1);
      expect(contract.status).toBe("partially_signed");
    });

    it("recusa assinatura de contrato anulado", () => {
      const contract = ContractFakeBuilder.aContract().build();
      contract.annul("Dados incorretos", NOW);

      contract.sign(signCommand());

      expect(contract.notification.hasErrors()).toBe(true);
      expect(contract.signatures).toEqual([]);
    });

    /**
     * 🔴 A regressão que protege contra assinar com nome alheio: nome e
     * documento vêm do snapshot congelado, nunca do comando. O comando só traz
     * a prova de contexto (quem estava autenticado, quando, de onde).
     */
    it("copia nome e documento da parte congelada, não do comando", () => {
      const contract = ContractFakeBuilder.aContract().build();

      contract.sign(signCommand({ role: "contracted" }));

      const assinatura = contract.signatureOf("contracted")!;
      expect(assinatura.signer_name).toBe(contract.contracted.legal_name);
      expect(assinatura.signer_document).toBe(contract.contracted.document);
      expect(assinatura.signer_email).toBe(contract.contracted.email);
    });

    it("quando há representante, é ele quem consta como signatário", () => {
      const contract = ContractFakeBuilder.aContract().build();

      contract.sign(signCommand({ role: "contractor" }));

      const assinatura = contract.signatureOf("contractor")!;
      expect(assinatura.signer_name).toBe("José da Silva");
      expect(assinatura.signer_document).toBe("98765432100");
    });

    /**
     * 🔴 Músico MEI (14/set/2026). A parte é pessoa jurídica SEM representante
     * nomeado, e o `document` dela é o CNPJ. O fallback copiava esse CNPJ para
     * `signer_document` — que é CPF — e o `ContractSignature` LANÇAVA: o MEI
     * não conseguia assinar o próprio contrato. O CPF de quem assinou não é
     * conhecido aqui, e o campo manda deixar `null` em vez de derivar; a
     * identidade da assinatura vem de `signer_user_id`.
     *
     * Só apareceu assinando pelo seed um contrato emitido pelo use-case real.
     */
    it("parte PJ sem representante (MEI) assina com documento do signatário nulo, nunca o CNPJ", () => {
      const mei = ContractParty.fromJSON({
        ...ContractFakeBuilder.defaultContracted().toJSON(),
        kind: "company",
        document: "11222333000181",
        representative: null,
      });
      const contract = ContractFakeBuilder.aContract()
        .withContracted(mei)
        .build();

      contract.sign(signCommand({ role: "contracted" }));

      expect(contract.notification.hasErrors()).toBe(false);
      const assinatura = contract.signatureOf("contracted")!;
      expect(assinatura.signer_name).toBe(mei.legal_name);
      expect(assinatura.signer_document).toBeNull();
    });

    /**
     * Todo o soundmeet-web sai de um IP só. Registrar a procedência é o que
     * impede a trilha de afirmar que sabe o IP do signatário quando não sabe.
     */
    it("registra a procedência do IP junto com o IP", () => {
      const contract = ContractFakeBuilder.aContract().build();

      contract.sign(
        signCommand({
          role: "contracted",
          ip: "10.0.0.5",
          ip_source: "proxied",
          forwarded_for: "203.0.113.7, 10.0.0.5",
        }),
      );

      const assinatura = contract.signatureOf("contracted")!;
      expect(assinatura.ip).toBe("10.0.0.5");
      expect(assinatura.ip_source).toBe("proxied");
      expect(assinatura.forwarded_for).toBe("203.0.113.7, 10.0.0.5");
    });
  });

  describe("certificado de assinatura", () => {
    it("só pode ser anexado depois das duas assinaturas", () => {
      const contract = ContractFakeBuilder.aContract().build();

      contract.attachCertificate("contracts/a/b/c/certificado.pdf");
      expect(contract.notification.hasErrors()).toBe(true);
      expect(contract.certificate_key).toBeNull();

      contract.notification.errors.clear();
      contract.sign(signCommand({ role: "contractor" }));
      contract.sign(signCommand({ role: "contracted" }));
      contract.attachCertificate("contracts/a/b/c/certificado.pdf");

      expect(contract.certificate_key).toBe("contracts/a/b/c/certificado.pdf");
    });
  });

  describe("anulação", () => {
    it("anula contrato ainda não assinado e emite evento", () => {
      const contract = ContractFakeBuilder.aContract().build();

      contract.annul("Cachê registrado errado", NOW);

      expect(contract.status).toBe("annulled");
      expect(contract.annul_reason).toBe("Cachê registrado errado");
      expect(contract.annulled_at).toEqual(NOW);
      expect(Array.from(contract.events)[0]).toBeInstanceOf(
        ContractAnnulledEvent,
      );
    });

    it("anula contrato parcialmente assinado", () => {
      const contract = ContractFakeBuilder.aContract().build();
      contract.sign(signCommand({ role: "contractor" }));

      contract.annul("Show remarcado antes do aceite do artista", NOW);

      expect(contract.status).toBe("annulled");
    });

    /**
     * 🔴 A invariante que sustenta o valor probatório: contrato assinado é
     * prova, e anular apagaria justamente a evidência que ele existe para
     * produzir. Show cancelado depois de assinado é fato do Booking.
     */
    it("RECUSA anular contrato assinado", () => {
      const contract = ContractFakeBuilder.aContract().build();
      contract.sign(signCommand({ role: "contractor" }));
      contract.sign(signCommand({ role: "contracted" }));

      contract.annul("Show cancelado", NOW);

      expect(contract.notification.hasErrors()).toBe(true);
      expect(contract.status).toBe("signed");
      expect(contract.annulled_at).toBeNull();
    });

    it("exige motivo", () => {
      const contract = ContractFakeBuilder.aContract().build();

      contract.annul("   ", NOW);

      expect(contract.notification.hasErrors()).toBe(true);
      expect(contract.status).toBe("issued");
    });

    it("recusa anular duas vezes", () => {
      const contract = ContractFakeBuilder.aContract().build();
      contract.annul("Primeiro motivo", NOW);
      contract.notification.errors.clear();

      contract.annul("Segundo motivo", NOW);

      expect(contract.notification.hasErrors()).toBe(true);
      expect(contract.annul_reason).toBe("Primeiro motivo");
    });
  });

  describe("toJSON", () => {
    it("serializa o snapshot inteiro", () => {
      const contract = ContractFakeBuilder.aContract().build();
      contract.sign(signCommand({ role: "contractor" }));

      const json = contract.toJSON();

      expect(json.contract_id).toBe(contract.contract_id.id);
      expect(json.status).toBe("partially_signed");
      expect(json.clauses).toHaveLength(contract.clauses.length);
      expect(json.signatures).toHaveLength(1);
      expect(json.contractor.document).toBe("12345678000190");
      expect(json.variables.cache_formatado).toBe("R$ 1.500,00");
      expect(json.content_hash).toBe(contract.content_hash);
    });
  });
});
