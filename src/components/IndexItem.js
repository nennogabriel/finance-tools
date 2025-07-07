import React, { memo, useCallback } from 'react';
import { debounce } from '@/utils/helpers';

const IndexItem = memo(({ index, onRemove, onChange, onSelectSuggestion, onFetchData, apiKey, onError, isApiLimitReached }) => {
    // A flag to prevent fetching suggestions right after one has been selected.
    const suggestionSelected = React.useRef(false);

    const debouncedFetch = useCallback(debounce(async (keywords) => {
        if (!apiKey || suggestionSelected.current) {
            suggestionSelected.current = false;
            return;
        }

        try {
            const response = await fetch(`/api/market-data/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    type: 'suggestions', 
                    keywords, 
                    apiKey,
                    isApiLimitReached // Pass the flag
                })
            });

            if (!response.ok) {
                let errorMessage = 'Failed to fetch suggestions';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    // Fail silently
                }
                return onError(errorMessage);
            }

            const suggestions = await response.json();
            onChange(index.id, 'suggestions', suggestions);
        } catch (error) {
            onChange(index.id, 'suggestions', []);
            onError(error.message);
        }
    }, 500), [index.id, onChange, apiKey, onError, isApiLimitReached]);

    const handleTickerChange = (e) => {
        const { value } = e.target;
        // Reset status when the user starts typing a new ticker
        onChange(index.id, 'status', 'idle');
        onChange(index.id, 'ticker', value.toUpperCase());
        
        if (value.length >= 3) {
            debouncedFetch(value);
        } else {
            onChange(index.id, 'suggestions', []);
        }
    };
    
    const handleSelectSuggestion = (suggestion) => {
        suggestionSelected.current = true;
        onSelectSuggestion(index.id, suggestion);
    };

    return (
        <div className="p-4 bg-white rounded-lg shadow-md relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                <input type="text" value={index.name} onChange={(e) => onChange(index.id, 'name', e.target.value)} placeholder="Index Name" className="p-2 border border-gray-300 rounded-md w-full"/>
                <div className="flex items-center gap-2">
                    <button onClick={() => onRemove(index.id)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-md transition duration-300">X</button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div>
                    <label className="text-sm text-gray-600">Annual Return (Manual %)</label>
                    <input type="text" value={index.annualProfitability} disabled={index.source === 'api'} onChange={(e) => onChange(index.id, 'annualProfitability', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100"/>
                </div>
                <div className="relative">
                    <label className="text-sm text-gray-600">Ticker (e.g., ^GSPC, AAPL)</label>
                    <div className="flex gap-2">
                        <input type="text" value={index.ticker} onChange={handleTickerChange} placeholder="Type to search..." className="w-full p-2 border border-gray-300 rounded-md"/>
                        <button onClick={() => onFetchData(index.id, 'index')} disabled={!apiKey || !index.ticker || index.status === 'loading'} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-gray-400">
                            {index.status === 'loading' ? '...' : 'Fetch'}
                        </button>
                    </div>
                    {index.suggestions?.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto">
                            {index.suggestions.map(s => (
                                <li key={s['1. symbol']} className="p-2 hover:bg-gray-100 cursor-pointer" onClick={() => handleSelectSuggestion(s)}>
                                    {s['1. symbol']} - {s['2. name']}
                                </li>
                            ))}
                        </ul>
                    )}
                    {index.status === 'loaded' && <p className="text-xs text-green-600 mt-1">Historical data loaded!</p>}
                    {index.status === 'error' && <p className="text-xs text-red-600 mt-1">Error loading data.</p>}
                </div>
            </div>
        </div>
    );
});
IndexItem.displayName = 'IndexItem';

export default IndexItem; 