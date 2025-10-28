'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Activity, Users, DollarSign } from 'lucide-react';

interface ChartData {
  label: string;
  value: number;
  color?: string;
  change?: number;
}

interface LineChartProps {
  data: ChartData[];
  height?: number;
  showGrid?: boolean;
  showDots?: boolean;
  className?: string;
}

export function LineChart({ 
  data, 
  height = 200, 
  showGrid = true, 
  showDots = true,
  className = '' 
}: LineChartProps) {
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((item.value - minValue) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className={`relative ${className}`}>
      <svg width="100%" height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Grid lines */}
        {showGrid && (
          <g stroke="currentColor" strokeWidth="0.1" opacity="0.2">
            {[0, 25, 50, 75, 100].map(y => (
              <line key={y} x1="0" y1={y} x2="100" y2={y} />
            ))}
            {[0, 20, 40, 60, 80, 100].map(x => (
              <line key={x} x1={x} y1="0" x2={x} y2="100" />
            ))}
          </g>
        )}

        {/* Area under the curve */}
        <polygon
          points={`0,100 ${points} 100,100`}
          fill="url(#gradient)"
          opacity="0.1"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-blue-500"
        />

        {/* Dots */}
        {showDots && data.map((item, index) => {
          const x = (index / (data.length - 1)) * 100;
          const y = 100 - ((item.value - minValue) / range) * 100;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="1"
              fill="currentColor"
              className="text-blue-500"
            />
          );
        })}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
        {data.map((item, index) => (
          <span key={index} className="text-center">
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

interface BarChartProps {
  data: ChartData[];
  height?: number;
  showValues?: boolean;
  className?: string;
}

export function BarChart({ 
  data, 
  height = 200, 
  showValues = true,
  className = '' 
}: BarChartProps) {
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className={`flex items-end justify-between space-x-2 ${className}`} style={{ height }}>
      {data.map((item, index) => {
        const barHeight = (item.value / maxValue) * 100;
        return (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div className="relative w-full">
              <div
                className="w-full rounded-t-lg transition-all duration-300 hover:opacity-80"
                style={{
                  height: `${barHeight}%`,
                  backgroundColor: item.color || '#3b82f6',
                }}
              />
              {showValues && (
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-600 dark:text-gray-300">
                  {item.value}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface PieChartProps {
  data: ChartData[];
  size?: number;
  showLabels?: boolean;
  className?: string;
}

export function PieChart({ 
  data, 
  size = 200, 
  showLabels = true,
  className = '' 
}: PieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulativePercentage = 0;

  const segments = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const startAngle = (cumulativePercentage / 100) * 360;
    const endAngle = ((cumulativePercentage + percentage) / 100) * 360;
    
    cumulativePercentage += percentage;

    const radius = size / 2 - 10;
    const centerX = size / 2;
    const centerY = size / 2;

    const startAngleRad = (startAngle - 90) * (Math.PI / 180);
    const endAngleRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = centerX + radius * Math.cos(startAngleRad);
    const y1 = centerY + radius * Math.sin(startAngleRad);
    const x2 = centerX + radius * Math.cos(endAngleRad);
    const y2 = centerY + radius * Math.sin(endAngleRad);

    const largeArcFlag = percentage > 50 ? 1 : 0;

    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');

    return {
      pathData,
      color: item.color || `hsl(${(index * 360) / data.length}, 70%, 50%)`,
      label: item.label,
      percentage: percentage.toFixed(1),
    };
  });

  return (
    <div className={`relative ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((segment, index) => (
          <path
            key={index}
            d={segment.pathData}
            fill={segment.color}
            stroke="white"
            strokeWidth="2"
            className="hover:opacity-80 transition-opacity duration-200"
          />
        ))}
      </svg>

      {showLabels && (
        <div className="mt-4 space-y-2">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {segment.label}: {segment.percentage}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<any>;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function MetricCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  color, 
  trend = 'neutral',
  className = '' 
}: MetricCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {change !== undefined && (
            <div className={`flex items-center mt-2 text-sm ${
              trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {trend === 'up' && <TrendingUp className="w-4 h-4 mr-1" />}
              {trend === 'down' && <TrendingDown className="w-4 h-4 mr-1" />}
              <span>{change > 0 ? '+' : ''}{change}%</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

interface SparklineProps {
  data: number[];
  height?: number;
  color?: string;
  className?: string;
}

export function Sparkline({ 
  data, 
  height = 40, 
  color = '#3b82f6',
  className = '' 
}: SparklineProps) {
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - minValue) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className={`${className}`}>
      <svg width="100%" height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
