import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp }   from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useSync }  from '../context/SyncContext';
import { getFailedSyncs } from '../services/db';
import { retryFailedSyncs, retryOne, MAX_ATTEMPTS } from '../services/syncManager';
import { COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE } from '../constants/theme';

const STATUS_DOT_COLOR = {
  synced:  COLORS.accent,
  error:   COLORS.danger,
  syncing: COLORS.warning,
  idle:    COLORS.textTertiary,
};

export default function SyncManagementScreen() {
  const { user }                      = useApp();
  const { showToast }                 = useToast();
  const { lastSyncTime, syncStatus }  = useSync();

  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [retrying, setRetrying] = useState(false);

  const loadFailedSyncs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFailedSyncs();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadFailedSyncs(); }, [loadFailedSyncs]));

  const retryAll = useCallback(async () => {
    if (!user) {
      showToast({ message: 'Sign in to sync receipts.', type: 'info' });
      return;
    }
    setRetrying(true);
    try {
      const { succeeded, failed } = await retryFailedSyncs(user.uid);
      showToast({
        message: `Retried: ${succeeded} succeeded, ${failed} still failing`,
        type: succeeded > 0 ? 'success' : 'warning',
      });
      await loadFailedSyncs();
    } catch (e) {
      showToast({ message: e.message, type: 'error' });
    } finally {
      setRetrying(false);
    }
  }, [user, showToast, loadFailedSyncs]);

  const retrySingle = useCallback(async (failedSyncId) => {
    if (!user) {
      showToast({ message: 'Sign in to sync receipts.', type: 'info' });
      return;
    }
    try {
      await retryOne(failedSyncId, user.uid);
      showToast({ message: 'Retry successful ✓', type: 'success' });
      await loadFailedSyncs();
    } catch (e) {
      showToast({ message: `Retry failed: ${e.message}`, type: 'error' });
      await loadFailedSyncs();
    }
  }, [user, showToast, loadFailedSyncs]);

  const renderItem = useCallback(({ item }) => {
    const tooManyAttempts = item.attempt_count >= MAX_ATTEMPTS;
    return (
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.vendor} numberOfLines={1}>
            {item.vendor || 'Unknown vendor'}
          </Text>
          <Text style={s.total}>
            {item.total != null ? `$${parseFloat(item.total).toFixed(2)}` : '—'}
          </Text>
        </View>
        {item.date ? <Text style={s.date}>{item.date}</Text> : null}
        {item.error_message ? (
          <Text style={s.error} numberOfLines={2}>{item.error_message}</Text>
        ) : null}
        <View style={s.cardFooter}>
          <Text style={[s.attempts, tooManyAttempts && s.attemptsMax]}>
            Attempts: {item.attempt_count}/{MAX_ATTEMPTS}
          </Text>
          <TouchableOpacity
            style={[s.retryBtn, tooManyAttempts && s.retryBtnDisabled]}
            onPress={() => retrySingle(item.id)}
            disabled={tooManyAttempts}
            activeOpacity={0.75}
          >
            <Text style={[s.retryBtnTxt, tooManyAttempts && s.retryBtnTxtDisabled]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [retrySingle]);

  return (
    <View style={s.container}>
      {/* Header row */}
      <View style={s.header}>
        <Text style={s.title}>Failed Syncs</Text>
        {items.length > 0 && (
          <TouchableOpacity
            style={[s.retryAllBtn, retrying && s.retryAllBtnDisabled]}
            onPress={retryAll}
            disabled={retrying}
            activeOpacity={0.9}
          >
            {retrying
              ? <ActivityIndicator color={COLORS.bg} size="small" />
              : <Text style={s.retryAllTxt}>Retry All</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Last sync status row */}
      <View style={s.syncStatusRow}>
        <View style={[s.syncDot, { backgroundColor: STATUS_DOT_COLOR[syncStatus] ?? COLORS.textTertiary }]} />
        <Text style={s.syncStatusText}>
          Last sync:{' '}
          {lastSyncTime
            ? new Date(lastSyncTime).toLocaleTimeString()
            : 'Never'}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 48 }} />
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <Text style={s.emptyIconText}>✓</Text>
          </View>
          <Text style={s.emptyText}>All syncs successful ✓</Text>
          <Text style={s.emptySubtext}>No failed syncs at this time</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },

  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: SPACE.lg,
  },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },

  syncStatusRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SPACE.sm,
    paddingBottom:  SPACE.md,
  },
  syncDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  syncStatusText: {
    fontSize:  12,
    color:     COLORS.textSecondary,
    fontWeight:'500',
  },

  retryAllBtn: {
    backgroundColor: COLORS.accent,
    height:          36,
    paddingHorizontal: SPACE.lg,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    ...ELEVATION.glow,
  },
  retryAllBtnDisabled: { opacity: 0.5 },
  retryAllTxt: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },

  card: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.md,
    marginBottom:    SPACE.sm,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
    ...ELEVATION.card,
  },
  cardHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   SPACE.xs,
  },
  vendor:  { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1, marginRight: SPACE.sm },
  total:   { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  date:    { fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACE.xs },
  error:   { fontSize: 12, color: COLORS.danger,        marginBottom: SPACE.sm },

  cardFooter: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      SPACE.sm,
  },
  attempts:    { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  attemptsMax: { color: COLORS.danger },

  retryBtn: {
    backgroundColor: COLORS.cardAlt,
    paddingHorizontal: SPACE.md,
    paddingVertical:  6,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  retryBtnDisabled:   { opacity: 0.4 },
  retryBtnTxt:        { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600' },
  retryBtnTxtDisabled:{ color: COLORS.textTertiary },

  empty: { alignItems: 'center', marginTop: 80, gap: SPACE.sm },
  emptyIcon: {
    width:           72,
    height:          72,
    borderRadius:    RADIUS.xl,
    backgroundColor: COLORS.accentMuted,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    SPACE.sm,
    borderWidth:     1,
    borderColor:     COLORS.accent + '50',
  },
  emptyIconText: { fontSize: 32, color: COLORS.accent },
  emptyText:     { fontSize: 18, color: COLORS.textPrimary, fontWeight: '700' },
  emptySubtext:  { fontSize: 14, color: COLORS.textSecondary },
});
