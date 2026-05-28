export interface ParsedCommand {
  channels: number[];
  value: number;
  display: string;
}

export interface ParseResult {
  ok: boolean;
  command?: ParsedCommand;
  error?: string;
}

function parseChannelToken(token: string): number[] | null {
  const t = token.trim();
  if (!t) return null;
  const m = t.match(/^(\d+)\s*(?:-|thru|THRU)\s*(\d+)$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (lo < 1 || hi > 512) return null;
    const out: number[] = [];
    for (let i = lo; i <= hi; i++) out.push(i);
    return out;
  }
  const n = parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1 || n > 512) return null;
  return [n];
}

function parseValueToken(token: string): number | null {
  const t = token.trim().toUpperCase();
  if (!t) return null;
  if (t === 'FULL') return 255;
  if (t === 'OUT' || t === 'OFF') return 0;
  if (t === '@') return null;

  // Hex is only triggered by an explicit letter A-F (e.g. "FF", "A0", "ff").
  // Plain digits are treated as percent (0-100) or raw byte (101-255), so
  // "50" → 50% → 128, not 0x50 → 80.
  if (/^[0-9A-F]{1,2}$/.test(t) && /[A-F]/.test(t)) {
    const v = parseInt(t, 16);
    if (Number.isFinite(v) && v >= 0 && v <= 255) return v;
  }

  if (!/^\d+$/.test(t)) return null;
  const n = parseInt(t, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n <= 100) return Math.round((n / 100) * 255);
  if (n <= 255) return n;
  return null;
}

export function parseCommand(input: string): ParseResult {
  const raw = input.replace(/THRU/gi, '-').trim();
  if (!raw) return { ok: false, error: 'empty command' };

  const atIdx = raw.indexOf('@');
  if (atIdx < 0) return { ok: false, error: 'missing @' };

  const channelsPart = raw.slice(0, atIdx).trim();
  const valuePart = raw.slice(atIdx + 1).trim();

  if (!channelsPart) return { ok: false, error: 'no channels' };
  if (!valuePart) return { ok: false, error: 'no value' };

  const channels: number[] = [];
  for (const tok of channelsPart.split('+')) {
    const sub = parseChannelToken(tok);
    if (!sub) return { ok: false, error: `bad channel: ${tok}` };
    for (const c of sub) if (!channels.includes(c)) channels.push(c);
  }

  const value = parseValueToken(valuePart);
  if (value == null) return { ok: false, error: `bad value: ${valuePart}` };

  channels.sort((a, b) => a - b);

  return {
    ok: true,
    command: {
      channels,
      value,
      display: `${channelsPart} @ ${valuePart}`,
    },
  };
}
