import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { getAllReceipts } from '../services/db';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE, CATEGORIES } from '../constants/theme';

const PERIODS = ['This Week', 'This Month', 'Last Month', 'All Time'];

export default function ReportsScreen() {
  const { isPro }       = useApp();
  const { showToast }   = useToast();
  const [period, setPeriod]     = useState('This Month');
  const [receipts, setReceipts] = useState([]);

  useFocusEffect(useCallback(() => { load(); }, [period]));

  const load = async () => {
    const all = await getAllReceipts();
    setReceipts(filterByPeriod(all, period));
  };

  const filterByPeriod = (all, p) => {
    const now = new Date();
    return all.filter(r => {
      const d = new Date(r.date);
      if (p === 'This Week') {
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      }
      if (p === 'This Month')
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (p === 'Last Month') {
        const lm = new Date(now); lm.setMonth(now.getMonth() - 1);
        return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
      }
      return true;
    });
  };

  const totalSpent = receipts.reduce((s, r) => s + parseFloat(r.total), 0);
  const totalTax   = receipts.reduce((s, r) => s + parseFloat(r.tax),   0);

  const categoryBreakdown = CATEGORIES.map(cat => {
    const catReceipts = receipts.filter(r => (r.category || 'Other') === cat.key);
    const total = catReceipts.reduce((s, r) => s + parseFloat(r.total), 0);
    return { ...cat, total, count: catReceipts.length };
  }).filter(c => c.count > 0).sort((a, b) => b.total - a.total);

  const exportCSV = async () => {
    const BOM    = '\uFEFF';
    const header = 'Date,Vendor,Category,Total,Tax\n';
    const rows   = receipts.map(r => {
      const vendor = `"${(r.vendor || '').replace(/"/g, '""')}"`;
      return `${r.date},${vendor},${r.category || 'Other'},${parseFloat(r.total).toFixed(2)},${parseFloat(r.tax).toFixed(2)}`;
    }).join('\n');
    const csv  = BOM + header + rows;
    const path = FileSystem.documentDirectory + 'receipts_export.csv';
    await FileSystem.writeAsStringAsync(path, csv, { encoding: 'utf8' });
    await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Receipts' });
  };

  return (
    <View style={styles.container}>
      {/* Period chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.periodScroll}
        contentContainerStyle={styles.periodContent}
      >
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodActive]}
            onPress={() => setPeriod(p)}
            activeOpacity={0.75}
          >
            <Text style={[styles.periodTxt, period === p && styles.periodActiveTxt]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={categoryBreakdown}
        keyExtractor={c => c.key}
        ListHeaderComponent={
          <>
            {/* Summary cards */}
            <View style={styles.summaryRow}>
              <SummaryCard label="Spent"    value={`$${totalSpent.toFixed(2)}`} accent />
              <SummaryCard label="Tax"      value={`$${totalTax.toFixed(2)}`}   />
              <SummaryCard label="Receipts" value={String(receipts.length)}     />
            </View>

            {categoryBreakdown.length > 0 && (
              <Text style={styles.sectionTitle}>By Category</Text>
            )}
          </>
        }
        renderItem={({ item }) => {
          const pct = totalSpent > 0 ? item.total / totalSpent : 0;
          return (
            <View style={styles.catRow}>
              <View style={[styles.catIcon, { backgroundColor: item.color + '1A' }]}>
                <Text style={styles.catEmoji}>{item.emoji}</Text>
              </View>
              <View style={styles.catInfo}>
                <View style={styles.catTopRow}>
                  <Text style={styles.catLabel}>{item.label}</Text>
                  <Text style={styles.catAmount}>${item.total.toFixed(2)}</Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${(pct * 100).toFixed(1)}%`, backgroundColor: item.color }]} />
                </View>
                <Text style={styles.catMeta}>{item.count} receipt{item.count !== 1 ? 's' : ''} · {(pct * 100).toFixed(0)}%</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          receipts.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>📊</Text>
              </View>
              <Text style={styles.emptyText}>No data for this period</Text>
              <Text style={styles.emptySubtext}>Add some receipts to see your spending</Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 110 }} />}
        contentContainerStyle={{ paddingBottom: SPACE.sm }}
      />

      <View style={[styles.exportWrap, ELEVATION.glow]}>
        <TouchableOpacity style={styles.exportBtn} onPress={exportCSV} activeOpacity={0.9}>
          <Text style={styles.exportTxt}>Export to CSV</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SummaryCard({ label, value, accent }) {
  return (
    <View style={[styles.summaryCard, accent && styles.summaryCardAccent]}>
      <Text style={[styles.summaryValue, accent && styles.summaryValueAccent]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },

  periodScroll:   { marginTop: SPACE.md, marginBottom: SPACE.md },
  periodContent:  { gap: SPACE.sm, flexDirection: 'row' },
  periodBtn: {
    paddingHorizontal: SPACE.md,
    paddingVertical:   8,
    borderRadius:      RADIUS.chip,
    borderWidth:       1.5,
    borderColor:       COLORS.border,
    backgroundColor:   'transparent',
  },
  periodActive:    { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  periodTxt:       { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  periodActiveTxt: { color: COLORS.textPrimary, fontWeight: '700' },

  summaryRow: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.xl },
  summaryCard: {
    flex:            1,
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.md,
    alignItems:      'center',
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
    ...ELEVATION.card,
  },
  summaryCardAccent: {
    backgroundColor: COLORS.accentMuted,
    borderColor:     COLORS.accent + '40',
  },
  summaryValue:       { fontSize: 17, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 },
  summaryValueAccent: { color: COLORS.textPrimary },
  summaryLabel:       { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },

  sectionTitle: {
    fontSize:      12,
    fontWeight:    '700',
    color:         COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom:  SPACE.md,
  },

  catRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.md,
    marginBottom:    SPACE.sm,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
    ...ELEVATION.card,
  },
  catIcon: {
    width:           44,
    height:          44,
    borderRadius:    RADIUS.md,
    justifyContent:  'center',
    alignItems:      'center',
    marginRight:     SPACE.md,
  },
  catEmoji:  { fontSize: 22 },
  catInfo:   { flex: 1 },
  catTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACE.sm },
  catLabel:  { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  catAmount: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  barBg: {
    height:          5,
    backgroundColor: COLORS.cardAlt,
    borderRadius:    RADIUS.sm,
    overflow:        'hidden',
    marginBottom:    SPACE.xs,
  },
  barFill:  { height: 5, borderRadius: RADIUS.sm },
  catMeta:  { fontSize: 12, color: COLORS.textSecondary },

  // Empty state
  empty:         { alignItems: 'center', marginTop: 60, gap: SPACE.sm },
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
  emptyText:     { fontSize: 16, color: COLORS.textPrimary, fontWeight: '700' },
  emptySubtext:  { fontSize: 14, color: COLORS.textSecondary },

  exportWrap: {
    position:     'absolute',
    bottom:       SPACE.xxl,
    left:         H_PAD,
    right:        H_PAD,
    borderRadius: RADIUS.button,
  },
  exportBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
  },
  exportTxt: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
});
