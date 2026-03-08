import { formatCurrency, formatPercentage, calculatePnL, formatDate } from './utils.js';
import { updatePortfolioChart } from './charting.js';

// --- DOM Elements ---
const DOM = {
    balanceHeader: document.getElementById('header-balance'),
    portfolioHeader: document.getElementById('header-portfolio-value'),
    pnlHeader: document.getElementById('header-total-pnl'),

    marketList: document.getElementById('market-list'),
    heatmapContainer: document.getElementById('heatmap-container'),
    portfolioList: document.getElementById('portfolio-list'),
    transactionHistory: document.getElementById('transaction-history'),
    pendingOrdersList: document.getElementById('pending-orders-list'),

    // Modal
    tradeModal: document.getElementById('trade-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalTypeBadge: document.getElementById('modal-type-badge'),
    modalStockSymbol: document.getElementById('modal-stock-symbol'),
    modalStockPrice: document.getElementById('modal-stock-price'),
    modalQuantity: document.getElementById('trade-quantity'),
    modalTotalValue: document.getElementById('modal-total-value'),
    modalUserBalance: document.getElementById('modal-user-balance'),
    modalErrorMsg: document.getElementById('modal-error-msg'),
    modalOwnedContainer: document.getElementById('modal-owned-container'),
    modalOwnedQty: document.getElementById('modal-owned-qty'),
    confirmTradeBtn: document.getElementById('confirm-trade-btn'),
    closeModalBtn: document.getElementById('close-modal'),

    // Order Type inside Modal
    btnMarketOrder: document.getElementById('btn-market-order'),
    btnLimitOrder: document.getElementById('btn-limit-order'),
    priceInputContainer: document.getElementById('price-input-container'),
    tradePrice: document.getElementById('trade-price'),

    // Toast
    toastContainer: document.getElementById('toast-container'),

    // Theme & Reset
    themeToggle: document.getElementById('theme-toggle'),
    themeIcon: document.getElementById('theme-icon'),
    stockSearchInput: document.getElementById('stock-search-input'),
    tickerContent: document.getElementById('ticker-content'),
    resetBtn: document.getElementById('reset-account-btn'),

    // Tabs & Insights
    tabInsights: document.getElementById('tab-insights'),
    tabStocks: document.getElementById('tab-stocks'),
    insightsView: document.getElementById('insights-view'),
    marketSentimentText: document.getElementById('market-sentiment-text'),
    sentimentAdvanceBar: document.getElementById('sentiment-advance-bar'),
    sentimentAdvances: document.getElementById('sentiment-advances'),
    sentimentDeclines: document.getElementById('sentiment-declines'),
    sectorPerformanceList: document.getElementById('sector-performance-list'),
    whatsMovingList: document.getElementById('whats-moving-list'),
    highUpsideList: document.getElementById('high-upside-list'),

    // Stock Detail Overlay
    dashboardView: document.getElementById('dashboard-view'),
    stockDetailView: document.getElementById('stock-detail-view'),
    detailSymbol: document.getElementById('detail-symbol'),
    detailName: document.getElementById('detail-name'),
    detailPrice: document.getElementById('detail-price'),
    detailChange: document.getElementById('detail-change'),
    detailMcap: document.getElementById('detail-mcap'),
    detailHigh: document.getElementById('detail-high'),
    detailLow: document.getElementById('detail-low'),
    detailBuyBtn: document.getElementById('detail-buy-btn'),
    detailSellBtn: document.getElementById('detail-sell-btn'),
    backToDashboardBtn: document.getElementById('back-to-dashboard-btn')
};

let currentTradeConfig = null; // { type: 'BUY'|'SELL', symbol: string, currentPrice: number, balance: number, ownedQty: number, orderType: 'MARKET'|'LIMIT' }
export let currentDetailSymbol = null;
let currentFilter = 'ALL'; // ALL, GAINERS, LOSERS, PENNY
let currentSearchQuery = '';

export function setMarketFilter(filter) {
    currentFilter = filter;
    // Update active pill styling manually here or in app.js
}

export function setSearchQuery(query) {
    currentSearchQuery = query.trim().toLowerCase();
}

/**
 * Render Market List with Screener Filtering
 */
export function renderMarket(marketData) {
    DOM.marketList.innerHTML = '';

    let filteredData = [...marketData];

    if (currentFilter === 'GAINERS') {
        filteredData = filteredData.filter(s => s.currentPrice >= s.prevPrice).sort((a, b) => (b.currentPrice / b.prevPrice) - (a.currentPrice / a.prevPrice));
    } else if (currentFilter === 'LOSERS') {
        filteredData = filteredData.filter(s => s.currentPrice < s.prevPrice).sort((a, b) => (a.currentPrice / a.prevPrice) - (b.currentPrice / b.prevPrice));
    } else if (currentFilter === 'PENNY') {
        filteredData = filteredData.filter(s => s.currentPrice < 1000).sort((a, b) => a.currentPrice - b.currentPrice);
    }

    if (currentSearchQuery) {
        filteredData = filteredData.filter(s =>
            s.symbol.toLowerCase().includes(currentSearchQuery) ||
            s.name.toLowerCase().includes(currentSearchQuery)
        );
    }

    if (filteredData.length === 0) {
        DOM.marketList.innerHTML = '<div class="text-center text-gray-500 py-4 italic">No stocks match this filter.</div>';
        return;
    }

    filteredData.forEach(stock => {
        const item = document.createElement('div');
        item.className = 'market-list-item flex justify-between items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600 gap-2 cursor-pointer';
        item.dataset.symbol = stock.symbol;

        let priceColor = 'text-gray-900 dark:text-gray-100';
        let arrow = '';
        if (stock.currentPrice > stock.prevPrice) {
            priceColor = 'text-green-600 dark:text-green-400';
            arrow = '<i class="fas fa-caret-up ml-1"></i>';
        } else if (stock.currentPrice < stock.prevPrice) {
            priceColor = 'text-red-600 dark:text-red-400';
            arrow = '<i class="fas fa-caret-down ml-1"></i>';
        }

        item.innerHTML = `
            <div class="flex-1 min-w-0 pr-1">
                <h3 class="font-bold text-gray-900 dark:text-white text-[13px] truncate" title="${stock.symbol}">${stock.symbol}</h3>
                <p class="text-[11px] text-gray-500 truncate" title="${stock.name}">${stock.name}</p>
            </div>
            <div class="flex items-center space-x-2 shrink-0">
                <div class="text-right">
                    <p class="font-mono font-bold text-xs ${priceColor}">${formatCurrency(stock.currentPrice)}${arrow}</p>
                </div>
            </div>
        `;
        DOM.marketList.appendChild(item);
    });
}

/**
 * Render dynamic Market Heatmap based on Market Cap and % Change
 */
export function renderHeatmap(marketData) {
    if (!DOM.heatmapContainer) return;
    DOM.heatmapContainer.innerHTML = '';

    // Sort by market cap descending to put biggest blocks first
    const sortedData = [...marketData].sort((a, b) => b.marketCap - a.marketCap);

    sortedData.forEach(stock => {
        const block = document.createElement('div');

        // Calculate color intensity (simplified)
        const diffPercent = stock.prevPrice > 0 ? ((stock.currentPrice - stock.prevPrice) / stock.prevPrice) * 100 : 0;

        let bgColorClass = 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'; // neutral
        if (diffPercent > 0.5) bgColorClass = 'bg-green-200 dark:bg-green-900/60 text-green-800 dark:text-green-300';
        else if (diffPercent > 0) bgColorClass = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
        else if (diffPercent < -0.5) bgColorClass = 'bg-red-200 dark:bg-red-900/60 text-red-800 dark:text-red-300';
        else if (diffPercent < 0) bgColorClass = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';

        block.className = `${bgColorClass} flex flex-col justify-center items-center rounded overflow-hidden cursor-pointer hover:opacity-80 transition-colors duration-500 shadow-sm border border-transparent dark:hover:border-gray-500`;

        // Show inner text
        block.innerHTML = `
            <span class="font-bold text-[11px] md:text-xs truncate max-w-full px-1">${stock.symbol}</span>
            <span class="text-[9px] md:text-[10px] opacity-80 truncate max-w-full px-1">${diffPercent > 0 ? '+' : ''}${diffPercent.toFixed(2)}%</span>
        `;
        block.title = `${stock.name}: ${diffPercent > 0 ? '+' : ''}${diffPercent.toFixed(2)}%`;

        // Quick buy hook from heatmap
        block.addEventListener('click', () => {
            const row = document.querySelector(`.market-list-item[data-symbol="${stock.symbol}"]`);
            if (row) row.click();
        });

        DOM.heatmapContainer.appendChild(block);
    });
}

/**
 * Render Portfolio Table and update total values
 */
export function renderPortfolio(portfolio, marketData, balance) {
    DOM.portfolioList.innerHTML = '';

    let totalPortfolioValue = 0;
    let totalInvested = 0;

    const symbols = Object.keys(portfolio);

    if (symbols.length === 0) {
        DOM.portfolioList.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500 italic">Your portfolio is currently empty.</td></tr>`;
    } else {
        symbols.forEach(symbol => {
            const holding = portfolio[symbol];
            if (holding.quantity <= 0) return;

            const stock = marketData.find(s => s.symbol === symbol);
            if (!stock) return;

            const { pnlValue, pnlPercentage } = calculatePnL(stock.currentPrice, holding.averagePrice, holding.quantity);
            const currentValue = stock.currentPrice * holding.quantity;

            totalPortfolioValue += currentValue;
            totalInvested += holding.averagePrice * holding.quantity;

            const pnlClass = pnlValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
            const pnlSign = pnlValue >= 0 ? '+' : '';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="font-bold text-gray-900 dark:text-white">${symbol}</td>
                <td>${holding.quantity}</td>
                <td class="font-mono text-gray-600 dark:text-gray-300">${formatCurrency(holding.averagePrice)}</td>
                <td class="font-mono text-gray-900 dark:text-white">${formatCurrency(stock.currentPrice)}</td>
                <td class="font-mono font-medium text-gray-900 dark:text-white">${formatCurrency(currentValue)}</td>
                <td class="font-mono font-bold ${pnlClass}">
                    ${pnlSign}${formatCurrency(pnlValue)} <span class="text-xs">(${pnlSign}${formatPercentage(pnlPercentage)})</span>
                </td>
                <td class="text-right">
                    <button class="sell-btn text-xs bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:hover:bg-red-800/60 dark:text-red-300 px-2 py-1 rounded font-semibold transition-colors" data-symbol="${symbol}">
                        SELL
                    </button>
                </td>
            `;
            DOM.portfolioList.appendChild(row);
        });
    }

    renderSummary(balance, totalPortfolioValue, totalInvested);
}

/**
 * Render Pending Orders List
 */
export function renderPendingOrders(pendingOrders) {
    DOM.pendingOrdersList.innerHTML = '';
    if (!pendingOrders || pendingOrders.length === 0) {
        DOM.pendingOrdersList.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-500 italic">No pending orders.</td></tr>`;
        return;
    }

    pendingOrders.forEach(order => {
        const row = document.createElement('tr');
        const typeClass = order.type === 'BUY' ? 'text-blue-600 font-bold' : 'text-red-600 font-bold';

        row.innerHTML = `
            <td class="${typeClass}">${order.type}</td>
            <td class="font-bold dark:text-white">${order.symbol}</td>
            <td>${order.quantity}</td>
            <td class="font-mono">≤ ${formatCurrency(order.targetPrice)}</td>
            <td class="text-right">
                <button class="cancel-order-btn text-xs text-gray-500 hover:text-red-500 underline" data-id="${order.id}">Cancel</button>
            </td>
        `;
        DOM.pendingOrdersList.appendChild(row);
    });
}

/**
 * Render headers (Balance, Portfolio Value, Total P&L)
 */
function renderSummary(balance, portfolioValue, totalInvested) {
    DOM.balanceHeader.textContent = formatCurrency(balance);
    DOM.portfolioHeader.textContent = formatCurrency(portfolioValue);

    const totalPnL = portfolioValue - totalInvested;
    const pnlPercentage = totalInvested > 0 ? totalPnL / totalInvested : 0;

    if (totalInvested === 0) {
        DOM.pnlHeader.textContent = '₹0.00';
        DOM.pnlHeader.className = 'text-lg font-bold text-gray-500';
    } else {
        const pnlSign = totalPnL >= 0 ? '+' : '';
        const pnlClass = totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

        DOM.pnlHeader.textContent = `${pnlSign}${formatCurrency(totalPnL)} (${pnlSign}${formatPercentage(pnlPercentage)})`;
        DOM.pnlHeader.className = `text-lg font-bold ${pnlClass}`;
    }
}

/**
 * Render Transaction History
 */
export function renderHistory(history) {
    DOM.transactionHistory.innerHTML = '';
    if (history.length === 0) {
        DOM.transactionHistory.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500 italic">No transactions yet.</td></tr>`;
        return;
    }

    history.forEach(tx => {
        const row = document.createElement('tr');
        const typeClass = tx.type === 'BUY' ? 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/40' : 'text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900/40';

        row.innerHTML = `
            <td class="text-xs text-gray-500 whitespace-nowrap">${formatDate(new Date(tx.date))}</td>
            <td><span class="px-2 py-1 rounded text-xs font-bold ${typeClass}">${tx.type} ${tx.symbol}</span></td>
            <td class="font-mono text-gray-600 dark:text-gray-300">${formatCurrency(tx.price)}</td>
        `;
        DOM.transactionHistory.appendChild(row);
    });
}

/**
 * Setup Trade Modal
 */
export function openTradeModal(type, stock, balance, ownedQty = 0) {
    currentTradeConfig = {
        type,
        symbol: stock.symbol,
        currentPrice: stock.currentPrice,
        balance,
        ownedQty,
        orderType: 'MARKET'
    };

    DOM.modalTitle.textContent = `${stock.name}`;
    DOM.modalTypeBadge.textContent = type;
    DOM.modalTypeBadge.className = type === 'BUY'
        ? 'px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
        : 'px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';

    DOM.modalStockSymbol.textContent = stock.symbol;
    DOM.modalStockPrice.textContent = formatCurrency(stock.currentPrice);
    DOM.modalUserBalance.textContent = formatCurrency(balance);

    // Reset inputs
    DOM.modalQuantity.value = 1;
    DOM.tradePrice.value = stock.currentPrice;
    setOrderTypeUI('MARKET');
    DOM.modalErrorMsg.classList.add('hidden');

    if (type === 'SELL') {
        DOM.modalOwnedContainer.classList.remove('hidden');
        DOM.modalOwnedQty.textContent = ownedQty;
        DOM.modalQuantity.max = ownedQty;
        DOM.confirmTradeBtn.className = 'w-full btn btn-danger flex-1 py-3 text-lg';
    } else {
        DOM.modalOwnedContainer.classList.add('hidden');
        DOM.modalQuantity.removeAttribute('max');
        DOM.confirmTradeBtn.className = 'w-full btn btn-primary flex-1 py-3 text-lg';
    }

    updateModalTotal();

    DOM.tradeModal.classList.remove('hidden');
    setTimeout(() => DOM.modalQuantity.focus(), 50);
}

export function closeTradeModal() {
    DOM.tradeModal.classList.add('hidden');
    currentTradeConfig = null;
}

export function setOrderTypeUI(orderType) {
    if (!currentTradeConfig) return;
    currentTradeConfig.orderType = orderType;

    if (orderType === 'MARKET') {
        DOM.btnMarketOrder.className = 'px-3 py-2 text-sm border border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md font-semibold transition-colors';
        DOM.btnLimitOrder.className = 'px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors';
        DOM.priceInputContainer.classList.add('opacity-50', 'pointer-events-none');
        DOM.tradePrice.disabled = true;
    } else {
        DOM.btnLimitOrder.className = 'px-3 py-2 text-sm border border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md font-semibold transition-colors';
        DOM.btnMarketOrder.className = 'px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors';
        DOM.priceInputContainer.classList.remove('opacity-50', 'pointer-events-none');
        DOM.tradePrice.disabled = false;
    }
    updateModalTotal();
}

function updateModalTotal() {
    if (!currentTradeConfig) return;

    const qty = parseInt(DOM.modalQuantity.value) || 0;
    // For limit orders, cost is calculated against target price instead of current price
    const priceToUse = currentTradeConfig.orderType === 'LIMIT'
        ? (parseFloat(DOM.tradePrice.value) || 0)
        : currentTradeConfig.currentPrice;

    const total = qty * priceToUse;

    DOM.modalTotalValue.textContent = formatCurrency(total);

    let hasError = false;
    let remainingBalance = currentTradeConfig.balance;

    if (currentTradeConfig.type === 'BUY') {
        remainingBalance = currentTradeConfig.balance - total;
        if (total > currentTradeConfig.balance) {
            hasError = true;
        }
    } else if (currentTradeConfig.type === 'SELL') {
        remainingBalance = currentTradeConfig.balance + total;
        if (qty > currentTradeConfig.ownedQty) {
            hasError = true;
        }
    }

    if (qty <= 0 || priceToUse <= 0) {
        hasError = true;
    }

    // Dynamic Balance Rendering
    DOM.modalUserBalance.textContent = formatCurrency(remainingBalance);

    if (hasError) {
        DOM.modalTotalValue.classList.add('text-red-500');
        if (currentTradeConfig.type === 'BUY' && total > currentTradeConfig.balance) {
            DOM.modalUserBalance.classList.add('text-red-500');
            DOM.modalUserBalance.classList.remove('text-gray-900', 'dark:text-white', 'text-green-500', 'dark:text-green-400');
        }
        DOM.confirmTradeBtn.disabled = true;
    } else {
        DOM.modalTotalValue.classList.remove('text-red-500');
        DOM.modalUserBalance.classList.remove('text-red-500');

        if (currentTradeConfig.type === 'BUY') {
            // Highlighting successful deducation remaining amount
            DOM.modalUserBalance.classList.add('text-gray-900', 'dark:text-white');
            DOM.modalUserBalance.classList.remove('text-green-500', 'dark:text-green-400');
        } else {
            // Highlighting gaining amount for SELL positive prediction
            DOM.modalUserBalance.classList.add('text-green-500', 'dark:text-green-400');
            DOM.modalUserBalance.classList.remove('text-gray-900', 'dark:text-white');
        }

        DOM.confirmTradeBtn.disabled = false;
    }
}

/**
 * Toast Notifications
 */
export function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const bgs = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };

    toast.className = `${bgs[type]} text-white px-4 py-3 rounded shadow-lg transform transition-all duration-300 translate-y-2 opacity-0 flex items-center gap-2 mb-2`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';

    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    DOM.toastContainer.appendChild(toast);

    requestAnimationFrame(() => toast.classList.remove('translate-y-2', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Render Live Ticker Tape
 */
export function renderTicker(marketData) {
    if (!DOM.tickerContent) return;

    let html = '';
    // Duplicate data 4 times to ensure seamless scrolling width calculation
    const extendedData = [...marketData, ...marketData, ...marketData, ...marketData];

    extendedData.forEach(stock => {
        let colorClass = 'text-gray-300';
        let icon = '';
        if (stock.currentPrice > stock.prevPrice) {
            colorClass = 'text-green-500';
            icon = '<i class="fas fa-caret-up ml-1 text-xs"></i>';
        } else if (stock.currentPrice < stock.prevPrice) {
            colorClass = 'text-red-500';
            icon = '<i class="fas fa-caret-down ml-1 text-xs"></i>';
        }

        html += `<span class="ticker-item">${stock.symbol} <span class="${colorClass} ml-1">${formatCurrency(stock.currentPrice)}${icon}</span></span>`;
    });

    DOM.tickerContent.innerHTML = html;
}

/**
 * Render dynamic Insights page
 */
export function renderInsights(marketData) {
    if (!DOM.insightsView || DOM.insightsView.classList.contains('hidden')) return;

    // 1. Market Sentiment (Advances vs Declines)
    let advances = 0;
    let declines = 0;
    marketData.forEach(stock => {
        if (stock.currentPrice >= stock.prevPrice) advances++;
        else declines++;
    });

    const total = advances + declines;
    const advancePercent = total > 0 ? (advances / total) * 100 : 50;

    DOM.sentimentAdvances.textContent = advances;
    DOM.sentimentDeclines.textContent = declines;
    DOM.sentimentAdvanceBar.style.width = `${advancePercent}%`;

    if (advances > declines) {
        DOM.marketSentimentText.textContent = "Bullish";
        DOM.marketSentimentText.className = "text-green-500";
    } else if (declines > advances) {
        DOM.marketSentimentText.textContent = "Bearish";
        DOM.marketSentimentText.className = "text-red-500";
    } else {
        DOM.marketSentimentText.textContent = "Neutral";
        DOM.marketSentimentText.className = "text-gray-500";
    }

    // 2. Sector Performance
    const sectors = {};
    marketData.forEach(stock => {
        if (!sectors[stock.sector]) {
            sectors[stock.sector] = { name: stock.sector, adv: 0, dec: 0 };
        }
        if (stock.currentPrice >= stock.prevPrice) sectors[stock.sector].adv++;
        else sectors[stock.sector].dec++;
    });

    DOM.sectorPerformanceList.innerHTML = Object.values(sectors).map(sec => {
        const secTotal = sec.adv + sec.dec;
        const secAdvPct = secTotal > 0 ? (sec.adv / secTotal) * 100 : 50;
        return `
            <div>
                <div class="flex justify-between text-sm mb-2">
                    <span class="text-white font-bold tracking-wide">${sec.name} <i class="fas fa-chevron-right text-[10px] text-gray-500 ml-1"></i></span>
                    <div class="flex gap-3 text-xs font-bold font-mono">
                        <span class="text-[#00c853] bg-green-900/20 px-1.5 py-0.5 rounded">${sec.adv}</span>
                        <span class="text-[#ff3b3b] bg-red-900/20 px-1.5 py-0.5 rounded">${sec.dec}</span>
                    </div>
                </div>
                <div class="w-full h-1.5 bg-red-500 rounded-full overflow-hidden flex shadow-inner">
                    <div class="h-full bg-[#00c853] transition-all duration-700 ease-out border-r border-[#1e2128]" style="width: ${secAdvPct}%"></div>
                </div>
            </div>
        `;
    }).join('');

    // 3. What's Moving (Top Gainers/Losers simplified)
    const sortedByChange = [...marketData].sort((a, b) => {
        const changeA = (a.currentPrice - a.prevPrice) / a.prevPrice;
        const changeB = (b.currentPrice - b.prevPrice) / b.prevPrice;
        return changeB - changeA;
    });

    const topMovers = [sortedByChange[0], sortedByChange[1], sortedByChange[marketData.length - 1], sortedByChange[marketData.length - 2]];
    DOM.whatsMovingList.innerHTML = topMovers.filter(Boolean).map(stock => {
        const diff = stock.currentPrice - stock.prevPrice;
        const diffPercent = stock.prevPrice > 0 ? (diff / stock.prevPrice) * 100 : 0;
        const isUp = diff >= 0;
        const color = isUp ? 'text-[#00c853]' : 'text-[#ff3b3b]';
        const bgIconColor = isUp ? 'bg-green-900/30' : 'bg-red-900/30';
        const sign = isUp ? '+' : '';
        const icon = isUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
        return `
            <div class="flex justify-between items-center bg-gray-800/40 border border-gray-800 hover:border-gray-600 p-3 rounded-lg cursor-pointer transition-all market-list-item group" data-symbol="${stock.symbol}">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg ${bgIconColor} ${color} flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform"><i class="fas ${icon}"></i></div>
                    <div class="min-w-0 pr-2">
                        <p class="font-bold text-sm text-white truncate group-hover:text-blue-400 transition-colors">${stock.symbol}</p>
                        <p class="text-[11px] text-gray-500 truncate max-w-[120px] font-medium">${stock.name}</p>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <p class="font-mono font-bold text-sm text-white">${formatCurrency(stock.currentPrice)}</p>
                    <p class="text-[11px] font-bold ${color}">${sign}${formatCurrency(Math.abs(diff))} (${sign}${Math.abs(diffPercent).toFixed(2)}%)</p>
                </div>
            </div>
        `;
    }).join('');

    // 4. High Upside
    const highUpsideStocks = [...marketData].sort(() => Math.random() - 0.5).slice(0, 3);
    DOM.highUpsideList.innerHTML = highUpsideStocks.map(stock => {
        const potential = (Math.random() * 50 + 10).toFixed(2);
        const target = (stock.currentPrice * (1 + (potential / 100))).toFixed(2);
        return `
            <div class="bg-[#1e2128] rounded-xl p-5 shadow-lg border border-gray-800 hover:border-gray-600 transition-colors cursor-pointer group market-list-item" data-symbol="${stock.symbol}">
                <div class="flex justify-between items-start mb-4 border-b border-gray-800 pb-3">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md">${stock.symbol.substring(0, 1)}</div>
                        <div class="min-w-0 pr-1">
                            <h3 class="font-bold text-white text-base group-hover:text-blue-400 transition-colors truncate max-w-[120px]">${stock.symbol}</h3>
                            <p class="text-xs text-gray-500 font-medium truncate max-w-[120px]">${stock.sector}</p>
                        </div>
                    </div>
                    <div class="text-right shrink-0 bg-blue-900/20 px-2 py-1 rounded text-center">
                         <p class="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-0.5">Upside</p>
                         <p class="font-bold text-[#00c853] text-sm">+${potential}%</p>
                    </div>
                </div>
                <div class="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 flex justify-between items-center">
                    <div>
                        <span class="text-[11px] text-gray-400 font-medium block mb-0.5">Current Price</span>
                        <span class="text-white font-mono font-bold text-sm">${formatCurrency(stock.currentPrice)}</span>
                    </div>
                    <i class="fas fa-arrow-right text-gray-600 text-xs"></i>
                    <div class="text-right">
                        <span class="text-[11px] text-gray-400 font-medium block mb-0.5">Avg. Target</span>
                        <span class="text-blue-400 font-mono font-bold text-sm">${formatCurrency(target)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

}

/**
 * Handle Stock Detail View
 */
export function showStockDetails(stock, historyList) {
    currentDetailSymbol = stock.symbol;

    // populate text
    DOM.detailSymbol.textContent = stock.symbol;
    DOM.detailName.textContent = stock.name;
    DOM.detailPrice.textContent = formatCurrency(stock.currentPrice);

    const diffPercent = stock.prevPrice > 0 ? ((stock.currentPrice - stock.prevPrice) / stock.prevPrice) * 100 : 0;
    DOM.detailChange.textContent = `${diffPercent > 0 ? '+' : ''}${diffPercent.toFixed(2)}%`;
    DOM.detailChange.className = diffPercent >= 0 ? 'text-lg font-semibold text-green-500' : 'text-lg font-semibold text-red-500';

    DOM.detailMcap.textContent = `₹${(Math.round(stock.marketCap / 100) / 100).toFixed(2)}T`;

    const priceHigh = Math.max(...historyList);
    const priceLow = Math.min(...historyList);
    DOM.detailHigh.textContent = formatCurrency(priceHigh);
    DOM.detailLow.textContent = formatCurrency(priceLow);

    // Apply classes for the global click delegate in app.js
    DOM.detailBuyBtn.dataset.symbol = stock.symbol;
    DOM.detailBuyBtn.classList.add('buy-btn');
    DOM.detailSellBtn.dataset.symbol = stock.symbol;
    DOM.detailSellBtn.classList.add('sell-btn');

    // Swap UI Contexts
    DOM.dashboardView.classList.add('hidden');
    DOM.stockDetailView.classList.remove('hidden');

    // Trigger Chart.js render with dynamic module import just like other charts
    import('./charting.js').then(m => m.renderStockDetailChart(stock.symbol, historyList));
}

export function hideStockDetails() {
    currentDetailSymbol = null;
    DOM.stockDetailView.classList.add('hidden');
    DOM.dashboardView.classList.remove('hidden');
}

export { DOM, updateModalTotal, currentTradeConfig };
