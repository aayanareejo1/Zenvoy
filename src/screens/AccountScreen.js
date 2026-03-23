import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { signInWithGoogle, signOut } from '../services/auth';
import { restoreFromFirestore } from '../services/firestore';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import Dialog from '../components/Dialog';
import Sheet, { SheetOption } from '../components/Sheet';
import { COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE } from '../constants/theme';
import { FREE_MONTHLY_LIMIT } from '../constants/config';

export default function AccountScreen() {
  const { user, isPro, refreshInboxCount } = useApp();
  const { showToast }                      = useToast();

  const [upgradeSheet, setUpgradeSheet]   = useState(false);
  const [signOutDialog, setSignOutDialog] = useState(false);
  const [restoreDialog, setRestoreDialog] = useState(false);
  const [restoring, setRestoring]         = useState(false);

  const handleGoogleSignIn = async () => {
    try { await signInWithGoogle(); }
    catch (e) { showToast({ message: e.message, type: 'error' }); }
  };

  const confirmSignOut = async () => {
    setSignOutDialog(false);
    await signOut();
  };

  const confirmRestore = async () => {
    setRestoreDialog(false);
    if (!user) { showToast({ message: 'Sign in to restore from cloud.', type: 'info' }); return; }
    if (!isPro) { showToast({ message: 'Cloud restore is a Pro feature.', type: 'info' }); return; }
    setRestoring(true);
    try {
      const { imported, skipped, failed } = await restoreFromFirestore(user.uid);
      await refreshInboxCount();
      showToast({
        message: `Restored ${imported} receipt${imported !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} skipped` : ''}`,
        type: 'success',
      });
    } catch (e) {
      showToast({ message: e.message, type: 'error' });
    } finally {
      setRestoring(false);
    }
  };

  // ── Not signed in ──────────────────────────────────────────────────────────

  if (!user) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.logoSection}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>Z</Text>
          </View>
          <Text style={styles.logo}>Zenvoy</Text>
          <Text style={styles.tagline}>Back up your receipts.{'\n'}Access anywhere.</Text>
        </View>

        <View style={styles.benefitsCard}>
          {[
            ['☁️', 'Automatic cloud backup'],
            ['📱', 'Restore on any device'],
            [`♾`, `Unlimited scans (free: ${FREE_MONTHLY_LIMIT}/month)`],
            ['📊', 'Reports & CSV export'],
          ].map(([icon, text]) => (
            <View key={text} style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>{icon}</Text>
              <Text style={styles.benefitText}>{text}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.glowWrap, { width: '100%' }]}>
          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn} activeOpacity={0.9}>
            <Text style={styles.googleBtnTxt}>Sign in with Google</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.appleBtn}
          onPress={() => showToast({ message: 'Apple Sign-In coming soon', type: 'info' })}
          activeOpacity={0.75}
        >
          <Text style={styles.appleBtnTxt}>🍎  Sign in with Apple</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Signed in ──────────────────────────────────────────────────────────────

  const initials = (user.displayName || user.email || '?')[0].toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>

      {/* Dialogs */}
      <Dialog
        visible={signOutDialog}
        title="Sign out?"
        message="You can sign back in anytime."
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmSignOut}
        onCancel={() => setSignOutDialog(false)}
      />
      <Dialog
        visible={restoreDialog}
        title="Restore from Cloud"
        message="This will import receipts from your cloud backup. Existing receipts are not affected."
        confirmLabel="Restore"
        cancelLabel="Cancel"
        onConfirm={confirmRestore}
        onCancel={() => setRestoreDialog(false)}
      />

      {/* Upgrade Sheet */}
      <Sheet visible={upgradeSheet} onClose={() => setUpgradeSheet(false)} title="Upgrade to Pro">
        <Text style={sheet.desc}>
          Unlimited scans, cloud backup, and restore on any device.
        </Text>

        {[
          { label: 'Monthly', price: '$9.99 / month', id: 'monthly' },
          { label: 'Yearly',  price: '$49.99 / year · 50% off', id: 'yearly'  },
        ].map(plan => (
          <TouchableOpacity
            key={plan.id}
            style={sheet.planRow}
            onPress={() => showToast({ message: 'In-app purchases coming soon', type: 'info' })}
            activeOpacity={0.75}
          >
            <View>
              <Text style={sheet.planLabel}>{plan.label}</Text>
              <Text style={sheet.planPrice}>{plan.price}</Text>
            </View>
            <Text style={sheet.planChevron}>›</Text>
          </TouchableOpacity>
        ))}

        <View style={sheet.glowWrap}>
          <TouchableOpacity
            style={sheet.ctaBtn}
            onPress={() => showToast({ message: 'In-app purchases coming soon', type: 'info' })}
            activeOpacity={0.9}
          >
            <Text style={sheet.ctaTxt}>Get Pro</Text>
          </TouchableOpacity>
        </View>
      </Sheet>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user.displayName || 'User'}</Text>
        <Text style={styles.email}>{user.email}</Text>
        {isPro && (
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeTxt}>PRO</Text>
          </View>
        )}
      </View>

      {/* Plan card */}
      <View style={styles.infoCard}>
        <Text style={styles.cardLabel}>Current Plan</Text>
        <Text style={styles.cardValue}>
          {isPro ? '✓ Pro — Unlimited scans' : `Free — ${FREE_MONTHLY_LIMIT} scans / month`}
        </Text>
      </View>

      {/* Upgrade CTA */}
      {!isPro && (
        <View style={styles.glowWrap}>
          <TouchableOpacity style={styles.upgradeBtn} onPress={() => setUpgradeSheet(true)} activeOpacity={0.9}>
            <Text style={styles.upgradeTxt}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Restore */}
      {isPro && (
        <TouchableOpacity
          style={[styles.secondaryBtn, restoring && styles.btnDisabled]}
          onPress={() => setRestoreDialog(true)}
          disabled={restoring}
          activeOpacity={0.75}
        >
          {restoring
            ? <ActivityIndicator color={COLORS.accent} size="small" />
            : <Text style={styles.secondaryBtnTxt}>☁️  Restore from Cloud</Text>}
        </TouchableOpacity>
      )}

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={() => setSignOutDialog(true)} activeOpacity={0.75}>
        <Text style={styles.signOutTxt}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.bg },
  center:        { justifyContent: 'center', alignItems: 'center', paddingHorizontal: H_PAD },
  scrollContent: { alignItems: 'center', padding: H_PAD, paddingBottom: 64 },

  // ── Signed-out hero
  logoSection: { alignItems: 'center', marginBottom: SPACE.xxxl, gap: SPACE.sm },
  logoMark: {
    width:           56,
    height:          56,
    borderRadius:    RADIUS.xl,
    backgroundColor: COLORS.accentMuted,
    borderWidth:     1,
    borderColor:     COLORS.accent + '50',
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    SPACE.sm,
  },
  logoMarkText: { fontSize: 26, fontWeight: '800', color: COLORS.accent },
  logo:         { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  tagline:      { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },

  benefitsCard: {
    alignSelf:       'stretch',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.lg,
    marginBottom:    SPACE.xxxl,
    gap:             SPACE.md,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
  },
  benefitRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  benefitIcon:  { fontSize: 18, width: 28, textAlign: 'center' },
  benefitText:  { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500', flex: 1 },

  glowWrap: {
    width:        '100%',
    borderRadius: RADIUS.button,
    marginBottom: SPACE.sm,
    ...ELEVATION.glow,
  },
  googleBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
  },
  googleBtnTxt: { fontSize: 16, fontWeight: '700', color: COLORS.bg },

  appleBtn: {
    backgroundColor: COLORS.card,
    height:          BTN_HEIGHT,
    paddingHorizontal: SPACE.xxxl,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    width:           '100%',
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  appleBtnTxt: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },

  // ── Signed-in
  avatarSection: { alignItems: 'center', marginTop: SPACE.xxl, marginBottom: SPACE.xl, gap: SPACE.sm },
  avatar: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: COLORS.accentMuted,
    borderWidth:     2,
    borderColor:     COLORS.accent + '50',
    justifyContent:  'center',
    alignItems:      'center',
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: COLORS.accent },
  name:       { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.3 },
  email:      { fontSize: 14, color: COLORS.textSecondary },

  proBadge: {
    backgroundColor: COLORS.accentMuted,
    paddingHorizontal: 12,
    paddingVertical:   4,
    borderRadius:    RADIUS.pill,
    borderWidth:     1,
    borderColor:     COLORS.accent + '50',
  },
  proBadgeTxt: { fontSize: 11, fontWeight: '800', color: COLORS.accent, letterSpacing: 1 },

  infoCard: {
    alignSelf:       'stretch',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.lg,
    marginBottom:    SPACE.lg,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
  },
  cardLabel: {
    fontSize:        11,
    color:           COLORS.textSecondary,
    fontWeight:      '600',
    textTransform:   'uppercase',
    letterSpacing:   0.6,
    marginBottom:    SPACE.xs,
  },
  cardValue: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '600' },

  upgradeBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
  },
  upgradeTxt: { fontSize: 16, fontWeight: '700', color: COLORS.bg },

  secondaryBtn: {
    alignSelf:       'stretch',
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     COLORS.border,
    backgroundColor: COLORS.cardAlt,
    marginBottom:    SPACE.sm,
  },
  btnDisabled:      { opacity: 0.5 },
  secondaryBtnTxt:  { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },

  signOutBtn: {
    alignSelf:       'stretch',
    height:          BTN_HEIGHT,
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:       SPACE.xs,
  },
  signOutTxt: { fontSize: 15, color: COLORS.danger, fontWeight: '500' },
});

const sheet = StyleSheet.create({
  desc: {
    fontSize:   14,
    color:      COLORS.textSecondary,
    textAlign:  'center',
    lineHeight: 20,
    marginBottom: SPACE.lg,
  },
  planRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: COLORS.cardAlt,
    borderRadius:    RADIUS.md,
    padding:         SPACE.lg,
    marginBottom:    SPACE.sm,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  planLabel: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  planPrice: { fontSize: 13, color: COLORS.accent, fontWeight: '500' },
  planChevron: { fontSize: 22, color: COLORS.textTertiary },
  glowWrap: {
    width:        '100%',
    borderRadius: RADIUS.button,
    marginTop:    SPACE.sm,
    ...ELEVATION.glow,
  },
  ctaBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
  },
  ctaTxt: { fontSize: 16, fontWeight: '700', color: COLORS.bg },
});
