// The PASS on paper — the sheet that leaves with the food when the ticket is bumped (kitchen#70).
//
// Two prints, two moments, and they are NOT the same paper:
//
//   · **the comanda**, at FIRE. Already shipped: `print-comanda.ts` in the shell listens on
//     `kitchen.order.created` and sends each station what it has to cook (ADR-0144/0145). It lives
//     in the shell because a kitchen with no screen at all still has to receive it.
//   · **the pass**, at BUMP — this file. Five of the ten KDS reviewed on 2026-09-02 print here
//     (Toast «Auto-print Fulfilled Tickets», Fresh KDS, Lightspeed K, MobiPOS «Print order list
//     when bump», Square) and none of them prints it from a background service: it is the KDS
//     device that prints, at the station whose screen was bumped. A bump cannot happen without a
//     screen, so the «must listen even with no screen» reason that put the comanda in the shell
//     does not carry over — and the switch that governs it is a `kitchen` setting, read by
//     `kitchen` code, which is the only shape `tests/every_setting_moves_something` accepts.
//
// `erplora.print(req)` is the published door every module uses to queue a document (`sales`,
// `invoice`, `inventory` all call it); the shell bolts it onto the client in `apps/web/src/main.ts`
// and decides the route — device, hub queue, or nothing.
//
// 🔴 `documentType` is a CLOSED vocabulary, checked twice: `print_queue::DOCUMENT_TYPES` in the
// runtime and `DocumentType::parse` in the device's ESC/POS renderer, which answers `None` for
// anything it does not know. A nicer-sounding `kitchen_pass` would be accepted by this code, cross
// the gate and print NOTHING — the exact failure inventory#44 paid for with a button that looked
// like it worked. The pass is a `kitchen_order`, which every deployed device already renders.

/** A line of the ticket, as `kitchen.orders.items` projects it (with its station snapshot). */
export interface PassItem {
  product_name?: string | null;
  /** Fixed-point 10⁶ (ADR-0147): the row and the event speak µ, the paper speaks logical units. */
  quantity?: number | string | null;
  notes?: string | null;
  /** Frozen supplements of the line (`Sin cebolla`), already composed by the module. */
  modifiers?: string | null;
  /** The MENU this line is a component of (ADR-0381), or null when it is à la carte. */
  combo_ref?: string | null;
  combo_name?: string | null;
  /** `display` | `printer` | `both` — of the STATION the line went to, frozen at send time. */
  destination?: string | null;
  /** Printer ROLE (`kitchen`, `bar`, …), never a device. */
  printer_role?: string | null;
  /** The line's status in `kitchen.orders.items` (`pending`, `preparing`, `ready`, …). */
  status?: string | null;
}

/** One line as it goes to paper. Keys that carry nothing are OMITTED, never sent empty: a device
 *  already in a shop ignores what it does not know, and `modifiers: ''` on every line would change
 *  the shape of the sheet for everybody in exchange for nothing. */
export interface PassLine {
  name: string;
  quantity: number;
  notes?: string;
  modifiers?: string;
  combo_ref?: string;
  combo_name?: string;
}

/** One sheet of paper: the lines that share a printer role. */
export interface PassGroup {
  role: string;
  items: PassLine[];
}

/** The bits of the SDK this file needs; injected in tests, taken from the shell in production. */
export interface PassPrintDeps {
  query<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T>;
  /** Absent on a shell that bolted no print door on (module preview): nothing prints, nothing breaks. */
  print?(req: Record<string, unknown>): Promise<{ via?: string; error?: string } | undefined | void>;
}

export interface PassPrintOptions {
  /** Turns the ticket's opaque `waiter_id` into the name the pass calls out (ADR-0192). The KDS
   *  already holds that map (`hub.users.list`), so resolving it here would be a query for nothing. */
  resolveWaiter?: (waiterId: string) => string;
}

export interface PassPrintOutcome {
  /** `false` = at least one sheet did not come out and somebody has to be told. */
  ok: boolean;
  /** Sheets the print door accepted (queued or printed). */
  sheets: number;
  /** Machine-readable cause; the caller maps it to a translated message (ADR-0055). */
  reason?: 'nothing_to_print' | 'no_printer' | 'gate_error' | 'threw' | 'no_gate';
  /** Technical detail from the gate, for the tail of that message. */
  detail?: string;
}

const QUANTITY_SCALE = 1_000_000;

/** The role a line with no routing falls back to — the same one `_insert_item.sql` freezes. */
const DEFAULT_ROLE = 'kitchen';

