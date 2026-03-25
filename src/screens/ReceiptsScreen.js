import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Animated, Easing, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { COLORS, ELEVATION, RADIUS, H_PAD, SPACE, CATEGORIES, getCategoryInfo } from '../constants/theme';
import Dialog from '../components/Dialog';
import { getReadyReceipts, deleteReceipt } from '../services/db';

const ALL_KEY = 'All';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Group receipts into SectionList sections ordered by month. */
function groupByMonth(receipts) {
  const map = {};
  receipts.forEach(r => {
    const key = r.date || r.created_at || '';
    const parts = key.split('-');
    if (parts.length < 2) return;
    const label = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!map[label]) map[label] = [];
    map[label].push(r);
  });
  return Object.entries(map).map(([title, data]) => ({ title, data }));
}

/** Returns contextual empty-state config based on active search/filter. */
function getEmptyStateConfig(search, activeCategory) {
  if (search.length > 0) {
    return { icon: '🔍', title: 'Nothing found', isSearch: true, subtitle: null };
  }
  if (activeCategory !== ALL_KEY) {
    const cat = getCategoryInfo(activeCategory);
    return { icon: '📋', title: `No ${cat.label} receipts`, isSearch: false, subtitle: 'Try a different category' };
  }
  return { icon: '🧾', title: 'No receipts yet', isSearch: false, subtitle: 'Tap Scan to add your first receipt' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Animated counter that counts up whenever `value` changes.
 * Uses JS driver (non-transform animation) — intentionally not on native thread.
 */
function AnimatedNumber({ value, format }) {
  const animVal  = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = animVal.addListener(({ value: v }) => setDisplay(v));
    animVal.setValue(0);
    Animated.timing(animVal, {
      toValue:         value,
      duration:        600,
      easing:          Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animVal.removeListener(id);
  }, [value]);

  return <Text style={s.statsValue}>{format(display)}</Text>;
}

/** Spring-mounted statistics card — animates in once on mount, values count up on change. */
function StatisticsCard({ total, count, average }) {
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue:         1,
      tension:         80,
      friction:        12,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[s.statsCard, { transform: [{ scale }] }]}>
      <Text style={s.statsHeader}>📊 This Month</Text>
      <View style={s.statsDivider} />
      <View style={s.statsRow}>
        <Text style={s.statsLabel}>Total</Text>
        <AnimatedNumber value={total}   format={v => `$${v.toFixed(2)}`} />
      </View>
      <View style={s.statsRow}>
        <Text style={s.statsLabel}>Receipts</Text>
        <AnimatedNumber value={count}   format={v => String(Math.round(v))} />
      </View>
      <View style={s.statsRow}>
        <Text style={s.statsLabel}>Average</Text>
        <AnimatedNumber value={average} format={v => `$${v.toFixed(2)}`} />
      </View>
    </Animated.View>
  );
}

/** Colored sync status indicator shown inline in the right column. */
function SyncBadge({ status }) {
  const cfg = status === 'synced'
    ? { icon: '✓', color: COLORS.accent }
    : status === 'error'
    ? { icon: '⚠', color: COLORS.danger }
    : { icon: '⟳', color: COLORS.warning };
  return <Text style={[s.syncIcon, { color: cfg.color }]}>{cfg.icon}</Text>;
}

/**
 * Premium receipt card.
 * - 3px accent bar on the left edge (teal synced, orange pending)
 * - Spring scale on press (0.98×)
 * - Receives `animValue` (Animated.Value 0→1) for mount stagger + delete fade
 */
