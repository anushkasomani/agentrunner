'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export interface NotificationProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  onClose?: (id: string) => void;
}

export default function Notification({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose
}: NotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose?.(id);
    }, 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStyles = () => {
    const baseStyles = "relative overflow-hidden rounded-xl shadow-lg border transition-all duration-300 transform";
    const visibilityStyles = isVisible && !isLeaving 
      ? "translate-x-0 opacity-100 scale-100" 
      : "translate-x-full opacity-0 scale-95";
    
    switch (type) {
      case 'success':
        return `${baseStyles} ${visibilityStyles} bg-white dark:bg-gray-800 border-green-200 dark:border-green-800`;
      case 'error':
        return `${baseStyles} ${visibilityStyles} bg-white dark:bg-gray-800 border-red-200 dark:border-red-800`;
      case 'warning':
        return `${baseStyles} ${visibilityStyles} bg-white dark:bg-gray-800 border-yellow-200 dark:border-yellow-800`;
      case 'info':
        return `${baseStyles} ${visibilityStyles} bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800`;
      default:
        return `${baseStyles} ${visibilityStyles} bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700`;
    }
  };

  return (
    <div className={getStyles()}>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 mr-3">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {title}
            </h4>
            {message && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {message}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 ml-3">
            <button
              onClick={handleClose}
              className="inline-flex text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-md p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 h-1 bg-gray-200 dark:bg-gray-700 w-full">
          <div 
            className="h-full bg-blue-500 transition-all ease-linear"
            style={{
              width: '100%',
              animation: `shrink ${duration}ms linear forwards`
            }}
          />
        </div>
      )}
      
      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

// Notification Container
interface NotificationContainerProps {
  notifications: NotificationProps[];
  onClose: (id: string) => void;
}

export function NotificationContainer({ notifications, onClose }: NotificationContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          {...notification}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

// Hook for managing notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);

  const addNotification = (notification: Omit<NotificationProps, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = { ...notification, id };
    setNotifications(prev => [...prev, newNotification]);
    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll
  };
}
