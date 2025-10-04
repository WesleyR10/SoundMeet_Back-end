import { Chance } from "chance";
import { EstablishmentFakeBuilder } from "../establishment-fake.builder";
import { Establishment, EstablishmentId } from "../establishment.aggregate";
import { Email } from "../../../shared/domain/value-objects/email.vo";
import { Phone } from "../../../shared/domain/value-objects/phone.vo";
import { QRCode } from "../../../shared/domain/value-objects/qr-code.vo";
import { Rating } from "../../../shared/domain/value-objects/rating.vo";
import { CNPJ } from "../../../shared/domain/value-objects/cnpj.vo";

describe("EstablishmentFakeBuilder Unit Tests", () => {
  describe("establishment_id prop", () => {
    const faker = EstablishmentFakeBuilder.anEstablishment();

    test("should throw error when any with methods has called", () => {
      expect(() => faker.establishment_id).toThrowError(
        new Error(
          "Property establishment_id not have a factory, use 'with' methods",
        ),
      );
    });

    test("should be undefined", () => {
      expect(faker["_establishment_id"]).toBeUndefined();
    });

    test("withEstablishmentId", () => {
      const establishment_id = new EstablishmentId();
      const $this = faker.withEstablishmentId(establishment_id);
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_establishment_id"]).toBe(establishment_id);

      faker.withEstablishmentId(() => establishment_id);
      //@ts-expect-error _establishment_id is a callable
      expect(faker["_establishment_id"]()).toBe(establishment_id);

      expect(faker.establishment_id).toBe(establishment_id);
    });

    test("should pass index to establishment_id factory", () => {
      faker.withEstablishmentId((index) => new EstablishmentId());
      const establishment = faker.build();
      expect(establishment.id).toBeInstanceOf(EstablishmentId);

      const fakerMany = EstablishmentFakeBuilder.theEstablishments(2);
      fakerMany.withEstablishmentId((index) => new EstablishmentId());
      const establishments = fakerMany.build();

      expect(establishments[0].id).toBeInstanceOf(
        EstablishmentId,
      );
      expect(establishments[1].id).toBeInstanceOf(
        EstablishmentId,
      );
      expect(establishments[0].id).not.toBe(
        establishments[1].id,
      );
    });
  });

  describe("name prop", () => {
    const faker = EstablishmentFakeBuilder.anEstablishment();

    test("should be a function", () => {
      expect(typeof faker["_name"]).toBe("function");
    });

    test("should call the word method", () => {
      const chance = Chance();
      const spyWordMethod = jest.spyOn(chance, "word");
      faker["chance"] = chance;
      faker.build();

      expect(spyWordMethod).toHaveBeenCalled();
    });

    test("withName", () => {
      const $this = faker.withName("Test Establishment");
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_name"]).toBe("Test Establishment");

      faker.withName(() => "Test Establishment");
      //@ts-expect-error name is callable
      expect(faker["_name"]()).toBe("Test Establishment");

      expect(faker.name).toBe("Test Establishment");
    });

    test("should pass index to name factory", () => {
      faker.withName((index) => `Test Establishment ${index}`);
      const fakerMany = EstablishmentFakeBuilder.theEstablishments(2);
      fakerMany.withName((index) => `Test Establishment ${index}`);
      const establishments = fakerMany.build();

      expect(establishments[0].name).toBe("Test Establishment 0");
      expect(establishments[1].name).toBe("Test Establishment 1");
    });

    test("invalid empty case", () => {
      const $this = faker.withInvalidNameEmpty(undefined);
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_name"]).toBeUndefined();

      faker.withInvalidNameEmpty(null);
      expect(faker["_name"]).toBeNull();

      faker.withInvalidNameEmpty("");
      expect(faker["_name"]).toBe("");
    });

    test("invalid too long case", () => {
      const $this = faker.withInvalidNameTooLong();
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_name"].length).toBe(256);

      const tooLong = "a".repeat(256);
      faker.withInvalidNameTooLong(tooLong);
      expect(faker["_name"].length).toBe(256);
      expect(faker["_name"]).toBe(tooLong);
    });
  });

  describe("email prop", () => {
    const faker = EstablishmentFakeBuilder.anEstablishment();

    test("should be a function", () => {
      expect(typeof faker["_email"]).toBe("function");
    });

    test("withEmail", () => {
      const $this = faker.withEmail("test@establishment.com");
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_email"]).toBe("test@establishment.com");

      faker.withEmail(() => "test@establishment.com");
      //@ts-expect-error email is callable
      expect(faker["_email"]()).toBe("test@establishment.com");

      expect(faker.email).toBe("test@establishment.com");
    });

    test("should pass index to email factory", () => {
      faker.withEmail((index) => `test${index}@establishment.com`);
      const fakerMany = EstablishmentFakeBuilder.theEstablishments(2);
      fakerMany.withEmail((index) => `test${index}@establishment.com`);
      const establishments = fakerMany.build();

      expect(establishments[0].email.value).toBe("test0@establishment.com");
      expect(establishments[1].email.value).toBe("test1@establishment.com");
    });

    test("invalid empty case", () => {
      const $this = faker.withInvalidEmailEmpty(undefined);
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_email"]).toBeUndefined();

      faker.withInvalidEmailEmpty(null);
      expect(faker["_email"]).toBeNull();

      faker.withInvalidEmailEmpty("");
      expect(faker["_email"]).toBe("");
    });

    test("invalid format case", () => {
      const $this = faker.withInvalidEmailNotAnEmail();
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_email"]).toBe("invalid-email");

      faker.withInvalidEmailNotAnEmail("not-an-email");
      expect(faker["_email"]).toBe("not-an-email");
    });
  });

  describe("cnpj prop", () => {
    const faker = EstablishmentFakeBuilder.anEstablishment();

    test("should be a function", () => {
      expect(typeof faker["_cnpj"]).toBe("function");
    });

    test("withCnpj", () => {
      const $this = faker.withCnpj("84244955000184");
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_cnpj"]).toBe("84244955000184");

      faker.withCnpj(() => "84244955000184");
      //@ts-expect-error cnpj is callable
      expect(faker["_cnpj"]()).toBe("84244955000184");

      expect(faker.cnpj).toBe("84244955000184");
    });

    test("should pass index to cnpj factory", () => {
      faker.withCnpj((index) =>
        index === 0 ? "90441272000110" : "84244955000184",
      );
      const fakerMany = EstablishmentFakeBuilder.theEstablishments(2);
      fakerMany.withCnpj((index) =>
        index === 0 ? "90441272000110" : "84244955000184",
      );
      const establishments = fakerMany.build();

      expect(establishments[0].cnpj?.value).toBe("90441272000110");
      expect(establishments[1].cnpj?.value).toBe("84244955000184");
    });

    test("invalid empty case", () => {
      const $this = faker.withInvalidCnpjEmpty(undefined);
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_cnpj"]).toBeUndefined();

      faker.withInvalidCnpjEmpty(null);
      expect(faker["_cnpj"]).toBeNull();

      faker.withInvalidCnpjEmpty("");
      expect(faker["_cnpj"]).toBe("");
    });
  });

  describe("description prop", () => {
    const faker = EstablishmentFakeBuilder.anEstablishment();

    test("should be a function", () => {
      expect(typeof faker["_description"]).toBe("function");
    });

    test("withDescription", () => {
      const $this = faker.withDescription("A great establishment");
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_description"]).toBe("A great establishment");

      faker.withDescription(() => "A great establishment");
      //@ts-expect-error description is callable
      expect(faker["_description"]()).toBe("A great establishment");

      expect(faker.description).toBe("A great establishment");
    });

    test("should pass index to description factory", () => {
      faker.withDescription((index) => `Description ${index}`);
      const fakerMany = EstablishmentFakeBuilder.theEstablishments(2);
      fakerMany.withDescription((index) => `Description ${index}`);
      const establishments = fakerMany.build();

      expect(establishments[0].description).toBe("Description 0");
      expect(establishments[1].description).toBe("Description 1");
    });
  });

  describe("avatar prop", () => {
    const faker = EstablishmentFakeBuilder.anEstablishment();

    test("should be a function", () => {
      expect(typeof faker["_avatar"]).toBe("function");
    });

    test("withAvatar", () => {
      const $this = faker.withAvatar("https://example.com/avatar.jpg");
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_avatar"]).toBe("https://example.com/avatar.jpg");

      faker.withAvatar(() => "https://example.com/avatar.jpg");
      //@ts-expect-error avatar is callable
      expect(faker["_avatar"]()).toBe("https://example.com/avatar.jpg");

      expect(faker.avatar).toBe("https://example.com/avatar.jpg");
    });
  });

  describe("phone prop", () => {
    const faker = EstablishmentFakeBuilder.anEstablishment();

    test("should be a function", () => {
      expect(typeof faker["_phone"]).toBe("function");
    });

    test("withPhone", () => {
      const $this = faker.withPhone("+5511999999999");
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_phone"]).toBe("+5511999999999");

      faker.withPhone(() => "+5511999999999");
      //@ts-expect-error phone is callable
      expect(faker["_phone"]()).toBe("+5511999999999");

      expect(faker.phone).toBe("+5511999999999");
    });
  });

  describe("is_active prop", () => {
    const faker = EstablishmentFakeBuilder.anEstablishment();

    test("should be a function", () => {
      expect(typeof faker["_is_active"]).toBe("function");
    });

    test("activate", () => {
      const $this = faker.activate();
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_is_active"]).toBe(true);
    });

    test("deactivate", () => {
      const $this = faker.deactivate();
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_is_active"]).toBe(false);
    });

    test("withIsActive", () => {
      const $this = faker.withIsActive(false);
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_is_active"]).toBe(false);

      faker.withIsActive(() => true);
      //@ts-expect-error is_active is callable
      expect(faker["_is_active"]()).toBe(true);

      expect(faker.is_active).toBe(true);
    });
  });

  describe("is_verified prop", () => {
    const faker = EstablishmentFakeBuilder.anEstablishment();

    test("should be a function", () => {
      expect(typeof faker["_is_verified"]).toBe("function");
    });

    test("verify", () => {
      const $this = faker.verify();
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_is_verified"]).toBe(true);
    });

    test("unverify", () => {
      const $this = faker.unverify();
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_is_verified"]).toBe(false);
    });

    test("withIsVerified", () => {
      const $this = faker.withIsVerified(true);
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_is_verified"]).toBe(true);

      faker.withIsVerified(() => false);
      //@ts-expect-error is_verified is callable
      expect(faker["_is_verified"]()).toBe(false);

      expect(faker.is_verified).toBe(false);
    });
  });

  describe("created_at prop", () => {
    const faker = EstablishmentFakeBuilder.anEstablishment();

    test("should throw error when any with methods has called", () => {
      const fakerEstablishment = EstablishmentFakeBuilder.anEstablishment();
      expect(() => fakerEstablishment.created_at).toThrowError(
        new Error("Property created_at not have a factory, use 'with' methods"),
      );
    });

    test("should be undefined", () => {
      expect(faker["_created_at"]).toBeUndefined();
    });

    test("withcreated_at", () => {
      const date = new Date();
      const $this = faker.withcreated_at(date);
      expect($this).toBeInstanceOf(EstablishmentFakeBuilder);
      expect(faker["_created_at"]).toBe(date);

      faker.withcreated_at(() => date);
      //@ts-expect-error _created_at is a callable
      expect(faker["_created_at"]()).toBe(date);
      expect(faker.created_at).toBe(date);
    });

    test("should pass index to created_at factory", () => {
      const date = new Date();
      faker.withcreated_at((index) => new Date(date.getTime() + index + 2));
      const fakerMany = EstablishmentFakeBuilder.theEstablishments(2);
      fakerMany.withcreated_at((index) => new Date(date.getTime() + index + 2));
      const establishments = fakerMany.build();

      expect(establishments[0].created_at).toEqual(
        new Date(date.getTime() + 0 + 2),
      );
      expect(establishments[1].created_at).toEqual(
        new Date(date.getTime() + 1 + 2),
      );
    });
  });

  test("should create an establishment", () => {
    const faker = EstablishmentFakeBuilder.anEstablishment();
    let establishment = faker.build();

    expect(establishment.id).toBeInstanceOf(EstablishmentId);
    expect(typeof establishment.name === "string").toBeTruthy();
    expect(establishment.email).toBeInstanceOf(Email);
    expect(establishment.cnpj).toBeInstanceOf(CNPJ);
    expect(establishment.description).toBeNull();
    expect(establishment.avatar).toBeNull();
    expect(establishment.phone).toBeNull();
    expect(establishment.rating).toBeInstanceOf(Rating);
    expect(establishment.total_ratings).toBe(0);
    expect(establishment.is_active).toBe(true);
    expect(establishment.is_verified).toBe(false);
    expect(establishment.created_at).toBeInstanceOf(Date);

    const created_at = new Date();
    const establishment_id = new EstablishmentId();
    establishment = faker
      .withEstablishmentId(establishment_id)
      .withName("Test Establishment")
      .withEmail("test@establishment.com")
      .withCnpj("84244955000184")
      .withDescription("A great establishment")
      .withAvatar("https://example.com/avatar.jpg")
      .withPhone("+5511999999999")
      .deactivate()
      .verify()
      .withcreated_at(created_at)
      .build();

    expect(establishment.id.id).toBe(establishment_id.id);
    expect(establishment.name).toBe("Test Establishment");
    expect(establishment.email.value).toBe("test@establishment.com");
    expect(establishment.cnpj?.value).toBe("84244955000184");
    expect(establishment.description).toBe("A great establishment");
    expect(establishment.avatar).toBe("https://example.com/avatar.jpg");
    expect(establishment.phone!.value).toBe("+5511999999999");
    expect(establishment.is_active).toBe(false);
    expect(establishment.is_verified).toBe(true);
    expect(establishment.created_at).toBe(created_at);
  });

  test("should create many establishments", () => {
    const faker = EstablishmentFakeBuilder.theEstablishments(2);
    let establishments = faker.build();

    establishments.forEach((establishment) => {
      expect(establishment.id).toBeInstanceOf(EstablishmentId);
      expect(typeof establishment.name === "string").toBeTruthy();
      expect(establishment.email).toBeInstanceOf(Email);
      expect(establishment.cnpj).toBeInstanceOf(CNPJ);
      expect(establishment.description).toBeNull();
      expect(establishment.avatar).toBeNull();
      expect(establishment.phone).toBeNull();
      expect(establishment.rating).toBeInstanceOf(Rating);
      expect(establishment.total_ratings).toBe(0);
      expect(establishment.is_active).toBe(true);
      expect(establishment.is_verified).toBe(false);
      expect(establishment.created_at).toBeInstanceOf(Date);
    });

    const created_at = new Date();
    const establishment_id = new EstablishmentId();
    establishments = faker
      .withEstablishmentId((index) => establishment_id)
      .withName((index) => `Test Establishment ${index}`)
      .withEmail((index) => `test${index}@establishment.com`)
      .withCnpj((index) => (index === 0 ? "90441272000110" : "84244955000184"))
      .withDescription((index) => `Description ${index}`)
      .withAvatar((index) => `https://example.com/avatar${index}.jpg`)
      .withPhone((index) => `+551199999999${index}`)
      .deactivate()
      .verify()
      .withcreated_at((index) => created_at)
      .build();

    establishments.forEach((establishment, index) => {
      expect(establishment.id.id).toBe(establishment_id.id);
      expect(establishment.name).toBe(`Test Establishment ${index}`);
      expect(establishment.email.value).toBe(`test${index}@establishment.com`);
      expect(establishment.cnpj?.value).toBe(
        index === 0 ? "90441272000110" : "84244955000184",
      );
      expect(establishment.description).toBe(`Description ${index}`);
      expect(establishment.avatar).toBe(
        `https://example.com/avatar${index}.jpg`,
      );
      expect(establishment.phone!.value).toBe(`+551199999999${index}`);
      expect(establishment.is_active).toBe(false);
      expect(establishment.is_verified).toBe(true);
      expect(establishment.created_at).toBe(created_at);
    });
  });
});
