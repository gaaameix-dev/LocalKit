// Safe expression evaluator and dedicated financial calculations.
// No dynamic code execution — a hand-written tokenizer + shunting-yard parser.

export type CalcResult = { ok: true; value: number } | { ok: false; error: string };

type Token = { t: 'num'; v: number } | { t: 'op'; v: string };

const TOKEN_RE = /(\d+(?:\.\d+)?|\.\d+|[+\-*/%()]|\s+)/y;

function tokenize(src: string): Token[] | null {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < src.length) {
    TOKEN_RE.lastIndex = pos;
    const m = TOKEN_RE.exec(src);
    if (!m) return null; // character not allowed anywhere
    pos += m[0].length;
  }
  // Re-scan: the regex above validates the whole string; now split into tokens.
  const parts = src.match(/\d+(?:\.\d+)?|\.\d+|[+\-*/%()]|\s+/g) || [];
  for (const p of parts) {
    if (/^\s+$/.test(p)) continue;
    if (/^[\d.]/.test(p)) {
      const v = Number(p);
      if (!Number.isFinite(v)) return null;
      tokens.push({ t: 'num', v });
    } else {
      tokens.push({ t: 'op', v: p });
    }
  }
  return tokens;
}

// Precedence: unary +/- binds tighter than * / %, which bind tighter than + -.
function prec(op: string): number {
  if (op === 'u-' || op === 'u+') return 4;
  if (op === '*' || op === '/' || op === '%') return 3;
  if (op === '+' || op === '-') return 2;
  return 0;
}

function apply(op: string, out: number[]): void {
  if (op === 'u-') {
    const a = out.pop();
    if (a === undefined) throw new Error('Invalid expression');
    out.push(-a);
    return;
  }
  if (op === 'u+') {
    const a = out.pop();
    if (a === undefined) throw new Error('Invalid expression');
    out.push(a); // unary plus leaves the value unchanged
    return;
  }
  const b = out.pop();
  const a = out.pop();
  if (a === undefined || b === undefined) throw new Error('Invalid expression');
  switch (op) {
    case '+': out.push(a + b); return;
    case '-': out.push(a - b); return;
    case '*': out.push(a * b); return;
    case '/':
      if (b === 0) throw new Error('Division by zero is not allowed');
      out.push(a / b);
      return;
    case '%':
      if (b === 0) throw new Error('Division by zero is not allowed');
      out.push(a % b);
      return;
    default: throw new Error('Invalid expression');
  }
}

export function evaluateExpression(expr: string): CalcResult {
  const trimmed = expr.trim();
  if (!trimmed) return { ok: false, error: 'Enter an expression' };
  if (trimmed.length > 500) return { ok: false, error: 'Expression is too long' };

  const tokens = tokenize(trimmed);
  if (!tokens || tokens.length === 0) return { ok: false, error: 'Invalid expression' };
  if (tokens.length > 300) return { ok: false, error: 'Expression is too long' };

  const out: number[] = [];
  const ops: string[] = [];
  let expectOperand = true; // true when the next token must be a number, '(' or unary +/-

  try {
    for (const tok of tokens) {
      if (tok.t === 'num') {
        if (!expectOperand) throw new Error('Invalid expression'); // e.g. "2 3"
        out.push(tok.v);
        expectOperand = false;
        continue;
      }
      const v = tok.v;
      if (v === '(') {
        if (!expectOperand) throw new Error('Invalid expression'); // e.g. "2("
        ops.push(v);
        continue;
      }
      if (v === ')') {
        if (expectOperand) throw new Error('Invalid expression'); // e.g. "()"
        while (ops.length && ops[ops.length - 1] !== '(') apply(ops.pop()!, out);
        if (ops.pop() !== '(') throw new Error('Invalid expression'); // unbalanced
        continue;
      }
      // operator
      if (expectOperand) {
        if (v === '-' || v === '+') {
          // unary
          while (
            ops.length &&
            ops[ops.length - 1] !== '(' &&
            prec(ops[ops.length - 1]) >= prec('u' + v)
          ) apply(ops.pop()!, out);
          ops.push('u' + v);
          continue;
        }
        throw new Error('Invalid expression'); // e.g. "* 3"
      }
      while (
        ops.length &&
        ops[ops.length - 1] !== '(' &&
        prec(ops[ops.length - 1]) >= prec(v)
      ) apply(ops.pop()!, out);
      ops.push(v);
      expectOperand = true;
    }
    if (expectOperand) throw new Error('Invalid expression'); // trailing operator
    while (ops.length) {
      const op = ops.pop()!;
      if (op === '(') throw new Error('Invalid expression'); // unbalanced
      apply(op, out);
    }
    if (out.length !== 1) throw new Error('Invalid expression');
    if (!Number.isFinite(out[0])) return { ok: false, error: 'Result is not a finite number' };
    return { ok: true, value: out[0] };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message !== 'Invalid expression' ? e.message : 'Invalid expression' };
  }
}

// --- Dedicated safe calculations (no expression parsing involved) ---

export type Money = { ok: true; value: number } | { ok: false; error: string };

function num(s: string): number | null {
  const v = Number(String(s).trim());
  return Number.isFinite(v) ? v : null;
}

/** GST amount and total for a given amount and tax percentage. */
export function gstCalc(amount: string, gstPercent: string): { amount: number; gst: number; total: number } | { error: string } {
  const a = num(amount);
  const g = num(gstPercent);
  if (a === null || g === null || a < 0 || g < 0) return { error: 'Enter a valid non-negative amount and GST percentage' };
  const gst = a * g / 100;
  return { amount: a, gst, total: a + gst };
}

/** Discount amount and final price. */
export function discountCalc(amount: string, percent: string): { amount: number; discount: number; final: number } | { error: string } {
  const a = num(amount);
  const p = num(percent);
  if (a === null || p === null || a < 0 || p < 0) return { error: 'Enter a valid non-negative amount and discount percentage' };
  const discount = a * p / 100;
  return { amount: a, discount, final: a - discount };
}

/** Monthly EMI for a principal, annual interest rate (%) and tenure in months. */
export function emiCalc(principal: string, annualRatePercent: string, months: string): { emi: number; totalPayment: number; totalInterest: number } | { error: string } {
  const p = num(principal);
  const rate = num(annualRatePercent);
  const n = num(months);
  if (p === null || rate === null || n === null) return { error: 'Enter valid loan amounts' };
  if (p <= 0) return { error: 'Principal must be greater than zero' };
  if (rate < 0) return { error: 'Interest rate cannot be negative' };
  if (n <= 0) return { error: 'Tenure must be at least 1 month' };
  const r = rate / 12 / 100;
  const m = Math.round(n);
  const emi = r === 0 ? p / m : p * r * Math.pow(1 + r, m) / (Math.pow(1 + r, m) - 1);
  if (!Number.isFinite(emi)) return { error: 'Could not calculate EMI with these values' };
  return { emi, totalPayment: emi * m, totalInterest: emi * m - p };
}
