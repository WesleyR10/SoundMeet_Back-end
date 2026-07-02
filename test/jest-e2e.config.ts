import { Config } from "jest";

const config: Config = {
  clearMocks: true, // A cada teste, os mocks são limpos
  moduleFileExtensions: ["js", "json", "ts", "tsx"],
  rootDir: ".",
  testEnvironment: "node",
  coverageProvider: "v8",
  testRegex: ".e2e-spec.ts$",
  transform: {
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
  setupFilesAfterEnv: ["./jest-setup.ts"],
};

export default config;
