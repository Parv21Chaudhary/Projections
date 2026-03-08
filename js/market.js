import { checkPendingOrders } from './trading.js';

// Initial Indian dummy stock prices (in INR)
const initialStocks = [
    { symbol: 'RELIANCE', name: 'Reliance Industries', currentPrice: 2450.50, prevPrice: 2450.50, marketCap: 15.5, sector: 'Energy' },
    { symbol: 'TCS', name: 'Tata Consultancy', currentPrice: 3800.00, prevPrice: 3800.00, marketCap: 12.2, sector: 'IT' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank', currentPrice: 1550.25, prevPrice: 1550.25, marketCap: 9.8, sector: 'Banking' },
    { symbol: 'INFY', name: 'Infosys', currentPrice: 1420.75, prevPrice: 1420.75, marketCap: 6.1, sector: 'IT' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank', currentPrice: 980.10, prevPrice: 980.10, marketCap: 5.4, sector: 'Banking' },
    { symbol: 'SBIN', name: 'State Bank of India', currentPrice: 620.40, prevPrice: 620.40, marketCap: 4.8, sector: 'Banking' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel', currentPrice: 950.80, prevPrice: 950.80, marketCap: 4.5, sector: 'Telecom' },
    { symbol: 'ITC', name: 'ITC Ltd.', currentPrice: 450.30, prevPrice: 450.30, marketCap: 4.2, sector: 'FMCG' },
    { symbol: 'L&T', name: 'Larsen & Toubro', currentPrice: 3100.00, prevPrice: 3100.00, marketCap: 3.5, sector: 'Infrastructure' },
    { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', currentPrice: 2550.60, prevPrice: 2550.60, marketCap: 5.9, sector: 'FMCG' }
];

let marketData = [...initialStocks.map(s => ({ ...s }))];

const symbolMap = {
    'btcusdt': 'RELIANCE',
    'ethusdt': 'TCS',
    'bnbusdt': 'HDFCBANK',
    'solusdt': 'INFY',
    'xrpusdt': 'ICICIBANK',
    'adausdt': 'SBIN',
    'dogeusdt': 'BHARTIARTL',
    'dotusdt': 'ITC',
    'ltcusdt': 'L&T',
    'linkusdt': 'HINDUNILVR'
};

let websocket = null;
let initialCryptoPrices = {};
let lastDispatchTime = 0;
let marketHistory = {}; // Store price history: { 'RELIANCE': [2440, 2445, ...] }

let indicesData = [
    { symbol: 'NIFTY 50', currentPrice: 22530.70, prevPrice: 22530.70 },
    { symbol: 'SENSEX', currentPrice: 74119.39, prevPrice: 74119.39 },
    { symbol: 'NIFTY BANK', currentPrice: 47327.85, prevPrice: 47327.85 },
    { symbol: 'NIFTY IT', currentPrice: 34502.10, prevPrice: 34502.10 },
    { symbol: 'INDIA VIX', currentPrice: 15.20, prevPrice: 15.20 },
];
let indicesInterval = null;

/**
 * Get the current market data
 * @returns {Array} Array of stock objects
 */
export function getMarketData() {
    return marketData;
}

export function getMarketHistory(symbol) {
    if (!marketHistory[symbol]) {
        const stock = marketData.find(s => s.symbol === symbol);
        // Pre-fill history with dummy flat line
        marketHistory[symbol] = Array(30).fill(stock ? stock.currentPrice : 0);
    }
    return marketHistory[symbol];
}

/**
 * Get a specific stock's current data by symbol
 * @param {string} symbol 
 * @returns {Object|undefined} Stock object
 */
export function getStock(symbol) {
    return marketData.find(s => s.symbol === symbol);
}

/**
 * Start the WebSocket simulation
 */
export function startSimulation() {
    // Start index simulation
    if (!indicesInterval) {
        // Initial dispatch
        window.dispatchEvent(new CustomEvent('indicesUpdate', { detail: indicesData }));
        indicesInterval = setInterval(() => {
            indicesData = indicesData.map(idx => {
                const change = (Math.random() * 0.002) - 0.001;
                return {
                    ...idx,
                    prevPrice: idx.currentPrice,
                    currentPrice: Math.max(1, Math.round((idx.currentPrice * (1 + change)) * 100) / 100)
                };
            });
            window.dispatchEvent(new CustomEvent('indicesUpdate', { detail: indicesData }));
        }, 3000);
    }

    if (websocket) return;

    const streams = Object.keys(symbolMap).map(s => `${s}@ticker`).join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    websocket = new WebSocket(wsUrl);

    websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (!data || !data.data) return;

        const ticker = data.data;
        const cryptoSymbol = ticker.s.toLowerCase();
        const indianSymbol = symbolMap[cryptoSymbol];

        if (!indianSymbol) return;

        const currentCryptoPrice = parseFloat(ticker.c);

        if (!initialCryptoPrices[cryptoSymbol]) {
            initialCryptoPrices[cryptoSymbol] = currentCryptoPrice;
            return;
        }

        // Calculate % change relative to connection time
        const percentChange = currentCryptoPrice / initialCryptoPrices[cryptoSymbol];

        // Update the specific stock
        const stockIndex = marketData.findIndex(s => s.symbol === indianSymbol);
        if (stockIndex === -1) return;

        const stock = marketData[stockIndex];
        const initialStockPrice = initialStocks.find(s => s.symbol === indianSymbol).currentPrice;

        const newPrice = initialStockPrice * percentChange;

        // Only track prevPrice if price actually changed to avoid UI flipping constantly on identical ticks
        const roundedNewPrice = Math.max(0.01, Math.round(newPrice * 100) / 100);

        if (roundedNewPrice !== stock.currentPrice) {
            marketData[stockIndex] = {
                ...stock,
                prevPrice: stock.currentPrice,
                currentPrice: roundedNewPrice
            };

            if (!marketHistory[indianSymbol]) {
                marketHistory[indianSymbol] = Array(30).fill(stock.currentPrice);
            }
            marketHistory[indianSymbol].push(roundedNewPrice);
            if (marketHistory[indianSymbol].length > 30) {
                marketHistory[indianSymbol].shift();
            }
        }

        // Throttle full UI updates to max twice a second to keep performance high
        const now = Date.now();
        if (now - lastDispatchTime > 500) {
            window.dispatchEvent(new CustomEvent('marketUpdate', { detail: [...marketData] }));
            checkPendingOrders(marketData);
            lastDispatchTime = now;
        }
    };

    websocket.onerror = (err) => console.error("Market WebSocket Error:", err);
}

/**
 * Stop the simulation
 */
export function stopSimulation() {
    if (websocket) {
        websocket.close();
        websocket = null;
    }
    if (indicesInterval) {
        clearInterval(indicesInterval);
        indicesInterval = null;
    }
}
