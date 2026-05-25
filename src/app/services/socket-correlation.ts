export type BasicRequestIdentity = {
  operation?: unknown;
  entityType?: unknown;
  containerId?: unknown;
};

export function createCorrelationId(operation: string): string {
  const ts = Date.now().toString(36);
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${operation}:${ts}:${randomPart}`;
}

export function normalizeIdentityValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function matchesBasicRequestIdentity(
  left: BasicRequestIdentity | undefined,
  right: BasicRequestIdentity | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  return (
    normalizeIdentityValue(left.operation) === normalizeIdentityValue(right.operation) &&
    normalizeIdentityValue(left.entityType) === normalizeIdentityValue(right.entityType) &&
    normalizeIdentityValue(left.containerId) === normalizeIdentityValue(right.containerId)
  );
}