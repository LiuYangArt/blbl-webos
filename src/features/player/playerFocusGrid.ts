export type FocusLinks = {
  left?: string;
  right?: string;
  up?: string;
  down?: string;
};

export type FocusGridSection = {
  ids: string[];
  columns: number;
};

export function buildRowTargets(
  ids: string[],
  columns: number,
  row: 'first' | 'last',
  targetColumns: number,
): string[] {
  if (ids.length === 0 || targetColumns <= 0) {
    return [];
  }

  const rowCount = Math.ceil(ids.length / columns);
  const rowIndex = row === 'first' ? 0 : rowCount - 1;
  const rowStart = rowIndex * columns;
  const rowIds = ids.slice(rowStart, rowStart + columns);

  return Array.from({ length: targetColumns }, (_, columnIndex) => {
    const targetIndex = Math.min(columnIndex, rowIds.length - 1);
    return rowIds[targetIndex] ?? rowIds[rowIds.length - 1] ?? '';
  }).filter(Boolean);
}

export function buildGridFocusMap(
  ids: string[],
  columns: number,
  options: {
    upByColumn?: string[];
    downByColumn?: string[];
  } = {},
): Record<string, FocusLinks> {
  const focusMap: Record<string, FocusLinks> = {};

  ids.forEach((id, index) => {
    const column = index % columns;
    const rowStart = index - column;
    const rowEnd = Math.min(rowStart + columns, ids.length);
    const previous = column > 0 ? ids[index - 1] : undefined;
    const next = index + 1 < rowEnd ? ids[index + 1] : undefined;
    const above = index - columns >= 0
      ? ids[index - columns]
      : options.upByColumn?.[Math.min(column, (options.upByColumn?.length ?? 1) - 1)];
    const below = index + columns < ids.length
      ? ids[index + columns]
      : options.downByColumn?.[Math.min(column, (options.downByColumn?.length ?? 1) - 1)];

    focusMap[id] = {
      left: previous,
      right: next,
      up: above,
      down: below,
    };
  });

  return focusMap;
}

export function buildStackedGridFocusMap(sections: FocusGridSection[]): Record<string, FocusLinks> {
  const filteredSections = sections.filter((section) => section.ids.length > 0 && section.columns > 0);
  const focusMap: Record<string, FocusLinks> = {};

  filteredSections.forEach((section, index) => {
    const previousSection = filteredSections[index - 1];
    const nextSection = filteredSections[index + 1];
    const sectionFocusMap = buildGridFocusMap(section.ids, section.columns, {
      upByColumn: previousSection
        ? buildRowTargets(previousSection.ids, previousSection.columns, 'last', section.columns)
        : [],
      downByColumn: nextSection
        ? buildRowTargets(nextSection.ids, nextSection.columns, 'first', section.columns)
        : [],
    });

    Object.assign(focusMap, sectionFocusMap);
  });

  return focusMap;
}
