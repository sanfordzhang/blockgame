/**
 * useAccessLog — Custom Hook for route-based pageview tracking
 *
 * Monitors React Router location changes and records pageview events.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTron } from '../context/tron/TronContext';
import accessLogger from '../utils/accessLogger';

export function useAccessLog() {
    const location = useLocation();
    const tron = useTron();  // Safely reads TronContext via exported hook
    const walletAddress = tron?.address || null;
    const prevPathRef = useRef(null);
    const initializedRef = useRef(false);

    useEffect(() => {
        // Initialize logger on first mount
        if (!initializedRef.current) {
            accessLogger.init();
            initializedRef.current = true;
            // Record initial page load as the first entry
            accessLogger.recordPageView(location.pathname, walletAddress);
            prevPathRef.current = location.pathname;
            return;
        }

        // On route change: record previous page's view and start new one
        if (location.pathname !== prevPathRef.current) {
            if (prevPathRef.current) {
                accessLogger.recordPageView(location.pathname, walletAddress);
            } else {
                accessLogger.currentPath = location.pathname;
                accessLogger.entryTime = new Date();
            }
            prevPathRef.current = location.pathname;
        }
    }, [location.pathname, walletAddress]);

    useEffect(() => {
        // Wallet address change is handled by the dependency array above
    }, [walletAddress]);
}

export default useAccessLog;