/**
 * Groups the lines into sheets, by printer ROLE and never by station: two stations that share the
 * bar printer are ONE sheet. Screen-only lines are left out — that station has no printer and the
 * KDS is already showing them — and a line nobody routed IS printed: dropping it would leave a
 * plate off the pass without anyone noticing.
 */
export function buildPassGroups(items: PassItem[]): PassGroup[] {
  const groups = new Map<string, PassLine[]>();
  for (const item of items ?? []) {
    if ((item?.destination ?? 'both') === 'display') continue;
    const role = str(item.printer_role) || DEFAULT_ROLE;
    const comboRef = str(item.combo_ref);
    const line: PassLine = {
      name: str(item.product_name),
      quantity: num(item.quantity ?? QUANTITY_SCALE) / QUANTITY_SCALE,
      ...(item.notes ? { notes: str(item.notes) } : {}),
      ...(item.modifiers ? { modifiers: str(item.modifiers) } : {}),
      ...(comboRef ? { combo_ref: comboRef, combo_name: str(item.combo_name) } : {}),
    };
    const group = groups.get(role);
    if (group) group.push(line);
    else groups.set(role, [line]);
  }
  return [...groups].map(([role, lines]) => ({ role, items: lines }));
}

/**
 * Queues the pass of one ticket, one job per printer role.
 *
 * The `jobId` is stable for the (order, role) pair on purpose: the pass reaches every mounted KDS
 * at once and the queue deduplicates, so three screens are one sheet, not three. It is also
 * distinct from the fire comanda's (`kitchen-<order>-<role>`) — sharing it would make the queue
 * throw the pass away as a repeat of the comanda.
 *
 * Nothing here throws and nothing here blocks: the ticket is already `ready` in the database and
 * the KDS is the source of truth. Paper is the copy.
 */
export async function printPass(
  orderId: string,
  deps: PassPrintDeps,
  options: PassPrintOptions = {},
): Promise<PassPrintOutcome> {
  const print = deps.print;
  if (typeof print !== 'function') return { ok: false, sheets: 0, reason: 'no_gate' };

  let groups: PassGroup[];
  let header: Record<string, unknown>;
  try {
    const [items, headers] = await Promise.all([
      deps.query<PassItem[]>('kitchen.orders.items', { order_id: orderId }),
      deps.query<Record<string, unknown>[]>('kitchen.orders.get', { order_id: orderId }),
    ]);
    groups = buildPassGroups(Array.isArray(items) ? items : []);
    header = first(headers) ?? {};
  } catch (e) {
    // Visible, not silent: a pass that never printed because the lines could not be read is a
    // degradation the kitchen has to hear about (nothing else on this screen would say it).
    console.warn('[kitchen] the pass could not be read, so nothing was printed', e);
    return { ok: false, sheets: 0, reason: 'threw', detail: message(e) };
  }

  if (!groups.length) return { ok: true, sheets: 0, reason: 'nothing_to_print' };

  const waiter = options.resolveWaiter ? options.resolveWaiter(str(header.waiter_id)).trim() : '';
  const data = {
    receipt_id: str(header.order_number),
    label: str(header.label),
    round_number: num(header.round_number ?? 1),
    ...(waiter ? { waiter } : {}),
  };

  let sheets = 0;
  let reason: PassPrintOutcome['reason'];
  let detail: string | undefined;
  // In sequence, each with its own guard: a printer out of paper must not keep the other station
  // from getting its half of the pass.
  for (const group of groups) {
    try {
      const result = await print({
        role: group.role,
        documentType: 'kitchen_order',
        // Unattended: nobody is standing in front of the pass to accept a browser dialog, and that
        // dialog would freeze the KDS of a busy service.
        fallbackToBrowser: false,
        jobId: `kitchen-pass-${orderId}-${group.role}`,
        data: { ...data, items: group.items },
      });
      const via = result?.via ?? 'none';
      if (via === 'bridge' || via === 'queue' || via === 'browser') {
        sheets += 1;
        continue;
      }
      // `none` = no printer holds that role. It is NOT rerouted: the pass of the grill coming out
      // of the till printer leaves the runner with paper and the pass with nothing.
      reason = 'no_printer';
      detail = result?.error ?? detail;
      console.warn(`[kitchen] no printer with role ${group.role}: the pass did not come out`, result?.error ?? '');
    } catch (e) {
      reason = 'threw';
      detail = message(e);
      console.warn(`[kitchen] the ${group.role} printer refused the pass`, e);
    }
  }

  return sheets === groups.length ? { ok: true, sheets } : { ok: false, sheets, reason: reason ?? 'gate_error', detail };
}

