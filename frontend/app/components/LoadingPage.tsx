'use client';

import React from 'react';
import { Zap, Loader2 } from 'lucide-react';

interface LoadingPageProps {
  message?: string;
  showLogo?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingPage({ 
  message = 'Loading...', 
  showLogo = true,
  size = 'md'
}: LoadingPageProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
      <div className="text-center">
        {showLogo && (
          <div className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AgentRunner
            </h1>
          </div>
        )}
        
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />
          <p className={`text-gray-600 dark:text-gray-300 font-medium ${textSizeClasses[size]}`}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoadingCard({ 
  message = 'Loading...', 
  className = '' 
}: { 
  message?: string; 
  className?: string; 
}) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 ${className}`}>
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-600 dark:text-gray-300 font-medium">
          {message}
        </p>
      </div>
    </div>
  );
}

export function LoadingSkeleton({ 
  lines = 3, 
  className = '' 
}: { 
  lines?: number; 
  className?: string; 
}) {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={`h-4 bg-gray-200 dark:bg-gray-700 rounded mb-3 ${
            index === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        />
      ))}
    </div>
  );
}
