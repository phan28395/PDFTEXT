import React, { useEffect, useState } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  X, 
  Crown,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { useUsageAlerts } from '@/hooks/useUsageTracking';
import { Link } from 'react-router-dom';

interface NotificationProps {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  onClose: () => void;
}

function Notification({ type, title, message, action, onClose }: NotificationProps) {
  const getTypeStyles = () => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  return (
    <div className={`max-w-sm w-full border rounded-lg shadow-lg p-4 ${getTypeStyles()}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-sm opacity-90">{message}</p>
          {action && (
            <div className="mt-3">
              {action.href ? (
                <Link
                  to={action.href}
                  className="text-sm font-medium underline hover:no-underline"
                  onClick={onClose}
                >
                  {action.label}
                </Link>
              ) : (
                <button
                  onClick={() => {
                    action.onClick?.();
                    onClose();
                  }}
                  className="text-sm font-medium underline hover:no-underline"
                >
                  {action.label}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            onClick={onClose}
            className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function UsageNotifications() {
  const { alerts, hasAlerts } = useUsageAlerts();
  const [shownAlerts, setShownAlerts] = useState<Set<string>>(new Set());
  const [activeNotifications, setActiveNotifications] = useState<Array<{
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    action?: {
      label: string;
      href?: string;
      onClick?: () => void;
    };
  }>>([]);

  useEffect(() => {
    if (!hasAlerts) return;

    const newNotifications = alerts
      .filter(alert => !shownAlerts.has(alert.type + alert.message))
      .map(alert => {
        const id = alert.type + alert.message;
        
        let notification: any = {
          id,
          type: alert.severity === 'high' ? 'error' : alert.severity === 'medium' ? 'warning' : 'info',
          title: '',
          message: alert.message,
        };

        // Customize notification based on alert type
        switch (alert.type) {
          case 'limit_warning':
            notification.title = 'Usage Limit Warning';
            if (alert.action_required) {
              notification.action = {
                label: 'Upgrade Now',
                href: '/pricing'
              };
            }
            break;
            
          case 'monthly_limit_warning':
            notification.title = 'Monthly Limit Warning';
            notification.message += ` Your usage will reset on ${
              alert.period_end ? new Date(alert.period_end).toLocaleDateString() : 'your next billing date'
            }.`;
            break;
            
          case 'subscription_expiring':
            notification.title = 'Subscription Expiring';
            notification.action = {
              label: 'Manage Subscription',
              href: '/subscription'
            };
            break;
            
          default:
            notification.title = 'Usage Alert';
        }

        return notification;
      });

    if (newNotifications.length > 0) {
      setActiveNotifications(prev => [...prev, ...newNotifications]);
      setShownAlerts(prev => {
        const newSet = new Set(prev);
        newNotifications.forEach(notif => newSet.add(notif.id));
        return newSet;
      });
    }
  }, [alerts, hasAlerts, shownAlerts]);

  const removeNotification = (id: string) => {
    setActiveNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  // Auto-remove notifications after 10 seconds for non-critical alerts
  useEffect(() => {
    activeNotifications.forEach(notification => {
      if (notification.type !== 'error') {
        const timer = setTimeout(() => {
          removeNotification(notification.id);
        }, 10000);
        
        return () => clearTimeout(timer);
      }
    });
  }, [activeNotifications]);

  if (activeNotifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-4">
      {activeNotifications.map(notification => (
        <Notification
          key={notification.id}
          type={notification.type}
          title={notification.title}
          message={notification.message}
          action={notification.action}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

// Banner component for persistent alerts in the dashboard
export function UsageAlertBanner() {
  const { alerts, hasAlerts } = useUsageAlerts();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (!hasAlerts) return null;

  const activeAlerts = alerts.filter(alert => 
    !dismissed.has(alert.type + alert.message) && 
    alert.severity === 'high'
  );

  if (activeAlerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {activeAlerts.map((alert, index) => {
        const alertId = alert.type + alert.message;
        
        return (
          <div
            key={alertId}
            className={`border rounded-lg p-4 ${
              alert.severity === 'high' ? 'bg-red-50 border-red-200 text-red-800' :
              alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {alert.severity === 'high' ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </div>
              <div className="ml-3 flex-1">
                <h3 className="font-medium">
                  {alert.type === 'limit_warning' ? 'Usage Limit Alert' :
                   alert.type === 'monthly_limit_warning' ? 'Monthly Limit Alert' :
                   alert.type === 'subscription_expiring' ? 'Subscription Alert' :
                   'Usage Alert'}
                </h3>
                <p className="text-sm mt-1">{alert.message}</p>
                
                {alert.action_required && (
                  <p className="text-sm mt-1 font-medium">{alert.action_required}</p>
                )}
                
                <div className="flex items-center space-x-4 mt-3 text-sm">
                  {alert.pages_remaining !== undefined && (
                    <span className="flex items-center">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      {alert.pages_remaining} pages remaining
                    </span>
                  )}
                  
                  {alert.period_end && (
                    <span className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      Resets {new Date(alert.period_end).toLocaleDateString()}
                    </span>
                  )}
                </div>
                
                <div className="flex space-x-3 mt-4">
                  {alert.action_required && (
                    <Link
                      to="/pricing"
                      className="text-sm font-medium underline hover:no-underline"
                    >
                      Upgrade Plan
                    </Link>
                  )}
                  
                  {alert.type === 'subscription_expiring' && (
                    <Link
                      to="/subscription"
                      className="text-sm font-medium underline hover:no-underline"
                    >
                      Manage Subscription
                    </Link>
                  )}
                </div>
              </div>
              <div className="ml-4 flex-shrink-0">
                <button
                  onClick={() => setDismissed(prev => new Set([...prev, alertId]))}
                  className="inline-flex text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default UsageNotifications;