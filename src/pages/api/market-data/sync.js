import { fetchAlphaVantageData } from '@/lib/api';

const DIRECTUS_URL = process.env.NEXT_PUBLIC_DIRECTUS_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_API_TOKEN;
// The server-side API key is no longer used for fetching.

// --- Directus API Helpers ---

const getCachedSuggestions = async (keywords) => {
    if (!keywords) return [];
    const search = keywords.toUpperCase();
    const filter = { "_or": [{ "ticker": { "_starts_with": search } }, { "name": { "_icontains": search } }] };
    const params = new URLSearchParams({ fields: 'ticker,name', filter: JSON.stringify(filter), limit: 20 });
    try {
        const response = await fetch(`${DIRECTUS_URL}/items/market_data?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${DIRECTUS_TOKEN}` }
        });
        if (response.ok) {
            const { data } = await response.json();
            return data.map(item => ({ "1. symbol": item.ticker, "2. name": item.name }));
        }
    } catch (error) { /* Fall through and return empty */ }
    return [];
};

const saveNewTickerInfo = async (tickers) => {
    if (!tickers || tickers.length === 0) return;
    const symbols = tickers.map(t => t['1. symbol']);
    const filter = { "ticker": { "_in": symbols } };
    const checkUrl = `${DIRECTUS_URL}/items/market_data?filter=${JSON.stringify(filter)}&fields=ticker`;
    let existingTickers = new Set();
    try {
        const checkResponse = await fetch(checkUrl, { headers: { 'Authorization': `Bearer ${DIRECTUS_TOKEN}` } });
        if (checkResponse.ok) {
            const { data } = await checkResponse.json();
            if (data) {
                existingTickers = new Set(data.map(item => item.ticker));
            }
        }
    } catch (e) { /* Ignore */ }
    const newTickersToSave = tickers
        .filter(t => !existingTickers.has(t['1. symbol']))
        .map(t => ({ ticker: t['1. symbol'], name: t['2. name'] }));
    if (newTickersToSave.length === 0) return;
    try {
        const createResponse = await fetch(`${DIRECTUS_URL}/items/market_data`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(newTickersToSave)
        });
        if (!createResponse.ok) {
            throw new Error(`Directus new ticker POST failed.`);
        }
    } catch (error) {
        console.error("Error in saveNewTickerInfo (POST):", error);
    }
};

const getCachedMarketData = async (ticker) => {
    if (!DIRECTUS_URL || !DIRECTUS_TOKEN) return null;
    try {
        const response = await fetch(`${DIRECTUS_URL}/items/market_data/${ticker}`, {
            headers: { 'Authorization': `Bearer ${DIRECTUS_TOKEN}` }
        });
        if (response.ok) {
            const { data } = await response.json();
            return data;
        }
        return null;
    } catch (error) { return null; }
};

const saveMarketData = async (data) => {
    if (!data || !data.ticker) {
        console.error('saveMarketData: Invalid data provided.');
        return;
    }
    try {
        const url = `${DIRECTUS_URL}/items/market_data/${data.ticker}`;
        const response = await fetch(url, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Directus market data PATCH failed. Status: ${response.status}. Body: ${errorBody}`);
        }
    } catch (error) {
        console.error(`Error in saveMarketData (PATCH):`, error);
        throw error;
    }
};

const isCacheValid = (dateUpdated) => {
    if (!dateUpdated) return false;
    const cacheDate = new Date(dateUpdated);
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    return (now.getTime() - cacheDate.getTime()) < oneDay;
};

// --- Main Handler ---

// Custom error class to pass status codes
class ApiError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}

const handleSuggestions = async (req, res) => {
    const { keywords, apiKey } = req.body;
    if (!keywords || !apiKey) return res.status(400).json({ error: 'Keywords and API Key are required.' });

    // Do not process queries with less than 3 characters
    if (keywords.length < 3) {
        return res.status(200).json([]);
    }

    const cachedSuggestions = await getCachedSuggestions(keywords);
    
    // --- NEW LOGIC ---
    // Only call the external API if our local cache returns absolutely nothing.
    if (cachedSuggestions.length > 0) {
        return res.status(200).json(cachedSuggestions);
    }

    // If cache is empty, then proceed to the API call.
    try {
        const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(keywords)}&apikey=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        // Check for API notes/errors here as well
        const infoOrNote = data['Note'] || data['Information'];
        if (infoOrNote) {
            if (infoOrNote.toLowerCase().includes('limit') || infoOrNote.toLowerCase().includes('thank you')) {
                throw new ApiError(`The daily API call limit has been reached. Suggestions for new tickers are unavailable until tomorrow.`, 429);
            }
        }
        if (data['Error Message']) {
            throw new ApiError(`API Error: ${data['Error Message']}`, 400);
        }

        const apiSuggestions = data.bestMatches || [];
        if (apiSuggestions.length > 0) {
            await saveNewTickerInfo(apiSuggestions);
        }
        
        return res.status(200).json(apiSuggestions);

    } catch (error) {
        throw error;
    }
};

const handleFullData = async (req, res) => {
    const { ticker, name, apiKey } = req.body;
    if (!ticker || !apiKey) return res.status(400).json({ error: 'Ticker and API Key are required.' });
    const cachedData = await getCachedMarketData(ticker);
    const hasValidCache = cachedData && cachedData.monthly_returns && cachedData.monthly_returns.length > 0 && isCacheValid(cachedData.date_updated);
    if (hasValidCache) {
        return res.status(200).json(cachedData);
    }
    const { monthlyReturns } = await fetchAlphaVantageData(apiKey, ticker);
    const dataToSave = {
        ticker: ticker,
        name: cachedData?.name || name,
        monthly_returns: monthlyReturns,
        daily_returns: [],
        daily_ohlc: [],
    };
    await saveMarketData(dataToSave);
    return res.status(200).json(dataToSave);
};


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
        return res.status(500).json({ error: "Server configuration error." });
    }

    try {
        const { type } = req.body;
        if (type === 'suggestions') {
            return await handleSuggestions(req, res);
        }
        if (type === 'full_data') {
            return await handleFullData(req, res);
        }
        return res.status(400).json({ error: 'Invalid request type.' });
    } catch (error) {
        console.error(`Sync handler failed:`, error);
        const statusCode = error.statusCode || 500;
        const message = error.message || 'An unexpected server error occurred.';
        return res.status(statusCode).json({ error: message });
    }
} 