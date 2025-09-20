import {
  EstablishmentRules,
  EstablishmentValidator,
  EstablishmentValidatorFactory,
} from "../establishment.validator";
import { EstablishmentFakeBuilder } from "../establishment-fake.builder";
import { Notification } from "../../../shared/domain/validators/notification";

describe("EstablishmentValidator Tests", () => {
  let validator: EstablishmentValidator;
  let notification: Notification;

  beforeEach(() => {
    validator = EstablishmentValidatorFactory.create();
    notification = new Notification();
  });

  test("invalidation cases for name field", () => {
    let isValid = validator.validate(notification, {});
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, { name: null });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, { name: "" });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, { name: 5 as any });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, { name: "t".repeat(256) });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();
  });

  test("invalidation cases for email field", () => {
    notification = new Notification();
    let isValid = validator.validate(notification, {
      name: "Test Establishment",
    });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, {
      name: "Test Establishment",
      email: null,
    });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, {
      name: "Test Establishment",
      email: "",
    });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, {
      name: "Test Establishment",
      email: "invalid-email",
    });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();
  });

  test("validation cases for cnpj field", () => {
    const validData = {
      name: "Test Establishment",
      email: "test@establishment.com",
      phone: "11999999999",
      address_street: "Rua Teste",
      address_city: "São Paulo",
      establishment_type: "bar",
    };

    notification = new Notification();
    let isValid = validator.validate(notification, validData);
    expect(isValid).toBeTruthy();
    expect(notification.hasErrors()).toBeFalsy();

    notification = new Notification();
    isValid = validator.validate(notification, { ...validData, cnpj: null });
    expect(isValid).toBeTruthy();
    expect(notification.hasErrors()).toBeFalsy();

    notification = new Notification();
    isValid = validator.validate(notification, { ...validData, cnpj: "" }, [
      "name",
      "email",
      "phone",
      "address_street",
      "address_city",
      "establishment_type",
      "cnpj",
    ]);
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(
      notification,
      { ...validData, cnpj: "invalid-cnpj" },
      [
        "name",
        "email",
        "phone",
        "address_street",
        "address_city",
        "establishment_type",
        "cnpj",
      ],
    );
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();
  });

  test("valid cases", () => {
    const arrange = [
      {
        name: "Test Establishment",
        email: "test@establishment.com",
        phone: "11999999999",
        address_street: "Rua Teste",
        address_city: "São Paulo",
        establishment_type: "bar",
        cnpj: "84.244.955/0001-84",
      },
      {
        name: "Another Establishment",
        email: "another@establishment.com",
        phone: "11888888888",
        address_street: "Av. Principal",
        address_city: "Rio de Janeiro",
        establishment_type: "restaurant",
        cnpj: "90.441.272/0001-10",
        description: "A great place",
      },
    ];

    arrange.forEach((item) => {
      const isValid = validator.validate(new Notification(), item);
      expect(isValid).toBeTruthy();
    });
  });
});

describe("EstablishmentRules Unit Tests", () => {
  test("should create rules instance", () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    const rules = new EstablishmentRules(establishment);
    expect(rules).toBeInstanceOf(EstablishmentRules);
    expect(rules.name).toBe(establishment.name);
    expect(rules.email).toBe(establishment.email.value);
  });
});

describe("EstablishmentValidatorFactory Unit Tests", () => {
  test("should create a validator", () => {
    const validator = EstablishmentValidatorFactory.create();
    expect(validator).toBeInstanceOf(EstablishmentValidator);
  });
});
