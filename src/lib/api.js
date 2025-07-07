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
            throw new Error(`This asset requires a premium Alpha Vantage plan and cannot be fetched with a free key.`);
        }
        if (lowerInfo.includes('limit') || lowerInfo.includes('thank you for using')) {
            throw new Error(`The daily API call limit has been reached for this key. Please try again tomorrow, use a different key, or subscribe to a premium plan.`);
        }
        // Generic fallback for any other note/information
        throw new Error(`API provider note: ${infoOrNote}`);
    }

    if (data['Error Message']) {
        throw new Error(`API Error: ${data['Error Message']}`);
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