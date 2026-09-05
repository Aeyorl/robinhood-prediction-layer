import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  // Bundle the ABI JSON from @pl/contracts into dist so the SDK stays
  // loadable in unbundled Node runtimes (JSON imports from package externals
  // fail outside bundlers — e.g. the worker).
  noExternal: ["@pl/contracts"],
});
