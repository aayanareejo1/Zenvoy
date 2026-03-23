import NetInfo from '@react-native-community/netinfo';

/**
 * Network connection monitoring service.
 *
 * Usage:
 *   networkService.addListener(isConnected => { ... });
 *   networkService.removeListener(cb);
 *   networkService.isConnected  // current state
 */
const networkService = (() => {
  let _isConnected = true;
  const _listeners = new Set();
  let _unsubscribe = null;

  /** Start monitoring network state changes. Called once on module load. */
  const start = () => {
    _unsubscribe = NetInfo.addEventListener((state) => {
      const connected = !!(state.isConnected && state.isInternetReachable !== false);
      if (connected !== _isConnected) {
        const wasConnected = _isConnected;
        _isConnected = connected;
        // Notify listeners; include a `reconnected` flag when coming back online.
        _listeners.forEach(cb => cb(connected, !wasConnected && connected));
      }
    });
  };

  /** Stop monitoring (useful for testing / cleanup). */
  const stop = () => {
    if (_unsubscribe) {
      _unsubscribe();
      _unsubscribe = null;
    }
  };

  /** Register a listener: `(isConnected: boolean, reconnected?: boolean) => void`. */
  const addListener = (cb) => {
    _listeners.add(cb);
  };

  /** Remove a previously registered listener. */
  const removeListener = (cb) => {
    _listeners.delete(cb);
  };

  // Kick off monitoring immediately so `isConnected` is accurate from the start.
  start();

  return {
    get isConnected() { return _isConnected; },
    addListener,
    removeListener,
    start,
    stop,
  };
})();

export default networkService;
