import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getInboxReceipts } from '../services/db';
import { COLORS, ELEVATION, RADIUS, H_PAD, SPACE, getCategoryInfo } from '../constants/theme';

export default function InboxScreen({ navigation }) {
  const [receipts, setReceipts] = useState([]);

  const load = useCallback(async () => {
    const data = await getInboxReceipts();
    setReceipts(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = useCallback(({ item }) => {
    const cat    = getCategoryInfo(item.category);
    const vendor = item.vendor || 'Unknown vendor';
    const date   = item.date   || 'No date';
    const total  = parseFloat(item.total) > 0 ? `$${parseFloat(item.total).toFixed(2)}` : '—';

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('InboxDetail', { receipt: item, onSave: load })}
        activeOpacity={0.75}
      >
        <View style={[styles.catIcon, { backgroundColor: cat.color + '18', borderWidth: 1, borderColor: cat.color + '50' }]}>
          <Text style={styles.catEmoji}>{cat.emoji}</Text>
        </View>
        <View style={styles.rowMiddle}>
          <Text style={styles.vendor}>{vendor}</Text>
          <Text style={styles.date}>{date}</Text>
          {item.notes?.length > 0 && (
            <Text style={styles.note} numberOfLines={1}>· {item.notes[0]}</Text>
          )}
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.total}>{total}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Review</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [navigation, load]);

  return (
    <View style={styles.container}>
      {receipts.length > 0 && (
        <View style={styles.hintRow}>
          <Text style={styles.hint}>{receipts.length} receipt{receipts.length !== 1 ? 's' : ''} need attention</Text>
        </View>
      )}
      <FlatList
        data={receipts}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>✓</Text>
            </View>
            <Text style={styles.emptyText}>Inbox is clear</Text>
            <Text style={styles.emptySubtext}>All receipts have been reviewed</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 28 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },

  hintRow: { paddingTop: SPACE.md, paddingBottom: SPACE.xs },
  hint:    { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },

  row: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.md,
    marginVertical:  3,
    flexDirection:   'row',
    alignItems:      'center',
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.warning + '40',
    ...ELEVATION.card,
  },

  catIcon: {
    width:           42,
    height:          42,
    borderRadius:    RADIUS.md,
    justifyContent:  'center',
    alignItems:      'center',
    marginRight:     SPACE.md,
  },
  catEmoji: { fontSize: 19 },

  rowMiddle: { flex: 1, marginRight: SPACE.sm },
  vendor:    { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  date:      { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  note:      { fontSize: 12, color: COLORS.warning, marginTop: 3, fontWeight: '500' },

  rowRight: { alignItems: 'flex-end', gap: SPACE.sm },
  total:    { fontSize: 15, fontWeight: '700', color: COLORS.accent },

  badge: {
    backgroundColor: COLORS.warningMuted,
    borderRadius:    RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderWidth:     1,
    borderColor:     COLORS.warning + '50',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: COLORS.warning, letterSpacing: 0.4 },

  // Empty state
  empty: { alignItems: 'center', marginTop: 100, gap: SPACE.sm },
  emptyIcon: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: COLORS.accentMuted,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    SPACE.sm,
    borderWidth:     1,
    borderColor:     COLORS.accent + '40',
  },
  emptyIconText: { fontSize: 32, color: COLORS.accent, fontWeight: '700' },
  emptyText:     { fontSize: 18, color: COLORS.textPrimary, fontWeight: '700' },
  emptySubtext:  { fontSize: 14, color: COLORS.textSecondary },
});
