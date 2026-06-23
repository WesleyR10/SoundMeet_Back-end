import { MODULE_METADATA } from "@nestjs/common/constants";

import { AppModule } from "../../../app.module";
import { AiAudioModule } from "../../ai-audio-module/ai-audio.module";
import { RabbitmqModule } from "../rabbitmq.module";

describe("RabbitMQ module wiring", () => {
  it("registers RabbitMQ root once at application bootstrap", () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule);
    const rabbitmqRoots = imports.filter(
      (item: any) => item?.module === RabbitmqModule,
    );

    expect(rabbitmqRoots).toHaveLength(1);
    expect(rabbitmqRoots[0].imports).toHaveLength(1);
  });

  it("keeps AiAudioModule registered in AppModule", () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule);

    expect(imports).toContain(AiAudioModule);
  });

  it("forFeature only exposes feature-level message broker provider", () => {
    const featureModule = RabbitmqModule.forFeature();

    expect(featureModule.imports).toBeUndefined();
    expect(featureModule.exports).toEqual(["IMessageBroker"]);
    expect(featureModule.providers).toHaveLength(1);
  });
});
