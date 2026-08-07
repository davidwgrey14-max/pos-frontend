// src/utils/calculationUtils.js
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { RiseOutlined, FallOutlined } from '@ant-design/icons';
import React from 'react';

dayjs.extend(isBetween);
dayjs.extend(customParseFormat);

// =============================================
// UPDATED CALCULATION UTILITIES - FULLY ALIGNED WITH SERVER & COMPONENTS
// =============================================

export const CalculationUtils = {
  // Safe number conversion with enhanced validation
  safeNumber: (value, fallback = 0) => {
    if (value === null || value === undefined || value === '' || value === 'null' || value === 'undefined') return fallback;
    if (typeof value === 'boolean') return value ? 1 : 0;
    
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  },

  // Format currency for display with enhanced options
  formatCurrency: (amount, currency = 'KES', showSymbol = true) => {
    const value = CalculationUtils.safeNumber(amount);
    const formatted = value.toLocaleString('en-KE', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
    return showSymbol ? `${currency} ${formatted}` : formatted;
  },

  // Get color based on profit value
  getProfitColor: (profit) => {
    const value = CalculationUtils.safeNumber(profit);
    if (value > 0) return '#3f8600'; // Green
    if (value < 0) return '#cf1322'; // Red
    return '#d9d9d9'; // Gray
  },

  // Get profit icon based on profit value
  getProfitIcon: (profit) => {
    const value = CalculationUtils.safeNumber(profit);
    return value >= 0 ? <RiseOutlined /> : <FallOutlined />;
  },

  // Calculate profit from revenue and cost
  calculateProfit: (revenue, cost) => {
    const revenueNum = CalculationUtils.safeNumber(revenue);
    const costNum = CalculationUtils.safeNumber(cost);
    return revenueNum - costNum;
  },

  // Calculate profit margin percentage with enhanced validation
  calculateProfitMargin: (revenue, profit) => {
    const revenueNum = CalculationUtils.safeNumber(revenue);
    const profitNum = CalculationUtils.safeNumber(profit);
    if (revenueNum <= 0) return 0.0;
    return (profitNum / revenueNum) * 100;
  },

  // ENHANCED: Calculate cost from items with product data integration
  calculateCostFromItems: (transaction, products = []) => {
    try {
      // If cost is already provided and valid, use it
      if (transaction.cost && CalculationUtils.safeNumber(transaction.cost) > 0) {
        return CalculationUtils.safeNumber(transaction.cost);
      }
      
      if (transaction.totalCost && CalculationUtils.safeNumber(transaction.totalCost) > 0) {
        return CalculationUtils.safeNumber(transaction.totalCost);
      }

      // Calculate cost from items
      if (transaction.items && Array.isArray(transaction.items)) {
        let totalCost = 0;
        
        for (const item of transaction.items) {
          const quantity = CalculationUtils.safeNumber(item.quantity, 1);
          
          // Try to get cost from different sources in priority order
          let itemCost = 0;
          
          // Priority 1: Direct cost field in item
          if (item.cost && CalculationUtils.safeNumber(item.cost) > 0) {
            itemCost = CalculationUtils.safeNumber(item.cost);
          }
          // Priority 2: Buying price field in item
          else if (item.buyingPrice && CalculationUtils.safeNumber(item.buyingPrice) > 0) {
            itemCost = CalculationUtils.safeNumber(item.buyingPrice);
          }
          // Priority 3: Look up product buying price from products array
          else if (item.productId && products.length > 0) {
            const product = products.find(p => 
              p._id && item.productId && 
              (p._id.toString() === item.productId.toString() || 
               (p._id && item.productId._id && p._id.toString() === item.productId._id.toString()))
            );
            
            if (product) {
              itemCost = CalculationUtils.safeNumber(product.buyingPrice);
            }
          }
          // Priority 4: Use a default cost estimation (30% of price as fallback)
          else if (item.price && CalculationUtils.safeNumber(item.price) > 0) {
            itemCost = CalculationUtils.safeNumber(item.price) * 0.3; // Estimate 30% cost
          }

          totalCost += itemCost * quantity;
        }
        
        return totalCost;
      }
      
      return 0;
    } catch (error) {
      console.error('❌ Error calculating cost from items:', error);
      return 0;
    }
  },

  // UPDATED: Calculate COGS for transactions array - aligns with server methodology
  calculateCOGS: (transactions, products = []) => {
    if (!Array.isArray(transactions)) return 0;
    
    console.log('🧮 COGS Calculation - Processing transactions:', transactions.length);
    
    const totalCOGS = transactions.reduce((sum, transaction) => {
      // Exclude credit payment transactions from COGS calculation
      // Only include actual sales (new transactions and credit sales made)
      if (transaction.isCreditPayment) {
        console.log(`📦 Skipping COGS for credit payment transaction: ${transaction._id}`);
        return sum; // Credit payments don't contribute to COGS
      }
      
      // Include COGS for both complete sales and credit sales
      // Credit sales contribute to COGS when the sale is made, not when payment is received
      const cost = CalculationUtils.calculateCostFromItems(transaction, products);
      
      console.log(`📦 Transaction ${transaction._id}:`, {
        isCredit: transaction.isCreditTransaction,
        isCreditPayment: transaction.isCreditPayment,
        paymentMethod: transaction.paymentMethod,
        totalAmount: transaction.totalAmount,
        calculatedCost: cost,
        itemsCount: transaction.items?.length
      });
      
      return sum + cost;
    }, 0);
    
    console.log('💰 FINAL COGS Calculation Result:', {
      totalTransactions: transactions.length,
      creditTransactions: transactions.filter(t => t.isCreditTransaction && !t.isCreditPayment).length,
      creditPayments: transactions.filter(t => t.isCreditPayment).length,
      completeTransactions: transactions.filter(t => !t.isCreditTransaction && !t.isCreditPayment).length,
      totalCOGS: totalCOGS
    });
    
    return totalCOGS;
  },

  // NEW: Enhanced revenue calculation with credit payment support and immediate revenue tracking
  calculateRevenue: (transactions) => {
    if (!Array.isArray(transactions)) return 0;
    
    return transactions.reduce((sum, transaction) => {
      // For credit payments, use the payment amount as revenue
      if (transaction.isCreditPayment) {
        return sum + CalculationUtils.safeNumber(transaction.totalAmount);
      }
      
      // For regular transactions, use recognized revenue (includes immediate revenue for credit sales)
      return sum + CalculationUtils.safeNumber(transaction.recognizedRevenue || transaction.immediateRevenue || transaction.totalAmount);
    }, 0);
  },

  // UPDATED: Calculate transaction metrics with proper credit recognition and payment support
  calculateTransactionMetrics: (transaction, products = []) => {
    const items = transaction.items || [];
    const totalAmount = CalculationUtils.safeNumber(transaction.totalAmount);
    
    // Handle credit payments differently
    if (transaction.isCreditPayment) {
      return {
        ...transaction,
        totalAmount: totalAmount,
        cost: 0, // Credit payments don't have COGS
        profit: totalAmount, // Profit equals payment amount
        profitMargin: 100, // 100% profit margin for payments
        isCreditTransaction: false,
        isCreditPayment: true,
        recognizedRevenue: totalAmount,
        outstandingRevenue: 0,
        amountPaid: totalAmount,
        creditStatus: null,
        itemsCount: 0, // Credit payments don't have items
        displayDate: transaction.displayDate || new Date(transaction.saleDate || transaction.createdAt).toLocaleString('en-KE')
      };
    }
    
    // Use enhanced cost calculation for regular transactions with products data
    const cost = CalculationUtils.calculateCostFromItems(transaction, products);
    
    const isCredit = transaction.paymentMethod === 'credit' || transaction.isCreditTransaction;
    
    // Enhanced credit revenue recognition with immediate revenue tracking
    const recognizedRevenue = isCredit ? 
      CalculationUtils.safeNumber(transaction.recognizedRevenue || transaction.immediateRevenue || 0) : 
      totalAmount;
    
    const outstandingRevenue = isCredit ? 
      CalculationUtils.safeNumber(transaction.outstandingRevenue) : 
      0;
    
    const amountPaid = isCredit ? 
      CalculationUtils.safeNumber(transaction.amountPaid) : 
      totalAmount;

    // Calculate profit based on recognized revenue (not total amount for credits)
    const profit = recognizedRevenue - cost;
    const profitMargin = CalculationUtils.calculateProfitMargin(recognizedRevenue, profit);
    
    // Enhanced credit status calculation
    let creditStatus = transaction.creditStatus;
    if (isCredit && !creditStatus) {
      if (outstandingRevenue <= 0) {
        creditStatus = 'paid';
      } else if (amountPaid > 0) {
        creditStatus = 'partially_paid';
      } else {
        creditStatus = 'pending';
      }
    }

    return {
      totalAmount,
      cost, // This cost is stored and will be used in COGS calculation
      profit,
      profitMargin,
      itemsCount: items.reduce((sum, item) => sum + CalculationUtils.safeNumber(item.quantity, 1), 0),
      isCreditTransaction: isCredit,
      isCreditPayment: false,
      recognizedRevenue,
      outstandingRevenue,
      amountPaid,
      creditStatus,
      immediateRevenue: transaction.immediateRevenue || recognizedRevenue, // Track immediate revenue
      displayDate: transaction.displayDate || new Date(transaction.saleDate || transaction.createdAt).toLocaleString('en-KE')
    };
  },

  // NEW: Calculate outstanding credit by cashier - aligned with server structure
  calculateOutstandingCreditByCashier: (credits = []) => {
    const cashierCredits = {};
    
    credits.forEach(credit => {
      const cashierId = credit.cashierId || credit.cashier?._id || 'unknown';
      const cashierName = credit.cashierName || credit.cashier?.name || 'Unknown Cashier';
      
      if (!cashierCredits[cashierId]) {
        cashierCredits[cashierId] = {
          cashierId,
          cashierName,
          totalCreditGiven: 0,
          outstandingCredit: 0,
          amountCollected: 0,
          creditCount: 0,
          overdueCredit: 0,
          creditTransactions: []
        };
      }
      
      const balanceDue = CalculationUtils.safeNumber(credit.balanceDue);
      const totalAmount = CalculationUtils.safeNumber(credit.totalAmount);
      const amountPaid = CalculationUtils.safeNumber(credit.amountPaid);
      
      cashierCredits[cashierId].totalCreditGiven += totalAmount;
      cashierCredits[cashierId].outstandingCredit += balanceDue;
      cashierCredits[cashierId].amountCollected += amountPaid;
      cashierCredits[cashierId].creditCount += 1;
      
      // Check if credit is overdue
      if (credit.dueDate && dayjs(credit.dueDate).isBefore(dayjs()) && balanceDue > 0) {
        cashierCredits[cashierId].overdueCredit += balanceDue;
      }
      
      cashierCredits[cashierId].creditTransactions.push(credit);
    });
    
    // Convert to array and calculate additional metrics
    return Object.values(cashierCredits).map(cashier => ({
      ...cashier,
      collectionRate: cashier.totalCreditGiven > 0 ? 
        (cashier.amountCollected / cashier.totalCreditGiven) * 100 : 0,
      averageCreditAmount: cashier.creditCount > 0 ? 
        cashier.totalCreditGiven / cashier.creditCount : 0
    })).sort((a, b) => b.outstandingCredit - a.outstandingCredit);
  },

  // NEW: Calculate outstanding credit by shop - aligned with server structure
  calculateOutstandingCreditByShop: (credits = []) => {
    const shopCredits = {};
    
    credits.forEach(credit => {
      const shopId = credit.shopId || credit.shop?._id || credit.creditShopId || 'unknown';
      const shopName = credit.shopName || credit.shop?.name || credit.creditShopName || 'Unknown Shop';
      
      if (!shopCredits[shopId]) {
        shopCredits[shopId] = {
          shopId,
          shopName,
          totalCreditGiven: 0,
          outstandingCredit: 0,
          amountCollected: 0,
          creditCount: 0,
          overdueCredit: 0,
          creditTransactions: []
        };
      }
      
      const balanceDue = CalculationUtils.safeNumber(credit.balanceDue);
      const totalAmount = CalculationUtils.safeNumber(credit.totalAmount);
      const amountPaid = CalculationUtils.safeNumber(credit.amountPaid);
      
      shopCredits[shopId].totalCreditGiven += totalAmount;
      shopCredits[shopId].outstandingCredit += balanceDue;
      shopCredits[shopId].amountCollected += amountPaid;
      shopCredits[shopId].creditCount += 1;
      
      // Check if credit is overdue
      if (credit.dueDate && dayjs(credit.dueDate).isBefore(dayjs()) && balanceDue > 0) {
        shopCredits[shopId].overdueCredit += balanceDue;
      }
      
      shopCredits[shopId].creditTransactions.push(credit);
    });
    
    // Convert to array and calculate additional metrics
    return Object.values(shopCredits).map(shop => ({
      ...shop,
      collectionRate: shop.totalCreditGiven > 0 ? 
        (shop.amountCollected / shop.totalCreditGiven) * 100 : 0,
      averageCreditAmount: shop.creditCount > 0 ? 
        shop.totalCreditGiven / shop.creditCount : 0
    })).sort((a, b) => b.outstandingCredit - a.outstandingCredit);
  },

  // UPDATED: Calculate cashier performance with credit metrics - aligned with server
  calculateCashierPerformanceWithCredits: (transactions = [], credits = [], cashiers = []) => {
    const cashierPerformance = {};
    
    // Initialize cashier data
    cashiers.forEach(cashier => {
      cashierPerformance[cashier._id] = {
        cashierId: cashier._id,
        cashierName: cashier.name,
        totalRevenue: 0,
        totalTransactions: 0,
        totalProfit: 0,
        itemsSold: 0,
        creditSales: 0,
        creditRevenue: 0,
        outstandingCredit: 0,
        totalCreditGiven: 0,
        creditCollectionRate: 0,
        creditTransactions: [],
        immediateRevenue: 0 // NEW: Track immediate revenue
      };
    });
    
    // Process transactions
    transactions.forEach(transaction => {
      const cashierId = transaction.cashierId || transaction.cashier?._id;
      if (!cashierId || !cashierPerformance[cashierId]) return;
      
      const cashier = cashierPerformance[cashierId];
      const totalAmount = CalculationUtils.safeNumber(transaction.totalAmount);
      const recognizedRevenue = CalculationUtils.safeNumber(transaction.recognizedRevenue || transaction.immediateRevenue || transaction.totalAmount);
      
      cashier.totalRevenue += recognizedRevenue;
      cashier.totalTransactions += 1;
      cashier.itemsSold += CalculationUtils.safeNumber(transaction.itemsCount, 0);
      
      // Track immediate revenue
      cashier.immediateRevenue += CalculationUtils.safeNumber(transaction.immediateRevenue || recognizedRevenue);
      
      // Track credit sales (exclude credit payments)
      if ((transaction.paymentMethod === 'credit' || transaction.isCreditTransaction) && !transaction.isCreditPayment) {
        cashier.creditSales += 1;
        cashier.creditRevenue += totalAmount;
      }
    });
    
    // Process credits
    credits.forEach(credit => {
      const cashierId = credit.cashierId || credit.cashier?._id;
      if (!cashierId || !cashierPerformance[cashierId]) return;
      
      const cashier = cashierPerformance[cashierId];
      const balanceDue = CalculationUtils.safeNumber(credit.balanceDue);
      const totalAmount = CalculationUtils.safeNumber(credit.totalAmount);
      
      cashier.outstandingCredit += balanceDue;
      cashier.totalCreditGiven += totalAmount;
      cashier.creditTransactions.push(credit);
    });
    
    // Calculate final metrics
    return Object.values(cashierPerformance).map(cashier => {
      // Calculate profit based on revenue and estimated costs
      const estimatedCost = cashier.totalRevenue * 0.7; // Estimate 70% cost for performance metrics
      const totalProfit = cashier.totalRevenue - estimatedCost;
      const collectionRate = cashier.totalCreditGiven > 0 ? 
        ((cashier.totalCreditGiven - cashier.outstandingCredit) / cashier.totalCreditGiven) * 100 : 0;
      
      return {
        ...cashier,
        totalProfit,
        collectionRate,
        profitMargin: CalculationUtils.calculateProfitMargin(cashier.totalRevenue, totalProfit),
        averageTransactionValue: cashier.totalTransactions > 0 ? 
          cashier.totalRevenue / cashier.totalTransactions : 0,
        creditRiskScore: Math.max(0, 100 - (cashier.outstandingCredit / Math.max(cashier.totalCreditGiven, 1)) * 100)
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  },

  // UPDATED: Calculate shop performance with credit metrics - aligned with server
  calculateShopPerformanceWithCredits: (transactions = [], credits = [], shops = []) => {
    const shopPerformance = {};
    
    // Initialize shop data
    shops.forEach(shop => {
      shopPerformance[shop._id] = {
        shopId: shop._id,
        shopName: shop.name,
        location: shop.location,
        totalRevenue: 0,
        totalTransactions: 0,
        totalProfit: 0,
        itemsSold: 0,
        creditSales: 0,
        creditRevenue: 0,
        outstandingCredit: 0,
        totalCreditGiven: 0,
        creditCollectionRate: 0,
        creditTransactions: [],
        immediateRevenue: 0 // NEW: Track immediate revenue
      };
    });
    
    // Process transactions
    transactions.forEach(transaction => {
      const shopId = transaction.shopId || transaction.shop?._id;
      if (!shopId || !shopPerformance[shopId]) return;
      
      const shop = shopPerformance[shopId];
      const totalAmount = CalculationUtils.safeNumber(transaction.totalAmount);
      const recognizedRevenue = CalculationUtils.safeNumber(transaction.recognizedRevenue || transaction.immediateRevenue || transaction.totalAmount);
      
      shop.totalRevenue += recognizedRevenue;
      shop.totalTransactions += 1;
      shop.itemsSold += CalculationUtils.safeNumber(transaction.itemsCount, 0);
      
      // Track immediate revenue
      shop.immediateRevenue += CalculationUtils.safeNumber(transaction.immediateRevenue || recognizedRevenue);
      
      // Track credit sales (exclude credit payments)
      if ((transaction.paymentMethod === 'credit' || transaction.isCreditTransaction) && !transaction.isCreditPayment) {
        shop.creditSales += 1;
        shop.creditRevenue += totalAmount;
      }
    });
    
    // Process credits
    credits.forEach(credit => {
      const shopId = credit.shopId || credit.shop?._id || credit.creditShopId;
      if (!shopId || !shopPerformance[shopId]) return;
      
      const shop = shopPerformance[shopId];
      const balanceDue = CalculationUtils.safeNumber(credit.balanceDue);
      const totalAmount = CalculationUtils.safeNumber(credit.totalAmount);
      
      shop.outstandingCredit += balanceDue;
      shop.totalCreditGiven += totalAmount;
      shop.creditTransactions.push(credit);
    });
    
    // Calculate final metrics
    return Object.values(shopPerformance).map(shop => {
      // Calculate profit based on revenue and estimated costs
      const estimatedCost = shop.totalRevenue * 0.7; // Estimate 70% cost for performance metrics
      const totalProfit = shop.totalRevenue - estimatedCost;
      const collectionRate = shop.totalCreditGiven > 0 ? 
        ((shop.totalCreditGiven - shop.outstandingCredit) / shop.totalCreditGiven) * 100 : 0;
      
      return {
        ...shop,
        totalProfit,
        collectionRate,
        profitMargin: CalculationUtils.calculateProfitMargin(shop.totalRevenue, totalProfit),
        averageTransactionValue: shop.totalTransactions > 0 ? 
          shop.totalRevenue / shop.totalTransactions : 0,
        creditRiskScore: Math.max(0, 100 - (shop.outstandingCredit / Math.max(shop.totalCreditGiven, 1)) * 100)
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  },

  // UPDATED: Process comprehensive data with complete credit integration and payment support
  processComprehensiveData: (rawData, selectedShop) => {
    try {
      console.log('🔧 Processing comprehensive data with credit integration and payment support...', {
        rawDataKeys: Object.keys(rawData),
        selectedShop
      });

      // Extract data with proper fallbacks
      const transactions = rawData.transactions || 
                         rawData.salesWithProfit || 
                         rawData.filteredTransactions || 
                         [];

      const expenses = rawData.expenses || [];
      const credits = rawData.credits || [];
      const products = rawData.products || [];
      const shops = rawData.shops || [];
      const cashiers = rawData.cashiers || [];

      console.log('📊 Data extracted:', {
        transactions: transactions.length,
        expenses: expenses.length,
        credits: credits.length,
        products: products.length,
        shops: shops.length,
        cashiers: cashiers.length
      });

      // Process each transaction with enhanced credit handling
      const processedTransactions = transactions.map(transaction => {
        // Handle credit payments differently
        if (transaction.isCreditPayment) {
          return {
            ...transaction,
            totalAmount: CalculationUtils.safeNumber(transaction.totalAmount),
            cost: 0, // Credit payments don't have COGS
            profit: CalculationUtils.safeNumber(transaction.totalAmount), // Profit equals payment amount
            profitMargin: 100, // 100% profit margin for payments
            isCreditTransaction: false,
            isCreditPayment: true,
            recognizedRevenue: CalculationUtils.safeNumber(transaction.totalAmount),
            outstandingRevenue: 0,
            amountPaid: CalculationUtils.safeNumber(transaction.totalAmount),
            creditStatus: null,
            itemsCount: 0, // Credit payments don't have items
            immediateRevenue: CalculationUtils.safeNumber(transaction.totalAmount), // NEW: Track immediate revenue
            displayDate: transaction.displayDate || 
                        new Date(transaction.saleDate || transaction.createdAt).toLocaleString('en-KE'),
            _processedAt: new Date().toISOString(),
            _isValid: true
          };
        }

        // Ensure proper credit transaction detection for regular transactions
        const isCredit = transaction.paymentMethod === 'credit' || 
                        transaction.isCreditTransaction === true ||
                        transaction.status === 'credit';

        // Use enhanced cost calculation with products data
        const cost = CalculationUtils.calculateCostFromItems(transaction, products);
        const totalAmount = CalculationUtils.safeNumber(transaction.totalAmount);
        
        // Enhanced credit revenue recognition with immediate revenue tracking
        let recognizedRevenue, outstandingRevenue, amountPaid, creditStatus, immediateRevenue;

        if (isCredit) {
          recognizedRevenue = CalculationUtils.safeNumber(transaction.recognizedRevenue);
          outstandingRevenue = CalculationUtils.safeNumber(transaction.outstandingRevenue);
          amountPaid = CalculationUtils.safeNumber(transaction.amountPaid);
          immediateRevenue = CalculationUtils.safeNumber(transaction.immediateRevenue || transaction.amountPaid); // NEW: Use immediate revenue
          creditStatus = transaction.creditStatus || 'pending';
          
          // Validate credit amounts
          if (recognizedRevenue === 0 && outstandingRevenue === 0) {
            outstandingRevenue = totalAmount;
          }
        } else {
          // Complete transaction - all revenue recognized immediately
          recognizedRevenue = totalAmount;
          outstandingRevenue = 0;
          amountPaid = totalAmount;
          immediateRevenue = totalAmount; // NEW: Track immediate revenue
          creditStatus = null;
        }

        // Calculate profit metrics based on recognized revenue
        const profit = CalculationUtils.calculateProfit(recognizedRevenue, cost);
        const profitMargin = CalculationUtils.calculateProfitMargin(recognizedRevenue, profit);

        // Enhanced shop name handling
        let shopName = 'Unknown Shop';
        if (transaction.shop) {
          if (typeof transaction.shop === 'string') {
            shopName = transaction.shop;
          } else if (typeof transaction.shop === 'object' && transaction.shop.name) {
            shopName = transaction.shop.name;
          }
        } else if (transaction.shopName) {
          shopName = transaction.shopName;
        }

        // Enhanced date handling
        const saleDate = transaction.saleDate || transaction.createdAt;
        const displayDate = transaction.displayDate || 
                           (saleDate ? new Date(saleDate).toLocaleString('en-KE') : 'Date Unknown');

        return {
          ...transaction,
          // Core financial data
          totalAmount: parseFloat(totalAmount.toFixed(2)),
          cost: parseFloat(cost.toFixed(2)), // This cost will be used in COGS calculation
          profit: parseFloat(profit.toFixed(2)),
          profitMargin: parseFloat(profitMargin.toFixed(2)),
          
          // Enhanced credit management data
          isCreditTransaction: isCredit,
          isCreditPayment: false,
          recognizedRevenue: parseFloat(recognizedRevenue.toFixed(2)),
          outstandingRevenue: parseFloat(outstandingRevenue.toFixed(2)),
          amountPaid: parseFloat(amountPaid.toFixed(2)),
          immediateRevenue: parseFloat(immediateRevenue.toFixed(2)), // NEW: Track immediate revenue
          creditStatus: creditStatus,
          
          // Display properties
          displayDate,
          shop: shopName,
          shopName: shopName,
          
          // Cashier info
          cashierName: transaction.cashierName || 'Unknown Cashier',
          
          // Items count
          itemsCount: CalculationUtils.safeNumber(transaction.itemsCount) || 
                     (transaction.items ? transaction.items.reduce((sum, item) => 
                       sum + CalculationUtils.safeNumber(item.quantity, 1), 0) : 0),
          
          // Metadata
          _id: transaction._id,
          transactionNumber: transaction.transactionNumber,
          paymentMethod: transaction.paymentMethod,
          customerName: transaction.customerName || 'Walk-in Customer',
          status: transaction.status || 'completed',
          _processedAt: new Date().toISOString(),
          _isValid: true
        };
      });

      // Filter by shop if specified
      const filteredTransactions = selectedShop && selectedShop !== 'all' ? 
        processedTransactions.filter(t => {
          const transactionShopId = t.shopId || t.shop;
          return transactionShopId === selectedShop;
        }) : processedTransactions;

      console.log('✅ Processed transactions:', {
        total: processedTransactions.length,
        filtered: filteredTransactions.length,
        creditTransactions: filteredTransactions.filter(t => t.isCreditTransaction && !t.isCreditPayment).length,
        creditPayments: filteredTransactions.filter(t => t.isCreditPayment).length,
        completeTransactions: filteredTransactions.filter(t => !t.isCreditTransaction && !t.isCreditPayment).length
      });

      // Calculate financial stats with enhanced payment support
      const financialStats = CalculationUtils.calculateFinancialStatsWithCreditManagement(
        filteredTransactions, 
        expenses, 
        credits,
        products // NEW: Pass products for accurate cost calculation
      );

      // NEW: Calculate credit analytics
      const creditAnalytics = {
        byCashier: CalculationUtils.calculateOutstandingCreditByCashier(credits),
        byShop: CalculationUtils.calculateOutstandingCreditByShop(credits),
        cashierPerformance: CalculationUtils.calculateCashierPerformanceWithCredits(transactions, credits, cashiers),
        shopPerformance: CalculationUtils.calculateShopPerformanceWithCredits(transactions, credits, shops),
        summary: {
          totalOutstandingCredit: credits.reduce((sum, credit) => sum + CalculationUtils.safeNumber(credit.balanceDue), 0),
          totalCreditGiven: credits.reduce((sum, credit) => sum + CalculationUtils.safeNumber(credit.totalAmount), 0),
          totalCredits: credits.length,
          activeCredits: credits.filter(credit => CalculationUtils.safeNumber(credit.balanceDue) > 0).length,
          overdueCredits: credits.filter(credit => 
            credit.dueDate && dayjs(credit.dueDate).isBefore(dayjs()) && CalculationUtils.safeNumber(credit.balanceDue) > 0
          ).length
        }
      };

      return {
        salesWithProfit: filteredTransactions,
        financialStats,
        expenses,
        credits,
        products,
        shops,
        cashiers,
        summary: financialStats,
        enhancedStats: {
          financialStats,
          salesWithProfit: filteredTransactions,
          creditAnalytics
        },
        creditAnalytics,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error in processComprehensiveData:', error);
      return CalculationUtils.getDefaultProcessedData();
    }
  },

  // UPDATED: Process single transaction with comprehensive credit management data and payment support
  processSingleTransaction: (transaction, products = []) => {
    try {
      if (!transaction) return CalculationUtils.createFallbackTransaction();

      // Handle credit payments differently
      if (transaction.isCreditPayment) {
        return {
          ...transaction,
          totalAmount: CalculationUtils.safeNumber(transaction.totalAmount),
          cost: 0, // Credit payments don't have COGS
          profit: CalculationUtils.safeNumber(transaction.totalAmount), // Profit equals payment amount
          profitMargin: 100, // 100% profit margin for payments
          isCreditTransaction: false,
          isCreditPayment: true,
          recognizedRevenue: CalculationUtils.safeNumber(transaction.totalAmount),
          outstandingRevenue: 0,
          amountPaid: CalculationUtils.safeNumber(transaction.totalAmount),
          immediateRevenue: CalculationUtils.safeNumber(transaction.totalAmount), // NEW: Track immediate revenue
          creditStatus: null,
          itemsCount: 0, // Credit payments don't have items
          displayDate: transaction.displayDate || 
                      new Date(transaction.saleDate || transaction.createdAt).toLocaleString('en-KE'),
          _processedAt: new Date().toISOString(),
          _isValid: true
        };
      }

      // ENHANCED: Multiple ways to detect credit transactions
      const isCredit = transaction.paymentMethod === 'credit' || 
                      transaction.isCredit === true || 
                      transaction.transactionType === 'credit' ||
                      transaction.isCreditTransaction === true ||
                      transaction.status === 'credit';
      
      // Use server-calculated values when available, otherwise calculate
      const totalAmount = CalculationUtils.safeNumber(transaction.totalAmount) || 
                         CalculationUtils.safeNumber(transaction.amount) || 0;
      
      // ENHANCED: Use the new cost calculation function with products data
      const cost = CalculationUtils.calculateCostFromItems(transaction, products);
      
      // ENHANCED: Credit management revenue recognition logic
      const amountPaid = CalculationUtils.safeNumber(transaction.amountPaid) || 
                        CalculationUtils.safeNumber(transaction.paidAmount) || 0;
      
      // UPDATED: For credit transactions, recognized revenue is the amount paid immediately
      const recognizedRevenue = isCredit ? amountPaid : totalAmount;
      
      const outstandingRevenue = isCredit ? 
        (CalculationUtils.safeNumber(transaction.outstandingRevenue) || 
         CalculationUtils.safeNumber(transaction.balanceDue) || 
         Math.max(0, totalAmount - amountPaid)) : 0;

      // NEW: Track immediate revenue
      const immediateRevenue = isCredit ? amountPaid : totalAmount;

      // Calculate profit metrics based on recognized revenue
      const profit = CalculationUtils.calculateProfit(recognizedRevenue, cost);
      const profitMargin = CalculationUtils.calculateProfitMargin(recognizedRevenue, profit);

      // Enhanced date handling
      const saleDate = transaction.saleDate || transaction.createdAt || transaction.date;
      const displayDate = transaction.displayDate || 
                         (saleDate ? dayjs(saleDate).format('DD/MM/YYYY HH:mm') : 'Date Unknown');

      // Enhanced shop name handling
      let shopName = 'Unknown Shop';
      if (transaction.shop) {
        if (typeof transaction.shop === 'string') {
          shopName = transaction.shop;
        } else if (typeof transaction.shop === 'object' && transaction.shop.name) {
          shopName = transaction.shop.name;
        }
      }

      // ENHANCED: Credit status calculation similar to CreditManagement component
      const calculateCreditStatus = (transaction, balanceDue) => {
        if (balanceDue <= 0) {
          return 'paid';
        }
        
        if (amountPaid > 0 && balanceDue > 0) {
          return 'partially_paid';
        }
        
        if (transaction.dueDate && dayjs(transaction.dueDate).isBefore(dayjs())) {
          return 'overdue';
        }
        
        return 'pending';
      };

      const creditStatus = isCredit ? 
        (transaction.creditStatus || calculateCreditStatus(transaction, outstandingRevenue)) : 
        null;

      return {
        ...transaction,
        // Core financial data
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        cost: parseFloat(cost.toFixed(2)), // This cost will be used in COGS calculation
        profit: parseFloat(profit.toFixed(2)),
        profitMargin: parseFloat(profitMargin.toFixed(2)),
        
        // Enhanced revenue recognition with credit management
        amountPaid: parseFloat(amountPaid.toFixed(2)),
        recognizedRevenue: parseFloat(recognizedRevenue.toFixed(2)),
        outstandingRevenue: parseFloat(outstandingRevenue.toFixed(2)),
        immediateRevenue: parseFloat(immediateRevenue.toFixed(2)), // NEW: Track immediate revenue
        
        // Display properties
        displayDate,
        
        // Transaction classification with enhanced credit handling
        isCreditTransaction: isCredit,
        isCreditPayment: false,
        creditStatus: creditStatus,
        
        // Safe shop handling
        shop: shopName,
        shopName: shopName, // Alias for compatibility
        
        // Cashier info
        cashierName: transaction.cashierName || 'Unknown Cashier',
        
        // Additional metadata for credit management
        _processedAt: new Date().toISOString(),
        _isValid: true,
        _creditManagementData: {
          isCredit,
          creditStatus,
          amountPaid,
          outstandingRevenue,
          immediateRevenue,
          collectionRate: totalAmount > 0 ? (amountPaid / totalAmount) * 100 : 0
        }
      };
    } catch (error) {
      console.error('❌ Error processing transaction:', error, transaction);
      return CalculationUtils.createFallbackTransaction(transaction);
    }
  },

  // UPDATED: Calculate financial statistics with proper COGS and credit payment support
  calculateFinancialStatsWithCreditManagement: (transactions, expenses, credits, products = [], serverStats = null) => {
    // Prefer server-calculated stats when available
    if (serverStats) {
      return CalculationUtils.enhanceServerStatsWithCreditManagement(serverStats, transactions, credits, products);
    }

    const validTransactions = transactions.filter(t => t && t._isValid !== false);
    
    if (validTransactions.length === 0) {
      return CalculationUtils.getDefaultStatsWithCreditManagement();
    }

    try {
      // ENHANCED: Better transaction categorization
      const creditTransactions = validTransactions.filter(t => 
        (t.paymentMethod === 'credit' || t.isCreditTransaction === true || t.status === 'credit') && !t.isCreditPayment
      );
      
      const creditPayments = validTransactions.filter(t => t.isCreditPayment);
      
      const nonCreditTransactions = validTransactions.filter(t => 
        !creditTransactions.includes(t) && !creditPayments.includes(t)
      );

      console.log('🧮 Financial Analysis - Transaction Breakdown:', {
        totalTransactions: validTransactions.length,
        creditTransactions: creditTransactions.length,
        creditPayments: creditPayments.length,
        nonCreditTransactions: nonCreditTransactions.length
      });

      // ENHANCED: Revenue calculations with credit payment support and immediate revenue tracking
      const totalRevenue = CalculationUtils.calculateRevenue(validTransactions);
      const creditSalesAmount = creditTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      const nonCreditSalesAmount = nonCreditTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      const creditPaymentRevenue = creditPayments.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      
      // UPDATED COGS CALCULATION: Use products data for accurate cost calculation
      const costOfGoodsSold = CalculationUtils.calculateCOGS(validTransactions, products);
      
      const totalProfit = CalculationUtils.calculateProfit(totalRevenue, costOfGoodsSold);
      
      // Expense calculations
      const totalExpensesAmount = expenses.reduce((sum, e) => 
        sum + CalculationUtils.safeNumber(e.amount), 0
      );
      const netProfit = CalculationUtils.calculateProfit(totalProfit, totalExpensesAmount);
      
      // ENHANCED: Payment method calculations with split payment support
      const cashTransactions = validTransactions.filter(t => 
        t.paymentMethod === 'cash' || 
        (t.paymentSplit && CalculationUtils.safeNumber(t.paymentSplit.cash) > 0)
      );
      const mpesaBankTransactions = validTransactions.filter(t => 
        ['mpesa', 'bank', 'card', 'bank_mpesa'].includes(t.paymentMethod) ||
        (t.paymentSplit && CalculationUtils.safeNumber(t.paymentSplit.bank_mpesa) > 0)
      );

      // Calculate totals considering payment splits
      const totalCash = cashTransactions.reduce((sum, t) => {
        if (t.paymentSplit && CalculationUtils.safeNumber(t.paymentSplit.cash) > 0) {
          return sum + CalculationUtils.safeNumber(t.paymentSplit.cash);
        }
        return sum + CalculationUtils.safeNumber(t.recognizedRevenue || t.immediateRevenue || t.totalAmount);
      }, 0);
      
      const totalMpesaBank = mpesaBankTransactions.reduce((sum, t) => {
        if (t.paymentSplit && CalculationUtils.safeNumber(t.paymentSplit.bank_mpesa) > 0) {
          return sum + CalculationUtils.safeNumber(t.paymentSplit.bank_mpesa);
        }
        return sum + CalculationUtils.safeNumber(t.recognizedRevenue || t.immediateRevenue || t.totalAmount);
      }, 0);

      // ENHANCED: Credit calculations
      const outstandingCredit = creditTransactions.reduce((sum, t) => sum + (t.outstandingRevenue || 0), 0);
      const recognizedCreditRevenue = creditTransactions.reduce((sum, t) => sum + (t.recognizedRevenue || 0), 0);
      const immediateRevenue = validTransactions.reduce((sum, t) => sum + (t.immediateRevenue || t.recognizedRevenue || 0), 0);

      // NEW: Calculate credit metrics from credits data
      const totalCreditGiven = credits.reduce((sum, credit) => sum + CalculationUtils.safeNumber(credit.totalAmount), 0);
      const totalOutstandingFromCredits = credits.reduce((sum, credit) => sum + CalculationUtils.safeNumber(credit.balanceDue), 0);
      const totalAmountPaid = credits.reduce((sum, credit) => sum + CalculationUtils.safeNumber(credit.amountPaid), 0);

      // Calculate COGS breakdown for detailed analysis
      const cogsFromCreditSales = CalculationUtils.calculateCOGS(creditTransactions, products);
      const cogsFromCompleteSales = CalculationUtils.calculateCOGS(nonCreditTransactions, products);
      const cogsFromCreditPayments = CalculationUtils.calculateCOGS(creditPayments, products); // Should be 0

      console.log('💰 FINAL Financial Breakdown with Credit Payments:', {
        totalCOGS: costOfGoodsSold,
        fromCreditSales: cogsFromCreditSales,
        fromCompleteSales: cogsFromCompleteSales,
        fromCreditPayments: cogsFromCreditPayments,
        totalRevenue: totalRevenue,
        creditPaymentRevenue: creditPaymentRevenue,
        immediateRevenue: immediateRevenue,
        creditTransactionsCount: creditTransactions.length,
        creditPaymentsCount: creditPayments.length,
        completeTransactionsCount: nonCreditTransactions.length
      });

      // RETURN STRUCTURE WITH CREDIT MANAGEMENT & PAYMENT SUPPORT
      return {
        // Core financial metrics - matching your image requirements
        totalSales: validTransactions.length,
        creditSales: parseFloat(creditSalesAmount.toFixed(2)),
        nonCreditSales: parseFloat(nonCreditSalesAmount.toFixed(2)),
        creditPaymentRevenue: parseFloat(creditPaymentRevenue.toFixed(2)),
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalExpenses: parseFloat(totalExpensesAmount.toFixed(2)),
        grossProfit: parseFloat(totalProfit.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        costOfGoodsSold: parseFloat(costOfGoodsSold.toFixed(2)), // UPDATED: Now properly excludes credit payments
        totalMpesaBank: parseFloat(totalMpesaBank.toFixed(2)),
        totalCash: parseFloat(totalCash.toFixed(2)),
        outstandingCredit: parseFloat(Math.max(outstandingCredit, totalOutstandingFromCredits).toFixed(2)),
        totalCreditGiven: parseFloat(Math.max(creditSalesAmount, totalCreditGiven).toFixed(2)),
        totalAmountPaid: parseFloat(totalAmountPaid.toFixed(2)),
        
        // NEW: Immediate revenue tracking
        immediateRevenue: parseFloat(immediateRevenue.toFixed(2)),
        
        // Additional metrics
        creditSalesCount: creditTransactions.length,
        creditPaymentsCount: creditPayments.length,
        profitMargin: CalculationUtils.calculateProfitMargin(totalRevenue, netProfit),
        creditCollectionRate: totalCreditGiven > 0 ? 
          parseFloat(((totalCreditGiven - totalOutstandingFromCredits) / totalCreditGiven) * 100).toFixed(2) : 0,
        totalTransactions: validTransactions.length,
        totalItemsSold: validTransactions.reduce((sum, t) => sum + (t.itemsCount || 0), 0),
        
        // Enhanced credit metrics
        recognizedCreditRevenue: parseFloat(recognizedCreditRevenue.toFixed(2)),
        averageCreditSale: creditTransactions.length > 0 ? 
          parseFloat((creditSalesAmount / creditTransactions.length).toFixed(2)) : 0,
        
        // Credit status breakdown
        creditStatusBreakdown: {
          pending: creditTransactions.filter(t => t.creditStatus === 'pending').length,
          partially_paid: creditTransactions.filter(t => t.creditStatus === 'partially_paid').length,
          paid: creditTransactions.filter(t => t.creditStatus === 'paid').length,
          overdue: creditTransactions.filter(t => t.creditStatus === 'overdue').length
        },
        
        // Complete transactions count (non-credit)
        completeTransactionsCount: nonCreditTransactions.length,
        
        // COGS breakdown for analysis
        cogsBreakdown: {
          total: parseFloat(costOfGoodsSold.toFixed(2)),
          fromCreditSales: parseFloat(cogsFromCreditSales.toFixed(2)),
          fromCompleteSales: parseFloat(cogsFromCompleteSales.toFixed(2)),
          fromCreditPayments: parseFloat(cogsFromCreditPayments.toFixed(2))
        },
        
        // Timestamp
        timestamp: new Date().toISOString(),
        _calculatedAt: new Date().toISOString(),
        _creditManagementIntegrated: true,
        _creditPaymentSupport: true,
        _immediateRevenueTracking: true, // NEW: Indicate immediate revenue tracking
        _cogsCalculation: 'complete_sales_plus_credit_sales_made_exclude_payments'
      };
    } catch (error) {
      console.error('❌ Error calculating financial stats with credit management:', error);
      return CalculationUtils.getDefaultStatsWithCreditManagement();
    }
  },

  // UPDATED: Enhanced server stats processing with credit management
  enhanceServerStatsWithCreditManagement: (serverStats, transactions, credits, products = []) => {
    const enhanced = {
      ...CalculationUtils.getDefaultStatsWithCreditManagement(),
      ...serverStats
    };

    // Calculate additional credit metrics if not provided by server
    if (typeof enhanced.nonCreditSales === 'undefined' && transactions) {
      const nonCreditTransactions = transactions.filter(t => !t.isCreditTransaction && !t.isCreditPayment);
      enhanced.nonCreditSales = nonCreditTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    }

    if (typeof enhanced.totalMpesaBank === 'undefined') {
      enhanced.totalMpesaBank = enhanced.digitalSales || 0;
    }

    if (typeof enhanced.totalCreditGiven === 'undefined') {
      const creditTransactions = transactions ? transactions.filter(t => t.isCreditTransaction && !t.isCreditPayment) : [];
      enhanced.totalCreditGiven = creditTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    }

    if (typeof enhanced.completeTransactionsCount === 'undefined' && transactions) {
      enhanced.completeTransactionsCount = transactions.filter(t => !t.isCreditTransaction && !t.isCreditPayment).length;
    }

    // Calculate credit status breakdown
    if (transactions) {
      const creditTransactions = transactions.filter(t => t.isCreditTransaction && !t.isCreditPayment);
      enhanced.creditStatusBreakdown = {
        pending: creditTransactions.filter(t => t.creditStatus === 'pending').length,
        partially_paid: creditTransactions.filter(t => t.creditStatus === 'partially_paid').length,
        paid: creditTransactions.filter(t => t.creditStatus === 'paid').length,
        overdue: creditTransactions.filter(t => t.creditStatus === 'overdue').length
      };
    }

    // Add credit-specific metrics from credits data
    if (credits) {
      enhanced.totalCreditGiven = credits.reduce((sum, credit) => sum + CalculationUtils.safeNumber(credit.totalAmount), 0);
      enhanced.outstandingCredit = credits.reduce((sum, credit) => sum + CalculationUtils.safeNumber(credit.balanceDue), 0);
      enhanced.totalAmountPaid = credits.reduce((sum, credit) => sum + CalculationUtils.safeNumber(credit.amountPaid), 0);
    }

    // FIXED: Calculate COGS for both complete and credit sales if not provided (exclude credit payments)
    if (typeof enhanced.costOfGoodsSold === 'undefined' && transactions) {
      enhanced.costOfGoodsSold = CalculationUtils.calculateCOGS(transactions, products);
    }

    // Calculate immediate revenue if not provided
    if (typeof enhanced.immediateRevenue === 'undefined' && transactions) {
      enhanced.immediateRevenue = transactions.reduce((sum, t) => 
        sum + (t.immediateRevenue || t.recognizedRevenue || 0), 0
      );
    }

    enhanced._source = 'server';
    enhanced._enhancedAt = new Date().toISOString();
    enhanced._creditManagementIntegrated = true;
    enhanced._creditPaymentSupport = true;
    enhanced._immediateRevenueTracking = true;
    enhanced._cogsCalculation = 'complete_sales_plus_credit_sales_made_exclude_payments';

    return enhanced;
  },

  // UPDATED: Credit analysis calculation
  calculateCreditAnalysis: (transactions, credits) => {
    const creditTransactions = transactions.filter(t => t.isCreditTransaction && !t.isCreditPayment);
    const creditPayments = transactions.filter(t => t.isCreditPayment);
    
    if (creditTransactions.length === 0 && credits.length === 0) {
      return {
        totalCreditSales: 0,
        recognizedCreditRevenue: 0,
        outstandingCredit: 0,
        creditSalesCount: 0,
        creditPaymentsCount: 0,
        creditCollectionRate: 0,
        averageCreditSale: 0,
        cogsForCreditSales: 0,
        immediateCreditRevenue: 0 // NEW: Track immediate credit revenue
      };
    }

    const totalCreditSales = creditTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const recognizedCreditRevenue = creditTransactions.reduce((sum, t) => sum + t.recognizedRevenue, 0);
    const outstandingCredit = creditTransactions.reduce((sum, t) => sum + t.outstandingRevenue, 0);
    const immediateCreditRevenue = creditTransactions.reduce((sum, t) => sum + (t.immediateRevenue || 0), 0); // NEW
    const cogsForCreditSales = CalculationUtils.calculateCOGS(creditTransactions);

    // Use credits data if available for more accurate calculations
    const totalCreditGiven = credits.reduce((sum, credit) => sum + CalculationUtils.safeNumber(credit.totalAmount), totalCreditSales);
    const totalOutstanding = credits.reduce((sum, credit) => sum + CalculationUtils.safeNumber(credit.balanceDue), outstandingCredit);

    return {
      totalCreditSales: parseFloat(totalCreditGiven.toFixed(2)),
      recognizedCreditRevenue: parseFloat(recognizedCreditRevenue.toFixed(2)),
      outstandingCredit: parseFloat(totalOutstanding.toFixed(2)),
      creditSalesCount: Math.max(creditTransactions.length, credits.length),
      creditPaymentsCount: creditPayments.length,
      creditCollectionRate: totalCreditGiven > 0 ? parseFloat(((totalCreditGiven - totalOutstanding) / totalCreditGiven) * 100).toFixed(2) : 0,
      averageCreditSale: Math.max(creditTransactions.length, credits.length) > 0 ? 
        parseFloat((totalCreditGiven / Math.max(creditTransactions.length, credits.length)).toFixed(2)) : 0,
      cogsForCreditSales: parseFloat(cogsForCreditSales.toFixed(2)),
      immediateCreditRevenue: parseFloat(immediateCreditRevenue.toFixed(2)) // NEW
    };
  },

 // UPDATED: Enhanced sales performance summary
calculateSalesPerformanceSummary: (transactions, expenses, financialStats) => {
  try {
    const validTransactions = transactions.filter(t => t && t._isValid !== false);
    
    if (validTransactions.length === 0) {
      return CalculationUtils.getDefaultSalesPerformanceSummary();
    }

    // ENHANCED: Include credit management data
    const creditTransactions = validTransactions.filter(t => t.isCreditTransaction && !t.isCreditPayment);
    const creditPayments = validTransactions.filter(t => t.isCreditPayment);
    const nonCreditTransactions = validTransactions.filter(t => !t.isCreditTransaction && !t.isCreditPayment);

    // FIXED: COGS calculations for both credit and non-credit sales (exclude credit payments)
    const cogsForCreditSales = CalculationUtils.calculateCOGS(creditTransactions);
    const cogsForNonCreditSales = CalculationUtils.calculateCOGS(nonCreditTransactions);
    const cogsForCreditPayments = CalculationUtils.calculateCOGS(creditPayments);

    return {
      // Sales counts with credit breakdown
      totalSales: validTransactions.length,
      creditSales: financialStats.creditSalesCount,
      creditPayments: financialStats.creditPaymentsCount,
      nonCreditSales: validTransactions.length - financialStats.creditSalesCount - financialStats.creditPaymentsCount,
      completeTransactions: nonCreditTransactions.length,
      
      // Revenue breakdown
      totalRevenue: financialStats.totalRevenue,
      debtSalesRevenue: financialStats.creditSales,
      creditPaymentRevenue: financialStats.creditPaymentRevenue,
      nonDebtRevenue: financialStats.nonCreditSales,
      immediateRevenue: financialStats.immediateRevenue || financialStats.totalRevenue, // NEW
      
      // FIXED: Cost analysis - COGS includes both complete + credit sales, excludes credit payments
      costOfGoodsSold: financialStats.costOfGoodsSold,
      costOfGoodsSoldCredit: cogsForCreditSales,
      costOfGoodsSoldNonCredit: cogsForNonCreditSales,
      costOfGoodsSoldCreditPayments: cogsForCreditPayments,
      
      // Profit analysis
      grossProfit: financialStats.grossProfit,
      netProfit: financialStats.netProfit,
      debtSalesProfit: creditTransactions.reduce((sum, t) => sum + (t.profit || 0), 0),
      nonDebtProfit: nonCreditTransactions.reduce((sum, t) => sum + (t.profit || 0), 0), // FIXED: Added missing comma here
      
      // Expense analysis
      expenses: financialStats.totalExpenses,
      revenueAfterExpenses: financialStats.totalRevenue - financialStats.totalExpenses,
      profitAfterExpenses: financialStats.netProfit,
      
      // Payment method analysis
      totalMpesa: financialStats.totalMpesaBank,
      totalBank: 0, // Combined with Mpesa in financialStats
      totalCash: financialStats.totalCash,
      
      // Enhanced credit analysis
      outstandingCredit: financialStats.outstandingCredit,
      totalCreditCollected: financialStats.recognizedCreditRevenue,
      creditCollectionRate: financialStats.creditCollectionRate,
      averageCreditSale: financialStats.averageCreditSale,
      
      // Timestamp
      timestamp: new Date().toISOString(),
      _calculatedAt: new Date().toISOString(),
      _cogsMethodology: 'complete_sales_plus_credit_sales_made_exclude_payments',
      _immediateRevenueTracking: true // NEW
    };
  } catch (error) {
    console.error('❌ Error calculating sales performance summary:', error);
    return CalculationUtils.getDefaultSalesPerformanceSummary();
  }
},
  // ENHANCED: Simplified filtering functions for TransactionsReport
  filterTransactionsByShop: (transactions, shopId) => {
    if (!Array.isArray(transactions)) return [];
    if (!shopId || shopId === 'all') return transactions;
    
    return transactions.filter(transaction => {
      const transactionShopId = transaction.shopId || 
                               (transaction.shop && typeof transaction.shop === 'object' ? transaction.shop._id : transaction.shop);
      return transactionShopId === shopId;
    });
  },

  filterExpensesByShop: (expenses, shopId) => {
    if (!Array.isArray(expenses)) return [];
    if (!shopId || shopId === 'all') return expenses;
    
    return expenses.filter(expense => {
      const expenseShopId = expense.shopId || 
                           (expense.shop && typeof expense.shop === 'object' ? expense.shop._id : expense.shop);
      return expenseShopId === shopId;
    });
  },

  filterCreditsByShop: (credits, shopId) => {
    if (!Array.isArray(credits)) return [];
    if (!shopId || shopId === 'all') return credits;
    
    return credits.filter(credit => {
      const creditShopId = credit.shopId || credit.creditShopId || 
                          (credit.shop && typeof credit.shop === 'object' ? credit.shop._id : credit.shop);
      return creditShopId === shopId;
    });
  },

  // NEW: Filter credits by cashier
  filterCreditsByCashier: (credits, cashierId) => {
    if (!Array.isArray(credits)) return [];
    if (!cashierId || cashierId === 'all') return credits;
    
    return credits.filter(credit => {
      const creditCashierId = credit.cashierId || 
                             (credit.cashier && typeof credit.cashier === 'object' ? credit.cashier._id : credit.cashier);
      return creditCashierId === cashierId;
    });
  },

  // UPDATED: Top products calculation with enhanced cost tracking
  calculateTopProducts: (transactionsData, limit = 10) => {
    if (!transactionsData || !Array.isArray(transactionsData)) {
      return [];
    }

    const productSales = {};
    const validTransactions = transactionsData.filter(t => t && t.items && Array.isArray(t.items) && !t.isCreditPayment);
    
    validTransactions.forEach(transaction => {
      if (!transaction.items) return;
      
      transaction.items.forEach(item => {
        if (!item) return;
        
        const productName = item.productName || item.name || 'Unknown Product';
        const productId = item.productId || item._id || productName;
        const key = `${productId}-${productName}`;
        
        if (!productSales[key]) {
          productSales[key] = {
            id: productId,
            name: productName,
            totalSold: 0,
            totalRevenue: 0,
            totalProfit: 0,
            totalCost: 0,
            transactions: 0
          };
        }
        
        const quantity = CalculationUtils.safeNumber(item.quantity, 1);
        const price = CalculationUtils.safeNumber(item.price || item.unitPrice || 0);
        const cost = CalculationUtils.safeNumber(item.cost || item.buyingPrice || item.unitCost || 0);
        const revenue = price * quantity;
        const itemCost = cost * quantity;
        const profit = revenue - itemCost;
        
        productSales[key].totalSold += quantity;
        productSales[key].totalRevenue += revenue;
        productSales[key].totalProfit += profit;
        productSales[key].totalCost += itemCost;
        productSales[key].transactions += 1;
      });
    });
    
    const products = Object.values(productSales)
      .map(product => ({
        ...product,
        profitMargin: CalculationUtils.calculateProfitMargin(product.totalRevenue, product.totalProfit),
        averagePrice: product.totalSold > 0 ? product.totalRevenue / product.totalSold : 0,
        averageCost: product.totalSold > 0 ? product.totalCost / product.totalSold : 0
      }));

    return products
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit)
      .map(product => ({
        ...product,
        totalRevenue: parseFloat(product.totalRevenue.toFixed(2)),
        totalProfit: parseFloat(product.totalProfit.toFixed(2)),
        totalCost: parseFloat(product.totalCost.toFixed(2)),
        profitMargin: parseFloat(product.profitMargin.toFixed(1))
      }));
  },

  // UPDATED: Shop performance calculation with immediate revenue tracking
  calculateShopPerformance: (transactions, shops = []) => {
    if (!transactions || !Array.isArray(transactions)) {
      return [];
    }

    const shopSales = {};
    const validTransactions = transactions.filter(t => t && t._isValid !== false && !t.isCreditPayment);
    
    validTransactions.forEach(sale => {
      // Enhanced shop identification
      let shopId = sale.shopId;
      let shopName = 'Unknown Shop';
      
      // Handle different shop data structures
      if (sale.shop) {
        if (typeof sale.shop === 'string') {
          shopName = sale.shop;
          shopId = shopId || sale.shop;
        } else if (typeof sale.shop === 'object') {
          shopName = sale.shop.name || 'Unknown Shop';
          shopId = shopId || sale.shop._id;
        }
      }
      
      // Find shop in provided shops array
      if (shops.length > 0 && shopId) {
        const foundShop = shops.find(s => s._id === shopId || s.name === shopName);
        if (foundShop) {
          shopName = foundShop.name;
          shopId = foundShop._id;
        }
      }
      
      if (!shopSales[shopId]) {
        shopSales[shopId] = { 
          id: shopId,
          name: shopName,
          revenue: 0, 
          transactions: 0, 
          profit: 0,
          creditSales: 0,
          completeSales: 0,
          costOfGoodsSold: 0,
          immediateRevenue: 0 // NEW: Track immediate revenue
        };
      }
      
      const recognizedRevenue = CalculationUtils.safeNumber(sale.recognizedRevenue || sale.immediateRevenue || sale.totalAmount || 0);
      shopSales[shopId].revenue += recognizedRevenue;
      shopSales[shopId].transactions += 1;
      shopSales[shopId].profit += CalculationUtils.safeNumber(sale.profit || 0);
      shopSales[shopId].costOfGoodsSold += CalculationUtils.safeNumber(sale.cost || 0);
      shopSales[shopId].immediateRevenue += CalculationUtils.safeNumber(sale.immediateRevenue || recognizedRevenue); // NEW
      
      // ENHANCED: Track credit vs complete sales
      if (sale.isCreditTransaction) {
        shopSales[shopId].creditSales += 1;
      } else {
        shopSales[shopId].completeSales += 1;
      }
    });
    
    return Object.values(shopSales)
      .map((data) => ({
        ...data,
        revenue: parseFloat(data.revenue.toFixed(2)),
        profit: parseFloat(data.profit.toFixed(2)),
        costOfGoodsSold: parseFloat(data.costOfGoodsSold.toFixed(2)),
        immediateRevenue: parseFloat(data.immediateRevenue.toFixed(2)), // NEW
        profitMargin: CalculationUtils.calculateProfitMargin(data.revenue, data.profit)
      }))
      .sort((a, b) => b.revenue - a.revenue);
  },

  // UPDATED: Cashier performance calculation with immediate revenue tracking
  calculateCashierPerformance: (transactions, cashiers = []) => {
    if (!transactions || !Array.isArray(transactions)) {
      return [];
    }

    const cashierSales = {};
    const validTransactions = transactions.filter(t => t && t._isValid !== false && !t.isCreditPayment);
    
    validTransactions.forEach(sale => {
      const cashierName = sale.cashierName || 
                         (sale.cashier && typeof sale.cashier === 'object' ? 
                          sale.cashier.name : 'Unknown Cashier') || 
                         'Unknown Cashier';
      
      const cashierId = sale.cashierId || 
                       (sale.cashier && typeof sale.cashier === 'object' ? 
                        sale.cashier._id || sale.cashier.id : cashierName);
      
      if (!cashierSales[cashierId]) {
        cashierSales[cashierId] = { 
          id: cashierId,
          name: cashierName,
          revenue: 0, 
          transactions: 0,
          profit: 0,
          itemsSold: 0,
          creditTransactions: 0,
          completeTransactions: 0,
          performanceScore: 0,
          costOfGoodsSold: 0,
          immediateRevenue: 0 // NEW: Track immediate revenue
        };
      }
      
      const recognizedRevenue = CalculationUtils.safeNumber(sale.recognizedRevenue || sale.immediateRevenue || sale.totalAmount || 0);
      cashierSales[cashierId].revenue += recognizedRevenue;
      cashierSales[cashierId].profit += CalculationUtils.safeNumber(sale.profit || 0);
      cashierSales[cashierId].transactions += 1;
      cashierSales[cashierId].itemsSold += CalculationUtils.safeNumber(sale.itemsCount || 0);
      cashierSales[cashierId].costOfGoodsSold += CalculationUtils.safeNumber(sale.cost || 0);
      cashierSales[cashierId].immediateRevenue += CalculationUtils.safeNumber(sale.immediateRevenue || recognizedRevenue); // NEW
      
      if (sale.isCreditTransaction) {
        cashierSales[cashierId].creditTransactions += 1;
      } else {
        cashierSales[cashierId].completeTransactions += 1;
      }
    });
    
    return Object.values(cashierSales)
      .map((cashier) => ({
        ...cashier,
        revenue: parseFloat(cashier.revenue.toFixed(2)),
        profit: parseFloat(cashier.profit.toFixed(2)),
        costOfGoodsSold: parseFloat(cashier.costOfGoodsSold.toFixed(2)),
        immediateRevenue: parseFloat(cashier.immediateRevenue.toFixed(2)), // NEW
        profitMargin: CalculationUtils.calculateProfitMargin(cashier.revenue, cashier.profit),
        averageTransactionValue: cashier.transactions > 0 ? parseFloat((cashier.revenue / cashier.transactions).toFixed(2)) : 0,
        performanceScore: CalculationUtils.calculatePerformanceScore(cashier)
      }))
      .sort((a, b) => b.performanceScore - a.performanceScore);
  },

  // Default data structures with credit management integration
  getDefaultProcessedData: () => ({
    salesWithProfit: [],
    financialStats: CalculationUtils.getDefaultStatsWithCreditManagement(),
    expenses: [],
    credits: [],
    salesPerformanceSummary: CalculationUtils.getDefaultSalesPerformanceSummary(),
    summary: CalculationUtils.getDefaultStatsWithCreditManagement(),
    enhancedStats: {
      financialStats: CalculationUtils.getDefaultStatsWithCreditManagement(),
      salesWithProfit: [],
      creditAnalysis: CalculationUtils.calculateCreditAnalysis([], [])
    },
    creditAnalytics: {
      byCashier: [],
      byShop: [],
      cashierPerformance: [],
      shopPerformance: [],
      summary: {
        totalOutstandingCredit: 0,
        totalCreditGiven: 0,
        totalCredits: 0,
        activeCredits: 0,
        overdueCredits: 0
      }
    },
    metadata: {
      processedAt: new Date().toISOString(),
      shopFilter: null,
      recordCounts: {
        transactions: 0,
        creditTransactions: 0,
        creditPayments: 0,
        completeTransactions: 0,
        expenses: 0,
        credits: 0
      }
    }
  }),

  // UPDATED: Default stats with credit management integration and immediate revenue tracking
  getDefaultStatsWithCreditManagement: () => ({
    // Core metrics for FinancialOverview
    totalSales: 0,
    creditSales: 0,
    nonCreditSales: 0,
    creditPaymentRevenue: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    grossProfit: 0,
    netProfit: 0,
    costOfGoodsSold: 0,
    totalMpesaBank: 0,
    totalCash: 0,
    outstandingCredit: 0,
    totalCreditGiven: 0,
    totalAmountPaid: 0,
    
    // NEW: Immediate revenue tracking
    immediateRevenue: 0,
    
    // Additional metrics
    creditSalesCount: 0,
    creditPaymentsCount: 0,
    profitMargin: 0,
    creditCollectionRate: 0,
    totalTransactions: 0,
    totalItemsSold: 0,
    recognizedCreditRevenue: 0,
    averageCreditSale: 0,
    
    // Credit management integration
    completeTransactionsCount: 0,
    creditStatusBreakdown: {
      pending: 0,
      partially_paid: 0,
      paid: 0,
      overdue: 0
    },
    
    // COGS breakdown
    cogsBreakdown: {
      total: 0,
      fromCreditSales: 0,
      fromCompleteSales: 0,
      fromCreditPayments: 0
    },
    
    timestamp: new Date().toISOString(),
    _calculatedAt: new Date().toISOString(),
    _creditManagementIntegrated: true,
    _creditPaymentSupport: true,
    _immediateRevenueTracking: true, // NEW
    _cogsCalculation: 'complete_sales_plus_credit_sales_made_exclude_payments'
  }),

  getDefaultSalesPerformanceSummary: () => ({
    totalSales: 0,
    creditSales: 0,
    creditPayments: 0,
    nonCreditSales: 0,
    completeTransactions: 0,
    totalRevenue: 0,
    debtSalesRevenue: 0,
    creditPaymentRevenue: 0,
    nonDebtRevenue: 0,
    expenses: 0,
    grossProfit: 0,
    netProfit: 0,
    costOfGoodsSold: 0,
    costOfGoodsSoldCredit: 0,
    costOfGoodsSoldNonCredit: 0,
    costOfGoodsSoldCreditPayments: 0,
    totalMpesa: 0,
    totalBank: 0,
    totalCash: 0,
    outstandingCredit: 0,
    totalCreditCollected: 0,
    debtSalesProfit: 0,
    nonDebtProfit: 0,
    revenueAfterExpenses: 0,
    profitAfterExpenses: 0,
    creditCollectionRate: 0,
    averageCreditSale: 0,
    immediateRevenue: 0, // NEW
    timestamp: new Date().toISOString(),
    _cogsMethodology: 'complete_sales_plus_credit_sales_made_exclude_payments',
    _immediateRevenueTracking: true // NEW
  }),

  createFallbackTransaction: (originalTransaction = {}) => ({
    _id: originalTransaction?._id || `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    transactionNumber: originalTransaction?.transactionNumber || `FALLBACK-${Date.now()}`,
    totalAmount: 0,
    cost: 0,
    profit: 0,
    profitMargin: 0,
    paymentMethod: 'cash',
    status: 'completed',
    customerName: 'Walk-in Customer',
    cashierName: 'Unknown Cashier',
    shop: 'Unknown Shop',
    shopName: 'Unknown Shop',
    saleDate: new Date(),
    items: [],
    itemsCount: 0,
    amountPaid: 0,
    recognizedRevenue: 0,
    outstandingRevenue: 0,
    immediateRevenue: 0, // NEW
    displayDate: dayjs().format('DD/MM/YYYY HH:mm'),
    isCreditTransaction: false,
    isCreditPayment: false,
    creditStatus: null,
    _isValid: false,
    _isFallback: true
  }),

  // Utility function for performance score calculation
  calculatePerformanceScore: (cashier) => {
    if (!cashier) return 0;
    
    const revenueScore = Math.min((cashier.revenue || 0) / 1000, 100);
    const transactionScore = Math.min((cashier.transactions || 0) * 2, 50);
    const marginScore = Math.min((cashier.profitMargin || 0) * 2, 30);
    const itemsScore = Math.min((cashier.itemsSold || 0) / 10, 20);
    const immediateRevenueScore = Math.min((cashier.immediateRevenue || 0) / 500, 25); // NEW: Reward immediate revenue
    
    return revenueScore + transactionScore + marginScore + itemsScore + immediateRevenueScore;
  },

  // NEW: Utility function to filter data by date range
  filterDataByDateRange: (data, startDate, endDate, dateField = 'saleDate') => {
    if (!Array.isArray(data)) return [];
    
    return data.filter(item => {
      const itemDate = item[dateField] || item.createdAt || item.date;
      if (!itemDate) return false;
      
      const itemDayjs = dayjs(itemDate);
      const startDayjs = dayjs(startDate);
      const endDayjs = dayjs(endDate);
      
      return itemDayjs.isBetween(startDayjs, endDayjs, null, '[]');
    });
  },

  // UPDATED: Enhanced revenue calculation with credit payment support and immediate revenue tracking
  calculateRevenueWithCreditPayments: (transactions) => {
    if (!Array.isArray(transactions)) return { 
      totalRevenue: 0, 
      cashRevenue: 0, 
      digitalRevenue: 0, 
      creditRevenue: 0,
      immediateRevenue: 0 // NEW
    };
    
    let totalRevenue = 0;
    let cashRevenue = 0;
    let digitalRevenue = 0;
    let creditRevenue = 0;
    let immediateRevenue = 0; // NEW

    transactions.forEach(transaction => {
      // For credit transactions, only count recognized revenue (amount paid)
      // For non-credit transactions, count full amount
      const revenue = transaction.isCreditTransaction ? 
        CalculationUtils.safeNumber(transaction.recognizedRevenue) : 
        CalculationUtils.safeNumber(transaction.totalAmount);

      totalRevenue += revenue;
      immediateRevenue += CalculationUtils.safeNumber(transaction.immediateRevenue || revenue); // NEW

      // Categorize by payment method
      if (transaction.isCreditTransaction) {
        creditRevenue += revenue;
      } else if (transaction.paymentMethod === 'cash') {
        cashRevenue += revenue;
      } else if (['mpesa', 'bank', 'card'].includes(transaction.paymentMethod)) {
        digitalRevenue += revenue;
      } else if (transaction.paymentMethod === 'cash_bank_mpesa') {
        // Handle split payments
        const cashAmount = CalculationUtils.safeNumber(transaction.cashAmount);
        const bankMpesaAmount = CalculationUtils.safeNumber(transaction.bankMpesaAmount);
        cashRevenue += cashAmount;
        digitalRevenue += bankMpesaAmount;
      }
    });

    return {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      cashRevenue: parseFloat(cashRevenue.toFixed(2)),
      digitalRevenue: parseFloat(digitalRevenue.toFixed(2)),
      creditRevenue: parseFloat(creditRevenue.toFixed(2)),
      immediateRevenue: parseFloat(immediateRevenue.toFixed(2)) // NEW
    };
  },

  // NEW: Calculate payment split totals for cashier dashboard
  calculatePaymentSplitTotals: (transactions) => {
    if (!Array.isArray(transactions)) {
      return { cash: 0, bank_mpesa: 0, credit: 0 };
    }

    return transactions.reduce((totals, transaction) => {
      if (transaction.paymentSplit) {
        totals.cash += CalculationUtils.safeNumber(transaction.paymentSplit.cash);
        totals.bank_mpesa += CalculationUtils.safeNumber(transaction.paymentSplit.bank_mpesa);
        totals.credit += CalculationUtils.safeNumber(transaction.paymentSplit.credit);
      } else {
        // Fallback calculation based on payment method
        const amount = CalculationUtils.safeNumber(transaction.recognizedRevenue || transaction.immediateRevenue || transaction.totalAmount);
        if (transaction.paymentMethod === 'cash') {
          totals.cash += amount;
        } else if (['mpesa', 'bank', 'card', 'bank_mpesa'].includes(transaction.paymentMethod)) {
          totals.bank_mpesa += amount;
        } else if (transaction.paymentMethod === 'credit') {
          totals.credit += amount;
        } else if (transaction.paymentMethod === 'cash_bank_mpesa') {
          // Split evenly as fallback
          const half = amount / 2;
          totals.cash += half;
          totals.bank_mpesa += half;
        }
      }
      return totals;
    }, { cash: 0, bank_mpesa: 0, credit: 0 });
  },

  // NEW: Enhanced credit status calculation for UI components
  calculateEnhancedCreditStatus: (credit) => {
    if (!credit) return 'unknown';
    
    const balanceDue = CalculationUtils.safeNumber(credit.balanceDue);
    const amountPaid = CalculationUtils.safeNumber(credit.amountPaid);
    
    if (balanceDue <= 0) {
      return 'paid';
    }
    
    if (amountPaid > 0 && balanceDue > 0) {
      return 'partially_paid';
    }
    
    if (credit.dueDate && dayjs(credit.dueDate).isBefore(dayjs()) && balanceDue > 0) {
      return 'overdue';
    }
    
    return 'pending';
  }
};

export default CalculationUtils;



