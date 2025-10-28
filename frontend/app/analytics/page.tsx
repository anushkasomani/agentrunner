'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Zap, 
  DollarSign, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { LineChart, BarChart, PieChart, MetricCard, Sparkline } from '../components/Charts';

// Sample data for charts
const performanceData = [
  { label: 'Jan', value: 65 },
  { label: 'Feb', value: 78 },
  { label: 'Mar', value: 82 },
  { label: 'Apr', value: 88 },
  { label: 'May', value: 92 },
  { label: 'Jun', value: 95 },
];

const agentTypesData = [
  { label: 'Trading', value: 35, color: '#3b82f6' },
  { label: 'Arbitrage', value: 25, color: '#10b981' },
  { label: 'Yield Farming', value: 20, color: '#f59e0b' },
  { label: 'Liquidity', value: 15, color: '#ef4444' },
  { label: 'Other', value: 5, color: '#8b5cf6' },
];

const transactionData = [
  { label: 'Mon', value: 120 },
  { label: 'Tue', value: 150 },
  { label: 'Wed', value: 180 },
  { label: 'Thu', value: 200 },
  { label: 'Fri', value: 220 },
  { label: 'Sat', value: 190 },
  { label: 'Sun', value: 160 },
];

interface ActivityItem {
  id: string;
  type: 'success' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  agent?: string;
}

function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default: return <Activity className="w-5 h-5 text-blue-500" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'success': return 'border-l-green-500 bg-green-50 dark:bg-green-900/10';
      case 'warning': return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10';
      default: return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10';
    }
  };

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className={`p-4 rounded-lg border-l-4 ${getColor(activity.type)}`}
        >
          <div className="flex items-start space-x-3">
            {getIcon(activity.type)}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-white">{activity.message}</p>
              {activity.agent && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Agent: {activity.agent}
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {activity.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState({
    totalAgents: 0,
    activeAgents: 0,
    totalTransactions: 0,
    totalVolume: 0,
    successRate: 0,
    avgResponseTime: 0
  });

  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Simulate loading data
    const loadData = async () => {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMetrics({
        totalAgents: 24,
        activeAgents: 18,
        totalTransactions: 1247,
        totalVolume: 45678.90,
        successRate: 94.2,
        avgResponseTime: 1.2
      });

      setActivities([
        {
          id: '1',
          type: 'success',
          message: 'Agent "SwapBot" successfully executed SOL to USDC swap',
          timestamp: new Date(Date.now() - 2 * 60 * 1000),
          agent: 'SwapBot'
        },
        {
          id: '2',
          type: 'info',
          message: 'New agent "RebalancePro" registered on the platform',
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          agent: 'RebalancePro'
        },
        {
          id: '3',
          type: 'success',
          message: 'Agent "YieldFarmer" completed LP position optimization',
          timestamp: new Date(Date.now() - 8 * 60 * 1000),
          agent: 'YieldFarmer'
        },
        {
          id: '4',
          type: 'warning',
          message: 'Agent "ArbitrageBot" experienced high slippage on trade',
          timestamp: new Date(Date.now() - 12 * 60 * 1000),
          agent: 'ArbitrageBot'
        },
        {
          id: '5',
          type: 'success',
          message: 'Agent "LiquidityManager" successfully rebalanced portfolio',
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          agent: 'LiquidityManager'
        }
      ]);
    };

    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                <BarChart3 className="w-8 h-8 mr-3 text-blue-600" />
                Analytics Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Monitor agent performance and platform metrics
              </p>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Last updated: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Total Agents"
            value={metrics.totalAgents}
            change={12.5}
            icon={Users}
            color="bg-gradient-to-r from-blue-500 to-blue-600"
            trend="up"
          />
          <MetricCard
            title="Active Agents"
            value={metrics.activeAgents}
            change={8.3}
            icon={Zap}
            color="bg-gradient-to-r from-green-500 to-green-600"
            trend="up"
          />
          <MetricCard
            title="Total Transactions"
            value={metrics.totalTransactions.toLocaleString()}
            change={23.1}
            icon={Activity}
            color="bg-gradient-to-r from-purple-500 to-purple-600"
            trend="up"
          />
          <MetricCard
            title="Total Volume"
            value={`$${metrics.totalVolume.toLocaleString()}`}
            change={15.7}
            icon={DollarSign}
            color="bg-gradient-to-r from-yellow-500 to-orange-500"
            trend="up"
          />
          <MetricCard
            title="Success Rate"
            value={`${metrics.successRate}%`}
            change={2.1}
            icon={TrendingUp}
            color="bg-gradient-to-r from-emerald-500 to-emerald-600"
            trend="up"
          />
          <MetricCard
            title="Avg Response Time"
            value={`${metrics.avgResponseTime}s`}
            change={-5.2}
            icon={Clock}
            color="bg-gradient-to-r from-indigo-500 to-indigo-600"
            trend="up"
          />
        </div>

        {/* Charts and Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Performance Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Agent Performance Trend
            </h3>
            <div className="h-64">
              <LineChart data={performanceData} height={200} />
            </div>
          </div>

          {/* Agent Types Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Agent Types Distribution
            </h3>
            <div className="h-64 flex items-center justify-center">
              <PieChart data={agentTypesData} size={200} />
            </div>
          </div>

          {/* Transaction Volume */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Weekly Transaction Volume
            </h3>
            <div className="h-64">
              <BarChart data={transactionData} height={200} />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Activity
            </h3>
            <ActivityFeed activities={activities} />
          </div>
        </div>

        {/* Agent Performance Table */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Performing Agents
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Transactions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg Response
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[
                  { name: 'SwapBot', type: 'Trading', successRate: 98.5, transactions: 234, responseTime: '0.8s' },
                  { name: 'YieldFarmer', type: 'Yield', successRate: 96.2, transactions: 189, responseTime: '1.2s' },
                  { name: 'ArbitrageBot', type: 'Arbitrage', successRate: 94.8, transactions: 156, responseTime: '0.5s' },
                  { name: 'RebalancePro', type: 'Portfolio', successRate: 97.1, transactions: 98, responseTime: '1.8s' },
                  { name: 'LiquidityManager', type: 'Liquidity', successRate: 95.3, transactions: 87, responseTime: '2.1s' }
                ].map((agent, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                          <Zap className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{agent.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                        {agent.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {agent.successRate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {agent.transactions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {agent.responseTime}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
