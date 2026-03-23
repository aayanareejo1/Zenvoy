import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { preprocessImage, isTooLarge } from '../services/imageProcessor';
import { parseReceiptWithVision } from '../services/claude';
import { updateReceiptFromScan } from '../services/db';
import { deriveStatus } from '../utils/receiptHelpers';
import Dialog from '../components/Dialog';
import { COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE } from '../constants/theme';

const STATUS_LABEL = {
  queued:     'Queued',
  processing: 'Processing…',
  done:       'Done',
  failed:     'Failed — enter manually',
  skipped:    'Too large — enter manually',
};

const STATUS_COLOR = {
  queued:     COLORS.textTertiary,
  processing: COLORS.accent,
  done:       COLORS.success,
  failed:     COLORS.danger,
  skipped:    COLORS.warning,
};

const STATUS_ICON = {
  queued:     '○',
  processing: '◌',
  done:       '✓',
  failed:     '✕',
  skipped:    '⊘',
};

export default function ProcessingScreen({ route, navigation }) {
  const { items: initialItems } = route.params;

  const [items, setItems] = useState(
    initialItems.map(i => ({ ...i, status: 'queued' }))
  );
  const [cancelDialog, setCancelDialog] = useState(false);

  const cancelledRef = useRef(false);

  const setItemStatus = useCallback((id, status) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  }, []);

  useEffect(() => {
    runQueue();
    return () => { cancelledRef.current = true; };
  }, []);

  const runQueue = async () => {
    for (const item of initialItems) {
      if (cancelledRef.current) break;

      setItemStatus(item.id, 'processing');
      try {
        const { uri: processedUri, size } = await preprocessImage(item.photoUri);

        if (isTooLarge(size)) {
          await updateReceiptFromScan(item.id, {
            vendor: null, date: null, total: 0, tax: 0,
            category: 'Other', status: 'needs_review',
            notes: ['Image too large — please enter manually'],
          });
          setItemStatus(item.id, 'skipped');
          continue;
        }

        const parsed = await parseReceiptWithVision(processedUri);
        const status = deriveStatus(parsed);

        await updateReceiptFromScan(item.id, {
          vendor:   parsed.vendor,
          date:     parsed.date,
          total:    parsed.total,
          tax:      parsed.tax,
          category: parsed.category,
          status,
          notes:    parsed.notes,
        });

        setItemStatus(item.id, 'done');
      } catch (e) {
        await updateReceiptFromScan(item.id, {
          vendor: null, date: null, total: 0, tax: 0,
          category: 'Other', status: 'needs_review',
          notes: [`Processing failed: ${e.message}`],
        });
        setItemStatus(item.id, 'failed');
      }
    }
  };

  const confirmCancel = async () => {
    setCancelDialog(false);
    cancelledRef.current = true;
    for (const item of items.filter(i => i.status === 'queued' || i.status === 'processing')) {
      await updateReceiptFromScan(item.id, {
        vendor: null, date: null, total: 0, tax: 0,
        category: 'Other', status: 'needs_review',
        notes: ['Processing cancelled — please enter manually'],
      });
    }
    navigation.navigate('Inbox');
  };

  const done        = items.filter(i => ['done', 'failed', 'skipped'].includes(i.status)).length;
  const allFinished = done === items.length;
  const progress    = items.length > 0 ? done / items.length : 0;

  const renderItem = ({ item, index }) => (
    <View style={styles.row}>
      <View style={[styles.statusIconWrap, { backgroundColor: STATUS_COLOR[item.status] + '18' }]}>
        <Text style={[styles.statusIcon, { color: STATUS_COLOR[item.status] }]}>
          {STATUS_ICON[item.status]}
        </Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowNum}>Receipt #{index + 1}</Text>
        <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
          {STATUS_LABEL[item.status]}
        </Text>
      </View>
    </View>
  );

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
          {allFinished ? 'All done!' : `Processing receipts`}
        </Text>
        {!allFinished && (
          <Text style={styles.subtext}>{done} of {items.length} complete</Text>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(progress * 100).toFixed(1)}%` }]} />
      </View>

      <FlatList
        data={items}
        keyExtractor={i => String(i.id)}
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
  doneBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.bg },

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
