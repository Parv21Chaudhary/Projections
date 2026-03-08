const STATE_KEY = 'dalal_street_sim_state';

const INITIAL_BALANCE = 100000; // ₹1,00,000 Starting Balance

let state = {
    balance: INITIAL_BALANCE,
    portfolio: {}, // e.g., { 'RELIANCE': { quantity: 10, averagePrice: 2400 } }
    history: [], // [{ id, type: 'BUY', symbol, quantity, price, total, date }]
    pendingOrders: [] // [{ id, type: 'BUY', symbol, quantity, targetPrice, orderType: 'LIMIT', date }]
};

/**
 * Load state from localStorage
 */
export function loadState() {
    try {
        const savedState = localStorage.getItem(STATE_KEY);
        if (savedState) {
            state = JSON.parse(savedState);
        } else {
            saveState(); // Initialize if not present
        }
    } catch (e) {
        console.error("Failed to load state from localStorage:", e);
    }
}

/**
 * Save current state to localStorage
 */
export function saveState() {
    try {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error("Failed to save state to localStorage:", e);
    }
}

/**
 * Reset application state to initial values
 */
export function resetState() {
    state = {
        balance: INITIAL_BALANCE,
        portfolio: {},
        history: [],
        pendingOrders: []
    };
    saveState();
    return state;
}

/**
 * Get current state
 */
export function getState() {
    return state;
}

/**
 * Add a pending order
 */
export function addPendingOrder(order) {
    const newOrder = {
        ...order,
        id: crypto.randomUUID(),
        date: new Date().toISOString()
    };
    if (!state.pendingOrders) state.pendingOrders = [];
    state.pendingOrders.push(newOrder);
    saveState();
}

/**
 * Remove a pending order by ID
 */
export function removePendingOrder(orderId) {
    if (!state.pendingOrders) return;
    state.pendingOrders = state.pendingOrders.filter(o => o.id !== orderId);
    saveState();
}

/**
 * Update balance
 */
export function updateBalance(newBalance) {
    state.balance = newBalance;
    saveState();
}

/**
 * Add or update portfolio holding
 */
export function updatePortfolio(symbol, quantity, averagePrice) {
    state.portfolio[symbol] = { quantity, averagePrice };
    saveState();
}

/**
 * Remove portfolio holding
 */
export function removePortfolio(symbol) {
    delete state.portfolio[symbol];
    saveState();
}

/**
 * Add a transaction to history
 */
export function addTransaction(transaction) {
    const newTransaction = {
        ...transaction,
        id: crypto.randomUUID(), // Built-in browser unique ID
        date: new Date().toISOString()
    };
    // Add to beginning of array
    state.history.unshift(newTransaction);

    // Keep history reasonably sized (e.g., max 100 items)
    if (state.history.length > 100) {
        state.history = state.history.slice(0, 100);
    }
    saveState();
}
