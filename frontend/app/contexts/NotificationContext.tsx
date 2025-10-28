'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { NotificationContainer, useNotifications } from '../components/Notification';

interface NotificationContextType {
  addNotification: (notification: Omit<import('../components/Notification').NotificationProps, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { notifications, addNotification, removeNotification, clearAll } = useNotifications();

  return (
    <NotificationContext.Provider value={{ addNotification, removeNotification, clearAll }}>
      {children}
      <NotificationContainer notifications={notifications} onClose={removeNotification} />
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}
