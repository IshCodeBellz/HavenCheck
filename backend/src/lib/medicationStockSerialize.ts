/** Flatten optional 1:1 MedicationStock for API responses that previously read columns on Medication. */
export function attachStockFields<M extends { stock?: { currentStock: number | null; reorderThreshold: number | null } | null }>(
  med: M
): Omit<M, 'stock'> & { currentStock: number | null; reorderThreshold: number | null } {
  const { stock, ...rest } = med;
  return {
    ...(rest as Omit<M, 'stock'>),
    currentStock: stock?.currentStock ?? null,
    reorderThreshold: stock?.reorderThreshold ?? null,
  };
}
