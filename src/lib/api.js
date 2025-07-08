import { ApiError } from '@/utils/helpers';

// No longer using client-side cache, Directus will handle caching.
// const apiCache = {}; 

export const fetchTickerSuggestions = async (apiKey, keywords) => {
    if (!apiKey || keywords.length < 2) return [];
    
    // Using a Map for simple in-memory cache for the current session to avoid repeated searches.
    const suggestionsCache = new Map();
    const cacheKey = `search_${keywords}`;
    if (suggestionsCache.has(cacheKey)) return suggestionsCache.get(cacheKey);

    try {
        const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(keywords)}&apikey=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        const suggestions = data.bestMatches || [];
        suggestionsCache.set(cacheKey, suggestions);
        return suggestions;
    } catch (error) {
        console.error("Error fetching ticker suggestions:", error);
        return [];
    }
};

const fetchFromAPI = async (apiKey, ticker, seriesFunction) => {
    const url = `https://www.alphavantage.co/query?function=${seriesFunction}&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}&outputsize=full`;
        const response = await fetch(url);
        const data = await response.json();

    const infoOrNote = data['Note'] || data['Information'];
    if (infoOrNote) {
        const lowerInfo = infoOrNote.toLowerCase();
        if (lowerInfo.includes('premium')) {
            // Using ApiError to send a specific status code back
            throw new ApiError(`This asset requires a premium Alpha Vantage plan.`, 402); // 402 Payment Required
        }
        if (lowerInfo.includes('limit') || lowerInfo.includes('thank you for using')) {
            throw new ApiError(`The Alpha Vantage API limit has been reached. You can still use assets that are already cached.`, 429); // 429 Too Many Requests
        }
        // Generic fallback for any other note/information
        throw new ApiError(`API provider note: ${infoOrNote}`, 400);
        }

        if (data['Error Message']) {
        throw new ApiError(`API Error: ${data['Error Message']}`, 400);
        }
    return data;
};

export const fetchAlphaVantageData = async (apiKey, ticker) => {
    if (!apiKey || !ticker) return null;

    try {
        // Fetch only the monthly data, which is available on the free plan.
        const monthlyData = await fetchFromAPI(apiKey, ticker, 'TIME_SERIES_MONTHLY_ADJUSTED');
        const monthlyTimeSeries = monthlyData['Monthly Adjusted Time Series'];
        
        if (!monthlyTimeSeries) {
            throw new Error('Could not retrieve monthly time series. The ticker may be invalid or data is unavailable.');
        }

        // Calculate monthly returns.
        const sortedDates = Object.keys(monthlyTimeSeries).sort((a, b) => new Date(a) - new Date(b));
        const monthlyReturns = [];
        for (let i = 1; i < sortedDates.length; i++) {
            const prevClose = parseFloat(monthlyTimeSeries[sortedDates[i-1]]['5. adjusted close']);
            const currentClose = parseFloat(monthlyTimeSeries[sortedDates[i]]['5. adjusted close']);
            if (prevClose > 0) {
                monthlyReturns.push((currentClose / prevClose) - 1);
            }
        }
        
        return { monthlyReturns };

    } catch (error) {
        console.error(`Error fetching historical data for ${ticker}:`, error);
        throw error;
    }
}; 