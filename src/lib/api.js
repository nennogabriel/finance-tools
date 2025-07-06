const apiCache = {};

export const fetchTickerSuggestions = async (apiKey, keywords) => {
    if (!apiKey || keywords.length < 2) return [];
    const cacheKey = `search_${keywords}`;
    if (apiCache[cacheKey]) return apiCache[cacheKey];

    try {
        const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(keywords)}&apikey=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        const suggestions = data.bestMatches || [];
        apiCache[cacheKey] = suggestions;
        return suggestions;
    } catch (error) {
        console.error("Error fetching ticker suggestions:", error);
        return [];
    }
};

export const fetchHistoricalData = async (apiKey, ticker) => {
    if (!apiKey || !ticker) return null;
    const cacheKey = `history_${ticker}`;
    if (apiCache[cacheKey]) return apiCache[cacheKey];

    try {
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data['Note']) {
             throw new Error(`API Note: ${data['Note']}. You may have hit the free API call limit.`);
        }
        if (data['Information']) {
             throw new Error(`API Information: ${data['Information']}. The API call limit may have been reached.`);
        }
        if (data['Error Message']) {
            throw new Error(`API Error: ${data['Error Message']}`);
        }
        if (!data['Monthly Adjusted Time Series']) {
            throw new Error('The API returned an empty response. Check if the ticker is correct and try again later.');
        }

        const timeSeries = data['Monthly Adjusted Time Series'];
        const sortedDates = Object.keys(timeSeries).sort((a, b) => new Date(a) - new Date(b));
        
        const monthlyReturns = [];
        for (let i = 1; i < sortedDates.length; i++) {
            const prevClose = parseFloat(timeSeries[sortedDates[i-1]]['5. adjusted close']);
            const currentClose = parseFloat(timeSeries[sortedDates[i]]['5. adjusted close']);
            if (prevClose > 0) {
                monthlyReturns.push((currentClose / prevClose) - 1);
            }
        }
        apiCache[cacheKey] = monthlyReturns;
        return monthlyReturns;
    } catch (error) {
        console.error("Error fetching historical data:", error);
        alert(`Error for ticker ${ticker}: ${error.message}`);
        return null;
    }
}; 