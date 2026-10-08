import {
  DEFAULT_BRAZIL_TIMEZONE,
  localDayWindow,
  resolveVenueTimezone,
  timezoneForBrazilianAddress,
} from "../brazil-timezone";

describe("timezoneForBrazilianAddress", () => {
  it.each([
    ["SP", "São Paulo", "America/Sao_Paulo"],
    ["RJ", "Rio de Janeiro", "America/Sao_Paulo"],
    ["BA", "Salvador", "America/Bahia"],
    ["CE", "Fortaleza", "America/Fortaleza"],
    ["PE", "Recife", "America/Recife"],
    ["TO", "Palmas", "America/Araguaina"],
    ["MT", "Cuiabá", "America/Cuiaba"],
    ["MS", "Campo Grande", "America/Campo_Grande"],
    ["RO", "Porto Velho", "America/Porto_Velho"],
    ["RR", "Boa Vista", "America/Boa_Vista"],
    ["AM", "Manaus", "America/Manaus"],
    ["AC", "Rio Branco", "America/Rio_Branco"],
  ])("%s / %s → %s", (state, city, expected) => {
    expect(timezoneForBrazilianAddress({ state, city })).toBe(expected);
  });

  it("cobre as 27 UFs", () => {
    const ufs =
      "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(
        " ",
      );
    for (const uf of ufs) {
      expect(timezoneForBrazilianAddress({ state: uf })).not.toBeNull();
    }
  });

  it("🔴 oeste do Amazonas segue o Acre (UTC-5), com ou sem acento", () => {
    expect(timezoneForBrazilianAddress({ state: "AM", city: "Eirunepé" })).toBe(
      "America/Eirunepe",
    );
    expect(
      timezoneForBrazilianAddress({
        state: "am",
        city: "  benjamin  constant ",
      }),
    ).toBe("America/Eirunepe");
    // Tabatinga é a ponta da linha da lei, mas fica em UTC-4.
    expect(
      timezoneForBrazilianAddress({ state: "AM", city: "Tabatinga" }),
    ).toBe("America/Manaus");
  });

  it("🔴 Fernando de Noronha é UTC-2; o resto de Pernambuco, UTC-3", () => {
    expect(
      timezoneForBrazilianAddress({ state: "PE", city: "Fernando de Noronha" }),
    ).toBe("America/Noronha");
  });

  it("aceita o estado por extenso", () => {
    expect(timezoneForBrazilianAddress({ state: "Mato Grosso do Sul" })).toBe(
      "America/Campo_Grande",
    );
    expect(
      timezoneForBrazilianAddress({ state: "Amazonas", city: "Envira" }),
    ).toBe("America/Eirunepe");
  });

  it("estado desconhecido não resolve", () => {
    expect(timezoneForBrazilianAddress({ state: "CA" })).toBeNull();
    expect(timezoneForBrazilianAddress({ state: null })).toBeNull();
  });
});

describe("resolveVenueTimezone", () => {
  it("🔴 o endereço vence o fuso declarado (o painel pré-preenche São Paulo)", () => {
    expect(
      resolveVenueTimezone({
        state: "AM",
        city: "Manaus",
        declared_timezone: "America/Sao_Paulo",
      }),
    ).toBe("America/Manaus");
  });

  it("sem endereço que resolva, usa o declarado", () => {
    expect(
      resolveVenueTimezone({ state: null, declared_timezone: "Europe/Lisbon" }),
    ).toBe("Europe/Lisbon");
  });

  it("🔴 nunca UTC: o default da coluna é ignorado e cai em São Paulo", () => {
    expect(resolveVenueTimezone({ declared_timezone: "UTC" })).toBe(
      DEFAULT_BRAZIL_TIMEZONE,
    );
    expect(resolveVenueTimezone({ declared_timezone: "Not/AZone" })).toBe(
      DEFAULT_BRAZIL_TIMEZONE,
    );
    expect(resolveVenueTimezone({})).toBe(DEFAULT_BRAZIL_TIMEZONE);
  });
});

describe("localDayWindow", () => {
  it("dia da noite (6h) em São Paulo: 23h30 e 1h30 caem no MESMO dia", () => {
    // 23h30 de 02/10 em Brasília
    const evening = localDayWindow(
      new Date("2026-10-03T02:30:00.000Z"),
      "America/Sao_Paulo",
      6,
    );
    // 1h30 de 03/10 em Brasília
    const lateNight = localDayWindow(
      new Date("2026-10-03T04:30:00.000Z"),
      "America/Sao_Paulo",
      6,
    );

    expect(evening.start.toISOString()).toBe("2026-10-02T09:00:00.000Z");
    expect(evening.end.toISOString()).toBe("2026-10-03T09:00:00.000Z");
    expect(lateNight).toEqual(evening);
  });

  it("🔴 a virada não acontece às 21h de Brasília (meia-noite UTC)", () => {
    const before = localDayWindow(
      new Date("2026-10-02T23:59:00.000Z"), // 20h59 Brasília
      "America/Sao_Paulo",
      6,
    );
    const after = localDayWindow(
      new Date("2026-10-03T00:01:00.000Z"), // 21h01 Brasília
      "America/Sao_Paulo",
      6,
    );
    expect(after).toEqual(before);
  });

  it("cada fuso vira na própria hora local", () => {
    const now = new Date("2026-10-02T15:00:00.000Z");
    expect(localDayWindow(now, "America/Manaus", 6).start.toISOString()).toBe(
      "2026-10-02T10:00:00.000Z",
    );
    expect(
      localDayWindow(now, "America/Rio_Branco", 6).start.toISOString(),
    ).toBe("2026-10-02T11:00:00.000Z");
    expect(localDayWindow(now, "America/Noronha", 6).start.toISOString()).toBe(
      "2026-10-02T08:00:00.000Z",
    );
  });

  it("startHour 0 é o dia do calendário local", () => {
    const window = localDayWindow(
      new Date("2026-10-03T02:30:00.000Z"),
      "America/Sao_Paulo",
      0,
    );
    expect(window.start.toISOString()).toBe("2026-10-02T03:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-10-03T03:00:00.000Z");
  });

  it("vira o mês e o ano", () => {
    const window = localDayWindow(
      new Date("2027-01-01T05:00:00.000Z"), // 2h de 01/01 em Brasília
      "America/Sao_Paulo",
      6,
    );
    expect(window.start.toISOString()).toBe("2026-12-31T09:00:00.000Z");
    expect(window.end.toISOString()).toBe("2027-01-01T09:00:00.000Z");
  });

  it("tem 23h no dia em que começa o horário de verão (fuso com DST)", () => {
    // Nova York adianta o relógio em 08/03/2026, às 2h.
    const window = localDayWindow(
      new Date("2026-03-08T18:00:00.000Z"),
      "America/New_York",
      0,
    );
    expect(window.start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });
});
