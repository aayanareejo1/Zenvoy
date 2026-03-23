import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, SectionList, TouchableOpacity, TextInput, Alert, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getReadyReceipts, deleteReceipt } from '../services/db';
import { COLORS, RADIUS, H_PAD, CATEGORIES, getCategoryInfo } from '../constants/theme';

const ALL_KEY = 'All';

function groupByMonth(receipts) {
  const sections = {};
  receipts.forEach(r => {
    const key = r.date || r.created_at || '';
    const [year, month] = key.split('-');
    if (!year || !month) return;
    const label = new Date(parseInt(year), parseInt(month) - 1, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!sections[label]) sections[label] = [];
    sections[label].push(r);
  });
  return Object.entries(sections).map(([title, data]) => ({ title, data }));
}

export default function ReceiptsScreen({ navigation }) {
  const [receipts, setReceipts] = useState([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(ALL_KEY);

  const load = useCallback(async () => {
    const data = await getReadyReceipts();
    setReceipts(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = useCallback((id) => {
    Alert.alert('Delete Receipt', 'Are you sure?', [
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteReceipt(id); load(); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [load]);

  const sections = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const filtered = receipts.filter(r => {
      const matchSearch = (r.vendor || '').toLowerCase().includes(lowerSearch);
      const matchCat = activeCategory === ALL_KEY || (r.category || 'Other') === activeCategory;
      return matchSearch && matchCat;
    });
    return groupByMonth(filtered);
  }, [receipts, search, activeCategory]);

  const renderItem = useCallback(({ item }) => {
    const cat = getCategoryInfo(item.category);
    return (
      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('ReceiptDetail', { receipt: item })}>
        <View style={[styles.catDot, { backgroundColor: cat.color }]}>
          <Text style={styles.catEmoji}>{cat.emoji}</Text>
        </View>
        <View style={styles.rowMiddle}>
          <Text style={styles.vendor} numberOfLines={1}>{item.vendor || 'Unknown vendor'}</Text>
          <Text style={styles.date}>{item.date || '—'}</Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.total}>${parseFloat(item.total).toFixed(2)}</Text>
          <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.deleteBtn}>✕</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [navigation, handleDelete]);

  const renderSectionHeader = useCallback(({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionTotal}>
        ${section.data.reduce((s, r) => s + parseFloat(r.total), 0).toFixed(2)}
      </Text>
    </View>
  ), []);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search by vendor..."
        placeholderTextColor={COLORS.textSecondary}
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContent}>
        <TouchableOpacity
          style={[styles.chip, activeCategory === ALL_KEY && styles.chipActive]}
          onPress={() => setActiveCategory(ALL_KEY)}
        >
          <Text style={[styles.chipText, activeCategory === ALL_KEY && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.chip, { borderColor: cat.color }, activeCategory === cat.key && { backgroundColor: cat.color }]}
            onPress={() => setActiveCategory(cat.key)}
          >
            <Text style={styles.chipEmoji}>{cat.emoji}</Text>
            <Text style={[styles.chipText, activeCategory === cat.key && styles.chipTextActive]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <SectionList
        sections={sections}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No receipts yet.</Text>
            <Text style={styles.emptySubtext}>Tap Scan to add your first one.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },
  search: { backgroundColor: COLORS.card, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, height: 44, color: COLORS.textPrimary, marginTop: 12, marginBottom: 8 },
  chipScroll: { marginBottom: 8 },
  chipContent: { paddingVertical: 4, gap: 8, flexDirection: 'row' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: 'transparent', gap: 5 },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTotal: { fontSize: 13, fontWeight: '700', color: COLORS.accent },
  row: { backgroundColor: COLORS.card, borderRadius: RADIUS.card, padding: 14, marginVertical: 3, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  catDot: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  catEmoji: { fontSize: 18 },
  rowMiddle: { flex: 1, marginRight: 8 },
  vendor: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  date: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  total: { fontSize: 15, fontWeight: '700', color: COLORS.accent },
  deleteBtn: { fontSize: 14, color: COLORS.danger, padding: 2 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, color: COLORS.textPrimary, fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8 },
});
