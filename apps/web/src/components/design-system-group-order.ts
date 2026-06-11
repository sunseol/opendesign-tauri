import type { DesignSystemSummary } from '@open-design/contracts';

function isEditableSystem(system: DesignSystemSummary): boolean {
  return system.isEditable === true || system.source === 'user';
}

function groupHasEditable(items: readonly DesignSystemSummary[]): boolean {
  return items.some(isEditableSystem);
}

function orderItemsEditableFirst(items: DesignSystemSummary[]): DesignSystemSummary[] {
  return [...items].sort((a, b) => {
    const aEditable = isEditableSystem(a);
    const bEditable = isEditableSystem(b);
    if (aEditable === bEditable) return 0;
    return aEditable ? -1 : 1;
  });
}

export function orderDesignSystemGroups(
  entries: ReadonlyArray<[string, DesignSystemSummary[]]>,
): Array<[string, DesignSystemSummary[]]> {
  return entries
    .map(([category, items]): [string, DesignSystemSummary[]] => [
      category,
      orderItemsEditableFirst(items),
    ])
    .sort(([, a], [, b]) => {
      const aEditable = groupHasEditable(a);
      const bEditable = groupHasEditable(b);
      if (aEditable === bEditable) return 0;
      return aEditable ? -1 : 1;
    });
}
