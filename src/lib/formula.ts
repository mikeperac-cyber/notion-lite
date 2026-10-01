/**
 * High-Performance Safe Formula Evaluator with Memoized Compiler & Sandbox Protection
 */

export interface FormulaContext {
  properties: Record<string, any>; // propId -> value OR propName -> value
  propNameMap?: Record<string, string>; // propName -> propId
}

// In-memory cache for compiled formula functions
const evaluatorCache = new Map<string, Function>();

const SANDBOX_HELPERS = {
  _if: (cond: any, a: any, b: any) => (Boolean(cond) ? a : b),
  _and: (...args: any[]) => args.every(Boolean),
  _or: (...args: any[]) => args.some(Boolean),
  _not: (arg: any) => !Boolean(arg),
  _min: (...args: any[]) => {
    const nums = args.map(Number).filter((n) => !isNaN(n));
    return nums.length ? Math.min(...nums) : 0;
  },
  _max: (...args: any[]) => {
    const nums = args.map(Number).filter((n) => !isNaN(n));
    return nums.length ? Math.max(...nums) : 0;
  },
  _round: (n: any, decimals = 0) => {
    const num = Number(n);
    if (isNaN(num)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  },
  _floor: (n: any) => Math.floor(Number(n) || 0),
  _ceil: (n: any) => Math.ceil(Number(n) || 0),
  _abs: (n: any) => Math.abs(Number(n) || 0),
  _concat: (...args: any[]) => args.map((a) => (a === null || a === undefined ? "" : String(a))).join(""),
  _length: (str: any) => String(str || "").length,
  _upper: (str: any) => String(str || "").toUpperCase(),
  _lower: (str: any) => String(str || "").toLowerCase(),
  _contains: (str: any, sub: any) => String(str || "").includes(String(sub || "")),
  _now: () => new Date().toISOString(),
  _dateBetween: (d1: any, d2: any, unit = "days") => {
    if (!d1 || !d2) return 0;
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    if (isNaN(t1) || isNaN(t2)) return 0;
    const diffMs = t1 - t2;
    if (unit === "hours") return Math.round(diffMs / (1000 * 60 * 60));
    if (unit === "days") return Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (unit === "weeks") return Math.round(diffMs / (1000 * 60 * 60 * 24 * 7));
    return diffMs;
  },
};

const HELPER_KEYS = Object.keys(SANDBOX_HELPERS);
const HELPER_VALUES = Object.values(SANDBOX_HELPERS);

export function evaluateFormula(
  expression: string,
  context: FormulaContext
): string | number | boolean | null {
  if (!expression || typeof expression !== "string") return null;

  try {
    const trimmed = expression.trim();
    if (!trimmed) return null;

    // Security check: block dangerous JavaScript identifiers
    if (/(process|window|document|global|fetch|require|import|eval|Function|prototype|constructor)/i.test(trimmed)) {
      return "#SECURITY_ERROR!";
    }

    // Step 1: Replace prop("Name") or prop("id") with extracted values
    let parsedExpr = trimmed.replace(/prop\s*\(\s*["']([^"']+)["']\s*\)/g, (_, propKey) => {
      let val: any = undefined;
      if (context.propNameMap && context.propNameMap[propKey] !== undefined) {
        val = context.properties[context.propNameMap[propKey]];
      } else if (context.properties[propKey] !== undefined) {
        val = context.properties[propKey];
      }

      if (val === undefined || val === null || val === "") return "0";
      if (typeof val === "boolean") return `${val}`;
      if (typeof val === "number") return `${val}`;
      // Check if value is a numeric string (e.g. "0.15" or "100")
      if (!isNaN(Number(val)) && !isNaN(parseFloat(val))) {
        return `${Number(val)}`;
      }
      return JSON.stringify(String(val));
    });

    // Step 2: Map Notion function names to safe internal prefixed helpers
    parsedExpr = parsedExpr
      .replace(/\bif\s*\(/g, "_if(")
      .replace(/\band\s*\(/g, "_and(")
      .replace(/\bor\s*\(/g, "_or(")
      .replace(/\bnot\s*\(/g, "_not(")
      .replace(/\bmin\s*\(/g, "_min(")
      .replace(/\bmax\s*\(/g, "_max(")
      .replace(/\bround\s*\(/g, "_round(")
      .replace(/\bfloor\s*\(/g, "_floor(")
      .replace(/\bceil\s*\(/g, "_ceil(")
      .replace(/\babs\s*\(/g, "_abs(")
      .replace(/\bconcat\s*\(/g, "_concat(")
      .replace(/\blength\s*\(/g, "_length(")
      .replace(/\bupper\s*\(/g, "_upper(")
      .replace(/\blower\s*\(/g, "_lower(")
      .replace(/\bcontains\s*\(/g, "_contains(")
      .replace(/\bnow\s*\(/g, "_now(")
      .replace(/\bdateBetween\s*\(/g, "_dateBetween(");

    // Step 3: Fetch or compile evaluator function
    let fn = evaluatorCache.get(parsedExpr);
    if (!fn) {
      if (evaluatorCache.size > 200) evaluatorCache.clear();
      // eslint-disable-next-line no-new-func
      fn = new Function(...HELPER_KEYS, `"use strict"; return (${parsedExpr});`);
      evaluatorCache.set(parsedExpr, fn);
    }

    const result = fn(...HELPER_VALUES);

    if (typeof result === "number") {
      if (isNaN(result) || !isFinite(result)) return 0;
      // Normalize floating point precision (e.g. 114.99999999999999 -> 115)
      return Math.round((result + Number.EPSILON) * 1e10) / 1e10;
    }
    return result;
  } catch (err) {
    return "#ERROR!";
  }
}
