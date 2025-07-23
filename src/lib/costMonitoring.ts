// Cost monitoring system for Google Document AI and other services
// Tracks API usage costs and provides budget alerts

export interface CostMetric {
  id: string;
  userId: string;
  service: string;
  operation: string;
  costAmount: number;
  currency: string;
  unitsConsumed: number;
  unitType: string;
  processingRecordId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface BudgetAlert {
  id: string;
  userId: string;
  budgetType: 'daily' | 'weekly' | 'monthly';
  threshold: number;
  currentAmount: number;
  percentage: number;
  alertLevel: 'warning' | 'critical' | 'exceeded';
  service?: string;
}

export interface CostSummary {
  totalCost: number;
  documentAICost: number;
  totalPagesProcessed: number;
  avgCostPerPage: number;
  dailyCosts: Array<{ date: string; cost: number }>;
  budgetStatus: {
    daily: { used: number; limit: number; percentage: number };
    monthly: { used: number; limit: number; percentage: number };
  };
}

class CostMonitoringService {
  private costMetrics: CostMetric[] = [];
  private budgetLimits = {
    daily: 10.0,   // $10 per day default
    weekly: 50.0,  // $50 per week default
    monthly: 200.0 // $200 per month default
  };

  // Document AI pricing (as of 2024)
  private documentAIPricing = {
    pages: 0.015, // $0.015 per page for Document AI
    batchPages: 0.0075 // $0.0075 per page for batch processing
  };

  // Track Document AI processing cost
  async trackDocumentAICost(
    userId: string,
    pagesProcessed: number,
    isBatchProcessing = false,
    processingRecordId?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const costPerPage = isBatchProcessing 
      ? this.documentAIPricing.batchPages 
      : this.documentAIPricing.pages;
    
    const totalCost = pagesProcessed * costPerPage;
    
    const costMetric: CostMetric = {
      id: `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      service: 'document-ai',
      operation: isBatchProcessing ? 'batch-process' : 'process-document',
      costAmount: totalCost,
      currency: 'USD',
      unitsConsumed: pagesProcessed,
      unitType: 'pages',
      processingRecordId,
      metadata: {
        ...metadata,
        costPerPage,
        isBatchProcessing
      },
      timestamp: new Date()
    };

    // Store locally
    this.costMetrics.push(costMetric);

    // Send to API
    try {
      await this.sendCostToAPI(costMetric);
      
      // Check for budget alerts after tracking cost
      await this.checkBudgetAlerts(userId);
      
      return costMetric.id;
    } catch (error) {
      console.error('Failed to track Document AI cost:', error);
      throw error;
    }
  }

  // Track other service costs (VirusTotal, etc.)
  async trackServiceCost(
    userId: string,
    service: string,
    operation: string,
    costAmount: number,
    unitsConsumed: number,
    unitType: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const costMetric: CostMetric = {
      id: `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      service,
      operation,
      costAmount,
      currency: 'USD',
      unitsConsumed,
      unitType,
      metadata,
      timestamp: new Date()
    };

    this.costMetrics.push(costMetric);

    try {
      await this.sendCostToAPI(costMetric);
      await this.checkBudgetAlerts(userId);
      return costMetric.id;
    } catch (error) {
      console.error(`Failed to track ${service} cost:`, error);
      throw error;
    }
  }

