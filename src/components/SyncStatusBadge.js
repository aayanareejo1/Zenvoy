import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSync } from '../context/SyncContext';
import { COLORS, RADIUS } from '../constants/theme';

const STATUS_CONFIG = {
  idle:    { label: '◎ Not syncing', color: COLORS.textSecondary, bg: COLORS.card },
  syncing: { label: '⟳ Syncing…',   color: COLORS.success,       bg: COLORS.successMuted },
  synced:  { label: '✓ All synced',  color: COLORS.accent,        bg: COLORS.accentMuted },
  error:   { label: '⚠ Sync failed', color: COLORS.danger,        bg: COLORS.dangerMuted },
};

export default function SyncStatusBadge() {
  const { syncStatus, syncError } = useSync();
  const config = STATUS_CONFIG[syncStatus] ?? STATUS_CONFIG.idle;

  return (
    <View style={[s.badge, { backgroundColor: config.bg }]}>
      <Text style={[s.label, { color: config.color }]}>
        {config.label}
      </Text>
      {syncStatus === 'error' && syncError ? (
        <Text style={s.errorMsg} numberOfLines={1}>{syncError}</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical:    4,
    borderRadius:       RADIUS.pill,
    alignSelf:          'center',
  },
  label: {
    fontSize:   12,
    fontWeight: '600',
  },
  errorMsg: {
    fontSize:   10,
    color:      COLORS.danger,
    marginTop:  2,
  },
});
