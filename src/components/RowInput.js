import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, SPACE } from '../constants/theme';

// ─── RowInput ──────────────────────────────────────────────────────────────────
// Grouped-style input row used inside a card surface.
// Pass `last` on the final row to suppress the bottom divider.
//
// Usage (inside a <View style={card}>):
//   <RowInput label="Vendor" value={v} onChange={setV} warn={!v} />
//   <RowInput label="Total"  value={t} onChange={setT} warn={!t} prefix="$" keyboardType="decimal-pad" last />

export default function RowInput({ label, value, onChange, warn, prefix, keyboardType, last }) {
  return (
    <>
      <View style={[s.row, warn && s.rowWarn]}>
        {warn ? <View style={s.warnBar} /> : null}
        <View style={s.inner}>
          <Text style={s.label}>{label}</Text>
          <View style={s.inputRow}>
            {prefix ? <Text style={s.prefix}>{prefix}</Text> : null}
            <TextInput
              style={s.input}
              value={value}
              onChangeText={onChange}
              keyboardType={keyboardType || 'default'}
              placeholderTextColor={COLORS.textTertiary}
              placeholder="—"
              selectionColor={COLORS.accent}
              autoCorrect={false}
            />
          </View>
        </View>
      </View>
      {!last && <View style={s.divider} />}
    </>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection:    'row',
    alignItems:       'stretch',
    overflow:         'hidden',
  },
  rowWarn: {},

  // Amber left bar for missing fields
  warnBar: {
    width:           3,
    backgroundColor: COLORS.warning,
  },

  inner: {
    flex:              1,
    paddingVertical:   14,
    paddingHorizontal: SPACE.lg,
  },

  label: {
    fontSize:      11,
    fontWeight:    '600',
    color:         COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom:  5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  prefix: {
    fontSize:   17,
    fontWeight: '500',
    color:      COLORS.textSecondary,
    lineHeight: 22,
  },
  input: {
    flex:       1,
    fontSize:   17,
    fontWeight: '500',
    color:      COLORS.textPrimary,
    padding:    0,
    margin:     0,
    lineHeight: 22,
  },

  divider: {
    height:           StyleSheet.hairlineWidth,
    backgroundColor:  COLORS.border,
    marginHorizontal: SPACE.lg,
  },
});
