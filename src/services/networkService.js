import NetInfo from '@react-native-community/netinfo';

/**
 * Singleton network monitor.
 * Usage:
 *   import networkService from './networkService';
 *   networkService.addListener((isConnected, reconnected) => { ... });
 *   networkService.isConnected  // current state
 */
const networkService = (() => {
  let _isConnected = true;
  const _listeners = new Set();
  let _unsubscribe = null;

  const start = () => {
    _unsubscribe = NetInfo.addEventListener((state) => {
      const connected = !!(state.isConnected && state.isInternetReachable !== false);
      if (connected !== _isConnected) {
        const wasConnected = _isConnected;
        _isConnected = connected;
        _listeners.forEach(cb => cb(connected, !wasConnected && connected));
      }
    });
  };

  const stop = () => {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
  };

  const addListener    = (cb) => _listeners.add(cb);
  const removeListener = (cb) => _listeners.delete(cb);

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
