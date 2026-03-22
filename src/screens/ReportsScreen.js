import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { getAllReceipts } from '../services/db';
import { useApp } from '../context/AppContext';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, RADIUS, BTN_HEIGHT, H_PAD, CATEGORIES, getCategoryInfo } from '../constants/theme';

const PERIODS = ['This Week', 'This Month', 'Last Month', 'All Time'];

export default function ReportsScreen() {
  const { isPro } = useApp();
  const [period, setPeriod] = useState('This Month');
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
      if (p === 'This Month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (p === 'Last Month') {
        const lm = new Date(now); lm.setMonth(now.getMonth() - 1);
        return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
      }
      return true; // All Time
    });
  };

  const totalSpent = receipts.reduce((s, r) => s + parseFloat(r.total), 0);
  const totalTax = receipts.reduce((s, r) => s + parseFloat(r.tax), 0);

  // Category breakdown
  const categoryBreakdown = CATEGORIES.map(cat => {
    const catReceipts = receipts.filter(r => (r.category || 'Other') === cat.key);
    const total = catReceipts.reduce((s, r) => s + parseFloat(r.total), 0);
    return { ...cat, total, count: catReceipts.length };
  }).filter(c => c.count > 0).sort((a, b) => b.total - a.total);

  const exportCSV = async () => {
    // UTF-8 BOM for Excel compatibility
    const BOM = '\uFEFF';
    const header = 'Date,Vendor,Category,Total,Tax\n';
    const rows = receipts.map(r => {
      const vendor = `"${(r.vendor || '').replace(/"/g, '""')}"`;
      return `${r.date},${vendor},${r.category || 'Other'},${parseFloat(r.total).toFixed(2)},${parseFloat(r.tax).toFixed(2)}`;
    }).join('\n');
    const csv = BOM + header + rows;
    const path = FileSystem.documentDirectory + 'receipts_export.csv';
    await FileSystem.writeAsStringAsync(path, csv, { encoding: 'utf8' });
    await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Receipts' });
  };

  return (
    <View style={styles.container}>
      {/* Period selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll} contentContainerStyle={styles.periodContent}>
        {PERIODS.map(p => (
          <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodActive]} onPress={() => setPeriod(p)}>
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
              <SummaryCard label="Total Spent" value={`$${totalSpent.toFixed(2)}`} />
              <SummaryCard label="Total Tax" value={`$${totalTax.toFixed(2)}`} />
              <SummaryCard label="Receipts" value={String(receipts.length)} />
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
              <View style={[styles.catIcon, { backgroundColor: item.color + '22' }]}>
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
                <Text style={styles.catCount}>{item.count} receipt{item.count !== 1 ? 's' : ''} · {(pct * 100).toFixed(0)}%</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          receipts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No receipts for this period.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
        contentContainerStyle={{ paddingBottom: 8 }}
      />

      <TouchableOpacity style={styles.exportBtn} onPress={exportCSV}>
        <Text style={styles.exportTxt}>Export to Excel / CSV</Text>
      </TouchableOpacity>
    </View>
  );
}

function SummaryCard({ label, value }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },
  periodScroll: { marginTop: 14, marginBottom: 14 },
  periodContent: { gap: 8, flexDirection: 'row' },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border },
  periodActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  periodTxt: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  periodActiveTxt: { color: COLORS.bg, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.card, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  summaryValue: { fontSize: 17, fontWeight: '700', color: COLORS.accent },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.card, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  catIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  catEmoji: { fontSize: 22 },
  catInfo: { flex: 1 },
  catTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  catLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  catAmount: { fontSize: 15, fontWeight: '700', color: COLORS.accent },
  barBg: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden', marginBottom: 5 },
  barFill: { height: 6, borderRadius: 3 },
  catCount: { fontSize: 12, color: COLORS.textSecondary },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  exportBtn: { position: 'absolute', bottom: 24, left: H_PAD, right: H_PAD, backgroundColor: COLORS.accent, height: BTN_HEIGHT, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center' },
  exportTxt: { fontSize: 16, fontWeight: '700', color: COLORS.bg },
});
