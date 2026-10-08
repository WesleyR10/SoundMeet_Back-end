import { Uuid } from "../../../../shared/domain";
import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Contract, ContractId } from "../../../domain/contract.aggregate";
import { ContractStatus } from "../../../domain/contract-types";
import {
  ContractParty,
  ContractPartyJSON,
} from "../../../domain/value-objects/contract-party.vo";
import { ContractSignature } from "../../../domain/value-objects/contract-signature.vo";
import { ContractVariables } from "../../../domain/value-objects/contract-variables.vo";
import { RenderedClause } from "../../../domain/value-objects/rendered-clause.vo";

/**
 * Forma da linha em `contracts`.
 *
 * Os quatro campos `Json` são o snapshot congelado. O mapper é o único ponto do
 * sistema que os reidrata, e reidrata **através dos VOs** — nunca fazendo cast
 * do JSON cru para o tipo. É o que garante que uma linha corrompida (ou de uma
 * versão antiga do formato) falhe na carga em vez de virar um contrato com
 * conteúdo inválido circulando pela aplicação.
 */
export type ContractModel = {
  id: string;
  bookingId: string;
  establishmentId: string;
  musicianId: string | null;
  bandId: string | null;
  revision: number;
  template_version: string;
  status: string;
  parties: unknown;
  clauses: unknown;
  variables: unknown;
  signatures: unknown;
  content_hash: string;
  verification_code: string;
  document_key: string | null;
  certificate_key: string | null;
  issued_at: Date;
  signed_at: Date | null;
  annulled_at: Date | null;
  annul_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * As duas partes na coluna `parties`.
 *
 * Um objeto com chaves nomeadas, não um array: `parties[0]` obrigaria todo
 * leitor a saber qual índice é qual, e a primeira troca de ordem produziria um
 * contrato em que o bar aparece como contratado.
 */
type ContractPartiesJSON = {
  contractor: ContractPartyJSON;
  contracted: ContractPartyJSON;
};

export class ContractModelMapper {
  static toModel(entity: Contract): ContractModel {
    const parties: ContractPartiesJSON = {
      contractor: entity.contractor.toJSON(),
      contracted: entity.contracted.toJSON(),
    };

    return {
      id: entity.contract_id.id,
      bookingId: entity.booking_id.id,
      establishmentId: entity.establishment_id.id,
      musicianId: entity.musician_id?.id ?? null,
      bandId: entity.band_id?.id ?? null,
      revision: entity.revision,
      template_version: entity.template_version,
      status: entity.status,
      parties,
      clauses: entity.clauses.map((clause) => clause.toJSON()),
      variables: entity.variables.toJSON(),
      signatures: entity.signatures.map((signature) => signature.toJSON()),
      content_hash: entity.content_hash,
      verification_code: entity.verification_code,
      document_key: entity.document_key,
      certificate_key: entity.certificate_key,
      issued_at: entity.issued_at,
      signed_at: entity.signed_at,
      annulled_at: entity.annulled_at,
      annul_reason: entity.annul_reason,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: ContractModel): Contract {
    try {
      const parties = ContractModelMapper.asRecord(model.parties, "parties");
      const clauses = ContractModelMapper.asArray(model.clauses, "clauses");
      const signatures = ContractModelMapper.asArray(
        model.signatures,
        "signatures",
      );

      const contract = new Contract({
        contract_id: new ContractId(model.id),
        booking_id: new Uuid(model.bookingId),
        establishment_id: new Uuid(model.establishmentId),
        musician_id: model.musicianId ? new Uuid(model.musicianId) : null,
        band_id: model.bandId ? new Uuid(model.bandId) : null,
        revision: model.revision,
        template_version: model.template_version,
        status: model.status as ContractStatus,
        contractor: ContractParty.fromJSON(parties.contractor),
        contracted: ContractParty.fromJSON(parties.contracted),
        clauses: clauses.map((clause) => RenderedClause.fromJSON(clause)),
        variables: ContractVariables.fromJSON(model.variables),
        signatures: signatures.map((signature) =>
          ContractSignature.fromJSON(signature),
        ),
        content_hash: model.content_hash,
        verification_code: model.verification_code,
        document_key: model.document_key,
        certificate_key: model.certificate_key,
        issued_at: model.issued_at,
        signed_at: model.signed_at,
        annulled_at: model.annulled_at,
        annul_reason: model.annul_reason,
        created_at: model.created_at,
        updated_at: model.updated_at,
      });

      contract.validate();
      if (contract.notification.hasErrors()) {
        throw new LoadEntityError(contract.notification.toJSON());
      }

      /*
       * 🔴 Verificação de integridade na carga.
       *
       * O `content_hash` é recalculado a partir do snapshot recém-reidratado e
       * comparado com o que está gravado. Um contrato cujo conteúdo foi
       * adulterado no banco — por script, por migração malfeita, por acesso
       * indevido — para de carregar aqui, em vez de continuar sendo exibido e
       * assinado como se estivesse íntegro.
       *
       * É barato (um SHA-256 sobre dados já em memória) e é o que dá sentido
       * prático a publicar o hash na página de verificação: se o sistema
       * aceitasse carregar um contrato adulterado, o hash publicado seria
       * decoração.
       */
      const recomputed = Contract.computeContentHash({
        template_version: contract.template_version,
        contractor: contract.contractor,
        contracted: contract.contracted,
        variables: contract.variables,
        clauses: contract.clauses,
      });

      if (recomputed !== contract.content_hash) {
        throw new LoadEntityError([
          {
            content_hash: [
              `Integridade do contrato ${model.id} violada: o conteúdo armazenado não corresponde ao hash registrado`,
            ],
          },
        ]);
      }

      return contract;
    } catch (error) {
      if (error instanceof LoadEntityError) throw error;

      throw new LoadEntityError([
        {
          contract: [
            error instanceof Error
              ? error.message
              : `Não foi possível carregar o contrato ${model.id}`,
          ],
        },
      ]);
    }
  }

  private static asRecord(value: unknown, field: string): any {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new LoadEntityError([
        { [field]: [`Campo "${field}" inválido na linha de contrato`] },
      ]);
    }
    return value;
  }

  private static asArray(value: unknown, field: string): any[] {
    if (!Array.isArray(value)) {
      throw new LoadEntityError([
        { [field]: [`Campo "${field}" deveria ser uma lista`] },
      ]);
    }
    return value;
  }
}
