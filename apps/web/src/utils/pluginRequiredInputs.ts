import type { InputFieldSpec } from '@open-design/contracts';

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

export function missingRequiredInputs(
  fields: InputFieldSpec[],
  values: Record<string, unknown>,
): string[] {
  const missing: string[] = [];
  for (const field of fields) {
    if (field.required !== true) continue;
    if (hasValue(values[field.name])) continue;
    if (hasValue(field.default)) continue;
    missing.push(field.label?.trim() || field.name);
  }
  return missing;
}

export function pluginInputsAreValid(
  fields: InputFieldSpec[],
  values: Record<string, unknown>,
): boolean {
  return missingRequiredInputs(fields, values).length === 0;
}
