import { instanceToPlain } from "class-transformer";

import { CollectionPresenter } from "../collection.presenter";

class StubCollectionPresenter extends CollectionPresenter {
  data = [1, 2, 3];
}

describe("CollectionPresenter Unit Tests", () => {
  describe("constructor", () => {
    it("should set values", () => {
      const presenter = new StubCollectionPresenter({
        current_page: 1,
        per_page: 2,
        last_page: 3,
        total: 4,
      });

      expect(presenter.meta).toStrictEqual({
        current_page: 1,
        per_page: 2,
        last_page: 3,
        total: 4,
      });
    });
  });

  it("should presenter data", () => {
    let presenter = new StubCollectionPresenter({
      current_page: 1,
      per_page: 2,
      last_page: 3,
      total: 4,
    });

    expect(instanceToPlain(presenter)).toStrictEqual({
      data: [1, 2, 3],
      meta: {
        current_page: 1,
        per_page: 2,
        last_page: 3,
        total: 4,
      },
    });

    presenter = new StubCollectionPresenter({
      current_page: "1" as any,
      per_page: "2" as any,
      last_page: "3" as any,
      total: "4" as any,
    });

    expect(instanceToPlain(presenter)).toStrictEqual({
      data: [1, 2, 3],
      meta: {
        current_page: 1,
        per_page: 2,
        last_page: 3,
        total: 4,
      },
    });
  });
});
