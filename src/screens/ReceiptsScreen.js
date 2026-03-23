import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, SectionList, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getReadyReceipts, deleteReceipt } from '../services/db';
import * as Haptics from 'expo-haptics';
import Dialog          from '../components/Dialog';
import ReceiptListItem from '../components/ReceiptListItem';
import { COLORS, RADIUS, H_PAD, SPACE, CATEGORIES } from '../constants/theme';

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
  const [receipts, setReceipts]   = useState([]);
  const [search, setSearch]       = useState('');
  const [activeCategory, setActiveCategory] = useState(ALL_KEY);
  const [deleteId, setDeleteId]   = useState(null);

  const load = useCallback(async () => {
    const data = await getReadyReceipts();
    setReceipts(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete  = useCallback((id) => setDeleteId(id), []);

  const confirmDelete = useCallback(async () => {
    if (!deleteId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await deleteReceipt(deleteId);
    setDeleteId(null);
    load();
  }, [deleteId, load]);

  const sections = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const filtered = receipts.filter(r => {
      const matchSearch = (r.vendor || '').toLowerCase().includes(lowerSearch);
      const matchCat    = activeCategory === ALL_KEY || (r.category || 'Other') === activeCategory;
      return matchSearch && matchCat;
    });
    return groupByMonth(filtered);
  }, [receipts, search, activeCategory]);

  const renderItem = useCallback(({ item }) => {
    return (
      <ReceiptListItem
        item={item}
        onPress={() => navigation.navigate('ReceiptDetail', { receipt: item })}
        onDelete={() => handleDelete(item.id)}
      />
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
      <Dialog
        visible={!!deleteId}
        title="Delete Receipt"
        message="This receipt will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.search}
          placeholder="Search by vendor…"
          placeholderTextColor={COLORS.textTertiary}
          value={search}
          onChangeText={setSearch}
          selectionColor={COLORS.accent}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContent}>
        <TouchableOpacity
          style={[styles.chip, activeCategory === ALL_KEY && styles.chipActive]}
          onPress={() => setActiveCategory(ALL_KEY)}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipText, activeCategory === ALL_KEY && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.chip, { borderColor: cat.color + '80' }, activeCategory === cat.key && { backgroundColor: cat.color, borderColor: cat.color }]}
            onPress={() => setActiveCategory(cat.key)}
            activeOpacity={0.75}
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
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>🧾</Text>
            </View>
            <Text style={styles.emptyText}>No receipts yet</Text>
            <Text style={styles.emptySubtext}>Tap Scan to add your first one</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 28 }}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },

  // Search
  searchWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.input,
    borderWidth:     1,
    borderColor:     COLORS.border,
    paddingHorizontal: SPACE.md,
    height:          46,
    marginTop:       SPACE.md,
    marginBottom:    SPACE.sm,
    gap:             SPACE.sm,
  },
  searchIcon:  { fontSize: 18, color: COLORS.textTertiary },
  search:      { flex: 1, color: COLORS.textPrimary, fontSize: 15 },
  clearBtn:    { fontSize: 13, color: COLORS.textTertiary, fontWeight: '600', padding: 4 },

  // Chips
  chipScroll:   { marginBottom: SPACE.sm },
  chipContent:  { paddingVertical: SPACE.xs, gap: SPACE.sm, flexDirection: 'row' },
  chip: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: SPACE.md,
    paddingVertical: 7,
    borderRadius:    RADIUS.chip,
    borderWidth:     1.5,
    borderColor:     COLORS.border,
    backgroundColor: 'transparent',
    gap:             5,
  },
  chipActive:       { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipEmoji:        { fontSize: 13 },
  chipText:         { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive:   { color: COLORS.bg },

  // Section header
  sectionHeader: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: SPACE.sm,
    paddingTop:      SPACE.xl,
  },
  sectionTitle: {
    fontSize:        12,
    fontWeight:      '700',
    color:           COLORS.textSecondary,
    textTransform:   'uppercase',
    letterSpacing:   0.6,
  },
  sectionTotal: {
    fontSize:   13,
    fontWeight: '700',
    color:      COLORS.accent,
  },

  // Empty state
  empty: { alignItems: 'center', marginTop: 80, gap: SPACE.sm },
  emptyIcon: {
    width:           72,
    height:          72,
    borderRadius:    RADIUS.xl,
    backgroundColor: COLORS.cardAlt,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    SPACE.sm,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  emptyIconText: { fontSize: 32 },
  emptyText:     { fontSize: 18, color: COLORS.textPrimary, fontWeight: '700' },
  emptySubtext:  { fontSize: 14, color: COLORS.textSecondary },
});
