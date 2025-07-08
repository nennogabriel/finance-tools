import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title as ChartTitle } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';

import { formatCurrency, createSeededRandom, createSeedFromString } from '@/utils/helpers';
import { fetchHistoricalData } from '@/lib/api';
import { runSimulation, generateManualReturns } from '@/lib/simulation';

import InputField from '@/components/InputField';
import AssetItem from '@/components/AssetItem';
import IndexItem from '@/components/IndexItem';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, ChartTitle);

// The ErrorModal component is no longer needed and will be removed.

// --- Helper moved outside component ---
const processDataForSimulation = (items, simulationPeriod, regenerateSignal = 0) => {
    return items.map(item => {
        const seedSource = item.ticker || item.name; // Use ticker if available, otherwise name
        
        // Manual assets are regenerated based on the signal
        if (item.source === 'manual') {
            const seed = createSeedFromString(seedSource) + regenerateSignal;
            const random = createSeededRandom(seed);
            const numericItem = {
                        ...item,
                        annualProfitability: parseFloat(item.annualProfitability),
                        minMonthlyProfitability: parseFloat(item.minMonthlyProfitability),
                        maxMonthlyProfitability: parseFloat(item.maxMonthlyProfitability),
                    };
            return { ...item, monthlyReturns: generateManualReturns(numericItem, simulationPeriod, random) };
        }

        // API assets are also regenerated based on the signal
        if (item.source === 'api' && item.monthlyReturns.length > 0) {
            const historicalReturns = item.monthlyReturns.slice(0, item.historicalLength);
            if (historicalReturns.length >= simulationPeriod) {
                return { ...item, monthlyReturns: historicalReturns.slice(0, simulationPeriod) };
            }
            // Generate missing data if needed
            const periodsToGenerate = simulationPeriod - historicalReturns.length;
            const seed = createSeedFromString(seedSource) + regenerateSignal;
            const random = createSeededRandom(seed);
            const minReturn = Math.min(...historicalReturns);
            const maxReturn = Math.max(...historicalReturns);
            const generatedReturns = Array.from({ length: periodsToGenerate }, () => random() * (maxReturn - minReturn) + minReturn);
            return { ...item, monthlyReturns: [...historicalReturns, ...generatedReturns] };
        }
        // Return item as is if no processing is needed
        return item;
    });
};

