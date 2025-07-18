export const generateManualReturns = (asset, periods, random = Math.random) => {
    const monthlyRate = Math.pow(1 + asset.annualProfitability / 100, 1/12) - 1;
    const min = asset.minMonthlyProfitability / 100;
    const max = asset.maxMonthlyProfitability / 100;
    
    if (min !== undefined && max !== undefined && min < max) {
        return Array.from({ length: periods }, () => random() * (max - min) + min);
    }
    
    return Array(periods).fill(monthlyRate);
};

export const runSimulation = (params) => {
    // This function now expects 'assets' and 'comparisonIndices' to be fully processed
    // with the correct number of monthly returns for the simulation period.
    const {
        initialCash,
        simulationPeriod,
        fixedMonthlyContribution, contributionAdjustmentIndexId,
        fixedMonthlyWithdrawal, withdrawalAdjustmentIndexId,
        percentageProfitabilityWithdrawal, percentageCashWithdrawal, 
        percentageExcessProfitWithdrawal, 
        selectedComparisonIndexForWithdrawal, enableRebalancing, rebalancePeriod,
        assets, // These are now the 'processedAssets'
        comparisonIndices, // These are now the 'processedIndices'
    } = params;
    
    // The Data Completion logic has been moved to the frontend.
    
    const results = [];
    let currentAssetValues = {};
    
    assets.forEach(asset => {
        const allocatedAmount = initialCash * (asset.initialAllocationPercentage / 100);
        currentAssetValues[asset.id] = allocatedAmount;
    });
    let currentCashBalance = initialCash - Object.values(currentAssetValues).reduce((sum, val) => sum + val, 0);

    if (currentCashBalance < 0) currentCashBalance = 0;

    const totalInitialInvestedInAssets = Object.values(currentAssetValues).reduce((sum, val) => sum + val, 0);
    let currentComparisonIndexValues = {};
    comparisonIndices.forEach(index => {
        currentComparisonIndexValues[index.id] = totalInitialInvestedInAssets;
    });

    const assetReturnsForSim = {};
    assets.forEach(asset => {
        if (asset.source === 'api' && asset.monthlyReturns?.length > 0) {
            assetReturnsForSim[asset.id] = asset.monthlyReturns;
        } else {
             // Use pre-generated returns for manual assets
            assetReturnsForSim[asset.id] = asset.monthlyReturns || [];
        }
    });
    
    const indexReturnsForSim = {};
    comparisonIndices.forEach(index => {
        if (index.source === 'api' && index.monthlyReturns?.length > 0) {
            indexReturnsForSim[index.id] = index.monthlyReturns;
        } else {
            const monthlyReturn = Math.pow(1 + index.annualProfitability / 100, 1/12) - 1;
            indexReturnsForSim[index.id] = Array(simulationPeriod).fill(monthlyReturn);
        }
    });

    const initialTotalPortfolioValue = totalInitialInvestedInAssets + currentCashBalance;
    const startDate = new Date();
    results.push({
        period: 0, 
        date: startDate,
        totalValue: initialTotalPortfolioValue, 
        assetValues: { ...currentAssetValues }, 
        cashBalance: currentCashBalance,
        comparisonIndexValues: { ...currentComparisonIndexValues }, 
        monthlyContributionAmount: 0, 
        monthlyWithdrawalAmount: 0,
    });

    let adjustedContribution = fixedMonthlyContribution;
    let adjustedWithdrawal = fixedMonthlyWithdrawal;

    for (let i = 1; i <= simulationPeriod; i++) {
        let nextAssetValues = { ...currentAssetValues };
        let nextComparisonIndexValues = { ...currentComparisonIndexValues };
        
        // --- Start of Month ---
        const portfolioValueAtStartOfMonth = results[i-1].totalValue;

        // 1. Contributions
        let monthlyContributionAmount = 0;
        if (contributionAdjustmentIndexId) {
            const returnIndex = (indexReturnsForSim[contributionAdjustmentIndexId]?.length || 0) - simulationPeriod + i - 1;
            const monthlyReturn = indexReturnsForSim[contributionAdjustmentIndexId]?.[returnIndex] ?? 0;
            adjustedContribution *= (1 + monthlyReturn);
        }
        monthlyContributionAmount = adjustedContribution;
        currentCashBalance += monthlyContributionAmount;
        
        const portfolioValueBeforeGrowth = Object.values(currentAssetValues).reduce((s, v) => s + v, 0) + currentCashBalance;

        // 2. Asset Growth
        assets.forEach(asset => {
            const returnIndex = (assetReturnsForSim[asset.id]?.length || 0) - simulationPeriod + i - 1;
            const monthlyReturn = assetReturnsForSim[asset.id]?.[returnIndex] ?? 0;
            nextAssetValues[asset.id] *= (1 + monthlyReturn);
        });
        
        // 3. Comparison Index Growth (Separate Loop)
        comparisonIndices.forEach(index => {
            const returnIndex = (indexReturnsForSim[index.id]?.length || 0) - simulationPeriod + i - 1;
            const monthlyReturn = indexReturnsForSim[index.id]?.[returnIndex] ?? 0;
            nextComparisonIndexValues[index.id] = currentComparisonIndexValues[index.id] * (1 + monthlyReturn) + monthlyContributionAmount;
        });
        
        // 4. Dividend Payments
        let monthlyDividends = 0;
        assets.forEach(asset => {
            if(asset.dividendYield > 0) {
                const dividendPayment = nextAssetValues[asset.id] * (asset.dividendYield / 100);
                currentCashBalance += dividendPayment;
                monthlyDividends += dividendPayment;
            }
        });
        
        const portfolioValueAfterGrowthAndDividends = Object.values(nextAssetValues).reduce((s, v) => s + v, 0) + currentCashBalance;
        const monthlyPortfolioProfit = portfolioValueAfterGrowthAndDividends - portfolioValueBeforeGrowth;
        
        // 5. Withdrawals
        if (withdrawalAdjustmentIndexId) {
            const returnIndex = (indexReturnsForSim[withdrawalAdjustmentIndexId]?.length || 0) - simulationPeriod + i - 1;
            const monthlyReturn = indexReturnsForSim[withdrawalAdjustmentIndexId]?.[returnIndex] ?? 0;
            adjustedWithdrawal *= (1 + monthlyReturn);
        }

        let totalWithdrawalAmount = adjustedWithdrawal > 0 ? adjustedWithdrawal : 0;
        const cashForWithdrawalCalc = currentCashBalance;
        
        if (percentageProfitabilityWithdrawal > 0 && monthlyPortfolioProfit > 0) {
            totalWithdrawalAmount += monthlyPortfolioProfit * (percentageProfitabilityWithdrawal / 100);
        }

        if (percentageCashWithdrawal > 0 && cashForWithdrawalCalc > 0) {
            totalWithdrawalAmount += cashForWithdrawalCalc * (percentageCashWithdrawal / 100);
        }
        
        if (percentageExcessProfitWithdrawal > 0 && selectedComparisonIndexForWithdrawal) {
            const indexValueAtStart = currentComparisonIndexValues[selectedComparisonIndexForWithdrawal];
            const indexValueAfter = nextComparisonIndexValues[selectedComparisonIndexForWithdrawal];
            const monthlyIndexProfit = indexValueAfter - indexValueAtStart;

            const excessProfit = monthlyPortfolioProfit - monthlyIndexProfit;
            if (excessProfit > 0) {
                totalWithdrawalAmount += excessProfit * (percentageExcessProfitWithdrawal / 100);
            }
        }
        
        // Deduct from cash first, then proportionally from assets
        if (totalWithdrawalAmount > 0) {
            const cashWithdrawal = Math.min(currentCashBalance, totalWithdrawalAmount);
            currentCashBalance -= cashWithdrawal;
            let remainingWithdrawal = totalWithdrawalAmount - cashWithdrawal;

            if (remainingWithdrawal > 0) {
                const totalAssetValue = Object.values(nextAssetValues).reduce((sum, v) => sum + v, 0);
                if (totalAssetValue > 0) {
                     assets.forEach(asset => {
                        const proportion = nextAssetValues[asset.id] / totalAssetValue;
                        const withdrawalFromAsset = remainingWithdrawal * proportion;
                        nextAssetValues[asset.id] -= withdrawalFromAsset;
                    });
                }
            }
        }

        const cashBeforeReinvestment = currentCashBalance;

        // 5. Monthly reinvestment from cash
        if (currentCashBalance > 0 && assets.length > 0) {
            const cashToInvest = currentCashBalance;
            const totalValueForAllocation = Object.values(nextAssetValues).reduce((s, v) => s + v, 0) + cashToInvest;
            
            const allocationWithDeltas = assets.map(asset => {
                const targetValue = totalValueForAllocation * (asset.initialAllocationPercentage / 100);
                const delta = targetValue - nextAssetValues[asset.id];
                return { id: asset.id, delta };
            });

            const mostUnderweightAsset = allocationWithDeltas.reduce((mostUnderweight, current) => {
                return current.delta > mostUnderweight.delta ? current : mostUnderweight;
            }, { id: null, delta: -Infinity });

            if (mostUnderweightAsset.id !== null && mostUnderweightAsset.delta > 0) {
                nextAssetValues[mostUnderweightAsset.id] += cashToInvest;
            } else { // If all are at or above target, distribute proportionally
                assets.forEach(asset => {
                    nextAssetValues[asset.id] += cashToInvest * (asset.initialAllocationPercentage / 100);
                });
            }
            
            currentCashBalance = 0;
        }

        // 7. Periodic Full Rebalancing
        if (enableRebalancing && rebalancePeriod > 0 && i % rebalancePeriod === 0) {
            let totalPortfolioValueForRebalance = Object.values(nextAssetValues).reduce((sum, val) => sum + val, 0) + currentCashBalance;
            let cashFromRebalancing = 0;

            assets.forEach(asset => {
                const targetValue = totalPortfolioValueForRebalance * (asset.initialAllocationPercentage / 100);
                const delta = targetValue - nextAssetValues[asset.id];
                nextAssetValues[asset.id] += delta;
                cashFromRebalancing -= delta;
            });
            currentCashBalance += cashFromRebalancing;
        }

        const currentTotalPortfolioValue = Object.values(nextAssetValues).reduce((s, v) => s + v, 0) + currentCashBalance;
        const netCashFlow = monthlyContributionAmount + monthlyDividends - totalWithdrawalAmount;

        const currentDate = new Date(startDate);
        currentDate.setMonth(startDate.getMonth() + i);

        results.push({
            period: i,
            date: currentDate,
            totalValue: currentTotalPortfolioValue,
            assetValues: { ...nextAssetValues },
            cashBalance: cashBeforeReinvestment,
            comparisonIndexValues: { ...nextComparisonIndexValues },
            monthlyDividends: monthlyDividends,
            monthlyContributionAmount: monthlyContributionAmount,
            monthlyWithdrawalAmount: totalWithdrawalAmount,
            netCashFlow: netCashFlow,
        });
        currentAssetValues = nextAssetValues;
        currentComparisonIndexValues = nextComparisonIndexValues;
    }
    return results;
}; 