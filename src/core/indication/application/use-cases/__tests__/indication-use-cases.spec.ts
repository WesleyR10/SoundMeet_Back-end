import { NotFoundError } from "../../../../shared/domain/errors";
import { Indication } from "../../../domain/indication.aggregate";
import { IndicationInMemoryRepository } from "../../../infra/db/in-memory/indication-in-memory.repository";
import { ListEstablishmentIndicationsUseCase } from "../list-establishment-indications/list-establishment-indications.use-case";
import { RecordIndicationUseCase } from "../record-indication/record-indication.use-case";
import { UpdateIndicationStatusUseCase } from "../update-indication-status/update-indication-status.use-case";

const AUDIENCE = "123e4567-e89b-42d3-a456-426614174000";
const MUSICIAN = "223e4567-e89b-42d3-a456-426614174001";
const ESTABLISHMENT = "323e4567-e89b-42d3-a456-426614174002";
const OTHER_ESTABLISHMENT = "423e4567-e89b-42d3-a456-426614174003";

function setup() {
  const repo = new IndicationInMemoryRepository();
  return {
    repo,
    record: new RecordIndicationUseCase(repo),
    list: new ListEstablishmentIndicationsUseCase(repo),
    updateStatus: new UpdateIndicationStatusUseCase(repo),
  };
}

describe("RecordIndicationUseCase", () => {
  it("grava a indicação com a mensagem", async () => {
    const { record, repo } = setup();

    const output = await record.execute({
      audience_id: AUDIENCE,
      musician_id: MUSICIAN,
      establishment_id: ESTABLISHMENT,
      message: "Toca muito",
    });

    expect(output.status).toBe("new");
    expect(output.is_new).toBe(true);
    expect((await repo.findAll()).length).toBe(1);
  });

  /*
   * 🔴 Chamado a partir de um evento de domínio, e eventos podem ser
   * reentregues. Além disso, o mesmo fã indicando o mesmo músico para a mesma
   * casa de novo é a mesma opinião, repetida — não uma indicação nova.
   */
  it("é idempotente por trio — repetir não cria uma segunda linha", async () => {
    const { record, repo } = setup();
    const input = {
      audience_id: AUDIENCE,
      musician_id: MUSICIAN,
      establishment_id: ESTABLISHMENT,
    };

    const first = await record.execute(input);
    const second = await record.execute(input);

    expect(second.id).toBe(first.id);
    expect((await repo.findAll()).length).toBe(1);
  });

  it("o mesmo músico para OUTRA casa é uma indicação nova", async () => {
    const { record, repo } = setup();
    await record.execute({
      audience_id: AUDIENCE,
      musician_id: MUSICIAN,
      establishment_id: ESTABLISHMENT,
    });
    await record.execute({
      audience_id: AUDIENCE,
      musician_id: MUSICIAN,
      establishment_id: OTHER_ESTABLISHMENT,
    });

    expect((await repo.findAll()).length).toBe(2);
  });
});

describe("ListEstablishmentIndicationsUseCase", () => {
  /*
   * 🔴 O teste que existe por causa da armadilha do `SearchParams.filter`: sem
   * o override do setter na subclasse, o filtro é descartado, o repositório
   * monta `where: {}` e a caixa de entrada de um estabelecimento devolve as
   * indicações de TODOS. Já aconteceu de verdade neste projeto (`repertoire`).
   */
  it("devolve SÓ as indicações do estabelecimento pedido", async () => {
    const { repo, list } = setup();
    await repo.bulkInsert([
      Indication.create({
        audience_id: AUDIENCE,
        musician_id: MUSICIAN,
        establishment_id: ESTABLISHMENT,
      }),
      Indication.create({
        audience_id: AUDIENCE,
        musician_id: MUSICIAN,
        establishment_id: OTHER_ESTABLISHMENT,
      }),
    ]);

    const output = await list.execute({ establishment_id: ESTABLISHMENT });

    expect(output.total).toBe(1);
    expect(output.items[0].establishment_id).toBe(ESTABLISHMENT);
  });

  it("new_count conta só as não vistas, e só as da casa", async () => {
    const { repo, list } = setup();
    const seen = Indication.create({
      audience_id: AUDIENCE,
      musician_id: MUSICIAN,
      establishment_id: ESTABLISHMENT,
    });
    seen.markAsSeen();

    await repo.bulkInsert([
      seen,
      Indication.create({
        audience_id: "523e4567-e89b-42d3-a456-426614174004",
        musician_id: MUSICIAN,
        establishment_id: ESTABLISHMENT,
      }),
      Indication.create({
        audience_id: AUDIENCE,
        musician_id: MUSICIAN,
        establishment_id: OTHER_ESTABLISHMENT,
      }),
    ]);

    const output = await list.execute({ establishment_id: ESTABLISHMENT });
    expect(output.new_count).toBe(1);
  });

  it("filtra por status quando pedido", async () => {
    const { repo, list } = setup();
    const archived = Indication.create({
      audience_id: AUDIENCE,
      musician_id: MUSICIAN,
      establishment_id: ESTABLISHMENT,
    });
    archived.archive();
    await repo.bulkInsert([
      archived,
      Indication.create({
        audience_id: "523e4567-e89b-42d3-a456-426614174004",
        musician_id: MUSICIAN,
        establishment_id: ESTABLISHMENT,
      }),
    ]);

    const output = await list.execute({
      establishment_id: ESTABLISHMENT,
      status: "archived",
    });

    expect(output.total).toBe(1);
    expect(output.items[0].status).toBe("archived");
  });
});

describe("UpdateIndicationStatusUseCase", () => {
  it("marca como vista", async () => {
    const { repo, updateStatus } = setup();
    const indication = Indication.create({
      audience_id: AUDIENCE,
      musician_id: MUSICIAN,
      establishment_id: ESTABLISHMENT,
    });
    await repo.insert(indication);

    const output = await updateStatus.execute({
      indication_id: indication.indication_id.id,
      establishment_id: ESTABLISHMENT,
      status: "seen",
    });

    expect(output.status).toBe("seen");
    expect(output.is_new).toBe(false);
  });

  /*
   * 🔴 O guard prova quem é o usuário, nunca de quem é o sub-recurso. Sem esta
   * conferência, o `:indication_id` do path bastaria para um estabelecimento
   * arquivar as indicações de outro — mesma armadilha registrada em
   * `personal-chord-sheet`.
   *
   * E responde 404, não 403: dizer "existe mas não é sua" já confirma a
   * existência a quem não deveria saber.
   */
  it("recusa mexer na indicação de OUTRO estabelecimento, com 404", async () => {
    const { repo, updateStatus } = setup();
    const indication = Indication.create({
      audience_id: AUDIENCE,
      musician_id: MUSICIAN,
      establishment_id: ESTABLISHMENT,
    });
    await repo.insert(indication);

    await expect(
      updateStatus.execute({
        indication_id: indication.indication_id.id,
        establishment_id: OTHER_ESTABLISHMENT,
        status: "archived",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    // E nada mudou.
    const untouched = await repo.findById(indication.indication_id);
    expect(untouched!.status).toBe("new");
  });

  it("indicação inexistente também é 404", async () => {
    const { updateStatus } = setup();
    await expect(
      updateStatus.execute({
        indication_id: "623e4567-e89b-42d3-a456-426614174005",
        establishment_id: ESTABLISHMENT,
        status: "seen",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