function ReceiptCard({ item, animValue, onDelete, onPress }) {
  const scale      = useRef(new Animated.Value(1)).current;
  const cat        = getCategoryInfo(item.category);
  const syncStatus = item.synced ? 'synced' : 'pending';
  const barColor   = syncStatus === 'synced' ? COLORS.accent
                   : syncStatus === 'error'  ? COLORS.danger
                   :                           COLORS.warning;

  const pressIn  = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 4 }).start();

  return (
    <Animated.View style={[s.cardWrapper, {
      opacity:   animValue,
      transform: [
        { scale },
        { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
      ],
    }]}>
      <TouchableOpacity
        style={s.card}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={0.85}
        testID={`receipt-card-${item.id}`}
      >
        {/* 3px left accent bar */}
        <View style={[s.accentBar, { backgroundColor: barColor }]} />

        <View style={s.cardContent}>
          {/* Category icon */}
          <View style={s.cardIconWrap}>
            <Text style={s.cardEmoji}>{cat.emoji}</Text>
          </View>

          {/* Middle: vendor + details */}
          <View style={s.cardMiddle}>
            <Text style={s.cardVendor} numberOfLines={1}>
              {item.vendor || 'Unknown vendor'}
            </Text>
            <Text style={s.cardDetails}>
              {item.date || '—'} · {cat.label}
            </Text>
          </View>

          {/* Right: sync badge + amount + more */}
          <View style={s.cardRight}>
            <SyncBadge status={syncStatus} />
            <Text style={s.cardAmount}>
              ${parseFloat(item.total || 0).toFixed(2)}
            </Text>
            <TouchableOpacity
              onPress={() => onDelete(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID={`delete-btn-${item.id}`}
            >
              <Text style={s.moreBtn}>⋯</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** 3-row shimmer skeleton shown while data loads. */
function SkeletonLoader() {
  const shimmer = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.7, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <>
      {[0, 1, 2].map(i => (
        <Animated.View key={i} style={[s.skeletonRow, { opacity: shimmer }]}>
          <View style={s.skeletonIcon} />
          <View style={s.skeletonMiddle}>
            <View style={s.skeletonLine} />
            <View style={[s.skeletonLine, { width: '55%', marginTop: 6 }]} />
          </View>
          <View style={s.skeletonAmount} />
        </Animated.View>
      ))}
    </>
  );
}

/** Contextual empty state with CTA button to navigate to Scan. */
function EmptyState({ search, activeCategory, onScan }) {
  const cfg = getEmptyStateConfig(search, activeCategory);
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyCircle}>
        <Text style={s.emptyCircleIcon}>{cfg.icon}</Text>
      </View>
      <Text style={s.emptyTitle}>{cfg.title}</Text>
      {cfg.isSearch ? (
        <Text style={s.emptySubtitle}>
          No results for <Text style={s.emptyHighlight}>{search}</Text>
        </Text>
      ) : (
        cfg.subtitle ? <Text style={s.emptySubtitle}>{cfg.subtitle}</Text> : null
      )}
      <TouchableOpacity
        style={s.emptyCta}
        onPress={onScan}
        activeOpacity={0.85}
        testID="empty-scan-cta"
      >
        <Text style={s.emptyCtaText}>Scan a Receipt</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReceiptsScreen({ navigation }) {
  const [receipts,       setReceipts]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [search,         setSearch]         = useState('');
  const [activeCategory, setActiveCategory] = useState(ALL_KEY);
  const [deleteId,       setDeleteId]       = useState(null);

  /** One Animated.Value per receipt id — reused for mount stagger + delete fade. */
  const animRefs = useRef({});

  // ── Data ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const data = await getReadyReceipts();
    setReceipts(data);
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRefreshing(false);
  }, [load]);

  // ── Filtering ────────────────────────────────────────────────────────────────

  const sections = useMemo(() => {
    const lower    = search.toLowerCase();
    const filtered = receipts.filter(r => {
      const matchSearch = (r.vendor || '').toLowerCase().includes(lower);
      const matchCat    = activeCategory === ALL_KEY || (r.category || 'Other') === activeCategory;
      return matchSearch && matchCat;
    });
    return groupByMonth(filtered);
  }, [receipts, search, activeCategory]);

  // ── Statistics ───────────────────────────────────────────────────────────────

  const statistics = useMemo(() => {
    const items   = sections.flatMap(sec => sec.data);
    const total   = items.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
    const count   = items.length;
    const average = count > 0 ? total / count : 0;
    return { total, count, average };
  }, [sections]);

  // ── Mount animations ─────────────────────────────────────────────────────────

  /**
   * Stagger all visible receipts: opacity 0→1 + translateY 16→0,
   * 80ms between each card, 380ms duration, Easing.out(Easing.cubic).
   */
  const triggerMountAnimations = useCallback((sectionData) => {
    let idx = 0;
    sectionData.forEach(sec => {
      sec.data.forEach(item => {
        if (!animRefs.current[item.id]) {
          animRefs.current[item.id] = new Animated.Value(0);
        }
        const anim = animRefs.current[item.id];
        anim.setValue(0);
        Animated.timing(anim, {
          toValue:         1,
          duration:        380,
          delay:           idx * 80,
          easing:          Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
        idx++;
      });
    });
  }, []);

  useEffect(() => {
    if (!loading) triggerMountAnimations(sections);
  }, [sections, loading]);

  // ── Delete flow ──────────────────────────────────────────────────────────────

  /** Tap ⋯ → medium haptic → show confirm dialog. */
  const handleDeletePress = useCallback((id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteId(id);
  }, []);

  /**
   * Confirm → success haptic → animate card out (opacity 1→0, 250ms)
   * → delete from DB → reload list.
   */
  const confirmDelete = useCallback(async () => {
    const id = deleteId;
    setDeleteId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const doDelete = async () => {
      await deleteReceipt(id);
      load();
    };

    const anim = animRefs.current[id];
    if (anim) {
      Animated.timing(anim, {
        toValue:         0,
        duration:        250,
        easing:          Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(doDelete);
    } else {
      doDelete();
    }
  }, [deleteId, load]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const renderItem = useCallback(({ item }) => {
    if (!animRefs.current[item.id]) {
      animRefs.current[item.id] = new Animated.Value(0);
    }
    return (
      <ReceiptCard
        item={item}
        animValue={animRefs.current[item.id]}
        onDelete={handleDeletePress}
        onPress={() => navigation.navigate('ReceiptDetail', { receipt: item })}
      />
    );
  }, [navigation, handleDeletePress]);

  const renderSectionHeader = useCallback(({ section }) => {
    const secTotal = section.data.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
    return (
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>{section.title}</Text>
        <Text style={s.sectionTotal}>${secTotal.toFixed(2)}</Text>
      </View>
    );
  }, []);

  const listHeader = (
    <StatisticsCard
      total={statistics.total}
      count={statistics.count}
      average={statistics.average}
    />
  );

  return (
    <View style={s.container}>
      <Dialog
        visible={!!deleteId}
        title="Delete Receipt?"
        message="This receipt will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* Search bar — hidden while loading */}
      {!loading && (
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            style={s.search}
            placeholder="Search by vendor…"
            placeholderTextColor={COLORS.textTertiary}
            value={search}
            onChangeText={setSearch}
            selectionColor={COLORS.accent}
            testID="search-input"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="clear-search"
            >
              <Text style={s.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => navigation.navigate('Export')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.exportBtn}
            testID="export-btn"
          >
            <Text style={s.exportBtnText}>📊</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Category chips — hidden while loading */}
      {!loading && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipScroll}
          contentContainerStyle={s.chipContent}
        >
          <TouchableOpacity
            style={[s.chip, activeCategory === ALL_KEY && s.chipActive]}
            onPress={() => setActiveCategory(ALL_KEY)}
            activeOpacity={0.75}
            testID="chip-all"
          >
            <Text style={[s.chipText, activeCategory === ALL_KEY && s.chipTextActive]}>All</Text>
          </TouchableOpacity>

          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[s.chip, isActive && s.chipActive]}
                onPress={() => setActiveCategory(cat.key)}
                activeOpacity={0.75}
                testID={`chip-${cat.key}`}
              >
                <Text style={s.chipEmoji}>{cat.emoji}</Text>
                <Text style={[s.chipText, isActive && s.chipTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <View style={s.skeletonWrap}>
          <SkeletonLoader />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <EmptyState
              search={search}
              activeCategory={activeCategory}
              onScan={() => navigation.getParent()?.navigate('Scan')}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.accent}
              colors={[COLORS.accent]}
            />
          }
          contentContainerStyle={s.listContent}
          stickySectionHeadersEnabled={false}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={15}
          windowSize={5}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },

  // ── Search bar
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
  searchIcon:    { fontSize: 18, color: COLORS.textTertiary },
  search:        { flex: 1, color: COLORS.textPrimary, fontSize: 15 },
  clearBtn:      { fontSize: 13, color: COLORS.textTertiary, fontWeight: '600', padding: 4 },
  exportBtn:     { padding: 4 },
  exportBtnText: { fontSize: 18 },

  // ── Category chips
  chipScroll:  { marginBottom: SPACE.sm },
  chipContent: { paddingVertical: SPACE.xs, gap: SPACE.sm, flexDirection: 'row' },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SPACE.md,
    paddingVertical:   7,
    borderRadius:      RADIUS.chip,
    borderWidth:       1.5,
    borderColor:       COLORS.border,
    backgroundColor:   COLORS.cardAlt,
    gap:               5,
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor:     COLORS.accent,
    shadowColor:     COLORS.accent,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.3,
    shadowRadius:    8,
    elevation:       8,
  },
  chipEmoji:      { fontSize: 13 },
  chipText:       { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  // ── Statistics card
  statsCard: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    borderWidth:     1,
    borderColor:     COLORS.border,
    padding:         SPACE.lg,
    marginTop:       SPACE.md,
    marginBottom:    SPACE.sm,
    gap:             SPACE.sm,
    ...ELEVATION.card,
  },
  statsHeader:  { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  statsDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: SPACE.xs },
  statsRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsLabel:   { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  statsValue:   { fontSize: 14, color: COLORS.accent, fontWeight: '700' },

  // ── Section header
  sectionHeader: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingTop:        SPACE.xl,
    paddingBottom:     6,
    marginBottom:      4,
    borderBottomWidth: 0.5,
    borderColor:       COLORS.border,
  },
  sectionTitle: {
    fontSize:      11,
    fontWeight:    '600',
    color:         COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  sectionTotal: {
    fontSize:      11,
    fontWeight:    '600',
    color:         COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },

  // ── Receipt card
  cardWrapper: { marginVertical: 3 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    borderWidth:     1,
    borderColor:     COLORS.border,
    overflow:        'hidden',   // clips accent bar to card corners
    ...ELEVATION.card,
  },
  accentBar: {
    position:     'absolute',
    left:         0,
    top:          0,
    bottom:       0,
    width:        3,
  },
  cardContent: {
    flexDirection:  'row',
    alignItems:     'center',
    padding:        SPACE.lg,
    paddingLeft:    SPACE.lg + 8, // breathing room after accent bar
  },
  cardIconWrap: {
    width:           42,
    height:          42,
    borderRadius:    10,
    backgroundColor: COLORS.cardAlt,
    justifyContent:  'center',
    alignItems:      'center',
    marginRight:     SPACE.md,
  },
  cardEmoji:  { fontSize: 24 },
  cardMiddle: { flex: 1, marginRight: SPACE.sm },
  cardVendor: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  cardDetails:{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardRight:  { alignItems: 'flex-end', gap: 4 },
  syncIcon:   { fontSize: 11, fontWeight: '700' },
  cardAmount: { fontSize: 15, fontWeight: '700', color: COLORS.accent },
  moreBtn:    { fontSize: 18, color: COLORS.textTertiary, letterSpacing: 1, lineHeight: 22 },

  // ── Skeleton
  skeletonWrap: { paddingTop: SPACE.md },
  skeletonRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.lg,
    marginVertical:  3,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  skeletonIcon: {
    width: 42, height: 42,
    borderRadius:    10,
    backgroundColor: COLORS.cardAlt,
    marginRight:     SPACE.md,
  },
  skeletonMiddle: { flex: 1 },
  skeletonLine: {
    height:          12,
    backgroundColor: COLORS.cardAlt,
    borderRadius:    6,
    width:           '80%',
  },
  skeletonAmount: {
    width:           52,
    height:          14,
    backgroundColor: COLORS.cardAlt,
    borderRadius:    6,
  },

  // ── Empty states
  emptyWrap: {
    alignItems:        'center',
    marginTop:         80,
    paddingHorizontal: SPACE.xl,
    gap:               SPACE.md,
  },
  emptyCircle: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: COLORS.accent + '26',  // ~15% opacity
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    SPACE.sm,
  },
  emptyCircleIcon: { fontSize: 32 },
  emptyTitle:      { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  emptySubtitle:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  emptyHighlight:  { color: COLORS.accent, fontWeight: '600' },
  emptyCta: {
    marginTop:         SPACE.sm,
    backgroundColor:   COLORS.accent,
    borderRadius:      RADIUS.button,
    paddingVertical:   SPACE.md,
    paddingHorizontal: SPACE.xxxl,
    ...ELEVATION.glow,
  },
  emptyCtaText: { fontSize: 15, fontWeight: '700', color: COLORS.bg },

  // ── List
  listContent: { paddingBottom: SPACE.xxxl },
});
