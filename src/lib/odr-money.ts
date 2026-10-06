// Indian rupee figures: lakh and crore, for the award and the settlement.

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

export function parseAmount(input: string): { rupees: number; paise: number } | null {
  const cleaned = input.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!cleaned || cleaned === ".") return null;
  const [rupeePart, paisePart = ""] = cleaned.split(".");
  if (!/^\d+$/.test(rupeePart)) return null;
  if (paisePart && !/^\d+$/.test(paisePart)) return null;
  const rupees = Number(rupeePart);
  if (!Number.isSafeInteger(rupees)) return null;
  const paise = Number((paisePart + "00").slice(0, 2));
  if (!Number.isSafeInteger(paise)) return null;
  return { rupees, paise };
}

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return one ? `${TENS[ten]}-${ONES[one]}` : (TENS[ten] ?? "");
}

function threeDigits(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

function indianWhole(n: number): string {
  if (n === 0) return "";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${indianWhole(crore) || threeDigits(crore)} Crore`.replace(/^ /, ""));
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}

export function amountInWords(input: string): string {
  const parsed = parseAmount(input);
  if (!parsed) return "";
  const rupees = parsed.rupees === 0 ? "Zero" : indianWhole(parsed.rupees);
  if (parsed.paise > 0) return `${rupees} and ${twoDigits(parsed.paise)} Paise`;
  return rupees;
}

export function formatIndianAmount(input: string): string {
  const parsed = parseAmount(input);
  if (!parsed) return "";
  const digits = String(parsed.rupees);
  let grouped = digits;
  if (digits.length > 3) {
    const last3 = digits.slice(-3);
    let head = digits.slice(0, -3);
    const pairs: string[] = [];
    while (head.length > 2) {
      pairs.unshift(head.slice(-2));
      head = head.slice(0, -2);
    }
    if (head) pairs.unshift(head);
    grouped = `${pairs.join(",")},${last3}`;
  }
  return `${grouped}.${String(parsed.paise).padStart(2, "0")}`;
}

export function addAmounts(values: string[]): string {
  let rupees = 0;
  let paise = 0;
  let any = false;
  for (const value of values) {
    const parsed = parseAmount(value);
    if (!parsed) continue;
    any = true;
    rupees += parsed.rupees;
    paise += parsed.paise;
  }
  if (!any) return "";
  rupees += Math.floor(paise / 100);
  paise = paise % 100;
  return formatIndianAmount(`${rupees}.${String(paise).padStart(2, "0")}`);
}

export function subtractAmounts(total: string, part: string): string {
  const left = parseAmount(total);
  const right = parseAmount(part);
  if (!left || !right) return "";
  let rupees = left.rupees - right.rupees;
  let paise = left.paise - right.paise;
  if (paise < 0) {
    rupees -= 1;
    paise += 100;
  }
  if (rupees < 0) return "";
  return formatIndianAmount(`${rupees}.${String(paise).padStart(2, "0")}`);
}
