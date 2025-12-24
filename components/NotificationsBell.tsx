// This is a new file: components/NotificationsBell.tsx
import React, { useState } from 'react';
import type { Notification } from '../types';
import { XIcon } from './Icons';

interface NotificationsBellProps {
    notifications: Notification[];
    unreadCount: number;
    onMarkAsRead: (id: string) => void;
}

const NotificationsBell: React.FC<NotificationsBellProps> = ({ notifications, unreadCount, onMarkAsRead }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggle = () => {
        setIsOpen(prev => !prev);
    };

    const handleRead = (id: string) => {
        onMarkAsRead(id);
    };

    return (
        <div className="relative">
            <button onClick={handleToggle} className="relative p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V5a1 1 0 00-2 0v.083A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-5 w-5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-white text-xs items-center justify-center">{unreadCount}</span>
                    </span>
                )}
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 z-50">
                    <div className="p-4 border-b dark:border-gray-700">
                        <h3 className="font-semibold">Notificaciones</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map(notif => (
                                <div key={notif.id} className={`p-4 border-b dark:border-gray-600 last:border-b-0 ${!notif.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                    <p className="text-sm">{notif.message}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Vence: {new Date(notif.dueDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</p>
                                        {!notif.isRead && (
                                            <button onClick={() => handleRead(notif.id)} className="text-xs text-blue-600 hover:underline">Marcar como leída</button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-500 p-4 text-center">No hay notificaciones.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationsBell;
