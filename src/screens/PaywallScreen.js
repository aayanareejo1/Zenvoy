import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useIAP } from 'react-native-iap';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { IAP_PRODUCTS, FREE_MONTHLY_LIMIT } from '../constants/config';
import { COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE } from '../constants/theme';
import { setProStatus } from '../services/firestore';

const BENEFITS = [
  { icon: '♾️', text: 'Unlimited receipt scans' },
  { icon: '☁️', text: 'Cloud backup & sync' },
  { icon: '📱', text: 'Restore on any device' },
  { icon: '⭐', text: 'Priority support' },
];

const SUBSCRIPTION_SKUS = new Set(Object.values(IAP_PRODUCTS));

export default function PaywallScreen({ navigation, route }) {
  const { onSuccess } = route.params ?? {};
  const { user, setIsPro } = useApp();
  const { showToast } = useToast();

  const {
    connected,
    currentPurchase,
    currentPurchaseError,
    finishTransaction,
    requestPurchase,
    fetchProducts,
    getAvailablePurchases,
  } = useIAP();

  const [purchasing, setPurchasing] = useState(false);
  const [productMap, setProductMap]  = useState({});

  // Fetch live prices once connected
  useEffect(() => {
    if (!connected) return;
    fetchProducts({ skus: [IAP_PRODUCTS.monthly, IAP_PRODUCTS.yearly], type: 'subs' })
      .then((prods) => {
        if (!prods) return;
        const map = {};
        prods.forEach((p) => { map[p.productId] = p.localizedPrice; });
        setProductMap(map);
      })
      .catch((err) => console.log('fetchProducts error:', err));
  }, [connected]);

  // Handle successful purchase
  useEffect(() => {
    if (!currentPurchase) return;
    const complete = async () => {
      try {
        await finishTransaction({ purchase: currentPurchase, isConsumable: false });
        if (user) {
          await setProStatus(user.uid, true, currentPurchase.transactionDate);
        }
        setIsPro(true);
        showToast({ message: 'Welcome to Pro!', type: 'success' });
        onSuccess?.();
        navigation.goBack();
      } catch (e) {
        showToast({ message: e.message || 'Could not complete purchase', type: 'error' });
      } finally {
        setPurchasing(false);
      }
    };
    complete();
  }, [currentPurchase]);

  // Handle purchase error
  useEffect(() => {
    if (!currentPurchaseError) return;
    showToast({ message: currentPurchaseError.message, type: 'error' });
    setPurchasing(false);
  }, [currentPurchaseError]);

  const handlePurchase = async (productId) => {
    if (!user) {
      showToast({ message: 'Sign in to upgrade to Pro.', type: 'info' });
      return;
    }
    setPurchasing(true);
    try {
      await requestPurchase({ sku: productId, type: 'subs' });
    } catch (e) {
      // Immediate errors (e.g. user cancelled) — async errors come via currentPurchaseError
      showToast({ message: e.message || 'Purchase cancelled', type: 'error' });
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!user) {
      showToast({ message: 'Sign in to restore purchases.', type: 'info' });
      return;
    }
    setPurchasing(true);
    try {
      const purchases = await getAvailablePurchases();
      const active = (purchases || []).find((p) => SUBSCRIPTION_SKUS.has(p.productId));
      if (active) {
        await setProStatus(user.uid, true, active.transactionDate);
        setIsPro(true);
        showToast({ message: 'Pro status restored!', type: 'success' });
        onSuccess?.();
        navigation.goBack();
      } else {
        showToast({ message: 'No active subscription found.', type: 'info' });
      }
    } catch (e) {
      showToast({ message: e.message || 'Restore failed', type: 'error' });
    } finally {
      setPurchasing(false);
    }
  };

  const getPrice = (sku, fallback) => productMap[sku] ?? fallback;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.headerSection}>
          <View style={s.badge}>
            <Text style={s.badgeTxt}>PRO</Text>
          </View>
          <Text style={s.title}>Upgrade to Pro</Text>
          <Text style={s.subtitle}>
            Free accounts get {FREE_MONTHLY_LIMIT} scans per month.{'\n'}
            Go Pro for unlimited access.
          </Text>
        </View>

        {/* Benefits */}
        <View style={s.benefitsCard}>
          {BENEFITS.map(({ icon, text }) => (
            <View key={text} style={s.benefitRow}>
              <Text style={s.benefitIcon}>{icon}</Text>
              <Text style={s.benefitText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Purchase buttons */}
        <View style={s.plansSection}>
          <View style={s.glowWrap}>
            <TouchableOpacity
              style={[s.planBtn, s.planBtnPrimary]}
              onPress={() => handlePurchase(IAP_PRODUCTS.yearly)}
              activeOpacity={0.9}
              disabled={purchasing}
            >
              {purchasing ? (
                <ActivityIndicator color={COLORS.bg} />
              ) : (
                <>
                  <View>
                    <Text style={s.planBtnLabel}>Yearly — Best Value</Text>
                    <Text style={s.planBtnPrice}>
                      {getPrice(IAP_PRODUCTS.yearly, '$49.99')} / year · save 58%
                    </Text>
                  </View>
                  <View style={s.savingsBadge}>
                    <Text style={s.savingsBadgeTxt}>SAVE 58%</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.planBtn, s.planBtnSecondary]}
            onPress={() => handlePurchase(IAP_PRODUCTS.monthly)}
            activeOpacity={0.85}
            disabled={purchasing}
          >
            <Text style={s.planBtnLabelSecondary}>Monthly</Text>
            <Text style={s.planBtnPriceSecondary}>
              {getPrice(IAP_PRODUCTS.monthly, '$9.99')} / month
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer links */}
        <TouchableOpacity
          style={s.restoreBtn}
          onPress={handleRestore}
          activeOpacity={0.7}
          disabled={purchasing}
        >
          <Text style={[s.restoreTxt, purchasing && s.linkDisabled]}>Restore Purchases</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.dismissBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          disabled={purchasing}
        >
          <Text style={[s.dismissTxt, purchasing && s.linkDisabled]}>Maybe later</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.bg,
  },
  scroll: { flex: 1 },
  content: {
    alignItems:      'center',
    paddingHorizontal: H_PAD,
    paddingTop:      SPACE.xxxl,
    paddingBottom:   48,
  },

  // Header
  headerSection: {
    alignItems:    'center',
    marginBottom:  SPACE.xxxl,
    gap:           SPACE.md,
  },
  badge: {
    backgroundColor: COLORS.accentMuted,
    paddingHorizontal: 14,
    paddingVertical:   5,
    borderRadius:    RADIUS.pill,
    borderWidth:     1,
    borderColor:     COLORS.accent + '50',
    marginBottom:    SPACE.xs,
  },
  badgeTxt: {
    fontSize:   11,
    fontWeight: '800',
    color:      COLORS.accent,
    letterSpacing: 1.5,
  },
  title: {
    fontSize:      28,
    fontWeight:    '800',
    color:         COLORS.textPrimary,
    letterSpacing: -0.5,
    textAlign:     'center',
  },
  subtitle: {
    fontSize:   15,
    color:      COLORS.textSecondary,
    textAlign:  'center',
    lineHeight: 22,
  },

  // Benefits
  benefitsCard: {
    alignSelf:       'stretch',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.lg,
    marginBottom:    SPACE.xl,
    gap:             SPACE.md,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
  },
  benefitRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  benefitIcon: { fontSize: 20, width: 30, textAlign: 'center' },
  benefitText: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500', flex: 1 },

  // Plans
  plansSection: { alignSelf: 'stretch', gap: SPACE.sm, marginBottom: SPACE.lg },
  glowWrap: {
    borderRadius: RADIUS.button,
    ...ELEVATION.glow,
  },
  planBtn: {
    height:          BTN_HEIGHT + 8,
    borderRadius:    RADIUS.button,
    paddingHorizontal: SPACE.lg,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
  },
  planBtnPrimary: {
    backgroundColor: COLORS.accent,
  },
  planBtnSecondary: {
    backgroundColor: COLORS.card,
    borderWidth:     1,
    borderColor:     COLORS.border,
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    height:          BTN_HEIGHT,
  },
  planBtnLabel: {
    fontSize:   16,
    fontWeight: '700',
    color:      COLORS.bg,
  },
  planBtnPrice: {
    fontSize:   13,
    color:      COLORS.bg + 'CC',
    fontWeight: '500',
    marginTop:  2,
  },
  savingsBadge: {
    backgroundColor: COLORS.bg + '30',
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:    RADIUS.pill,
  },
  savingsBadgeTxt: {
    fontSize:   10,
    fontWeight: '800',
    color:      COLORS.bg,
    letterSpacing: 0.5,
  },
  planBtnLabelSecondary: {
    fontSize:   15,
    fontWeight: '600',
    color:      COLORS.textPrimary,
  },
  planBtnPriceSecondary: {
    fontSize:   13,
    color:      COLORS.accent,
    fontWeight: '500',
    marginTop:  2,
  },

  // Footer
  restoreBtn: {
    marginBottom:    SPACE.sm,
    paddingVertical: SPACE.sm,
  },
  restoreTxt: {
    fontSize:   14,
    color:      COLORS.textSecondary,
    fontWeight: '500',
    textAlign:  'center',
  },
  dismissBtn: {
    paddingVertical: SPACE.sm,
  },
  dismissTxt: {
    fontSize:  14,
    color:     COLORS.textTertiary,
    textAlign: 'center',
  },
  linkDisabled: { opacity: 0.4 },
});
