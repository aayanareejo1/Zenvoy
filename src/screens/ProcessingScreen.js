import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { processQueueItem } from '../services/backgroundProcessor';
import { getAllQueueEntries, getQueueEntryById } from '../services/db';
import Dialog from '../components/Dialog';
import { COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE } from '../constants/theme';

// Map queue DB statuses → display labels / colors / icons
const STATUS_LABEL = {
  pending:    '⏳ Pending',
  processing: 'Processing…',
  completed:  'Done',
  failed:     'Failed — tap to retry',
  skipped:    'Too large — enter manually',
};

const STATUS_COLOR = {
  pending:    COLORS.textTertiary,
  processing: COLORS.accent,
  completed:  COLORS.success,
  failed:     COLORS.danger,
  skipped:    COLORS.warning,
};

const STATUS_ICON = {
  pending:    '○',
  processing: '◌',
  completed:  '✓',
  failed:     '✕',
  skipped:    '⊘',
};

const TERMINAL = ['completed', 'failed', 'skipped'];

export default function ProcessingScreen({ route, navigation }) {
  // queueItems: [{ queueId, receiptId, photoUri }]
  const { queueItems } = route.params;

  // Local per-item state keyed by queueId
  const [statusMap, setStatusMap] = useState(() => {
    const map = {};
    for (const qi of queueItems) map[qi.queueId] = 'pending';
    return map;
  });
  const [errorMap, setErrorMap] = useState({});
  const [cancelDialog, setCancelDialog] = useState(false);

  const cancelledRef   = useRef(false);
  const processingRef  = useRef(new Set()); // queueIds currently in-flight
  const pollIntervalRef = useRef(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const setStatus = useCallback((queueId, status, error = null) => {
    setStatusMap(prev => ({ ...prev, [queueId]: status }));
    if (error) setErrorMap(prev => ({ ...prev, [queueId]: error }));
  }, []);

  // ── Queue DB polling (every 1 s) ──────────────────────────────────────────

  const syncFromDb = useCallback(async () => {
    try {
      const rows = await getAllQueueEntries();
      const queueIds = new Set(queueItems.map(qi => qi.queueId));
      const relevant = rows.filter(r => queueIds.has(r.id));

      setStatusMap(prev => {
        const next = { ...prev };
        for (const row of relevant) {
          const uiStatus = row.status === 'completed' ? 'completed'
            : row.status === 'failed'     ? 'failed'
            : row.status === 'processing' ? 'processing'
            : 'pending';
          next[row.id] = uiStatus;
        }
        return next;
      });
      setErrorMap(prev => {
        const next = { ...prev };
        for (const row of relevant) {
          if (row.error_message) next[row.id] = row.error_message;
        }
        return next;
      });
    } catch (_) { /* ignore poll errors */ }
  }, [queueItems]);

  // ── Process a single item ─────────────────────────────────────────────────

  const processItem = useCallback(async (qi) => {
    if (processingRef.current.has(qi.queueId)) return;
    processingRef.current.add(qi.queueId);
    setStatus(qi.queueId, 'processing');

    try {
      await processQueueItem({
        id:          qi.queueId,
        receipt_id:  qi.receiptId,
        photo_uri:   qi.photoUri,
        retry_count: 0,
      });
    } catch (_) { /* handleQueueError inside processQueueItem handles this */ }

    processingRef.current.delete(qi.queueId);
    // Sync final status from DB
    await syncFromDb();
  }, [setStatus, syncFromDb]);

  // ── Run the full queue sequentially ──────────────────────────────────────

  const runQueue = useCallback(async () => {
    for (const qi of queueItems) {
      if (cancelledRef.current) break;
      await processItem(qi);
    }
  }, [queueItems, processItem]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    runQueue();
    pollIntervalRef.current = setInterval(syncFromDb, 1000);
    return () => {
      cancelledRef.current = true;
      clearInterval(pollIntervalRef.current);
    };
  }, [runQueue, syncFromDb]);

  // Auto-navigate to Inbox 2 seconds after all items are terminal
  const statuses = Object.values(statusMap);
  const done         = statuses.filter(s => TERMINAL.includes(s)).length;
  const allFinished  = done === queueItems.length;
  const progress     = queueItems.length > 0 ? done / queueItems.length : 0;

  const navigatedRef = useRef(false);
  useEffect(() => {
    if (allFinished && !navigatedRef.current) {
      navigatedRef.current = true;
      clearInterval(pollIntervalRef.current);
      const t = setTimeout(() => navigation.navigate('Inbox'), 2000);
      return () => clearTimeout(t);
    }
  }, [allFinished, navigation]);

  // ── Cancel ────────────────────────────────────────────────────────────────

  const confirmCancel = async () => {
    setCancelDialog(false);
    cancelledRef.current = true;
    clearInterval(pollIntervalRef.current);
    navigation.navigate('Inbox');
  };

  // ── Retry a failed item ───────────────────────────────────────────────────

  const retryItem = (qi) => {
    if (cancelledRef.current) return;
    setStatus(qi.queueId, 'pending');
    setErrorMap(prev => { const n = { ...prev }; delete n[qi.queueId]; return n; });
    getQueueEntryById(qi.queueId).then(row => {
      processQueueItem({
        id:          qi.queueId,
        receipt_id:  qi.receiptId,
        photo_uri:   qi.photoUri,
        retry_count: row?.retry_count ?? 0,
      }).then(() => syncFromDb());
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const renderItem = ({ item: qi, index }) => {
    const status = statusMap[qi.queueId] ?? 'pending';
    const color  = STATUS_COLOR[status] ?? COLORS.textTertiary;
    const isFailed = status === 'failed';

    return (
      <View style={styles.row}>
        <View style={[styles.statusIconWrap, { backgroundColor: color + '18' }]}>
          {status === 'processing' ? (
            <ActivityIndicator size="small" color={color} />
          ) : (
            <Text style={[styles.statusIcon, { color }]}>{STATUS_ICON[status] ?? '○'}</Text>
          )}
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowNum}>Receipt #{index + 1}</Text>
          <Text style={[styles.statusText, { color }]}>{STATUS_LABEL[status] ?? 'Pending'}</Text>
        </View>
        {isFailed && (
          <TouchableOpacity style={styles.retryBtn} onPress={() => retryItem(qi)} activeOpacity={0.75}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Dialog
        visible={cancelDialog}
        title="Cancel processing?"
        message="Already processed receipts are saved. Remaining will be in Inbox."
        confirmLabel="Yes, cancel"
        cancelLabel="Keep going"
        destructive
        onConfirm={confirmCancel}
        onCancel={() => setCancelDialog(false)}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>
          {allFinished ? 'All done!' : 'Processing Receipts'}
        </Text>
        {!allFinished && (
          <Text style={styles.subtext}>{done} of {queueItems.length} complete</Text>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(progress * 100).toFixed(1)}%` }]} />
      </View>

      <FlatList
        data={queueItems}
        keyExtractor={qi => String(qi.queueId)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 120 }}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
      />

      {allFinished ? (
        <View style={[styles.bottomBtn, ELEVATION.glow]}>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('Inbox')} activeOpacity={0.9}>
            <Text style={styles.doneBtnText}>View in Inbox</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelDialog(true)} activeOpacity={0.75}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },

  header: { marginTop: SPACE.xxl, marginBottom: SPACE.lg },
  heading: {
    fontSize:    26,
    fontWeight:  '700',
    color:       COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: SPACE.xs,
  },
  subtext: { fontSize: 14, color: COLORS.textSecondary },

  progressTrack: {
    height:          6,
    backgroundColor: COLORS.cardAlt,
    borderRadius:    3,
    marginBottom:    SPACE.xxl,
    overflow:        'hidden',
  },
  progressFill: {
    height:          6,
    backgroundColor: COLORS.accent,
    borderRadius:    3,
  },

  row: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.md,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACE.md,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
  },
  statusIconWrap: {
    width:           38,
    height:          38,
    borderRadius:    RADIUS.md,
    justifyContent:  'center',
    alignItems:      'center',
  },
  statusIcon: { fontSize: 16, fontWeight: '700' },
  rowContent: { flex: 1 },
  rowNum:     { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  statusText: { fontSize: 13, fontWeight: '500' },

  retryBtn: {
    paddingHorizontal: SPACE.md,
    paddingVertical:   SPACE.xs,
    borderRadius:      RADIUS.sm,
    borderWidth:       1,
    borderColor:       COLORS.danger,
  },
  retryBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.danger },

  bottomBtn: {
    position:     'absolute',
    bottom:       SPACE.xxl,
    left:         H_PAD,
    right:        H_PAD,
    borderRadius: RADIUS.button,
  },
  doneBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },

  cancelBtn: {
    position:       'absolute',
    bottom:         SPACE.xxl,
    left:           H_PAD,
    right:          H_PAD,
    height:         BTN_HEIGHT,
    borderRadius:   RADIUS.button,
    justifyContent: 'center',
    alignItems:     'center',
    borderWidth:    1,
    borderColor:    COLORS.borderStrong,
    backgroundColor: COLORS.cardAlt,
  },
  cancelBtnText: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '500' },
});

