import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { COLORS, ELEVATION, RADIUS, SPACE, getCategoryInfo } from '../constants/theme';

function SyncBadge({ synced, isPro }) {
  if (isPro && synced) {
    return <Text style={[s.syncBadge, s.syncBadgeSynced]}>✓ Synced</Text>;
  }
  if (isPro && !synced) {
    return <Text style={[s.syncBadge, s.syncBadgePending]}>⏳ Pending</Text>;
  }
  return <Text style={[s.syncBadge, s.syncBadgeLocal]}>🔒 Local only</Text>;
}

export default function ReceiptListItem({ item, onPress, onDelete }) {
  const { isPro } = useApp();
  const cat = getCategoryInfo(item.category);

  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[s.catDot, { backgroundColor: cat.color + '22', borderColor: cat.color + '55', borderWidth: 1 }]}>
        <Text style={s.catEmoji}>{cat.emoji}</Text>
      </View>

      <View style={s.rowMiddle}>
        <Text style={s.vendor} numberOfLines={1}>{item.vendor || 'Unknown vendor'}</Text>
        <Text style={s.date}>{item.date || '—'}</Text>
        <SyncBadge synced={item.synced} isPro={isPro} />
      </View>

      <View style={s.rowRight}>
        <Text style={s.total}>${parseFloat(item.total).toFixed(2)}</Text>
        {onDelete ? (
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={s.deleteBtn}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.md,
    marginVertical:  3,
    flexDirection:   'row',
    alignItems:      'center',
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
    ...ELEVATION.card,
  },
  catDot: {
    width: 42, height: 42,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems:     'center',
    marginRight:    SPACE.md,
  },
  catEmoji:  { fontSize: 19 },
  rowMiddle: { flex: 1, marginRight: SPACE.sm },
  vendor:    { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  date:      { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  rowRight:  { alignItems: 'flex-end', gap: SPACE.sm },
  total:     { fontSize: 15, fontWeight: '700', color: COLORS.accent },
  deleteBtn: { fontSize: 13, color: COLORS.textTertiary, padding: 2 },

  syncBadge: {
    fontSize:         10,
    fontWeight:       '600',
    marginTop:        4,
    alignSelf:        'flex-start',
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:     RADIUS.pill,
    overflow:         'hidden',
  },
  syncBadgeSynced:  { color: COLORS.accent,   backgroundColor: COLORS.accentMuted },
  syncBadgePending: { color: COLORS.warning,  backgroundColor: COLORS.warningMuted },
  syncBadgeLocal:   { color: COLORS.textSecondary, backgroundColor: COLORS.cardAlt },
});
