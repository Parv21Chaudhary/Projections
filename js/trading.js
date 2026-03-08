import { getState, updateBalance, updatePortfolio, addTransaction, removePortfolio, addPendingOrder, removePendingOrder } from './state.js';
import { getStock } from './market.js';
import { showToast } from './ui.js';

/**
 * Attempt to buy a stock immediately or queue a pending order
 * @param {string} symbol 
 * @param {number} quantity 
 * @param {string} orderType 'MARKET' or 'LIMIT'
 * @param {number} targetPrice Only for LIMIT
 * @returns {Object} { success: boolean, message: string }
 */
export function buyStock(symbol, quantity, orderType = 'MARKET', targetPrice = null) {
    if (quantity <= 0) return { success: false, message: "Invalid quantity." };

    const state = getState();
    const stock = getStock(symbol);

    if (!stock) return { success: false, message: "Stock not found." };

    // For limit orders, we use the target price to hold funds. For market, current price.
    const priceToUse = orderType === 'LIMIT' ? targetPrice : stock.currentPrice;
    if (!priceToUse || priceToUse <= 0) return { success: false, message: "Invalid target price." };

    const totalCost = priceToUse * quantity;

    if (state.balance < totalCost) {
        return { success: false, message: "Insufficient balance." };
    }

    if (orderType === 'MARKET') {
        return executeBuy(symbol, quantity, stock.currentPrice, totalCost, stock.name);
    } else {
        // Limit Order: Deduct funds immediately to lock them in
        updateBalance(state.balance - totalCost);
        addPendingOrder({
            type: 'BUY',
            symbol: symbol,
            quantity: quantity,
            targetPrice: targetPrice,
            orderType: 'LIMIT',
            name: stock.name,
            lockedAmount: totalCost
        });
        return { success: true, message: `Limit BUY order placed for ${quantity} ${symbol} @ ₹${targetPrice}` };
    }
}

function executeBuy(symbol, quantity, currentPrice, totalCost, name) {
    const state = getState();
    const newBalance = state.balance - totalCost;
    updateBalance(newBalance);

    const existingHolding = state.portfolio[symbol];
    let newQuantity = quantity;
    let newAveragePrice = currentPrice;

    if (existingHolding) {
        newQuantity += existingHolding.quantity;
        const totalInvestedBefore = existingHolding.quantity * existingHolding.averagePrice;
        newAveragePrice = (totalInvestedBefore + totalCost) / newQuantity;
    }

    updatePortfolio(symbol, newQuantity, newAveragePrice);

    addTransaction({
        type: 'BUY',
        symbol: symbol,
        name: name,
        quantity: quantity,
        price: currentPrice,
        total: totalCost
    });

    return { success: true, message: `Successfully bought ${quantity} shares of ${symbol}.` };
}

/**
 * Attempt to sell a stock
 * @param {string} symbol 
 * @param {number} quantity 
 * @param {string} orderType 'MARKET' or 'LIMIT'
 * @param {number} targetPrice Only for LIMIT
 * @returns {Object} { success: boolean, message: string }
 */
export function sellStock(symbol, quantity, orderType = 'MARKET', targetPrice = null) {
    if (quantity <= 0) return { success: false, message: "Invalid quantity." };

    const state = getState();
    const stock = getStock(symbol);
    const holding = state.portfolio[symbol];

    if (!stock) return { success: false, message: "Stock not found." };
    if (!holding) return { success: false, message: "You don't own this stock." };

    // Calculate total explicitly queued shares
    const queuedShares = (state.pendingOrders || [])
        .filter(o => o.symbol === symbol && o.type === 'SELL')
        .reduce((sum, o) => sum + o.quantity, 0);

    const availableShares = holding.quantity - queuedShares;

    if (availableShares < quantity) {
        return { success: false, message: `You only have ${availableShares} unreserved shares available.` };
    }

    if (orderType === 'MARKET') {
        return executeSell(symbol, quantity, stock.currentPrice, stock.name);
    } else {
        addPendingOrder({
            type: 'SELL',
            symbol: symbol,
            quantity: quantity,
            targetPrice: targetPrice,
            orderType: 'LIMIT',
            name: stock.name
        });
        return { success: true, message: `Limit SELL order placed for ${quantity} ${symbol} @ ₹${targetPrice}` };
    }
}

function executeSell(symbol, quantity, currentPrice, name) {
    const state = getState();
    const holding = state.portfolio[symbol];
    const totalValue = currentPrice * quantity;

    const newBalance = state.balance + totalValue;
    updateBalance(newBalance);

    const remainingQuantity = holding.quantity - quantity;
    if (remainingQuantity === 0) {
        removePortfolio(symbol);
    } else {
        updatePortfolio(symbol, remainingQuantity, holding.averagePrice);
    }

    addTransaction({
        type: 'SELL',
        symbol: symbol,
        name: name,
        quantity: quantity,
        price: currentPrice,
        total: totalValue
    });

    return { success: true, message: `Successfully sold ${quantity} shares of ${symbol}.` };
}

/**
 * Cancel a pending order, returning locked funds if it was a buy
 */
export function cancelOrder(orderId) {
    const state = getState();
    const order = state.pendingOrders.find(o => o.id === orderId);
    if (!order) return;

    if (order.type === 'BUY') {
        updateBalance(state.balance + order.lockedAmount);
    }
    removePendingOrder(orderId);
    showToast(`Order cancelled for ${order.symbol}.`, "info");
}

/**
 * Evaluate pending operations (called every market tick)
 */
export function checkPendingOrders(marketData) {
    const state = getState();
    if (!state.pendingOrders || state.pendingOrders.length === 0) return;

    const pendingCopy = [...state.pendingOrders];
    let triggered = false;

    // Build lookup for quick access
    const priceMap = marketData.reduce((acc, s) => {
        acc[s.symbol] = s.currentPrice;
        return acc;
    }, {});

    pendingCopy.forEach(order => {
        const currentPrice = priceMap[order.symbol];
        if (!currentPrice) return;

        let shouldExecute = false;

        if (order.type === 'BUY') {
            // Limit Buy triggers if price drops to or below target
            if (currentPrice <= order.targetPrice) {
                shouldExecute = true;
            }
        } else if (order.type === 'SELL') {
            // Limit Sell triggers if price rises to or above target
            if (currentPrice >= order.targetPrice) {
                shouldExecute = true;
            }
        }

        if (shouldExecute) {
            triggered = true;
            removePendingOrder(order.id);

            // Execute the trade at the targeted price technically to be "fair", 
            // since we locked in funds based on the target price for buys.
            if (order.type === 'BUY') {
                // Refund the held amount first since executeBuy subtracts it normally again
                updateBalance(getState().balance + order.lockedAmount);
                executeBuy(order.symbol, order.quantity, order.targetPrice, order.lockedAmount, order.name);
                showToast(`Limit BUY Executed: ${order.quantity} ${order.symbol} @ ₹${order.targetPrice}`, "success");
            } else {
                executeSell(order.symbol, order.quantity, order.targetPrice, order.name);
                showToast(`Limit SELL Executed: ${order.quantity} ${order.symbol} @ ₹${order.targetPrice}`, "success");
            }
        }
    });

    if (triggered) {
        window.dispatchEvent(new CustomEvent('tradeCompleted')); // Force full UI refresh hook
    }
}
