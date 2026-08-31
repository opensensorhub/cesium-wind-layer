import { defineConfig } from 'tsup'
import { glsl } from "esbuild-plugin-glsl";

export default defineConfig({
  esbuildPlugins: [glsl({
    minify: true
  })]
})