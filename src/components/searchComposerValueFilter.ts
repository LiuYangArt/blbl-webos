export type SearchComposerValueFilter = 'none' | 'digits' | 'ip-address';

const IP_ADDRESS_MAX_LENGTH = 15;

export function applySearchComposerValueFilter(
  value: string,
  filter: SearchComposerValueFilter = 'none',
  maxLength?: number,
): string {
  const normalized = normalizeByFilter(value, filter);
  const resolvedMaxLength = resolveMaxLength(filter, maxLength);
  return resolvedMaxLength > 0 ? normalized.slice(0, resolvedMaxLength) : normalized;
}

export function resolveSearchComposerInputMode(
  filter: SearchComposerValueFilter = 'none',
  inputMode?: 'text' | 'search' | 'numeric' | 'decimal' | 'tel' | 'url' | 'email',
): 'text' | 'search' | 'numeric' | 'decimal' | 'tel' | 'url' | 'email' | undefined {
  if (inputMode) {
    return inputMode;
  }

  if (filter === 'digits') {
    return 'numeric';
  }

  if (filter === 'ip-address') {
    return 'decimal';
  }

  return undefined;
}

export function resolveSearchComposerMaxLength(
  filter: SearchComposerValueFilter = 'none',
  maxLength?: number,
): number | undefined {
  const resolved = resolveMaxLength(filter, maxLength);
  return resolved > 0 ? resolved : undefined;
}

function normalizeByFilter(value: string, filter: SearchComposerValueFilter): string {
  if (filter === 'digits') {
    return value.replace(/[^\d]/g, '');
  }

  if (filter === 'ip-address') {
    const digitsAndDots = value.replace(/[^\d.]/g, '');
    const segments = digitsAndDots.split('.');
    const limitedSegments = segments.slice(0, 4).map((segment) => segment.slice(0, 3));
    return limitedSegments.join('.');
  }

  return value;
}

function resolveMaxLength(filter: SearchComposerValueFilter, maxLength?: number): number {
  if (filter === 'ip-address') {
    return Math.min(IP_ADDRESS_MAX_LENGTH, maxLength ?? IP_ADDRESS_MAX_LENGTH);
  }

  return maxLength ?? 0;
}
