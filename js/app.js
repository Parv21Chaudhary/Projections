import { loadState, getState, resetState } from './state.js';
import { getMarketData, startSimulation, getMarketHistory } from './market.js';
import { buyStock, sellStock, cancelOrder } from './trading.js';
import { DOM, renderMarket, renderPortfolio, renderHistory, renderHeatmap, renderPendingOrders, renderTicker, openTradeModal, closeTradeModal, updateModalTotal, currentTradeConfig, showToast, setMarketFilter, setSearchQuery, setOrderTypeUI, showStockDetails, hideStockDetails, currentDetailSymbol, renderInsights } from './ui.js';

function init() {
    loadState();

    // Initial Render
    updateUI();

    // Start background market simulation
    startSimulation();

    // Event Listeners
    setupEventListeners();
}

function updateUI(marketData = getMarketData()) {
    const state = getState();
    renderMarket(marketData);
    renderHeatmap(marketData);
    renderPortfolio(state.portfolio, marketData, state.balance);
    renderPendingOrders(state.pendingOrders);
    renderHistory(state.history);
    renderInsights(marketData);
}

function setupEventListeners() {
    // Market Updates Listeners
    window.addEventListener('marketUpdate', (e) => {
        const marketData = e.detail;
        updateUI(marketData);

        // Update Details Page dynamically if open
        if (currentDetailSymbol) {
            const activeStock = marketData.find(s => s.symbol === currentDetailSymbol);
            if (activeStock) {
                showStockDetails(activeStock, getMarketHistory(currentDetailSymbol));
            }
        }

        if (currentTradeConfig) {
            // Update modal price if it's open for the specific stock
            const updatedStock = marketData.find(s => s.symbol === currentTradeConfig.symbol);
            if (updatedStock) {
                currentTradeConfig.currentPrice = updatedStock.currentPrice;
                DOM.modalStockPrice.textContent = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(updatedStock.currentPrice);
                // We do NOT update the trade price input automatically if it's a LIMIT order
                if (currentTradeConfig.orderType === 'MARKET') {
                    DOM.tradePrice.value = updatedStock.currentPrice;
                }
                updateModalTotal();
            }
        }
    });

    window.addEventListener('indicesUpdate', (e) => {
        renderTicker(e.detail);
    });

    // Tab Toggles
    if (DOM.tabInsights && DOM.tabStocks) {
        DOM.tabInsights.addEventListener('click', () => {
            DOM.tabInsights.classList.replace('text-gray-600', 'text-white');
            DOM.tabInsights.classList.replace('dark:text-gray-400', 'text-white');
            DOM.tabInsights.classList.replace('hover:text-gray-900', 'text-white');
            DOM.tabInsights.classList.add('bg-blue-600', 'shadow');
            DOM.tabInsights.classList.remove('bg-transparent');

            DOM.tabStocks.classList.replace('text-white', 'text-gray-600');
            DOM.tabStocks.classList.add('dark:text-gray-400', 'hover:text-gray-900', 'dark:hover:text-white', 'bg-transparent');
            DOM.tabStocks.classList.remove('bg-blue-600', 'shadow');

            DOM.insightsView.classList.remove('hidden');
            DOM.dashboardView.classList.add('hidden');
        });

        DOM.tabStocks.addEventListener('click', () => {
            DOM.tabStocks.classList.replace('text-gray-600', 'text-white');
            DOM.tabStocks.classList.replace('dark:text-gray-400', 'text-white');
            DOM.tabStocks.classList.replace('hover:text-gray-900', 'text-white');
            DOM.tabStocks.classList.add('bg-blue-600', 'shadow');
            DOM.tabStocks.classList.remove('bg-transparent');

            DOM.tabInsights.classList.replace('text-white', 'text-gray-600');
            DOM.tabInsights.classList.add('dark:text-gray-400', 'hover:text-gray-900', 'dark:hover:text-white', 'bg-transparent');
            DOM.tabInsights.classList.remove('bg-blue-600', 'shadow');

            DOM.dashboardView.classList.remove('hidden');
            DOM.insightsView.classList.add('hidden');
        });
    }

    window.addEventListener('tradeCompleted', () => {
        updateUI(); // Quick UI refresh outside of market tick
        import('./charting.js').then(m => m.updatePortfolioChart(getState().portfolio, getMarketData()));
    });

    // Buy/Sell buttons (Delegated on document body because items are re-rendered)
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn) {
            if (btn.classList.contains('buy-btn')) {
                const symbol = btn.dataset.symbol;
                const stock = getMarketData().find(s => s.symbol === symbol);
                if (stock) openTradeModal('BUY', stock, getState().balance);
            } else if (btn.classList.contains('sell-btn')) {
                const symbol = btn.dataset.symbol;
                const stock = getMarketData().find(s => s.symbol === symbol);
                const ownedQty = getState().portfolio[symbol]?.quantity || 0;
                if (stock) openTradeModal('SELL', stock, getState().balance, ownedQty);
            } else if (btn.classList.contains('cancel-order-btn')) {
                const orderId = btn.dataset.id;
                cancelOrder(orderId);
                updateUI();
            } else if (btn.classList.contains('screener-btn')) {
                document.querySelectorAll('.screener-btn').forEach(b => {
                    b.className = 'screener-btn shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600';
                });
                btn.className = 'screener-btn shrink-0 active px-3 py-1 rounded-full text-xs font-semibold bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900';
                setMarketFilter(btn.dataset.filter);
                renderMarket(getMarketData());
            }
            return;
        }

        const marketItem = e.target.closest('.market-list-item');
        if (marketItem) {
            const symbol = marketItem.dataset.symbol;
            const stock = getMarketData().find(s => s.symbol === symbol);
            if (stock) {
                if (symbol === 'RELIANCE') {
                    showStockDetails(stock, getMarketHistory(symbol));
                } else {
                    openTradeModal('BUY', stock, getState().balance);
                }
            }
        }
    });

    if (DOM.stockSearchInput) {
        DOM.stockSearchInput.addEventListener('input', (e) => {
            setSearchQuery(e.target.value);
            renderMarket(getMarketData());
        });
    }

    // Modal Events
    DOM.closeModalBtn.addEventListener('click', closeTradeModal);

    // Order Type selectors
    const btnMarket = document.getElementById('btn-market-order');
    const btnLimit = document.getElementById('btn-limit-order');

    if (btnMarket) btnMarket.addEventListener('click', () => setOrderTypeUI('MARKET'));
    if (btnLimit) btnLimit.addEventListener('click', () => setOrderTypeUI('LIMIT'));

    if (DOM.backToDashboardBtn) {
        DOM.backToDashboardBtn.addEventListener('click', hideStockDetails);
    }

    DOM.modalQuantity.addEventListener('input', () => {
        updateModalTotal();
    });

    DOM.tradePrice.addEventListener('input', () => {
        updateModalTotal();
    });

    DOM.confirmTradeBtn.addEventListener('click', () => {
        if (!currentTradeConfig) return;

        const quantity = parseInt(DOM.modalQuantity.value, 10);
        if (isNaN(quantity) || quantity <= 0) return;

        let result;
        const targetPrice = parseFloat(DOM.tradePrice.value);

        if (currentTradeConfig.type === 'BUY') {
            result = buyStock(currentTradeConfig.symbol, quantity, currentTradeConfig.orderType, targetPrice);
        } else {
            result = sellStock(currentTradeConfig.symbol, quantity, currentTradeConfig.orderType, targetPrice);
        }

        if (result.success) {
            showToast(result.message, 'success');
            closeTradeModal();
            updateUI();
        } else {
            DOM.modalErrorMsg.textContent = result.message;
            DOM.modalErrorMsg.classList.remove('hidden');
            // Shake effect for error
            DOM.tradeModal.firstElementChild.classList.add('animate-shake');
            setTimeout(() => DOM.tradeModal.firstElementChild.classList.remove('animate-shake'), 400);
        }
    });

    // 4. Reset Account
    DOM.resetBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to reset your portfolio? All your holdings, transaction history, and balance will be wiped out.")) {
            resetState();
            updateUI();
            showToast("Account has been reset to ₹1,00,000", "info");
        }
    });

    // 5. Theme Toggle Logic
    const toggleTheme = () => {
        const isDark = document.body.classList.toggle('dark');
        // Toggle icon
        if (isDark) {
            DOM.themeIcon.classList.remove('fa-moon');
            DOM.themeIcon.classList.add('fa-sun');
            localStorage.setItem('theme', 'dark');
        } else {
            DOM.themeIcon.classList.add('fa-moon');
            DOM.themeIcon.classList.remove('fa-sun');
            localStorage.setItem('theme', 'light');
        }
    };

    DOM.themeToggle.addEventListener('click', toggleTheme);

    // Initial Theme Check
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark');
        DOM.themeIcon.classList.remove('fa-moon');
        DOM.themeIcon.classList.add('fa-sun');
    }

    // Periodic chart updates (every 10 seconds)
    setInterval(() => {
        import('./charting.js').then(m => m.updatePortfolioChart(getState().portfolio, getMarketData()));
    }, 10000);
}

// Ensure DOM is loaded
document.addEventListener('DOMContentLoaded', init);
