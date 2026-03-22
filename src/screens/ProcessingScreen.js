import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { preprocessImage, isTooLarge } from '../services/imageProcessor';
import { parseReceiptWithVision } from '../services/claude';
import { updateReceiptFromScan } from '../services/db';
import { deriveStatus } from '../utils/receiptHelpers';
import { COLORS, RADIUS, BTN_HEIGHT, H_PAD } from '../constants/theme';

const STATUS_LABEL = {
  queued:     'Queued',
  processing: 'Processing…',
  done:       'Done',
  failed:     'Failed — enter manually',
  skipped:    'Skipped — image too large',
};

const STATUS_COLOR = {
  queued:     COLORS.textSecondary,
  processing: COLORS.accent,
  done:       '#34D399',
  failed:     COLORS.danger,
  skipped:    COLORS.warning,
};

export default function ProcessingScreen({ route, navigation }) {
  const { items: initialItems } = route.params; // [{ id, photoUri }]

  const [items, setItems] = useState(
    initialItems.map(i => ({ ...i, status: 'queued' }))
  );

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
        // Preprocess
        const { uri: processedUri, size } = await preprocessImage(item.photoUri);

        if (isTooLarge(size)) {
          await updateReceiptFromScan(item.id, {
            vendor: null, date: null, total: 0, tax: 0,
            category: 'Other', status: 'needs_review',
            notes: ['Image too large after preprocessing — please enter manually'],
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

  const handleCancel = () => {
    Alert.alert('Cancel processing?', 'Already processed receipts are saved. Remaining will be in Inbox.', [
      {
        text: 'Yes, cancel', style: 'destructive', onPress: async () => {
          cancelledRef.current = true;
          // Mark any still-queued items as needs_review
          for (const item of items.filter(i => i.status === 'queued' || i.status === 'processing')) {
            await updateReceiptFromScan(item.id, {
              vendor: null, date: null, total: 0, tax: 0,
              category: 'Other', status: 'needs_review',
              notes: ['Processing cancelled — please enter manually'],
            });
          }
          navigation.navigate('Inbox');
        },
      },
      { text: 'Keep going', style: 'cancel' },
    ]);
  };

  const done = items.filter(i => ['done', 'failed', 'skipped'].includes(i.status)).length;
  const allFinished = done === items.length;

  const renderItem = ({ item, index }) => (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowNum}>#{index + 1}</Text>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] }]} />
        <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
          {STATUS_LABEL[item.status]}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        {allFinished ? 'Done!' : `Processing ${done} / ${items.length}`}
      </Text>
      {!allFinished && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(done / items.length) * 100}%` }]} />
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {allFinished ? (
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('Inbox')}>
          <Text style={styles.doneBtnText}>Go to Inbox</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },
  heading: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginTop: 24, marginBottom: 16 },
  progressBar: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, marginBottom: 20, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: COLORS.accent, borderRadius: 3 },
  row: { backgroundColor: COLORS.card, borderRadius: RADIUS.card, padding: 14, marginVertical: 3, borderWidth: 1, borderColor: COLORS.border },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowNum: { fontSize: 13, color: COLORS.textSecondary, width: 24 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: '600' },
  doneBtn: { position: 'absolute', bottom: 24, left: H_PAD, right: H_PAD, backgroundColor: COLORS.accent, height: BTN_HEIGHT, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center' },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.bg },
  cancelBtn: { position: 'absolute', bottom: 24, left: H_PAD, right: H_PAD, height: BTN_HEIGHT, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  cancelBtnText: { fontSize: 16, color: COLORS.textSecondary },
});
