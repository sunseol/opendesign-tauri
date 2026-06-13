export interface SwiftColorToken {
  name: string;
  hex: string;
}

export function evalSwiftNumber(expr: string): number | null {
  const parts = expr.split('/');
  if (parts.length > 2) return null;
  const values = parts.map((part) => {
    const token = part.trim();
    if (/^0x[0-9a-f]+$/i.test(token)) return Number.parseInt(token, 16);
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(token)) return Number.parseFloat(token);
    return Number.NaN;
  });
  if (values.some((value) => Number.isNaN(value))) return null;
  if (values.length === 1) return values[0]!;
  if (values[1] === 0) return null;
  return values[0]! / values[1]!;
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function byteHex(unit: number): string {
  return Math.round(clampUnit(unit) * 255)
    .toString(16)
    .padStart(2, '0');
}

export function rgbUnitToHex(red: number, green: number, blue: number): string {
  return `#${byteHex(red)}${byteHex(green)}${byteHex(blue)}`;
}

export function hsbToHex(hue: number, saturation: number, brightness: number): string {
  const h = ((hue % 1) + 1) % 1;
  const s = clampUnit(saturation);
  const v = clampUnit(brightness);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let red = 0;
  let green = 0;
  let blue = 0;
  switch (i % 6) {
    case 0:
      red = v;
      green = t;
      blue = p;
      break;
    case 1:
      red = q;
      green = v;
      blue = p;
      break;
    case 2:
      red = p;
      green = v;
      blue = t;
      break;
    case 3:
      red = p;
      green = q;
      blue = v;
      break;
    case 4:
      red = t;
      green = p;
      blue = v;
      break;
    default:
      red = v;
      green = p;
      blue = q;
      break;
  }
  return rgbUnitToHex(red, green, blue);
}

function namedArg(args: string, key: string): number | null {
  const match = args.match(new RegExp(`\\b${key}\\s*:\\s*([^,)]+)`, 'u'));
  if (!match) return null;
  return evalSwiftNumber(match[1]!.trim());
}

function swiftColorArgsToHex(args: string): string | null {
  const red = namedArg(args, 'red');
  const green = namedArg(args, 'green');
  const blue = namedArg(args, 'blue');
  if (red !== null && green !== null && blue !== null) return rgbUnitToHex(red, green, blue);

  const hue = namedArg(args, 'hue');
  const saturation = namedArg(args, 'saturation');
  const brightness = namedArg(args, 'brightness');
  if (hue !== null && saturation !== null && brightness !== null) {
    return hsbToHex(hue, saturation, brightness);
  }

  const white = namedArg(args, 'white');
  if (white !== null) return rgbUnitToHex(white, white, white);

  return null;
}

export function extractSwiftColors(raw: string): SwiftColorToken[] {
  const tokens: SwiftColorToken[] = [];
  const declRe =
    /(?:(?:static\s+|public\s+|private\s+|internal\s+)*(?:let|var)\s+([A-Za-z_]\w*)\s*(?::[^=\n]+)?=\s*)?\bColor\s*\(([^)]*)\)/gu;
  let match: RegExpExecArray | null;
  while ((match = declRe.exec(raw)) !== null) {
    const name = match[1] ?? '';
    const hex = swiftColorArgsToHex(match[2] ?? '');
    if (hex) tokens.push({ name, hex });
  }
  return tokens;
}
