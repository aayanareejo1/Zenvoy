import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { signInWithGoogle, signOut } from '../services/auth';
import { restoreFromFirestore } from '../services/firestore';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS, BTN_HEIGHT, H_PAD } from '../constants/theme';
import { FREE_MONTHLY_LIMIT } from '../constants/config';

export default function AccountScreen() {
  const { user, isPro, refreshInboxCount } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleGoogleSignIn = async () => {
    try { await signInWithGoogle(); }
    catch (e) { Alert.alert('Sign in failed', e.message); }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Sign out', style: 'destructive', onPress: signOut },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRestore = async () => {
    if (!user) { Alert.alert('Sign in required', 'Please sign in to restore from cloud.'); return; }
    if (!isPro) { Alert.alert('Pro required', 'Cloud backup and restore is available for Pro users.'); return; }

    Alert.alert('Restore from Cloud', 'This will import receipts from your cloud backup. Existing receipts will not be affected.', [
      {
        text: 'Restore', onPress: async () => {
          setRestoring(true);
          try {
            const { imported, skipped, failed } = await restoreFromFirestore(user.uid);
            await refreshInboxCount();
            Alert.alert(
              'Restore complete',
              `Imported: ${imported}\nSkipped (already existed): ${skipped}${failed > 0 ? `\nFailed: ${failed}` : ''}`
            );
          } catch (e) {
            Alert.alert('Restore failed', e.message);
          } finally {
            setRestoring(false);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (!user) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.logo}>Zenvoy</Text>
        <Text style={styles.tagline}>Back up your receipts. Access anywhere.</Text>
        <View style={styles.benefits}>
          {[
            '☁️  Automatic cloud backup',
            '📱  Restore on new device',
            `♾️  Unlimited scans (free: ${FREE_MONTHLY_LIMIT}/month)`,
            '📊  Reports & CSV export',
          ].map(b => (
            <Text key={b} style={styles.benefit}>{b}</Text>
          ))}
        </View>
        <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn}>
          <Text style={styles.googleBtnTxt}>🔑  Sign in with Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.appleBtn} onPress={() => Alert.alert('Coming Soon', 'Apple Sign-In coming soon.')}>
          <Text style={styles.appleBtnTxt}>🍎  Sign in with Apple</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = (user.displayName || user.email || '?')[0].toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <Text style={styles.name}>{user.displayName || 'User'}</Text>
      <Text style={styles.email}>{user.email}</Text>
      {isPro && <View style={styles.proBadge}><Text style={styles.proBadgeTxt}>PRO</Text></View>}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Current Plan</Text>
        <Text style={styles.cardValue}>{isPro ? '✅ Pro — Unlimited scans' : `🆓 Free — ${FREE_MONTHLY_LIMIT} scans/month`}</Text>
      </View>

      {!isPro && (
        <TouchableOpacity style={styles.upgradeBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.upgradeTxt}>Upgrade to Pro</Text>
        </TouchableOpacity>
      )}

      {isPro && (
        <TouchableOpacity
          style={[styles.restoreBtn, restoring && styles.btnDisabled]}
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring
            ? <ActivityIndicator color={COLORS.accent} />
            : <Text style={styles.restoreTxt}>☁️  Restore from Cloud</Text>}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutTxt}>Sign Out</Text>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Upgrade to Pro</Text>
            <Text style={styles.modalDesc}>Unlimited scans, cloud backup, and restore on any device.</Text>
            {[
              { label: 'Monthly',              price: '$9.99/mo',  id: 'monthly' },
              { label: 'Yearly (50% off intro)', price: '$49.99/yr', id: 'yearly' },
            ].map(plan => (
              <TouchableOpacity key={plan.id} style={styles.planBtn} onPress={() => Alert.alert('Coming Soon', 'In-app purchases require RevenueCat setup. See README.')}>
                <Text style={styles.planLabel}>{plan.label}</Text>
                <Text style={styles.planPrice}>{plan.price}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowModal(false)}>
              <Text style={styles.modalCloseTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.bg },
  center:        { justifyContent: 'center', alignItems: 'center', paddingHorizontal: H_PAD },
  scrollContent: { alignItems: 'center', padding: H_PAD, paddingBottom: 60 },
  logo:          { fontSize: 32, fontWeight: '800', color: COLORS.accent, marginBottom: 8 },
  tagline:       { fontSize: 16, color: COLORS.textSecondary, marginBottom: 32, textAlign: 'center' },
  benefits:      { alignSelf: 'stretch', backgroundColor: COLORS.card, borderRadius: RADIUS.card, padding: 20, marginBottom: 32, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  benefit:       { color: COLORS.textPrimary, fontSize: 15 },
  googleBtn:     { backgroundColor: COLORS.accent, height: BTN_HEIGHT, paddingHorizontal: 32, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: 12 },
  googleBtnTxt:  { fontSize: 16, fontWeight: '700', color: COLORS.bg },
  appleBtn:      { backgroundColor: COLORS.card, height: BTN_HEIGHT, paddingHorizontal: 32, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', width: '100%', borderWidth: 1, borderColor: COLORS.border },
  appleBtnTxt:   { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  avatar:        { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 12, marginTop: 20 },
  avatarText:    { fontSize: 28, fontWeight: '700', color: COLORS.bg },
  name:          { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  email:         { fontSize: 14, color: COLORS.textSecondary, marginBottom: 12 },
  proBadge:      { backgroundColor: COLORS.accent, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 24 },
  proBadgeTxt:   { fontSize: 12, fontWeight: '800', color: COLORS.bg, letterSpacing: 1 },
  card:          { alignSelf: 'stretch', backgroundColor: COLORS.card, borderRadius: RADIUS.card, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  cardLabel:     { fontSize: 12, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  cardValue:     { fontSize: 16, color: COLORS.textPrimary, fontWeight: '600' },
  upgradeBtn:    { backgroundColor: COLORS.accent, height: BTN_HEIGHT, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: 12 },
  upgradeTxt:    { fontSize: 16, fontWeight: '700', color: COLORS.bg },
  restoreBtn:    { height: BTN_HEIGHT, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', width: '100%', borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  btnDisabled:   { opacity: 0.5 },
  restoreTxt:    { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },
  signOutBtn:    { height: BTN_HEIGHT, justifyContent: 'center', alignItems: 'center', width: '100%' },
  signOutTxt:    { fontSize: 16, color: COLORS.danger },
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:         { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  modalTitle:    { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' },
  modalDesc:     { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20 },
  planBtn:       { backgroundColor: COLORS.bg, borderRadius: RADIUS.button, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planLabel:     { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  planPrice:     { fontSize: 16, color: COLORS.accent, fontWeight: '700' },
  modalClose:    { height: BTN_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  modalCloseTxt: { color: COLORS.textSecondary, fontSize: 16 },
});