  // Send cost data to API
  private async sendCostToAPI(costMetric: CostMetric): Promise<void> {
    try {
      const response = await fetch('/api/metrics/cost-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          user_id: costMetric.userId,
          service: costMetric.service,
          operation: costMetric.operation,
          cost_amount: costMetric.costAmount,
          units_consumed: costMetric.unitsConsumed,
          unit_type: costMetric.unitType,
          processing_record_id: costMetric.processingRecordId,
          metadata: costMetric.metadata
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error sending cost data to API:', error);
      throw error;
    }
  }

  // Get user's cost summary
  async getCostSummary(userId: string, days = 30): Promise<CostSummary> {
    try {
      const response = await fetch(`/api/metrics/cost-summary?userId=${userId}&days=${days}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.summary;
    } catch (error) {
      console.error('Error fetching cost summary:', error);
      throw error;
    }
  }

  // Check budget alerts
  private async checkBudgetAlerts(userId: string): Promise<BudgetAlert[]> {
    try {
      const response = await fetch(`/api/metrics/budget-alerts?userId=${userId}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.alerts;
    } catch (error) {
      console.error('Error checking budget alerts:', error);
      return [];
    }
  }

  // Set budget limits
  setBudgetLimits(limits: Partial<typeof this.budgetLimits>): void {
    this.budgetLimits = { ...this.budgetLimits, ...limits };
  }

  // Get budget limits
  getBudgetLimits() {
    return { ...this.budgetLimits };
  }

  // Calculate estimated cost for pages
  estimateDocumentAICost(pages: number, isBatchProcessing = false): number {
    const costPerPage = isBatchProcessing 
      ? this.documentAIPricing.batchPages 
      : this.documentAIPricing.pages;
    return pages * costPerPage;
  }

  // Get pricing information
  getPricingInfo() {
    return {
      documentAI: { ...this.documentAIPricing },
      budgetLimits: { ...this.budgetLimits }
    };
  }

  // Get recent cost metrics
  getRecentCosts(userId: string, hours = 24): CostMetric[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.costMetrics.filter(
      metric => metric.userId === userId && metric.timestamp > cutoff
    );
  }

  // Clear local metrics
  clearLocalMetrics(): void {
    this.costMetrics = [];
  }

  // Get auth token (helper method)
  private getAuthToken(): string {
    // This should be implemented based on your auth system
    // For now, return empty string - the API should handle auth through cookies/headers
    return '';
  }
}

// Create global instance
export const costMonitoring = new CostMonitoringService();

// React hook for cost monitoring
export function useCostMonitoring() {
  const trackDocumentAICost = async (
    userId: string,
    pagesProcessed: number,
    isBatchProcessing = false,
    processingRecordId?: string,
    metadata?: Record<string, any>
  ) => {
    return costMonitoring.trackDocumentAICost(
      userId,
      pagesProcessed,
      isBatchProcessing,
      processingRecordId,
      metadata
    );
  };

  const trackServiceCost = async (
    userId: string,
    service: string,
    operation: string,
    costAmount: number,
    unitsConsumed: number,
    unitType: string,
    metadata?: Record<string, any>
  ) => {
    return costMonitoring.trackServiceCost(
      userId,
      service,
      operation,
      costAmount,
      unitsConsumed,
      unitType,
      metadata
    );
  };

  const getCostSummary = async (userId: string, days = 30) => {
    return costMonitoring.getCostSummary(userId, days);
  };

  const estimateDocumentAICost = (pages: number, isBatchProcessing = false) => {
    return costMonitoring.estimateDocumentAICost(pages, isBatchProcessing);
  };

  const getPricingInfo = () => {
    return costMonitoring.getPricingInfo();
  };

  const setBudgetLimits = (limits: any) => {
    costMonitoring.setBudgetLimits(limits);
  };

  return {
    trackDocumentAICost,
    trackServiceCost,
    getCostSummary,
    estimateDocumentAICost,
    getPricingInfo,
    setBudgetLimits
  };
}

// Cost tracking wrapper for API calls
export function withCostTracking<T extends (...args: any[]) => Promise<any>>(
  apiFunction: T,
  service: string,
  operation: string,
  costCalculator: (...args: Parameters<T>) => { cost: number; units: number; unitType: string }
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    let error: Error | null = null;
    
    try {
      const result = await apiFunction(...args);
      
      // Calculate cost based on successful result
      const { cost, units, unitType } = costCalculator(...args);
      
      // Track the cost (assuming first argument contains userId)
      if (args[0] && typeof args[0] === 'object' && 'userId' in args[0]) {
        await costMonitoring.trackServiceCost(
          (args[0] as any).userId,
          service,
          operation,
          cost,
          units,
          unitType,
          {
            duration: Date.now() - startTime,
            success: true
          }
        );
      }
      
      return result;
    } catch (err) {
      error = err as Error;
      
      // Track failed operation cost (if any)
      if (args[0] && typeof args[0] === 'object' && 'userId' in args[0]) {
        await costMonitoring.trackServiceCost(
          (args[0] as any).userId,
          service,
          `${operation}-failed`,
          0, // No cost for failed operations
          0,
          'requests',
          {
            duration: Date.now() - startTime,
            success: false,
            error: error.message
          }
        );
      }
      
      throw error;
    }
  }) as T;
}

// Budget alert component data
export interface BudgetAlertComponentData {
  alerts: BudgetAlert[];
  summary: CostSummary;
  recommendations: string[];
}

// Generate budget recommendations
export function generateBudgetRecommendations(summary: CostSummary): string[] {
  const recommendations: string[] = [];
  
  // High daily usage
  if (summary.budgetStatus.daily.percentage > 80) {
    recommendations.push('Consider batch processing to reduce per-page costs');
    recommendations.push('Review processing settings to optimize efficiency');
  }
  
  // High cost per page
  if (summary.avgCostPerPage > 0.02) {
    recommendations.push('Switch to batch processing for better rates');
    recommendations.push('Optimize PDF preprocessing to reduce page counts');
  }
  
  // Monthly budget approaching
  if (summary.budgetStatus.monthly.percentage > 75) {
    recommendations.push('Set up usage alerts to prevent overage');
    recommendations.push('Consider upgrading to a higher tier for better rates');
  }
  
  // No recent usage
  const recentDays = summary.dailyCosts.filter(d => 
    new Date(d.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  
  if (recentDays.length === 0) {
    recommendations.push('No recent usage detected - consider processing pending documents');
  }
  
  return recommendations;
}