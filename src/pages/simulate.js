import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title as ChartTitle } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';

import { formatCurrency } from '@/utils/helpers';
import { fetchHistoricalData } from '@/lib/api';
import { runSimulation, generateManualReturns } from '@/lib/simulation';

import InputField from '@/components/InputField';
import AssetItem from '@/components/AssetItem';
import IndexItem from '@/components/IndexItem';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, ChartTitle);

// --- Main App Component ---
const InvestmentPortfolioSimulator = () => {
    const [params, setParams] = useState({
        initialCash: '500000',
        simulationPeriod: '48',
        fixedMonthlyContribution: '0',
        contributionAdjustmentIndexId: '',
        fixedMonthlyWithdrawal: '0',
        withdrawalAdjustmentIndexId: '',
        percentageProfitabilityWithdrawal: '0',
        percentageCashWithdrawal: '0',
        percentageExcessProfitWithdrawal: '0',
        selectedComparisonIndexForWithdrawal: '',
        rebalancePeriod: '12',
        enableRebalancing: false,
    });

    const [assets, setAssets] = useState([
        { id: 1, name: 'Fixed Income', initialAllocationPercentage: '25', dividendYield: '0', annualProfitability: '15', minMonthlyProfitability: '1.2', maxMonthlyProfitability: '1.3', ticker: '', source: 'manual', monthlyReturns: [], status: 'idle', suggestions: [] },
        { id: 2, name: 'REITs', initialAllocationPercentage: '25', dividendYield: '0', annualProfitability: '8', minMonthlyProfitability: '-10', maxMonthlyProfitability: '15', ticker: '', source: 'manual', monthlyReturns: [], status: 'idle', suggestions: [] },
        { id: 3, name: 'BR Stocks', initialAllocationPercentage: '25', dividendYield: '0', annualProfitability: '12', minMonthlyProfitability: '-20', maxMonthlyProfitability: '20', ticker: 'IBOV.SA', source: 'manual', monthlyReturns: [], status: 'idle', suggestions: [] },
        { id: 4, name: 'International Stocks', initialAllocationPercentage: '25', dividendYield: '0', annualProfitability: '12', minMonthlyProfitability: '-20', maxMonthlyProfitability: '20', ticker: 'SPY', source: 'manual', monthlyReturns: [], status: 'idle', suggestions: [] },
    ]);
    const [comparisonIndices, setComparisonIndices] = useState([
        { id: 1, name: 'Inflation', annualProfitability: '6', ticker: '', source: 'manual', monthlyReturns: [], status: 'idle', suggestions: [] },
        { id: 2, name: 'SELIC', annualProfitability: '15', ticker: '', source: 'manual', monthlyReturns: [], status: 'idle', suggestions: [] },
    ]);
    
    const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY || '');
    const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
    const [simulationResults, setSimulationResults] = useState([]);
    const [errors, setErrors] = useState({});

    const prevSimPeriodRef = useRef(params.simulationPeriod);

    const finalAllocation = simulationResults[simulationResults.length - 1]?.assetValues || {};
    const totalAllocationPercentage = assets.reduce((sum, asset) => sum + parseFloat(asset.initialAllocationPercentage || 0), 0);

    const showContributions = simulationResults.some(res => res.monthlyContributionAmount > 0);
    const showWithdrawals = simulationResults.some(res => res.monthlyWithdrawalAmount > 0);
    const showDividends = simulationResults.some(res => res.monthlyDividends > 0);
    const showNetCashFlow = showContributions || showWithdrawals || showDividends;

    const handleRegenerateAll = useCallback(() => {
        const simPeriod = parseInt(params.simulationPeriod, 10);
        if(isNaN(simPeriod) || simPeriod <= 0) return;

        setAssets(prevAssets => 
            prevAssets.map(asset => {
                if (asset.source === 'manual') {
                    const numericAsset = {
                        ...asset,
                        annualProfitability: parseFloat(asset.annualProfitability),
                        minMonthlyProfitability: parseFloat(asset.minMonthlyProfitability),
                        maxMonthlyProfitability: parseFloat(asset.maxMonthlyProfitability),
                    };
                    return { ...asset, monthlyReturns: generateManualReturns(numericAsset, simPeriod) };
                }
                return asset;
            })
        );
    }, [params.simulationPeriod]);

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
                assets: assets.map(a => ({...a, initialAllocationPercentage: parseFloat(a.initialAllocationPercentage) || 0, dividendYield: parseFloat(a.dividendYield) || 0, annualProfitability: parseFloat(a.annualProfitability) || 0, minMonthlyProfitability: parseFloat(a.minMonthlyProfitability) || 0, maxMonthlyProfitability: parseFloat(a.maxMonthlyProfitability) || 0 })),
                comparisonIndices: comparisonIndices.map(i => ({...i, annualProfitability: parseFloat(i.annualProfitability) || 0})),
            };
            const results = runSimulation(numericParams);
            setSimulationResults(results);
        } else {
            setSimulationResults([]);
        }
    }, [params, assets, comparisonIndices, validateParams]);
    
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
        const item = type === 'asset' ? assets.find(i => i.id === id) : comparisonIndices.find(i => i.id === id);
        if(!item?.ticker) {
            alert("Please enter a ticker symbol before fetching data.");
            return;
        }
        const setter = type === 'asset' ? setAssets : setComparisonIndices;
        setter(prev => prev.map(i => i.id === id ? { ...i, status: 'loading' } : i));
        const monthlyReturns = await fetchHistoricalData(apiKey, item.ticker);

        if (monthlyReturns) {
            setter(prev => prev.map(i => i.id === id ? { ...i, status: 'loaded', source: 'api', monthlyReturns } : i));
        } else {
             setter(prev => prev.map(i => i.id === id ? { ...i, status: 'error' } : i));
        }
    };
    
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8 font-sans text-gray-800">
            <div className="max-w-7xl mx-auto bg-white shadow-2xl rounded-xl p-6 sm:p-10">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-indigo-700 mb-8">
                    Investment Portfolio Simulator
                </h1>

                <div className="flex flex-col gap-8">
                    {/* API Key Config */}
                    <div className="p-6 bg-yellow-50 rounded-lg shadow-inner">
                        <h2 className="text-xl font-semibold text-yellow-800 mb-4">API Configuration (Alpha Vantage)</h2>
                        <div className="relative mt-1">
                            <input
                                type={isApiKeyVisible ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="w-full p-2 pr-10 border border-gray-300 rounded-md"
                                placeholder="Enter your API Key"
                            />
                            <button
                                type="button"
                                onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
                                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-600 hover:text-gray-800"
                                aria-label={isApiKeyVisible ? 'Hide API Key' : 'Show API Key'}
                            >
                                {isApiKeyVisible ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67.127 2.457.362m-4.594 8.843a3 3 0 114.243-4.242M6.125 6.125L17.875 17.875"></path></svg>
                                )}
                            </button>
                        </div>
                        <p className="text-xs text-gray-600 mt-2">A default demo key is provided. For higher usage, get a free key from <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Alpha Vantage</a> and add it to your <code>.env.local</code> file as <code>NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY</code>.</p>
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
                                />
                            ))}
                        </div>
                        <button onClick={() => setAssets([...assets, { id: Date.now(), name: 'New Asset', initialAllocationPercentage: '0', dividendYield: '0', annualProfitability: '0', minMonthlyProfitability: '-5', maxMonthlyProfitability: '5', ticker: '', source: 'manual', monthlyReturns: [], status: 'idle', suggestions: [] }])} className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">+ Add Asset</button>
                        <div className={`mt-4 p-3 rounded-md text-center font-semibold ${totalAllocationPercentage > 100 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                            Total Allocation: {totalAllocationPercentage.toFixed(2)}%
                        </div>
                    </div>
                    
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
                                    {assets.map(asset => <th key={asset.id} className="py-2 px-3 text-left bg-blue-50">{asset.name}</th>)}
                                    {comparisonIndices.map(index => <th key={index.id} className="py-2 px-3 text-left bg-orange-50">{index.name}</th>)}
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