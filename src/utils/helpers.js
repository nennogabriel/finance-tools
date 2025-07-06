// --- Helper Functions ---
export function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

export const formatCurrency = (value, options = {}) => {
    const { withSymbol = false, spaceSymbol = false } = options;
    const num = value || 0;

    const formatter = new Intl.NumberFormat('en-US', {
        style: withSymbol ? 'currency' : 'decimal',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    let formatted = formatter.format(num);

    if (withSymbol && spaceSymbol) {
        formatted = formatted.replace('$', '$ ');
    }
    
    // Add space for negative sign
    if (num < 0) {
        formatted = formatted.replace('-', '- ');
    }

    return formatted;
}; 