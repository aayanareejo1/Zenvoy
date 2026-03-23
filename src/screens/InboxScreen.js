import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getInboxReceipts } from '../services/db';
import { COLORS, RADIUS, H_PAD, getCategoryInfo } from '../constants/theme';

export default function InboxScreen({ navigation }) {
  const [receipts, setReceipts] = useState([]);

  const load = useCallback(async () => {
    const data = await getInboxReceipts();
    setReceipts(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = useCallback(({ item }) => {
    const cat = getCategoryInfo(item.category);
    const vendor = item.vendor || 'Unknown vendor';
    const date   = item.date   || 'No date';
    const total  = parseFloat(item.total) > 0 ? `$${parseFloat(item.total).toFixed(2)}` : 'No total';

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('InboxDetail', { receipt: item, onSave: load })}
      >
        <View style={[styles.catIcon, { backgroundColor: cat.color + '22' }]}>
          <Text style={styles.catEmoji}>{cat.emoji}</Text>
        </View>
        <View style={styles.rowMiddle}>
          <Text style={styles.vendor}>{vendor}</Text>
          <Text style={styles.date}>{date}</Text>
          {item.notes?.length > 0 && (
            <Text style={styles.note} numberOfLines={1}>• {item.notes[0]}</Text>
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
        <Text style={styles.hint}>{receipts.length} receipt{receipts.length !== 1 ? 's' : ''} need attention</Text>
      )}
      <FlatList
        data={receipts}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>Inbox is clear</Text>
            <Text style={styles.emptySubtext}>All receipts have been reviewed.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },
  hint: { fontSize: 13, color: COLORS.textSecondary, marginTop: 14, marginBottom: 6 },
  row: { backgroundColor: COLORS.card, borderRadius: RADIUS.card, padding: 14, marginVertical: 3, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.warning + '55' },
  catIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  catEmoji: { fontSize: 18 },
  rowMiddle: { flex: 1, marginRight: 8 },
  vendor: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  date: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  note: { fontSize: 12, color: COLORS.warning, marginTop: 3 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  total: { fontSize: 15, fontWeight: '700', color: COLORS.accent },
  badge: { backgroundColor: COLORS.warning + '22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.warning },
  badgeText: { fontSize: 10, fontWeight: '700', color: COLORS.warning },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, color: COLORS.textPrimary, fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8 },
});
