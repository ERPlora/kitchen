import { defineConfig } from 'vitest/config';

// Tests of the module's Web Component (Lit + Shadow DOM), next to the code: `ui/**/*.test.ts`.
// `happy-dom` gives a real DOM (custom elements + shadow root), so the WC is mounted and what it
// PAINTS is checked, not what its source says.
//
// Beware: happy-dom does NO layout (no flex, no scroll). Anything that depends on layout is verified
// in a real browser; here the CONTRACT that makes it possible is pinned.
export default defineConfig({
  // The decorator settings Lit needs, stated here because this repo ships no `tsconfig.json`.
  // Vite 8 transpiles with oxc, which reads the nearest tsconfig: inside the development workspace it
  // finds `modules-workspace/tsconfig.json`, but in a standalone clone it finds none and every
  // `@property()` is a «SyntaxError: Invalid or unexpected token» (ERPlora/pm#393). Same values as
  // the gate's config (`module-toolkit/src/vitest.module.config.mjs`), so `vitest run` here and
  // `erplora test` in CI transpile identically.
  oxc: {
    tsconfig: {
      compilerOptions: {
        target: 'ES2022',
        experimentalDecorators: true, // Lit's `@state()` / `@property()` are legacy decorators
        useDefineForClassFields: false, // with `true` the class field shadows the decorator's accessor
      },
    },
  },
  test: {
    include: ['ui/**/*.test.ts'],
    environment: 'happy-dom',
  },
});
