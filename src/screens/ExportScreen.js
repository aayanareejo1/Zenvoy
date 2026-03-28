import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getReadyReceipts } from '../services/db';
import { shareReceipts } from '../services/exportService';
import { trackEvent, Events } from '../services/eventTracker';
import { useToast } from '../context/ToastContext';
import { COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE, CATEGORIES, getCategoryInfo } from '../constants/theme';

const ALL_KEY = 'All';

export default function ExportScreen() {
  const { showToast } = useToast();

  const [allReceipts,      setAllReceipts]      = useState([]);
  const [filtered,         setFiltered]          = useState([]);
  const [selectedIds,      setSelectedIds]        = useState([]);
  const [activeCategory,   setActiveCategory]     = useState(ALL_KEY);
  const [dateFrom,         setDateFrom]           = useState('');
  const [dateTo,           setDateTo]             = useState('');
  const [isExporting,      setIsExporting]        = useState(false);

  // YYYY-MM-DD format check — used to guard string-based date comparisons
  const isValidDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);

  const applyFilters = useCallback((receipts, category, from, to) => {
    const validFrom = isValidDate(from) ? from : null;
    const validTo   = isValidDate(to)   ? to   : null;
    return receipts.filter(r => {
      const matchCat  = category === ALL_KEY || (r.category || 'Other') === category;
      const matchFrom = !validFrom || (r.date || '') >= validFrom;
      const matchTo   = !validTo   || (r.date || '') <= validTo;
      return matchCat && matchFrom && matchTo;
    });
  }, []);

  const loadReceipts = useCallback(async () => {
    const data = await getReadyReceipts();
    setAllReceipts(data);
    setFiltered(applyFilters(data, activeCategory, dateFrom, dateTo));
    setSelectedIds([]);
  }, [activeCategory, dateFrom, dateTo, applyFilters]);

  useFocusEffect(useCallback(() => { loadReceipts(); }, [loadReceipts]));

  const updateFilters = useCallback((category, from, to) => {
    setActiveCategory(category);
    setDateFrom(from);
    setDateTo(to);
    setFiltered(applyFilters(allReceipts, category, from, to));
    setSelectedIds([]);
  }, [allReceipts, applyFilters]);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.length === filtered.length && filtered.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(r => r.id));
    }
  }, [selectedIds, filtered]);

  const toggleReceipt = useCallback((id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
    );
  }, []);

  const handleExport = useCallback(async (format) => {
    const toExport = selectedIds.length > 0
      ? filtered.filter(r => selectedIds.includes(r.id))
      : filtered;

    if (toExport.length === 0) {
      showToast({ message: 'No receipts to export', type: 'info' });
      return;
    }

    setIsExporting(true);
    trackEvent(Events.EXPORT_TRIGGERED, { format, count: toExport.length });
    try {
      await shareReceipts(toExport, format);
      showToast({
        message: `Exported ${toExport.length} receipt${toExport.length !== 1 ? 's' : ''} as ${format.toUpperCase()}`,
        type: 'success',
      });
    } catch (error) {
      showToast({ message: 'Export failed: ' + error.message, type: 'error' });
    } finally {
      setIsExporting(false);
    }
  }, [selectedIds, filtered, showToast]);

  // Summary reflects selected receipts when a selection exists, otherwise all filtered
  const displayReceipts = selectedIds.length > 0
    ? filtered.filter(r => selectedIds.includes(r.id))
    : filtered;
  const totalAmount = displayReceipts.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
  const totalTax    = displayReceipts.reduce((sum, r) => sum + parseFloat(r.tax || 0), 0);

  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;

  const renderItem = useCallback(({ item }) => {
    const isSelected = selectedIds.includes(item.id);
    const cat = getCategoryInfo(item.category);
    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => toggleReceipt(item.id)}
        activeOpacity={0.75}
      >
        <View style={[styles.catDot, { backgroundColor: cat.color + '22', borderColor: cat.color + '55', borderWidth: 1 }]}>
          <Text style={styles.catEmoji}>{cat.emoji}</Text>
        </View>
        <View style={styles.rowMiddle}>
          <Text style={styles.vendor} numberOfLines={1}>{item.vendor || 'Unknown vendor'}</Text>
          <Text style={styles.date}>{item.date || '—'}</Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.amount}>${parseFloat(item.total || 0).toFixed(2)}</Text>
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [selectedIds, toggleReceipt]);

  return (
    <View style={styles.container}>
      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContent}
      >
        <TouchableOpacity
          style={[styles.chip, activeCategory === ALL_KEY && styles.chipActive]}
          onPress={() => updateFilters(ALL_KEY, dateFrom, dateTo)}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipText, activeCategory === ALL_KEY && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.chip,
              { borderColor: cat.color + '80' },
              activeCategory === cat.key && { backgroundColor: cat.color, borderColor: cat.color },
            ]}
            onPress={() => updateFilters(cat.key, dateFrom, dateTo)}
            activeOpacity={0.75}
          >
            <Text style={styles.chipEmoji}>{cat.emoji}</Text>
            <Text style={[styles.chipText, activeCategory === cat.key && styles.chipTextActive]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Date range filter */}
      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <Text style={styles.dateLabel}>From</Text>
          <TextInput
            style={styles.dateInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textTertiary}
            value={dateFrom}
            onChangeText={v => updateFilters(activeCategory, v, dateTo)}
            selectionColor={COLORS.accent}
            maxLength={10}
          />
        </View>
        <View style={styles.dateSep} />
        <View style={styles.dateField}>
          <Text style={styles.dateLabel}>To</Text>
          <TextInput
            style={styles.dateInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textTertiary}
            value={dateTo}
            onChangeText={v => updateFilters(activeCategory, dateFrom, v)}
            selectionColor={COLORS.accent}
            maxLength={10}
          />
        </View>
      </View>

      {/* Select-all / count header */}
      {filtered.length > 0 && (
        <View style={styles.selectionHeader}>
          <TouchableOpacity onPress={toggleSelectAll} activeOpacity={0.75}>
            <Text style={styles.selectAllText}>
              {allSelected
                ? `Deselect All (${selectedIds.length}/${filtered.length})`
                : `Select All (${filtered.length})`}
            </Text>
          </TouchableOpacity>
          {selectedIds.length > 0 && !allSelected && (
            <Text style={styles.selectionCount}>{selectedIds.length} selected</Text>
          )}
        </View>
      )}

      {/* Receipt list */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>🧾</Text>
          </View>
          <Text style={styles.emptyText}>No receipts to export</Text>
          <Text style={styles.emptySubtext}>Adjust your filters or add receipts first</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Summary + Export buttons */}
      {filtered.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryValue}>${totalAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>${totalTax.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Receipts</Text>
              <Text style={styles.summaryValue}>
                {selectedIds.length > 0 ? `${selectedIds.length} / ${filtered.length}` : filtered.length}
              </Text>
            </View>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.exportBtn, (isExporting || filtered.length === 0) && styles.btnDisabled]}
              onPress={() => handleExport('csv')}
              disabled={isExporting || filtered.length === 0}
              activeOpacity={0.85}
            >
              {isExporting
                ? <ActivityIndicator color={COLORS.bg} size="small" />
                : <Text style={styles.exportBtnText}>📊  Export CSV</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportBtnAlt, (isExporting || filtered.length === 0) && styles.btnDisabled]}
              onPress={() => handleExport('pdf')}
              disabled={isExporting || filtered.length === 0}
              activeOpacity={0.85}
            >
              {isExporting
                ? <ActivityIndicator color={COLORS.accent} size="small" />
                : <Text style={styles.exportBtnAltText}>📄  Export PDF</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },

  // Category chips
  chipScroll:   { marginTop: SPACE.md, marginBottom: SPACE.sm },
  chipContent:  { paddingVertical: SPACE.xs, gap: SPACE.sm, flexDirection: 'row' },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SPACE.md,
    paddingVertical:   7,
    borderRadius:      RADIUS.chip,
    borderWidth:       1.5,
    borderColor:       COLORS.border,
    backgroundColor:   'transparent',
    gap:               5,
  },
  chipActive:     { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipEmoji:      { fontSize: 13 },
  chipText:       { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: COLORS.bg },

  // Date filter
  dateRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACE.sm,
    marginBottom:    SPACE.sm,
  },
  dateField: { flex: 1 },
  dateLabel: {
    fontSize:      11,
    fontWeight:    '600',
    color:         COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom:  SPACE.xs,
  },
  dateInput: {
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.input,
    borderWidth:       1,
    borderColor:       COLORS.border,
    paddingHorizontal: SPACE.md,
    height:            40,
    color:             COLORS.textPrimary,
    fontSize:          14,
  },
  dateSep: {
    width:           1,
    height:          40,
    backgroundColor: COLORS.border,
    marginTop:       20,
  },

  // Selection header
  selectionHeader: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: SPACE.sm,
    marginBottom:    SPACE.xs,
  },
  selectAllText: { fontSize: 13, color: COLORS.accent, fontWeight: '600' },
  selectionCount: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },

  // Receipt rows
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
  rowSelected: {
    borderColor: COLORS.accent + '80',
    backgroundColor: COLORS.accentMuted,
  },
  catDot: {
    width: 40, height: 40,
    borderRadius:   RADIUS.md,
    justifyContent: 'center',
    alignItems:     'center',
    marginRight:    SPACE.md,
  },
  catEmoji:  { fontSize: 18 },
  rowMiddle: { flex: 1, marginRight: SPACE.sm },
  vendor:    { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  date:      { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  rowRight:  { alignItems: 'center', gap: SPACE.xs, flexDirection: 'row' },
  amount:    { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginRight: SPACE.sm },
  checkbox: {
    width:          22,
    height:         22,
    borderRadius:   6,
    borderWidth:    1.5,
    borderColor:    COLORS.border,
    backgroundColor: COLORS.cardAlt,
    justifyContent: 'center',
    alignItems:     'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.accent,
    borderColor:     COLORS.accent,
  },
  checkmark: { fontSize: 13, fontWeight: '800', color: COLORS.bg },

  // Empty state
  emptyState:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
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

  // Footer
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingTop:     SPACE.md,
    paddingBottom:  SPACE.md,
    gap:            SPACE.sm,
  },
  summary: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.md,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
    gap:             SPACE.xs,
  },
  summaryRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  summaryLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  summaryValue: { fontSize: 14, color: COLORS.textPrimary,   fontWeight: '700' },

  btnRow: { flexDirection: 'row', gap: SPACE.sm },
  exportBtn: {
    flex:            1,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    backgroundColor: COLORS.accent,
    justifyContent:  'center',
    alignItems:      'center',
    ...ELEVATION.glow,
  },
  exportBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  exportBtnAlt: {
    flex:            1,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    backgroundColor: COLORS.cardAlt,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  exportBtnAltText: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  btnDisabled: { opacity: 0.5 },
});
