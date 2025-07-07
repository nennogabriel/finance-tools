// --- Helper Functions ---
export const debounce = (func, delay) => {
    let timeout;

    return function executedFunction(...args) {
        const context = this;

        const later = () => {
            timeout = null;
            const result = func.apply(context, args);
            
            // If the function returns a promise, attach a basic catch handler.
            // This prevents the Next.js development error overlay for unhandled promise rejections.
            // The actual error logic is handled inside the component's async function.
            if (result instanceof Promise) {
                result.catch(e => {
                    // We can log this for debugging if needed, but the primary goal
                    // is to prevent the unhandled rejection error.
                    // console.error('Debounced promise rejection caught:', e);
                });
            }
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, delay);
    };
};

export class ApiError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
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