
/**
 * Generate unique Prescription ID in format: #PR-YYYY-XXXX
 * @returns {string} - Generated Prescription ID
 */
export function generatePrescriptionId() {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    return `#PR-${year}-${random}`;
}
