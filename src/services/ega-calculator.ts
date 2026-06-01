/**
 * EGA (Estimated Gestational Age) Calculator
 * Calculates current gestational age and expected delivery date from LMP.
 */

/**
 * Calculate EDD (Expected Delivery Date) from LMP using Naegele's rule:
 * EDD = LMP + 280 days (40 weeks)
 */
export function calculateEDD(lmpDate: Date): Date {
  const edd = new Date(lmpDate);
  edd.setDate(edd.getDate() + 280);
  return edd;
}

/**
 * Calculate current EGA (Estimated Gestational Age) in weeks from LMP
 */
export function calculateEGAWeeks(lmpDate: Date, referenceDate: Date = new Date()): number {
  const diffMs = referenceDate.getTime() - lmpDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

/**
 * Calculate current EGA in weeks and days
 */
export function calculateEGADetailed(lmpDate: Date, referenceDate: Date = new Date()): {
  weeks: number;
  days: number;
  totalDays: number;
} {
  const diffMs = referenceDate.getTime() - lmpDate.getTime();
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return {
    weeks: Math.floor(totalDays / 7),
    days: totalDays % 7,
    totalDays,
  };
}

/**
 * Get trimester based on EGA weeks
 */
export function getTrimester(egaWeeks: number): 1 | 2 | 3 {
  if (egaWeeks < 13) return 1;
  if (egaWeeks < 28) return 2;
  return 3;
}
