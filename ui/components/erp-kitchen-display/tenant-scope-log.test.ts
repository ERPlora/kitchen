// Una entrada de log solo apunta a una comanda y una estación del MISMO hub (pm#146).
//
// `kitchen.logs.create` es un command PÚBLICO: sus tres ids (`order_id`, `order_item_id`,
// `station_id`) llegan de quien llama, y el INSERT los metía tal cual. Los `_`-prefijados del
// módulo no tienen este problema —el runtime los rechaza para cualquier caller externo
// (`commands.rs`, gate de origen hub#131/#145)— pero este no lleva prefijo.
//
// Es el rastro de auditoría de la cocina: quién marcó qué y cuándo. Una fila que apunta a la
// comanda de otro negocio no rompe un cobro, pero corrompe justo el registro al que se acude
// cuando algo salió mal, y lo hace en silencio.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../../..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'module.json'), 'utf8')) as {
  id: string;
  commands: Record<
    string,
    { sql?: string[]; expect_rows?: { op: string; n: number; error: string; message?: string } }
  >;
};

const COMMAND = 'kitchen.logs.create';
const sqlOf = (name: string) =>
  (manifest.commands[name].sql ?? [])
    .map((rel) =>
      readFileSync(join(ROOT, rel), 'utf8')
        .split('\n')
        .filter((l) => !l.trim().startsWith('--'))
        .join('\n'),
    )
    .join('\n');

describe('el log de cocina solo apunta a filas del mismo hub (pm#146)', () => {
  it('la comanda se resuelve contra el hub inyectado', () => {
    const sql = sqlOf(COMMAND);
    expect(sql, 'toma cualquier order_id: también el de otro negocio').toMatch(/kitchen_order\b/);
    expect(sql, 'y tiene que ser de ESTE hub').toMatch(/hub_id\s*=\s*:hub_id/);
  });

  it('falla en vez de no escribir y decir que sí', () => {
    const gate = manifest.commands[COMMAND].expect_rows;
    expect(gate, 'un INSERT condicional sin `expect_rows` es un no-op que devuelve OK').toBeTruthy();
    expect(gate!.op).toBe('min');
    expect(gate!.n).toBeGreaterThanOrEqual(1);
    expect(gate!.error.split('.')[0], 'el instalador exige el namespace del módulo').toBe(manifest.id);
    expect(gate!.message, 'ningún shell traduce estos códigos todavía: hace falta el texto').toBeTruthy();
  });
});
