import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ScrollView, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  searchReceipts, filterReceipts, addRecentSearch,
  getRecentSearches, getSavedFilters, saveFilter, deleteFilter,
} from '../services/searchService';
import { getCategoryInfo, COLORS, SPACE, RADIUS, H_PAD, CATEGORIES } from '../constants/theme';

const DEBOUNCE_MS = 320;

// ─── Highlight matching text ─────────────────────────────────────────────────────

function HighlightText({ text, query, style }) {
  if (!query || !text) return <Text style={style}>{text || ''}</Text>;
  const lower = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  const idx = lower.indexOf(lowerQ);
  if (idx === -1) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {text.slice(0, idx)}
      <Text style={[style, { color: COLORS.accent, fontWeight: '700' }]}>{text.slice(idx, idx + query.length)}</Text>
      {text.slice(idx + query.length)}
    </Text>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────────

export default function SearchScreen({ navigation }) {
  const [query, setQuery]               = useState('');
  const [results, setResults]           = useState([]);
  const [searching, setSearching]       = useState(false);
  const [recentSearches, setRecent]     = useState([]);
  const [savedFilters, setSaved]        = useState({});
  const [showFilters, setShowFilters]   = useState(false);
  const [activeCategories, setActiveCat] = useState([]);
  const [minAmount, setMinAmount]       = useState('');
  const [maxAmount, setMaxAmount]       = useState('');

  const debounceTimer = useRef(null);
  const amountTimer   = useRef(null);
  const filtersHeight = useRef(new Animated.Value(0)).current;

  const loadMeta = useCallback(async () => {
    const [recent, saved] = await Promise.all([getRecentSearches(), getSavedFilters()]);
    setRecent(recent);
    setSaved(saved);
  }, []);

  useFocusEffect(useCallback(() => { loadMeta(); }, [loadMeta]));

  useEffect(() => {
    Animated.timing(filtersHeight, {
      toValue: showFilters ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [showFilters]);

  const runSearch = useCallback(async (q, cats, minAmt, maxAmt) => {
    const hasAmounts = (minAmt && minAmt.trim()) || (maxAmt && maxAmt.trim());
    if (!q.trim() && !cats.length && !hasAmounts) { setResults([]); return; }
    setSearching(true);
    try {
      let res;
      if (cats.length || hasAmounts) {
        const opts = { categories: cats };
        const min = parseFloat(minAmt);
        const max = parseFloat(maxAmt);
        if (!isNaN(min) && minAmt.trim()) opts.minAmount = min;
        if (!isNaN(max) && maxAmt.trim()) opts.maxAmount = max;
        res = await filterReceipts(opts);
        if (q.trim()) {
          const lq = q.trim().toLowerCase();
          res = res.filter(r => (r.vendor || '').toLowerCase().includes(lq));
        }
      } else {
        res = await searchReceipts(q);
      }
      setResults(res);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = useCallback((text) => {
    setQuery(text);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      runSearch(text, activeCategories, minAmount, maxAmount);
      if (text.trim()) addRecentSearch(text.trim());
    }, DEBOUNCE_MS);
  }, [activeCategories, minAmount, maxAmount, runSearch]);

  const toggleCategory = useCallback((key) => {
    const next = activeCategories.includes(key)
      ? activeCategories.filter(k => k !== key)
      : [...activeCategories, key];
    setActiveCat(next);
    runSearch(query, next, minAmount, maxAmount);
  }, [activeCategories, query, minAmount, maxAmount, runSearch]);

  const handleMinAmountChange = useCallback((text) => {
    setMinAmount(text);
    clearTimeout(amountTimer.current);
    amountTimer.current = setTimeout(() => {
      runSearch(query, activeCategories, text, maxAmount);
    }, DEBOUNCE_MS);
  }, [query, activeCategories, maxAmount, runSearch]);

  const handleMaxAmountChange = useCallback((text) => {
    setMaxAmount(text);
    clearTimeout(amountTimer.current);
    amountTimer.current = setTimeout(() => {
      runSearch(query, activeCategories, minAmount, text);
    }, DEBOUNCE_MS);
  }, [query, activeCategories, minAmount, runSearch]);

  const applyRecent = (q) => {
    setQuery(q);
    runSearch(q, activeCategories, minAmount, maxAmount);
  };

  const applyFilter = (filter) => {
    const cats = filter.categories || [];
    setActiveCat(cats);
    runSearch(query, cats, minAmount, maxAmount);
  };

  const handleDeleteFilter = async (name) => {
    await deleteFilter(name);
    loadMeta();
  };

  const handleSaveFilter = async () => {
    if (!activeCategories.length) return;
    const name = `${activeCategories.join(', ')} filter`;
    await saveFilter(name, { categories: activeCategories });
    loadMeta();
  };

  const renderItem = ({ item }) => {
    const cat = getCategoryInfo(item.category);
    return (
      <TouchableOpacity
        style={s.resultRow}
        onPress={() => navigation.navigate('ReceiptDetail', { receipt: item })}
        activeOpacity={0.75}
      >
        <View style={[s.catDot, { backgroundColor: cat.color + '22', borderColor: cat.color + '55', borderWidth: 1 }]}>
          <Text style={{ fontSize: 17 }}>{cat.emoji}</Text>
        </View>
        <View style={{ flex: 1, marginRight: SPACE.sm }}>
          <HighlightText style={s.vendor} text={item.vendor || 'Unknown vendor'} query={query} />
          <Text style={s.date}>{item.date || '—'}</Text>
        </View>
        <Text style={s.total}>${parseFloat(item.total).toFixed(2)}</Text>
      </TouchableOpacity>
    );
  };

  const showEmpty = !searching && (query.trim() || activeCategories.length || minAmount.trim() || maxAmount.trim()) && results.length === 0;
  const showResults = results.length > 0;
  const showSuggestions = !query.trim() && !activeCategories.length && !minAmount.trim() && !maxAmount.trim();

  return (
    <View style={s.container}>
      {/* Search bar */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search receipts…"
          placeholderTextColor={COLORS.textTertiary}
          value={query}
          onChangeText={handleQueryChange}
          selectionColor={COLORS.accent}
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
            <Text style={s.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.filterToggle, showFilters && s.filterToggleActive]}
          onPress={() => setShowFilters(v => !v)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[s.filterIcon, showFilters && { color: COLORS.bg }]}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Filter panel */}
      <Animated.View style={[s.filterPanel, { opacity: filtersHeight, maxHeight: filtersHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 320] }) }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catChips}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[s.catChip, { borderColor: cat.color + '80' }, activeCategories.includes(cat.key) && { backgroundColor: cat.color, borderColor: cat.color }]}
              onPress={() => toggleCategory(cat.key)}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 13 }}>{cat.emoji}</Text>
              <Text style={[s.catChipText, activeCategories.includes(cat.key) && { color: '#fff' }]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Amount range inputs */}
        <View style={s.amountRow}>
          <View style={s.amountField}>
            <Text style={s.amountLabel}>Min $</Text>
            <TextInput
              style={s.amountInput}
              placeholder="0.00"
              placeholderTextColor={COLORS.textTertiary}
              value={minAmount}
              onChangeText={handleMinAmountChange}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={s.amountSep} />
          <View style={s.amountField}>
            <Text style={s.amountLabel}>Max $</Text>
            <TextInput
              style={s.amountInput}
              placeholder="Any"
              placeholderTextColor={COLORS.textTertiary}
              value={maxAmount}
              onChangeText={handleMaxAmountChange}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {activeCategories.length > 0 && (
          <TouchableOpacity style={s.saveFilterBtn} onPress={handleSaveFilter}>
            <Text style={s.saveFilterText}>Save filter</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {showResults || showEmpty || searching ? (
        <>
          {searching && (
            <Text style={s.hint}>Searching…</Text>
          )}
          {showEmpty && (
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>🔍</Text>
              <Text style={s.emptyText}>No results for "{query}"</Text>
            </View>
          )}
          <FlatList
            data={results}
            keyExtractor={i => String(i.id)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 40 }}
            ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
            keyboardShouldPersistTaps="handled"
          />
        </>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled">
          {/* Saved filters */}
          {Object.keys(savedFilters).length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Saved Filters</Text>
              <View style={s.chipRow}>
                {Object.entries(savedFilters).map(([name, filter]) => (
                  <View key={name} style={s.savedChip}>
                    <TouchableOpacity onPress={() => applyFilter(filter)}>
                      <Text style={s.savedChipText}>{name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteFilter(name)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Text style={s.savedChipX}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Recent searches */}
          {showSuggestions && recentSearches.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Recent</Text>
              {recentSearches.map((r, i) => (
                <TouchableOpacity key={i} style={s.recentRow} onPress={() => applyRecent(r)}>
                  <Text style={s.recentIcon}>⏱</Text>
                  <Text style={s.recentText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Saved Searches chips */}
          {showSuggestions && recentSearches.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Saved Searches</Text>
              <View style={s.chipRow}>
                {recentSearches.map((r, i) => (
                  <TouchableOpacity key={i} style={s.savedChip} onPress={() => applyRecent(r)}>
                    <Text style={s.savedChipText}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },

  searchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.input,
    borderWidth:       1,
    borderColor:       COLORS.border,
    paddingHorizontal: SPACE.md,
    height:            46,
    marginTop:         SPACE.md,
    marginBottom:      SPACE.sm,
    gap:               SPACE.sm,
  },
  searchIcon:  { fontSize: 18, color: COLORS.textTertiary },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 15 },
  clearBtn:    { fontSize: 13, color: COLORS.textTertiary, fontWeight: '600', padding: 4 },
  filterToggle: {
    width: 30, height: 30, borderRadius: RADIUS.md,
    backgroundColor: COLORS.cardAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  filterToggleActive: { backgroundColor: COLORS.accent },
  filterIcon: { fontSize: 14, color: COLORS.textSecondary },

  filterPanel: {
    overflow: 'hidden',
    marginBottom: SPACE.xs,
  },
  catChips:    { gap: SPACE.sm, paddingVertical: SPACE.xs, flexDirection: 'row' },
  catChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACE.md, paddingVertical: 7,
    borderRadius: RADIUS.chip, borderWidth: 1.5,
    gap: 5,
  },
  catChipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  saveFilterBtn: { alignSelf: 'flex-start', marginTop: SPACE.xs, marginBottom: SPACE.sm },
  saveFilterText: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },

  amountRow: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    marginTop:      SPACE.sm,
    marginBottom:   SPACE.xs,
    gap:            SPACE.sm,
  },
  amountField: { flex: 1 },
  amountLabel: {
    fontSize:     11,
    fontWeight:   '600',
    color:        COLORS.textSecondary,
    textTransform:'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACE.xs,
  },
  amountInput: {
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.input,
    borderWidth:       1,
    borderColor:       COLORS.border,
    paddingHorizontal: SPACE.md,
    height:            40,
    color:             COLORS.textPrimary,
    fontSize:          14,
  },
  amountSep: {
    width:           1,
    height:          40,
    backgroundColor: COLORS.border,
  },

  hint: { fontSize: 13, color: COLORS.textTertiary, paddingVertical: SPACE.sm },

  resultRow: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.md,
    flexDirection:   'row',
    alignItems:      'center',
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
  },
  catDot: { width: 38, height: 38, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center', marginRight: SPACE.md },
  vendor: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  date:   { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  total:  { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },

  emptyWrap: { alignItems: 'center', marginTop: 60, gap: SPACE.sm },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },

  section:      { marginTop: SPACE.xl },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: SPACE.sm,
  },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  savedChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardAlt, borderRadius: RADIUS.chip,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACE.md, paddingVertical: 7, gap: SPACE.sm,
  },
  savedChipText: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  savedChipX:    { fontSize: 11, color: COLORS.textTertiary, fontWeight: '700' },

  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.sm, gap: SPACE.md },
  recentIcon: { fontSize: 14, color: COLORS.textTertiary },
  recentText: { fontSize: 15, color: COLORS.textSecondary },
});