// --- Main App Component ---
const InvestmentPortfolioSimulator = () => {
    const [params, setParams] = useState({
        initialCash: '100000',
        simulationPeriod: '60',
        fixedMonthlyContribution: '0',
        contributionAdjustmentIndexId: '',
        fixedMonthlyWithdrawal: '0',
        withdrawalAdjustmentIndexId: '',
        percentageProfitabilityWithdrawal: '0',
        percentageCashWithdrawal: '0',
        percentageExcessProfitWithdrawal: '0',
        selectedComparisonIndexForWithdrawal: '',
        rebalancePeriod: '3',
        enableRebalancing: false,
    });
    const [apiKey, setApiKey] = useState('');
    const [isApiLimitReached, setIsApiLimitReached] = useState(false); // This will now be passed to the backend
    // The premium tickers set is no longer needed.

    const [assets, setAssets] = useState([
        { id: 1, name: 'Bonds', initialAllocationPercentage: '34', dividendYield: '0', annualProfitability: '4.5', minMonthlyProfitability: '0.3', maxMonthlyProfitability: '0.7', ticker: '', source: 'manual', monthlyReturns: [], status: 'idle', suggestions: [] },
        { id: 2, name: 'REITs', initialAllocationPercentage: '33', dividendYield: '0', annualProfitability: '8', minMonthlyProfitability: '-10', maxMonthlyProfitability: '15', ticker: '', source: 'manual', monthlyReturns: [], status: 'idle', suggestions: [] },
        { id: 3, name: 'Stocks', initialAllocationPercentage: '33', dividendYield: '0', annualProfitability: '12', minMonthlyProfitability: '-20', maxMonthlyProfitability: '20', ticker: '', source: 'manual', monthlyReturns: [], status: 'idle', suggestions: [] },
    ]);
    const [comparisonIndices, setComparisonIndices] = useState([
        { id: 1, name: 'Inflation', annualProfitability: '6', ticker: '', source: 'manual', monthlyReturns: [], status: 'idle', suggestions: [] },
    ]);
    
    const [simulationResults, setSimulationResults] = useState([]);
    const [errors, setErrors] = useState({});
    // The errorModal state is no longer needed.

    const [adjustedPreview, setAdjustedPreview] = useState([]);
    const [regenerateSignal, setRegenerateSignal] = useState(0);

    const prevSimPeriodRef = useRef(params.simulationPeriod);

    // --- Derived State for UI ---
    const finalAllocation = simulationResults[simulationResults.length - 1]?.assetValues || {};
    const totalAllocationPercentage = assets.reduce((sum, asset) => sum + parseFloat(asset.initialAllocationPercentage || 0), 0);

    const showContributions = simulationResults.some(res => res.monthlyContributionAmount > 0);
    const showWithdrawals = simulationResults.some(res => res.monthlyWithdrawalAmount > 0);
    const showDividends = simulationResults.some(res => res.monthlyDividends > 0);
    const showNetCashFlow = showContributions || showWithdrawals || showDividends;

    const apiAssets = assets.filter(a => a.source === 'api' && a.monthlyReturns.length > 0);
    const shortestApiHistory = apiAssets.length > 0
        ? Math.min(...apiAssets.map(a => a.monthlyReturns.length))
        : parseInt(params.simulationPeriod, 10);
    const generatedDataNotice = shortestApiHistory < params.simulationPeriod && apiAssets.length > 0;

    const handleRegenerateAll = useCallback(() => {
        // This function now only "signals" to the main useEffect to re-run the processing.
        setRegenerateSignal(prev => prev + 1);
    }, []);

    const handleAdjustAllocations = () => {
        const currentTotal = assets.reduce((sum, asset) => sum + parseFloat(asset.initialAllocationPercentage || 0), 0);
        if (currentTotal === 0) return; // Avoid division by zero

        const factor = 100 / currentTotal;
        const adjustedAssets = assets.map(asset => ({
            ...asset,
            initialAllocationPercentage: (parseFloat(asset.initialAllocationPercentage || 0) * factor).toFixed(2),
        }));
        setAssets(adjustedAssets);
    };

    const handlePreviewAdjustment = () => {
        const currentTotal = assets.reduce((sum, asset) => sum + parseFloat(asset.initialAllocationPercentage || 0), 0);
        if (currentTotal === 0) return;

        const factor = 100 / currentTotal;
        const preview = assets.map(asset => ({
            id: asset.id,
            name: asset.name,
            newPercentage: (parseFloat(asset.initialAllocationPercentage || 0) * factor).toFixed(2),
        }));
        setAdjustedPreview(preview);
    };

    const handleApplyAdjustment = () => {
        const adjustedAssets = assets.map(asset => {
            const previewAsset = adjustedPreview.find(p => p.id === asset.id);
            return previewAsset ? { ...asset, initialAllocationPercentage: previewAsset.newPercentage } : asset;
        });
        setAssets(adjustedAssets);
        setAdjustedPreview([]); // Clear preview after applying
    };

    const cancelAdjustment = () => {
        setAdjustedPreview([]);
    };
    
    // Initial data generation
    useEffect(() => {
        handleRegenerateAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Regenerate all if simulation period changes
    useEffect(() => {
        if (prevSimPeriodRef.current !== params.simulationPeriod) {
            handleRegenerateAll();
            prevSimPeriodRef.current = params.simulationPeriod;
        }
    }, [params.simulationPeriod, handleRegenerateAll]);

    useEffect(() => {
        setIsApiLimitReached(false);
    }, [apiKey]);

    const handleApiError = (message) => {
        const isLimitError = message && message.toLowerCase().includes('limit');
        if (isLimitError) {
            toast.error("API limit reached. New ticker data will be unavailable for this session.");
            setIsApiLimitReached(true);
        } else {
            toast.error(message);
        }
    };

    const validateParams = useCallback(() => {
        const newErrors = {};
        if (isNaN(parseFloat(params.initialCash)) || parseFloat(params.initialCash) < 0) newErrors.initialCash = 'Must be a positive number.';
        if (isNaN(parseInt(params.simulationPeriod, 10)) || parseInt(params.simulationPeriod, 10) < 3) newErrors.simulationPeriod = 'Must be at least 3 months.';
        if (params.enableRebalancing && (isNaN(parseInt(params.rebalancePeriod, 10)) || parseInt(params.rebalancePeriod, 10) <= 0)) newErrors.rebalancePeriod = 'Must be > 0.';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [params]);

    useEffect(() => {
        if (validateParams()) {
            const simPeriod = parseInt(params.simulationPeriod, 10);
            
            // Centralized data processing
            const processedAssets = processDataForSimulation(assets, simPeriod, regenerateSignal);
            const processedIndices = processDataForSimulation(comparisonIndices, simPeriod, regenerateSignal);

            const numericParams = {
                ...params,
                initialCash: parseFloat(params.initialCash) || 0,
                simulationPeriod: parseInt(params.simulationPeriod, 10) || 0,
                fixedMonthlyContribution: parseFloat(params.fixedMonthlyContribution) || 0,
                contributionAdjustmentIndexId: params.contributionAdjustmentIndexId,
                fixedMonthlyWithdrawal: parseFloat(params.fixedMonthlyWithdrawal) || 0,
                withdrawalAdjustmentIndexId: params.withdrawalAdjustmentIndexId,
                percentageProfitabilityWithdrawal: parseFloat(params.percentageProfitabilityWithdrawal) || 0,
                percentageCashWithdrawal: parseFloat(params.percentageCashWithdrawal) || 0,
                percentageExcessProfitWithdrawal: parseFloat(params.percentageExcessProfitWithdrawal) || 0,
                selectedComparisonIndexForWithdrawal: params.selectedComparisonIndexForWithdrawal,
                rebalancePeriod: parseInt(params.rebalancePeriod, 10) || 0,
                assets: processedAssets.map(a => ({...a, initialAllocationPercentage: parseFloat(a.initialAllocationPercentage) || 0, dividendYield: parseFloat(a.dividendYield) || 0, annualProfitability: parseFloat(a.annualProfitability) || 0, minMonthlyProfitability: parseFloat(a.minMonthlyProfitability) || 0, maxMonthlyProfitability: parseFloat(a.maxMonthlyProfitability) || 0 })),
                comparisonIndices: processedIndices.map(i => ({...i, annualProfitability: parseFloat(i.annualProfitability) || 0})),
            };
            const results = runSimulation(numericParams);
            setSimulationResults(results);
        } else {
            setSimulationResults([]);
        }
    }, [params, assets, comparisonIndices, validateParams, regenerateSignal]);
    
    const handleParamChange = (e) => {
        const { name, value, type, checked } = e.target;
        setParams(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleAssetChange = useCallback((id, field, value) => {
        setAssets(prevItems => prevItems.map(item => item.id === id ? { ...item, [field]: value } : item));
    }, []);
    
    const handleIndexChange = useCallback((id, field, value) => {
        setComparisonIndices(prevItems => prevItems.map(item => item.id === id ? { ...item, [field]: value } : item));
    }, []);

    const selectAssetSuggestion = useCallback((assetId, suggestion) => {
        setAssets(prevAssets => prevAssets.map(asset => 
            asset.id === assetId ? { ...asset, ticker: suggestion['1. symbol'], name: suggestion['2. name'], suggestions: [] } : asset
        ));
    }, []);

    const selectIndexSuggestion = useCallback((indexId, suggestion) => {
        setComparisonIndices(prevIndices => prevIndices.map(index => 
            index.id === indexId ? { ...index, ticker: suggestion['1. symbol'], name: suggestion['2. name'], suggestions: [] } : index
        ));
    }, []);

    const handleFetchData = async (id, type) => {
        // The API limit check is now handled entirely by the backend.
        // if (isApiLimitReached) {
        //     return toast.error("API limit reached. New data cannot be fetched until the key is changed.");
        // }

        const item = type === 'asset' ? assets.find(i => i.id === id) : comparisonIndices.find(i => i.id === id);
        if (!item?.ticker) {
            return toast.error("Please enter a ticker symbol before fetching data.");
        }
        if (!apiKey) {
            return toast.error("Please provide your Alpha Vantage API key to fetch data.");
        }

        const setter = type === 'asset' ? setAssets : setComparisonIndices;
        setter(prev => prev.map(i => i.id === id ? { ...i, status: 'loading' } : i));
        
        try {
            // This is the call that needs the 'full_data' type
            const response = await fetch('/api/market-data/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    type: 'full_data', 
                    ticker: item.ticker, 
                    name: item.name, 
                    apiKey: apiKey,
                    isApiLimitReached: isApiLimitReached // Pass the flag to the backend
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch data');
            }

            const data = await response.json();
            
            const monthlyReturns = data.monthly_returns;

            if (monthlyReturns) {
                setter(prev => prev.map(i => i.id === id ? { 
                    ...i, 
                    status: 'loaded', 
                    source: 'api', 
                    monthlyReturns,
                    historicalLength: monthlyReturns.length // Store the original length
                } : i));
            } else {
                throw new Error("No monthly returns data received from server.");
            }
        } catch (error) {
            handleApiError(error.message);
            setter(prev => prev.map(i => i.id === id ? { ...i, status: 'error' } : i));
        }
    };
    
    // The useEffect for clearing premium tickers is no longer needed.
    
    // Chart Data
    const pieChartData = {
        labels: assets.map(asset => asset.name),
        datasets: [{
            data: assets.map(asset => finalAllocation[asset.id] || 0),
            backgroundColor: assets.map((_, i) => `hsl(${i * (360 / assets.length)}, 70%, 60%)`),
        }],
    };

    const lineChartData = {
        labels: simulationResults.map(res => {
            const date = new Date(res.date);
            return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', '-');
        }),
        datasets: [
            {
                label: 'Total Portfolio Value',
                data: simulationResults.map(res => res.totalValue),
                borderColor: 'rgb(75, 192, 192)',
            },
            ...comparisonIndices.map((index, idx) => ({
                label: index.name,
                data: simulationResults.map(res => res.comparisonIndexValues[index.id]),
                borderColor: `hsl(${idx * 60 + 60}, 70%, 50%)`,
                borderDash: [5, 5],
            }))
        ],
    };

    const onError = (message) => {
        toast.error(message);
    };

    const MAX_HEADER_LENGTH = 20;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8 font-sans text-gray-800">
            <div className="max-w-7xl mx-auto bg-white shadow-2xl rounded-xl p-6 sm:p-10">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-indigo-700 mb-8">
                    Investment Portfolio Simulator
                </h1>

                <div className="flex flex-col gap-8">
                    <div className="p-6 bg-yellow-50 rounded-lg shadow-inner">
                        <h2 className="text-xl font-semibold text-yellow-800 mb-4">Your Alpha Vantage API Key</h2>
                        <div className="relative mt-1">
                            <input
                                type="text" // Changed from 'password' to 'text'
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="w-full p-2 pr-10 border border-gray-300 rounded-md"
                                placeholder="Enter your API Key"
                            />
                            {/* The visibility toggle button is removed */}
                        </div>
                        <p className="text-xs text-gray-600 mt-2">Your key is used to fetch data not yet in our cache. The results are then cached to benefit all users. Get a free key from <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Alpha Vantage</a>.</p>
                    </div>

                    {/* Assets Section */}
                    <div className="p-6 bg-blue-50 rounded-lg shadow-inner">
                        <h2 className="text-xl font-semibold text-blue-800 mb-4">Your Assets</h2>
                        <div className="space-y-4">
                            {assets.map(asset => (
                                <AssetItem 
                                    key={asset.id}
                                    asset={asset}
                                    onRemove={() => setAssets(assets.filter(a => a.id !== asset.id))}
                                    onChange={handleAssetChange}
                                    onSelectSuggestion={selectAssetSuggestion}
                                    onFetchData={handleFetchData}
                                    apiKey={apiKey}
                                    onError={handleApiError}
                                    isApiLimitReached={isApiLimitReached}
                                />
                            ))}
                        </div>
                        <button onClick={() => setAssets([...assets, { id: Date.now(), name: 'New Asset', initialAllocationPercentage: '0', dividendYield: '0', annualProfitability: '0', minMonthlyProfitability: '-5', maxMonthlyProfitability: '5', ticker: '', source: 'manual', monthlyReturns: [], status: 'idle', suggestions: [] }])} className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">+ Add Asset</button>
                        <div className={`mt-4 p-3 rounded-md text-center font-semibold flex justify-center items-center gap-4 ${
                            Math.abs(totalAllocationPercentage - 100) > 0.01 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                            <span>Total Allocation: {totalAllocationPercentage.toFixed(2)}%</span>
                            {Math.abs(totalAllocationPercentage - 100) > 0.01 && !adjustedPreview.length && (
                                <button onClick={handlePreviewAdjustment} className="bg-yellow-500 text-yellow-800 hover:bg-yellow-600 px-3 py-1 rounded-md text-sm font-bold">
                                    Adjust to 100%
                                </button>
                            )}
                        </div>
                    </div>
                    
                    {adjustedPreview.length > 0 && (
                        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                            <h4 className="font-semibold text-center mb-2">Adjustment Preview</h4>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-1">Asset</th>
                                        <th className="text-right py-1">New %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {adjustedPreview.map(item => (
                                        <tr key={item.id}>
                                            <td className="py-1">{item.name}</td>
                                            <td className="text-right py-1">{item.newPercentage}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="flex justify-center gap-4 mt-4">
                                <button onClick={handleApplyAdjustment} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-4 rounded-md">Apply</button>
                                <button onClick={cancelAdjustment} className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-1 px-4 rounded-md">Cancel</button>
                            </div>
                        </div>
                    )}

                    {/* Comparison Indices Section */}
                    <div className="p-6 bg-orange-50 rounded-lg shadow-inner">
                         <h2 className="text-xl font-semibold text-orange-800 mb-4">Comparison Indices</h2>
                         <div className="space-y-4">
                            {comparisonIndices.map(index => (
                                <IndexItem
                                    key={index.id}
                                    index={index}
                                    onRemove={() => setComparisonIndices(comparisonIndices.filter(i => i.id !== index.id))}
                                    onChange={handleIndexChange}
                                    onSelectSuggestion={selectIndexSuggestion}
                                    onFetchData={handleFetchData}
                                    apiKey={apiKey}
                                    onError={handleApiError}
                                    isApiLimitReached={isApiLimitReached}
                                />
                            ))}
                         </div>
                         <button onClick={() => setComparisonIndices([...comparisonIndices, { id: Date.now(), name: 'New Index', annualProfitability: '0', ticker: '', source: 'manual', monthlyReturns: [], status: 'idle', suggestions: [] }])} className="mt-4 w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">+ Add Index</button>
                    </div>

                    {/* General Config Section */}
                     <div className="p-6 bg-gray-50 rounded-lg shadow-inner space-y-4">
                         <h2 className="text-xl font-semibold text-gray-800 mb-4">General Simulation Settings</h2>
                         <InputField label="Initial Cash ($)" name="initialCash" value={params.initialCash} onChange={handleParamChange} error={errors.initialCash} />
                         <InputField label="Simulation Period (Months)" name="simulationPeriod" value={params.simulationPeriod} onChange={handleParamChange} error={errors.simulationPeriod} />
                         
                         <div className="pt-4 border-t">
                            <h3 className="font-semibold text-gray-700">Contributions</h3>
                            <InputField label="Fixed Monthly Contribution ($)" name="fixedMonthlyContribution" value={params.fixedMonthlyContribution} onChange={handleParamChange} error={errors.fixedMonthlyContribution} />
                            <label className="text-sm text-gray-600 mt-2 block">Adjust contribution by index (optional)</label>
                            <select name="contributionAdjustmentIndexId" value={params.contributionAdjustmentIndexId} onChange={handleParamChange} className="w-full p-2 border rounded-md border-gray-300">
                                <option value="">No Adjustment</option>
                                {comparisonIndices.map(index => <option key={index.id} value={index.id}>{index.name}</option>)}
                            </select>
                         </div>

                         <div className="pt-4 border-t">
                            <h3 className="font-semibold text-gray-700">Withdrawals</h3>
                            <InputField label="Fixed Monthly Withdrawal ($)" name="fixedMonthlyWithdrawal" value={params.fixedMonthlyWithdrawal} onChange={handleParamChange} />
                             <label className="text-sm text-gray-600 mt-2 block">Adjust withdrawal by index (optional)</label>
                             <select name="withdrawalAdjustmentIndexId" value={params.withdrawalAdjustmentIndexId} onChange={handleParamChange} className="w-full p-2 border rounded-md border-gray-300">
                                 <option value="">No Adjustment</option>
                                 {comparisonIndices.map(index => <option key={index.id} value={index.id}>{index.name}</option>)}
                             </select>
                            <InputField label="Withdraw % of Monthly Profitability" name="percentageProfitabilityWithdrawal" value={params.percentageProfitabilityWithdrawal} onChange={handleParamChange} />
                            <InputField label="Withdraw % of Cash Balance" name="percentageCashWithdrawal" value={params.percentageCashWithdrawal} onChange={handleParamChange} />
                            <InputField label="Withdraw % of Profit Above Index" name="percentageExcessProfitWithdrawal" value={params.percentageExcessProfitWithdrawal} onChange={handleParamChange} />
                            <label className="text-sm text-gray-600 mt-2 block">Select Index for &apos;Profit Above&apos;</label>
                            <select name="selectedComparisonIndexForWithdrawal" value={params.selectedComparisonIndexForWithdrawal} onChange={handleParamChange} className="w-full p-2 border rounded-md border-gray-300">
                                <option value="">Select Index</option>
                                {comparisonIndices.map(index => <option key={index.id} value={index.id}>{index.name}</option>)}
                            </select>
                         </div>


                         <div className="pt-4 border-t">
                            <h3 className="font-semibold text-gray-700">Rebalancing</h3>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" name="enableRebalancing" checked={params.enableRebalancing} onChange={handleParamChange} className="h-5 w-5"/>
                                <span>Enable Rebalancing</span>
                            </div>
                            {params.enableRebalancing && (
                                <InputField label="Rebalancing Period (months)" name="rebalancePeriod" value={params.rebalancePeriod} onChange={handleParamChange} error={errors.rebalancePeriod} />
                            )}
                         </div>
                    </div>

                    {/* Charts and Report */}
                    <div className="p-6 bg-white rounded-lg shadow-lg">
                        <h2 className="text-xl font-semibold text-center mb-4">Final Portfolio Allocation</h2>
                        <div className="w-full h-80 max-w-md mx-auto">
                            <Pie data={pieChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                        </div>
                    </div>
                    <div className="p-6 bg-white rounded-lg shadow-lg">
                         <h2 className="text-xl font-semibold text-center mb-4">Portfolio Evolution vs. Indices</h2>
                        <div className="w-full h-96">
                            <Line data={lineChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                        </div>
                    </div>
                     <div className="mt-10 p-6 bg-gray-50 rounded-lg shadow-inner overflow-x-auto">
                        {generatedDataNotice && (
                            <div className="mb-4 p-3 bg-blue-100 border-l-4 border-blue-500 text-blue-800 rounded-r-lg">
                                <p className="font-semibold">Data Generation Notice</p>
                                <p className="text-sm">
                                    The shortest historical data found for an asset was {shortestApiHistory} months. 
                                    The remaining {params.simulationPeriod - shortestApiHistory} months have been randomly generated to complete the {params.simulationPeriod}-month simulation period.
                                </p>
                            </div>
                        )}
                        <div className="flex justify-center mb-4">
                            <button onClick={handleRegenerateAll} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-6 rounded-md shadow-md transition duration-300">
                                Regenerate Manual Simulations
                            </button>
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Detailed Results</h2>
                        <table className="min-w-full bg-white text-sm">
                            <thead className="bg-gray-200">
                                <tr>
                                    <th className="py-2 px-3 text-left">Month</th>
                                    {assets.map(asset => (
                                        <th key={asset.id} className="py-2 px-3 text-left bg-blue-50" title={asset.name}>
                                            {asset.name.length > MAX_HEADER_LENGTH ? asset.ticker : asset.name}
                                        </th>
                                    ))}
                                    {comparisonIndices.map(index => (
                                        <th key={index.id} className="py-2 px-3 text-left bg-orange-50" title={index.name}>
                                            {index.name.length > MAX_HEADER_LENGTH ? index.ticker : index.name}
                                        </th>
                                    ))}
                                    {showDividends && <th className="py-2 px-3 text-left bg-yellow-50">Dividends</th>}
                                    {showContributions && <th className="py-2 px-3 text-left bg-green-50">Contributions</th>}
                                    {showWithdrawals && <th className="py-2 px-3 text-left bg-red-50">Withdrawals</th>}
                                    {showNetCashFlow && <th className="py-2 px-3 text-left bg-gray-100">Net Cash Flow</th>}
                                    <th className="py-2 px-3 text-left font-bold bg-gray-200">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {simulationResults.map(result => (
                                    <tr key={result.period} className="border-b">
                                        <td className="py-2 px-3">
                                            {result.period === 0 ? 'Current' : new Date(result.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', '-')}
                                        </td>
                                        {assets.map(asset => <td key={asset.id} className="py-2 px-3 bg-blue-50">{formatCurrency(result.assetValues[asset.id])}</td>)}
                                        {comparisonIndices.map(index => <td key={index.id} className="py-2 px-3 bg-orange-50">{formatCurrency(result.comparisonIndexValues[index.id])}</td>)}
                                        {showDividends && <td className="py-2 px-3 bg-yellow-50">{formatCurrency(result.monthlyDividends)}</td>}
                                        {showContributions && <td className="py-2 px-3 bg-green-50">{formatCurrency(result.monthlyContributionAmount)}</td>}
                                        {showWithdrawals && <td className="py-2 px-3 bg-red-50">{formatCurrency(result.monthlyWithdrawalAmount)}</td>}
                                        {showNetCashFlow && <td className={`py-2 px-3 bg-gray-100 ${result.netCashFlow < 0 ? 'text-red-600' : ''}`}>
                                            {formatCurrency(result.netCashFlow)}
                                        </td>}
                                        <td className="py-2 px-3 font-bold bg-gray-200">{formatCurrency(result.totalValue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvestmentPortfolioSimulator; 