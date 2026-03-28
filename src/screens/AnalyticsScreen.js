import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform, TextInput, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import {
  getExpenseSummary, getExpenseByCategory,
  getMonthlyTrend, getTaxDeductible, getTopVendors,
} from '../services/analyticsService';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useToast } from '../context/ToastContext';
import { COLORS, ELEVATION, SPACE, RADIUS, H_PAD, BTN_HEIGHT, CATEGORIES, getCategoryInfo } from '../constants/theme';

const BUDGET_KEY = '@zenvoy_budget_limit';

// ─── Period helpers ─────────────────────────────────────────────────────────────

const PERIODS = [
  { key: 'month',   label: 'This Month' },
  { key: 'quarter', label: '3 Months'   },
  { key: 'year',    label: 'This Year'  },
  { key: 'all',     label: 'All Time'   },
];

function getDateRange(period) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = fmt(now);

  if (period === 'month') {
    const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    return { dateFrom: from, dateTo: today };
  }
  if (period === 'quarter') {
    const d = new Date(now); d.setMonth(d.getMonth() - 3);
    return { dateFrom: fmt(d), dateTo: today };
  }
  if (period === 'year') {
    return { dateFrom: `${now.getFullYear()}-01-01`, dateTo: today };
  }
  return { dateFrom: null, dateTo: null };
}

// ─── Sub-components ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }) {
  return (
    <View style={s.summaryCard}>
      <Text style={s.summaryValue}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
      {sub ? <Text style={s.summarySub}>{sub}</Text> : null}
    </View>
  );
}

function SectionHeader({ title }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

/** Horizontal bar for a category row. `fraction` = 0-1. */
function CategoryBar({ label, emoji, color, total, fraction, count }) {
  return (
    <View style={s.barRow}>
      <View style={s.barLeft}>
        <Text style={s.barEmoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <View style={s.barLabelRow}>
            <Text style={s.barLabel} numberOfLines={1}>{label}</Text>
            <Text style={s.barTotal}>${total.toFixed(2)}</Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${(fraction * 100).toFixed(1)}%`, backgroundColor: color }]} />
          </View>
        </View>
      </View>
      <Text style={s.barCount}>{count} receipt{count !== 1 ? 's' : ''}</Text>
    </View>
  );
}

/** Vertical bar for monthly trend. `fraction` = 0-1. */
function MonthBar({ month, total, fraction }) {
  const label = month ? month.slice(5) : '—'; // "03" from "2026-03"
  return (
    <View style={s.monthCol}>
      <Text style={s.monthTotal}>${total >= 1000 ? (total / 1000).toFixed(1) + 'k' : total.toFixed(0)}</Text>
      <View style={s.monthTrack}>
        <View style={[s.monthFill, { height: `${(fraction * 100).toFixed(1)}%` }]} />
      </View>
      <Text style={s.monthLabel}>{label}</Text>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────────

export default function AnalyticsScreen({ navigation }) {
  const { showToast } = useToast();

  const [period, setPeriod]               = useState('month');
  const [loading, setLoading]             = useState(true);
  const [summary, setSummary]             = useState(null);
  const [byCategory, setByCategory]       = useState({});
  const [trend, setTrend]                 = useState({});
  const [deductible, setDeductible]       = useState({});
  const [topVendors, setTopVendors]       = useState([]);
  const [budgetLimit, setBudgetLimit]     = useState(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput]     = useState('');

  // Load saved budget limit on mount
  useEffect(() => {
    AsyncStorage.getItem(BUDGET_KEY).then(val => {
      if (val) setBudgetLimit(parseFloat(val));
    });
  }, []);

  const handleSetBudget = async (value) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      await AsyncStorage.setItem(BUDGET_KEY, String(num));
      setBudgetLimit(num);
    }
  };

  const promptBudget = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Set Budget',
        'Enter your spending limit for this period:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Set', onPress: (val) => handleSetBudget(val) },
        ],
        'plain-text',
        budgetLimit ? String(budgetLimit) : '',
        'decimal-pad'
      );
    } else {
      setBudgetInput(budgetLimit ? String(budgetLimit) : '');
      setShowBudgetModal(true);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { dateFrom, dateTo } = getDateRange(period);
    const [sum, cat, tr, ded, vend] = await Promise.all([
      getExpenseSummary(dateFrom, dateTo),
      getExpenseByCategory(dateFrom, dateTo),
      getMonthlyTrend(6),
      getTaxDeductible(dateFrom, dateTo),
      getTopVendors(dateFrom, dateTo, 5),
    ]);
    setSummary(sum);
    setByCategory(cat);
    setTrend(tr);
    setDeductible(ded);
    setTopVendors(vend);
    setLoading(false);
  }, [period]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const [exportingAnalytics, setExportingAnalytics] = useState(false);

  const handleExportAnalytics = async () => {
    if (exportingAnalytics) return;
    setExportingAnalytics(true);
    try {
      const header = 'Category,Total,Count\n';
      const rows = Object.entries(byCategory).map(([key, val]) => {
        const info = getCategoryInfo(key);
        return `"${info.label}",${val.total.toFixed(2)},${val.count}`;
      }).join('\n');
      const csv = header + rows;
      const path = FileSystem.documentDirectory + 'analytics_export.csv';
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        showToast({ message: 'Sharing not available on this device.', type: 'warning' });
        return;
      }
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Analytics' });
    } catch (e) {
      showToast({ message: 'Export failed. Please try again.', type: 'error' });
    } finally {
      setExportingAnalytics(false);
    }
  };

  // Category chart data
  const catEntries = Object.entries(byCategory);
  const maxCatTotal = catEntries.reduce((m, [, v]) => Math.max(m, v.total), 0.01);

  // Monthly trend data (sorted ascending)
  const trendEntries = Object.entries(trend).sort(([a], [b]) => a.localeCompare(b));
  const maxTrend = trendEntries.reduce((m, [, v]) => Math.max(m, v.total), 0.01);

  // Tax deductible total
  const dedTotal = Object.values(deductible).reduce((s, v) => s + v.total, 0);

  return (
    <>
      <ScrollView style={s.container} contentContainerStyle={s.content}>

        {/* Period selector */}
        <View style={s.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[s.periodChip, period === p.key && s.periodChipActive]}
              onPress={() => setPeriod(p.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.periodText, period === p.key && s.periodTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={s.loader}>
            <ActivityIndicator color={COLORS.accent} size="large" />
          </View>
        ) : (
          <>
            {/* Summary cards */}
            <View style={s.summaryGrid}>
              <SummaryCard label="Total Expense"  value={`$${(summary?.totalExpense || 0).toFixed(2)}`} />
              <SummaryCard label="Avg / Receipt"  value={`$${(summary?.avgPerReceipt || 0).toFixed(2)}`} />
              <SummaryCard label="Total Tax"      value={`$${(summary?.totalTax || 0).toFixed(2)}`} />
              <SummaryCard label="Receipts"       value={String(summary?.count || 0)} />
            </View>

            {/* Budget exceeded banner */}
            {budgetLimit != null && summary && summary.totalExpense > budgetLimit && (
              <View style={s.budgetBanner}>
                <Text style={s.budgetBannerText}>
                  ⚠ You've exceeded your ${budgetLimit.toFixed(2)} budget this period
                </Text>
              </View>
            )}

            {/* Category breakdown */}
            {catEntries.length > 0 && (
              <>
                <SectionHeader title="By Category" />
                <View style={s.card}>
                  {catEntries.map(([key, val]) => {
                    const info = getCategoryInfo(key);
                    return (
                      <TouchableOpacity
                        key={key}
                        activeOpacity={0.7}
                        onPress={() => {
                          navigation.getParent()?.navigate('Receipts');
                          showToast({ message: `Showing ${info.label} receipts`, type: 'info' });
                        }}
                      >
                        <CategoryBar
                          label={info.label}
                          emoji={info.emoji}
                          color={info.color}
                          total={val.total}
                          fraction={val.total / maxCatTotal}
                          count={val.count}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

          {/* Monthly trend */}
          {trendEntries.length > 0 && (
            <>
              <SectionHeader title="Monthly Trend" />
              <View style={[s.card, s.trendCard]}>
                {trendEntries.map(([month, val]) => (
                  <MonthBar
                    key={month}
                    month={month}
                    total={val.total}
                    fraction={val.total / maxTrend}
                  />
                ))}
              </View>
            </>
          )}

          {/* Tax deductible */}
          {Object.keys(deductible).length > 0 && (
            <>
              <SectionHeader title={`Tax Deductible  ·  $${dedTotal.toFixed(2)} total`} />
              <View style={s.card}>
                {Object.entries(deductible).map(([cat, val]) => {
                  const info = getCategoryInfo(cat);
                  return (
                    <View key={cat} style={s.dedRow}>
                      <Text style={s.dedEmoji}>{info.emoji}</Text>
                      <Text style={s.dedLabel}>{info.label}</Text>
                      <Text style={s.dedCount}>{val.count} receipts</Text>
                      <Text style={s.dedTotal}>${val.total.toFixed(2)}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Top vendors */}
          {topVendors.length > 0 && (
            <>
              <SectionHeader title="Top Vendors" />
              <View style={s.card}>
                {topVendors.map((v, i) => (
                  <View key={i} style={s.vendorRow}>
                    <View style={s.vendorRank}>
                      <Text style={s.vendorRankText}>{i + 1}</Text>
                    </View>
                    <Text style={s.vendorName} numberOfLines={1}>{v.vendor}</Text>
                    <Text style={s.vendorCount}>{v.count}×</Text>
                    <Text style={s.vendorTotal}>${parseFloat(v.total).toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

            {/* Empty state */}
            {catEntries.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>📊</Text>
                <Text style={s.emptyText}>No data for this period</Text>
                <Text style={s.emptySub}>Scan some receipts to see your analytics</Text>
              </View>
            )}

            {/* Export Analytics button */}
            {catEntries.length > 0 && (
              <TouchableOpacity
                style={[s.analyticsExportBtn, exportingAnalytics && { opacity: 0.5 }]}
                onPress={handleExportAnalytics}
                disabled={exportingAnalytics}
                activeOpacity={0.85}
              >
                {exportingAnalytics
                  ? <ActivityIndicator color={COLORS.textPrimary} size="small" />
                  : <Text style={s.analyticsExportBtnText}>📊  Export Analytics CSV</Text>}
              </TouchableOpacity>
            )}

            {/* Set Budget link */}
            <TouchableOpacity style={s.setBudgetWrap} onPress={promptBudget} activeOpacity={0.7}>
              <Text style={s.setBudgetText}>
                {budgetLimit != null
                  ? `Budget: $${budgetLimit.toFixed(2)} · Edit`
                  : 'Set Budget'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Android budget modal */}
      {showBudgetModal && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowBudgetModal(false)}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Set Budget</Text>
              <Text style={s.modalSub}>Enter your spending limit for this period</Text>
              <TextInput
                style={s.modalInput}
                value={budgetInput}
                onChangeText={setBudgetInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.textTertiary}
                autoFocus
                selectTextOnFocus
              />
              <View style={s.modalBtns}>
                <TouchableOpacity
                  style={s.modalBtnCancel}
                  onPress={() => setShowBudgetModal(false)}
                  activeOpacity={0.75}
                >
                  <Text style={s.modalBtnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.modalBtnSet}
                  onPress={() => {
                    handleSetBudget(budgetInput);
                    setShowBudgetModal(false);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={s.modalBtnSetText}>Set</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content:   { paddingHorizontal: H_PAD, paddingBottom: 40 },

  periodRow: {
    flexDirection:  'row',
    gap:            SPACE.sm,
    paddingTop:     SPACE.md,
    paddingBottom:  SPACE.sm,
    flexWrap:       'wrap',
  },
  periodChip: {
    paddingHorizontal: SPACE.md,
    paddingVertical:   7,
    borderRadius:      RADIUS.chip,
    borderWidth:       1.5,
    borderColor:       COLORS.border,
  },
  periodChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  periodText:       { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  periodTextActive: { color: COLORS.textPrimary },

  loader: { paddingTop: 80, alignItems: 'center' },

  summaryGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SPACE.sm,
    marginBottom:  SPACE.lg,
    marginTop:     SPACE.sm,
  },
  summaryCard: {
    width:           '48%',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.md,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
  },
  summaryValue: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  summarySub:   { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },

  sectionHeader: {
    fontSize:      12,
    fontWeight:    '700',
    color:         COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom:  SPACE.sm,
    marginTop:     SPACE.lg,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.md,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
    gap:             SPACE.md,
  },

  // Category bars
  barRow: { flexDirection: 'column', gap: SPACE.xs },
  barLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  barEmoji: { fontSize: 18, width: 26, textAlign: 'center' },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  barTotal: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  barTrack: {
    height: 6, backgroundColor: COLORS.cardAlt,
    borderRadius: 3, overflow: 'hidden',
  },
  barFill:  { height: 6, borderRadius: 3 },
  barCount: { fontSize: 11, color: COLORS.textTertiary, alignSelf: 'flex-end' },

  // Monthly trend (vertical bars)
  trendCard: { flexDirection: 'row', alignItems: 'flex-end', gap: 0, paddingHorizontal: SPACE.sm },
  monthCol: {
    flex: 1, alignItems: 'center', gap: SPACE.xs,
  },
  monthTotal: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '600' },
  monthTrack: {
    width: '70%', height: 80,
    backgroundColor: COLORS.cardAlt,
    borderRadius: 3,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  monthFill: { width: '100%', backgroundColor: COLORS.accent, borderRadius: 3 },
  monthLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },

  // Tax deductible
  dedRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACE.sm,
  },
  dedEmoji: { fontSize: 16, width: 24, textAlign: 'center' },
  dedLabel: { flex: 1, fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  dedCount: { fontSize: 12, color: COLORS.textTertiary },
  dedTotal: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },

  // Top vendors
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  vendorRank: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.cardAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  vendorRankText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  vendorName:  { flex: 1, fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  vendorCount: { fontSize: 13, color: COLORS.textTertiary },
  vendorTotal: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },

  empty: { alignItems: 'center', marginTop: 60, gap: SPACE.sm },
  emptyIcon: { fontSize: 40, marginBottom: SPACE.sm },
  emptyText: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  emptySub:  { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },

  // Budget exceeded banner
  budgetBanner: {
    backgroundColor: COLORS.warningMuted,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.warning + '55',
    padding:         SPACE.md,
    marginBottom:    SPACE.lg,
  },
  budgetBannerText: {
    color:      COLORS.warning,
    fontSize:   13,
    fontWeight: '600',
    lineHeight: 20,
  },

  // Export Analytics button
  analyticsExportBtn: {
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    backgroundColor: COLORS.cardAlt,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     COLORS.border,
    marginTop:       SPACE.lg,
  },
  analyticsExportBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },

  // Set Budget link
  setBudgetWrap: {
    alignItems:   'center',
    paddingTop:   SPACE.xl,
    paddingBottom: SPACE.md,
  },
  setBudgetText: {
    fontSize:   13,
    color:      COLORS.accent,
    fontWeight: '500',
  },

  // Android budget modal
  modalOverlay: {
    flex:            1,
    backgroundColor: COLORS.overlay,
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: H_PAD,
  },
  modalCard: {
    width:           '100%',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    borderWidth:     1,
    borderColor:     COLORS.border,
    padding:         SPACE.xl,
    gap:             SPACE.md,
    ...ELEVATION.modal,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  modalSub:   { fontSize: 13, color: COLORS.textSecondary },
  modalInput: {
    backgroundColor:   COLORS.cardAlt,
    borderRadius:      RADIUS.input,
    borderWidth:       1,
    borderColor:       COLORS.border,
    paddingHorizontal: SPACE.md,
    height:            48,
    fontSize:          16,
    color:             COLORS.textPrimary,
  },
  modalBtns: {
    flexDirection: 'row',
    gap:           SPACE.sm,
    marginTop:     SPACE.xs,
  },
  modalBtnCancel: {
    flex:            1,
    height:          44,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     COLORS.border,
    backgroundColor: COLORS.cardAlt,
  },
  modalBtnCancelText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
  modalBtnSet: {
    flex:            1,
    height:          44,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: COLORS.accent,
  },
  modalBtnSetText: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '700' },
});
