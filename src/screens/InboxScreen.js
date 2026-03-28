import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getInboxReceipts, updateReceipt, softDeleteReceipt } from '../services/db';
import { COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE, getCategoryInfo } from '../constants/theme';

export default function InboxScreen({ navigation }) {
  const [receipts,    setReceipts]    = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const load = useCallback(async () => {
    const data = await getInboxReceipts();
    setReceipts(data);
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleBatchMarkReady = useCallback(async () => {
    const ids = selectedIds;
    for (const id of ids) {
      const item = receipts.find(r => r.id === id);
      if (item) await updateReceipt(id, { ...item, status: 'ready' });
    }
    setSelectedIds([]);
    await load();
  }, [selectedIds, receipts, load]);

  const handleBatchDelete = useCallback(async () => {
    for (const id of selectedIds) {
      await softDeleteReceipt(id);
    }
    setSelectedIds([]);
    await load();
  }, [selectedIds, load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = useCallback(({ item }) => {
    const cat        = getCategoryInfo(item.category);
    const vendor     = item.vendor || 'Unknown vendor';
    const date       = item.date   || 'No date';
    const total      = parseFloat(item.total) > 0 ? `$${parseFloat(item.total).toFixed(2)}` : '—';
    const isSelected = selectedIds.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => {
          if (selectedIds.length > 0) {
            toggleSelect(item.id);
          } else {
            navigation.navigate('InboxDetail', { receipt: item, onSave: load });
          }
        }}
        onLongPress={() => toggleSelect(item.id)}
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
  }, [navigation, load, selectedIds, toggleSelect]);

  const n = selectedIds.length;

  return (
    <View style={styles.container}>
      {receipts.length > 0 && (
        <View style={styles.hintRow}>
          <Text style={styles.hint}>
            {n > 0
              ? `${n} selected`
              : `${receipts.length} receipt${receipts.length !== 1 ? 's' : ''} need attention`}
          </Text>
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
        contentContainerStyle={{ paddingBottom: n > 0 ? 100 : 28 }}
      />

      {/* Batch action bar */}
      {n > 0 && (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionBtnReady} onPress={handleBatchMarkReady} activeOpacity={0.85}>
            <Text style={styles.actionBtnText}>Mark Ready ({n})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtnDelete} onPress={handleBatchDelete} activeOpacity={0.85}>
            <Text style={styles.actionBtnDeleteText}>Delete ({n})</Text>
          </TouchableOpacity>
        </View>
      )}
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
  total:    { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },

  badge: {
    backgroundColor: COLORS.warningMuted,
    borderRadius:    RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderWidth:     1,
    borderColor:     COLORS.warning + '50',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: COLORS.warning, letterSpacing: 0.4 },

  rowSelected: {
    borderColor:     COLORS.accent + '80',
    backgroundColor: COLORS.accentMuted,
  },

  // Batch action bar
  actionBar: {
    position:        'absolute',
    bottom:          20,
    left:            H_PAD,
    right:           H_PAD,
    flexDirection:   'row',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.border,
    padding:         SPACE.sm,
    gap:             SPACE.sm,
    ...ELEVATION.sheet,
  },
  actionBtnReady: {
    flex:            1,
    height:          BTN_HEIGHT,
    backgroundColor: COLORS.accent,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
  },
  actionBtnDelete: {
    flex:            1,
    height:          BTN_HEIGHT,
    backgroundColor: COLORS.dangerMuted,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     COLORS.danger + '40',
  },
  actionBtnText:       { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  actionBtnDeleteText: { fontSize: 14, fontWeight: '700', color: COLORS.danger },

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
