import React, { memo, useCallback } from 'react';
import { debounce } from '@/utils/helpers';

const AssetItem = memo(({ asset, onRemove, onChange, onSelectSuggestion, onFetchData, apiKey, onError, isApiLimitReached }) => {
    // A flag to prevent fetching suggestions right after one has been selected.
    const suggestionSelected = React.useRef(false);

    const debouncedFetch = useCallback(debounce(async (keywords) => {
        if (!apiKey || suggestionSelected.current) {
            suggestionSelected.current = false; // Reset the flag
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
                    // Fail silently in console, the user will see the toast.
                }
                // Instead of throwing, we just call the onError handler.
                return onError(errorMessage);
            }

            const suggestions = await response.json();
            onChange(asset.id, 'suggestions', suggestions);
        } catch (error) {
            // This will now primarily catch network errors.
            onChange(asset.id, 'suggestions', []); 
            onError(error.message); 
        }
    }, 500), [asset.id, onChange, apiKey, onError, isApiLimitReached]);

    const handleTickerChange = (e) => {
        const { value } = e.target;
        // Reset status when the user starts typing a new ticker
        onChange(asset.id, 'status', 'idle');
        onChange(asset.id, 'ticker', value.toUpperCase());
        
        if (value.length >= 3) {
            debouncedFetch(value);
        } else {
            onChange(asset.id, 'suggestions', []);
        }
    };

    const handleSelectSuggestion = (suggestion) => {
        suggestionSelected.current = true;
        onSelectSuggestion(asset.id, suggestion);
    };

    return (
        <div className="p-4 bg-white rounded-lg shadow-md space-y-3 relative">
            <div className="flex justify-between items-center">
                <input type="text" value={asset.name} onChange={(e) => onChange(asset.id, 'name', e.target.value)} placeholder="Asset Name" className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-400 outline-none w-full"/>
                <button onClick={() => onRemove(asset.id)} className="ml-2 bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded-md transition duration-300">X</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="text-sm text-gray-600">Initial Allocation (%)</label><input type="text" value={asset.initialAllocationPercentage} onChange={(e) => onChange(asset.id, 'initialAllocationPercentage', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md"/></div>
                 <div><label className="text-sm text-gray-600">Monthly Dividend Yield (%)</label><input type="text" value={asset.dividendYield} onChange={(e) => onChange(asset.id, 'dividendYield', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md"/></div>
                <div className="relative md:col-span-2">
                    <label className="text-sm text-gray-600">Asset Ticker (for API data)</label>
                    <div className="flex gap-2">
                        <input type="text" value={asset.ticker} onChange={handleTickerChange} placeholder="Type to search..." className="w-full p-2 border border-gray-300 rounded-md"/>
                        <button onClick={() => onFetchData(asset.id, 'asset')} disabled={!apiKey || !asset.ticker || asset.status === 'loading'} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-gray-400">
                            {asset.status === 'loading' ? '...' : 'Fetch'}
                        </button>
                    </div>
                    {asset.suggestions?.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto">
                            {asset.suggestions.map(s => (
                                <li key={s['1. symbol']} className="p-2 hover:bg-gray-100 cursor-pointer" onClick={() => handleSelectSuggestion(s)}>
                                    {s['1. symbol']} - {s['2. name']}
                                </li>
                            ))}
                        </ul>
                    )}
                    {asset.status === 'loaded' && <p className="text-xs text-green-600 mt-1">Historical data loaded!</p>}
                    {asset.status === 'error' && <p className="text-xs text-red-600 mt-1">Error loading data.</p>}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t mt-3">
                <div><label className="text-sm text-gray-600">Annual Return (Manual %)</label><input type="text" value={asset.annualProfitability} disabled={asset.source === 'api'} onChange={(e) => onChange(asset.id, 'annualProfitability', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100"/></div>
                <div><label className="text-sm text-gray-600">Min/Max Monthly Return (Manual %)</label>
                    <div className="flex gap-2">
                        <input type="text" value={asset.minMonthlyProfitability} disabled={asset.source === 'api'} onChange={(e) => onChange(asset.id, 'minMonthlyProfitability', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100"/>
                        <input type="text" value={asset.maxMonthlyProfitability} disabled={asset.source === 'api'} onChange={(e) => onChange(asset.id, 'maxMonthlyProfitability', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100"/>
                    </div>
                </div>
            </div>
        </div>
    );
});
AssetItem.displayName = 'AssetItem';

export default AssetItem; 