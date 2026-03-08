/**
 * Format a number as an Indian Rupee string
 * @param {number} value
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

/**
 * Format a number representing a percentage
 * @param {number} value
 * @returns {string} Formatted percentage string
 */
export function formatPercentage(value) {
    return new Intl.NumberFormat('en-IN', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

/**
 * Calculates profit/loss value and percentage
 * @param {number} currentPrice
 * @param {number} averagePrice
 * @param {number} quantity
 * @returns {Object} { pnlValue, pnlPercentage }
 */
export function calculatePnL(currentPrice, averagePrice, quantity) {
    if (quantity === 0 || averagePrice === 0) return { pnlValue: 0, pnlPercentage: 0 };

    const totalInvested = averagePrice * quantity;
    const currentValue = currentPrice * quantity;
    const pnlValue = currentValue - totalInvested;
    const pnlPercentage = pnlValue / totalInvested;

    return { pnlValue, pnlPercentage };
}

/**
 * Parse an Indian Rupee string back into a number (used for display testing mostly)
 */
export function parseCurrency(currencyString) {
    return Number(currencyString.replace(/[^0-9.-]+/g, ""));
}

/**
 * Format Date object to a readable string
 */
export function formatDate(date) {
    return new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(date);
}
