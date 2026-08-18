// Permission model of the kitchen module (kitchen#5).
//
// Three defects lived in `module.json`:
//  1. `kitchen.logs.create` (a WRITE into the audit trail) was gated by `kitchen.view_log`, a READ
//     permission: a read-only role could forge audit rows by hand. The automatic trail is written by
//     the `kitchen.order.*` listeners, which the relay runs with the module's own authority
//     (wildcard, hub#686 / ADR-0288), so raising the gate costs nothing there.
//  2. The cook (`employee`) had no `kitchen.change_order`, so the KDS was a read-only screen: it could
//     not fire, bump or recall a ticket. What it did have — `kitchen.complete_order` — gated nothing.
//  3. `kitchen.view_history` was declared and granted but no query or command used it.
//
// The fix keys the permission on the ACTION, not on one catch-all command: fire/mark_ready/recall
// stay under `change_order`; marking served is `complete_order`; cancelling a fired ticket is a
// front-of-house decision under `cancel_order`, which the cook does not get. The manifest declares
// ONE permission per command, so the split is by command.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'module.json'), 'utf8')) as {
  id: string;
  permissions: string[];
  role_permissions: Record<string, string[]>;
  queries: Record<string, { permission: string }>;
  commands: Record<string, { permission: string; schema?: string; handler?: { function: string } }>;
  events: { listen: Record<string, { command: string }> };
};

const roles = manifest.role_permissions;
const schemaOf = (command: string) =>
  JSON.parse(readFileSync(join(ROOT, manifest.commands[command].schema!), 'utf8')) as {
    properties: Record<string, { enum?: string[] }>;
  };

describe('writing to the audit trail is a write permission (kitchen#5 §1)', () => {
  it('kitchen.logs.create is gated by kitchen.add_log, not by a read permission', () => {
    expect(manifest.commands['kitchen.logs.create'].permission).toBe('kitchen.add_log');
    expect(manifest.permissions).toContain('kitchen.add_log');
  });

  it('manager may annotate the trail by hand; the cook may not', () => {
    expect(roles.manager).toContain('kitchen.add_log');
    expect(roles.employee).not.toContain('kitchen.add_log');
  });

  it('the automatic trail keeps flowing: every kitchen.order.* event still feeds logs.create', () => {
    // The relay runs listeners with the module authority (wildcard), so the cook’s bumps are still
    // recorded even though the cook cannot call `logs.create` directly.
    for (const ev of ['fired', 'ready', 'served', 'recalled', 'cancelled']) {
      expect(manifest.events.listen[`kitchen.order.${ev}`]?.command).toBe('kitchen.logs.create');
    }
  });
});

describe('the cook can operate the KDS (kitchen#5 §3)', () => {
  it('employee holds change_order (fire / bump / recall) and complete_order (serve)', () => {
    expect(roles.employee).toContain('kitchen.change_order');
    expect(roles.employee).toContain('kitchen.complete_order');
  });

  it('cancelling a fired ticket is a front-of-house decision: manager yes, cook no', () => {
    expect(roles.manager).toContain('kitchen.cancel_order');
    expect(roles.employee).not.toContain('kitchen.cancel_order');
  });
});

describe('one permission per action, keyed by command (kitchen#5 §3)', () => {
  it('kitchen.orders.set_status only carries the change_order verbs', () => {
    expect(manifest.commands['kitchen.orders.set_status'].permission).toBe('kitchen.change_order');
    expect(schemaOf('kitchen.orders.set_status').properties.action_name.enum).toEqual(['fire', 'mark_ready', 'recall']);
  });

  it('kitchen.orders.mark_served is a WASM command under complete_order', () => {
    const cmd = manifest.commands['kitchen.orders.mark_served'];
    expect(cmd, 'the command exists').toBeTruthy();
    expect(cmd.permission).toBe('kitchen.complete_order');
    expect(cmd.handler?.function).toBe('mark_order_served');
  });

  it('kitchen.orders.cancel is a WASM command under cancel_order', () => {
    const cmd = manifest.commands['kitchen.orders.cancel'];
    expect(cmd, 'the command exists').toBeTruthy();
    expect(cmd.permission).toBe('kitchen.cancel_order');
    expect(cmd.handler?.function).toBe('cancel_order');
  });
});

describe('no orphan permissions in either direction (kitchen#5 §2)', () => {
  const used = new Set<string>([
    ...Object.values(manifest.queries).map((q) => q.permission),
    ...Object.values(manifest.commands).map((c) => c.permission),
  ]);

  it('every declared permission gates at least one query or command', () => {
    const orphans = manifest.permissions.filter((p) => !used.has(p));
    expect(orphans, 'declared but gating nothing').toEqual([]);
  });

  it('every permission a query/command references is declared', () => {
    const undeclared = [...used].filter((p) => !manifest.permissions.includes(p));
    expect(undeclared, 'referenced but not declared').toEqual([]);
  });

  it('every permission granted to a role is declared', () => {
    for (const [role, perms] of Object.entries(roles)) {
      const stray = perms.filter((p) => p !== '*' && !manifest.permissions.includes(p));
      expect(stray, `${role} is granted permissions the module does not declare`).toEqual([]);
    }
  });

  it('kitchen.view_history is gone: it never gated anything', () => {
    expect(manifest.permissions).not.toContain('kitchen.view_history');
  });
});
