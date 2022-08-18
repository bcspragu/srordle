import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { builtinModules } from 'module'
import ignore from 'rollup-plugin-ignore'
import { terser } from "rollup-plugin-terser";
import htmlTemplate from 'rollup-plugin-generate-html-template'
import postcss from 'rollup-plugin-postcss'

const modulesToIgnore = [...builtinModules]
modulesToIgnore.push('jsdom', 'acorn')

const isProd = process.env.BUILD === 'production'
const infix = isProd ? '.min' : ''

export default {
  input: `src/index.ts`,
  output: {
    file: `dist/index${infix}.js`,
    format: 'iife',
    globals: {
      // For making PaperJS work (mostly) as expected.
      'jsdom/lib/jsdom/living/generated/utils': '{}', 
    },
  },
  plugins: [
    ignore(modulesToIgnore),
    typescript(),
    nodeResolve({ browser: true }),
    commonjs(),
    postcss({ extract: true, minimize: true, plugins: [] }),
    htmlTemplate({
      template: 'src/template.html',
      target: 'index.html',
    }),
    isProd && terser(),
  ],
  external: [
    // For making PaperJS work (mostly) as expected.
    'jsdom/lib/jsdom/living/generated/utils', 
  ],
}
