let portfolioChartInstance = null;
export let stockDetailChartInstance = null;

const CHART_COLORS = [
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#f59e0b', // amber-500
    '#10b981', // emerald-500
    '#06b6d4', // teal-500
    '#6366f1', // cyan-500
    '#a855f7', // purple-500
    '#14b8a6', // lime-500
    '#f43f5e'  // rose-500
];

/**
 * Initializes and updates the Portfolio Allocation Donut Chart
 * @param {Object} portfolio 
 * @param {Array} marketData 
 */
export function updatePortfolioChart(portfolio, marketData) {
    const canvas = document.getElementById('portfolio-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const symbols = Object.keys(portfolio);

    if (symbols.length === 0) {
        // Destroy existing chart if portfolio is empty
        if (portfolioChartInstance) {
            portfolioChartInstance.destroy();
            portfolioChartInstance = null;
        }
        return;
    }

    const labels = [];
    const dataValues = [];
    const bgColors = [];

    symbols.forEach((symbol, index) => {
        const holding = portfolio[symbol];
        const stock = marketData.find(s => s.symbol === symbol);

        if (stock && holding.quantity > 0) {
            labels.push(symbol);
            dataValues.push(stock.currentPrice * holding.quantity);
            bgColors.push(CHART_COLORS[index % CHART_COLORS.length]);
        }
    });

    const isDarkMode = document.body.classList.contains('dark');
    const textColor = isDarkMode ? '#9ca3af' : '#6b7280'; // gray-400 : gray-500

    const chartConfig = {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: bgColors,
                borderWidth: 2,
                borderColor: isDarkMode ? '#1f2937' : '#ffffff', // gray-800 : white
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: textColor,
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 11,
                            family: "'Inter', sans-serif"
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(context.parsed);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    };

    if (portfolioChartInstance) {
        // Update existing chart
        portfolioChartInstance.data = chartConfig.data;
        portfolioChartInstance.options.plugins.legend.labels.color = textColor;
        portfolioChartInstance.options.datasets = chartConfig.options.datasets;
        portfolioChartInstance.update();
    } else {
        // Create new chart
        portfolioChartInstance = new Chart(ctx, chartConfig);
    }
}

/**
 * Initializes and updates the Stock Detail Line Chart
 */
export function renderStockDetailChart(symbol, historyData) {
    const canvas = document.getElementById('stock-detail-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const labels = historyData.map((_, i) => i);
    const isDarkMode = document.body.classList.contains('dark');
    const textColor = isDarkMode ? '#9ca3af' : '#6b7280';
    const gridColor = isDarkMode ? '#374151' : '#e5e7eb';

    // Determine color based on start vs current frame (index 0 vs end)
    const isPositive = historyData[historyData.length - 1] >= historyData[0];
    const lineColor = isPositive ? '#10b981' : '#ef4444'; // emerald vs red
    const bgColor = isPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';

    const chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: symbol,
                data: historyData,
                borderColor: lineColor,
                backgroundColor: bgColor,
                borderWidth: 3,
                pointRadius: 0,
                pointHitRadius: 10,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0 // Prevent constant rebounce effect on rapid websocket ticks
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            return ` ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: { display: false },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                }
            }
        }
    };

    if (stockDetailChartInstance) {
        stockDetailChartInstance.data = chartConfig.data;
        stockDetailChartInstance.options.scales.y.grid.color = gridColor;
        stockDetailChartInstance.options.scales.y.ticks.color = textColor;
        stockDetailChartInstance.update();
    } else {
        stockDetailChartInstance = new Chart(ctx, chartConfig);
    }
}