/** Lines whose status already left the pass: nothing there is left to hurry. */
const DONE_STATUSES = new Set(['ready', 'served', 'cancelled']);

/**
 * The printer ROLES still cooking something of this round, in first-seen order. A screen-only
 * line has no printer to hand a chit to, and a line whose status is `ready`/`served`/`cancelled`
 * already left the pass — nothing there is left to speed up.
 */
function rushRoles(items: PassItem[]): string[] {
  const roles: string[] = [];
  const seen = new Set<string>();
  for (const item of items ?? []) {
    if ((item?.destination ?? 'both') === 'display') continue;
    if (DONE_STATUSES.has(str(item.status))) continue;
    const role = str(item.printer_role) || DEFAULT_ROLE;
    if (!seen.has(role)) {
      seen.add(role);
      roles.push(role);
    }
  }
  return roles;
}

/**
 * Puts a RUSH NOTICE of one ticket on paper (kitchen#93) — a round rushed after it already fired.
 *
 * A short chit, `items: []` so nothing on the rail gets cooked twice, flagged `priority: 'HIGH'`,
 * the flag the device's ESC/POS `kitchen_order` renderer already turns into «!! URGENTE !!» under
 * the kitchen header (hub `render_kitchen_order`). The document type stays the CLOSED vocabulary
 * every deployed device renders — a new one would cross the gate and print nothing (inventory#44).
 *
 * The `jobId` is per (order, role, rush_count), distinct from both the fire comanda's
 * (`kitchen-<order>-<role>`) and the pass's (`kitchen-pass-<order>-<role>`). The count comes from
 * the round itself, so every mounted board and the POS asking for the SAME rush share one id (one
 * sheet), while a round marked, cleared and marked again gets a new id — a repeated id would be
 * dropped by the queue as a duplicate and the second notice would never print (kitchen#99).
 */
export async function printRushNotice(
  orderId: string,
  deps: PassPrintDeps,
  options: PassPrintOptions = {},
): Promise<PassPrintOutcome> {
  const print = deps.print;
  if (typeof print !== 'function') return { ok: false, sheets: 0, reason: 'no_gate' };

  let roles: string[];
  let header: Record<string, unknown>;
  try {
    const [items, headers] = await Promise.all([
      deps.query<PassItem[]>('kitchen.orders.items', { order_id: orderId }),
      deps.query<Record<string, unknown>[]>('kitchen.orders.get', { order_id: orderId }),
    ]);
    roles = rushRoles(Array.isArray(items) ? items : []);
    header = first(headers) ?? {};
  } catch (e) {
    // Same visibility as the pass: a rush notice that never printed because the lines could not
    // be read is a degradation the kitchen has to hear about.
    console.warn('[kitchen] the rush notice could not be read, so nothing was printed', e);
    return { ok: false, sheets: 0, reason: 'threw', detail: message(e) };
  }

  if (!roles.length) return { ok: true, sheets: 0, reason: 'nothing_to_print' };

  const rushCount = num(header.rush_count ?? 0);
  const waiter = options.resolveWaiter ? options.resolveWaiter(str(header.waiter_id)).trim() : '';
  const data = {
    receipt_id: str(header.order_number),
    label: str(header.label),
    round_number: num(header.round_number ?? 1),
    ...(waiter ? { waiter } : {}),
    priority: 'HIGH',
    items: [],
  };

  let sheets = 0;
  let reason: PassPrintOutcome['reason'];
  let detail: string | undefined;
  // In sequence, each with its own guard, exactly like the pass: a printer out of paper must not
  // keep the other station's rush chit from going out.
  for (const role of roles) {
    try {
      const result = await print({
        role,
        documentType: 'kitchen_order',
        fallbackToBrowser: false,
        jobId: `kitchen-rush-${orderId}-${role}-${rushCount}`,
        data,
      });
      const via = result?.via ?? 'none';
      if (via === 'bridge' || via === 'queue' || via === 'browser') {
        sheets += 1;
        continue;
      }
      reason = 'no_printer';
      detail = result?.error ?? detail;
      console.warn(`[kitchen] no printer with role ${role}: the rush notice did not come out`, result?.error ?? '');
    } catch (e) {
      reason = 'threw';
      detail = message(e);
      console.warn(`[kitchen] the ${role} printer refused the rush notice`, e);
    }
  }

  return sheets === roles.length ? { ok: true, sheets } : { ok: false, sheets, reason: reason ?? 'gate_error', detail };
}

function first<T>(v: T[] | T | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v ?? 0) || 0;
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
