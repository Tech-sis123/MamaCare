"use strict";
/**
 * EGA (Estimated Gestational Age) Calculator
 * Calculates current gestational age and expected delivery date from LMP.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateEDD = calculateEDD;
exports.calculateEGAWeeks = calculateEGAWeeks;
exports.calculateEGADetailed = calculateEGADetailed;
exports.getTrimester = getTrimester;
/**
 * Calculate EDD (Expected Delivery Date) from LMP using Naegele's rule:
 * EDD = LMP + 280 days (40 weeks)
 */
function calculateEDD(lmpDate) {
    const edd = new Date(lmpDate);
    edd.setDate(edd.getDate() + 280);
    return edd;
}
/**
 * Calculate current EGA (Estimated Gestational Age) in weeks from LMP
 */
function calculateEGAWeeks(lmpDate, referenceDate = new Date()) {
    const diffMs = referenceDate.getTime() - lmpDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7);
}
/**
 * Calculate current EGA in weeks and days
 */
function calculateEGADetailed(lmpDate, referenceDate = new Date()) {
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
function getTrimester(egaWeeks) {
    if (egaWeeks < 13)
        return 1;
    if (egaWeeks < 28)
        return 2;
    return 3;
}
