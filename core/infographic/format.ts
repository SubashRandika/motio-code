/**
 * Number formatting for infographic elements.
 *
 * Deliberately not `toLocaleString`. The same project must produce the same
 * pixels in a browser, in a test and in a headless renderer, and those three can
 * easily disagree about the current locale -- a figure that reads "1,200" in the
 * editor and "1 200" in the export would be a rendering bug nobody could
 * reproduce locally.
 */

export interface NumberFormat {
  decimals: number;
  separator: boolean;
  prefix: string;
  suffix: string;
}

export const DEFAULT_NUMBER_FORMAT: NumberFormat = {
  decimals: 0,
  separator: true,
  prefix: "",
  suffix: "",
};

/** Groups a run of digits into threes from the right: 1234567 -> "1,234,567". */
function group(digits: string): string {
  let out = "";

  for (let index = 0; index < digits.length; index += 1) {
    // Insert a comma before every third digit counted from the end.
    const fromEnd = digits.length - index;
    if (index > 0 && fromEnd % 3 === 0) out += ",";
    out += digits[index];
  }

  return out;
}

export function formatNumber(value: number, format: Partial<NumberFormat> = {}): string {
  const { decimals, separator, prefix, suffix } = { ...DEFAULT_NUMBER_FORMAT, ...format };

  // A non-finite value would render as "NaN" or "Infinity" in the middle of a
  // slide; zero is the honest fallback for data that is not a number.
  const safe = Number.isFinite(value) ? value : 0;
  const negative = safe < 0;
  const fixed = Math.abs(safe).toFixed(decimals);

  const [whole, fraction] = fixed.split(".");
  const body = separator ? group(whole) : whole;
  const decimalPart = fraction ? `.${fraction}` : "";

  return `${negative ? "-" : ""}${prefix}${body}${decimalPart}${suffix}`;
}
