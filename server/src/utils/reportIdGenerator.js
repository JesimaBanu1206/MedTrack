
/**
 * Generate unique Lab Report ID in format: #LR-YYYY-XXXX
 * @returns {string} - Generated Lab Report ID
 */
export function generateReportId() {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    return `#LR-${year}-${random}`;
}
