import { defineConfig } from "vite";

import plainText from "vite-plugin-plain-text";

export default defineConfig({
  base: "/nbody-sim/",
  plugins: [plainText([/\.wgsl$/])],
  build: {
    target: "esnext",
  },
});
