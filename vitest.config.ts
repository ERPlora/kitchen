import { defineConfig } from 'vitest/config';

// Tests del Web Component del módulo (Lit + Shadow DOM), junto al código: `ui/**/*.test.ts`.
// `happy-dom` da un DOM real (custom elements + shadow root), así que se monta el WC y se comprueba
// lo que PINTA, no lo que dice el fuente.
//
// Ojo: happy-dom NO hace layout (no computa flex ni scroll). Lo que dependa de layout —que el pie
// del carrito quede abajo, que las líneas scrollen— se verifica en un navegador real; aquí se fija
// el CONTRATO que lo hace posible.
export default defineConfig({
  test: {
    include: ['ui/**/*.test.ts'],
    environment: 'happy-dom',
  },
});
