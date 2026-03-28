/**
 * PaywallScreen — renders the RevenueCat remote paywall.
 *
 * The paywall template, copy, and pricing are fully configurable in the
 * RevenueCat dashboard without a code change or app update.
 *
 * Entitlement: "Zenvoy Pro"
 * Offerings:   monthly | yearly  (configured in RC dashboard)
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useToast } from '../context/ToastContext';
import { COLORS, SPACE, RADIUS, BTN_HEIGHT, H_PAD } from '../constants/theme';

export default function PaywallScreen({ navigation, route }) {
  const { onSuccess } = route.params ?? {};
  const { showToast } = useToast();

  // Called when the user taps "X" or swipes to dismiss without purchasing.
  const handleDismiss = () => navigation.goBack();

  // Called after a successful purchase or restore.
  const handlePurchaseCompleted = ({ customerInfo }) => {
    showToast({ message: 'Welcome to Zenvoy Pro!', type: 'success' });
    onSuccess?.();
    navigation.goBack();
  };

  const handleRestoreCompleted = ({ customerInfo }) => {
    showToast({ message: 'Pro status restored!', type: 'success' });
    onSuccess?.();
    navigation.goBack();
  };

  const handlePurchaseError = (error) => {
    // User-cancelled is not an error worth toasting.
    if (error?.userCancelled) return;
    showToast({ message: error?.message ?? 'Purchase failed. Try again.', type: 'error' });
  };

  const handleRestoreError = (error) => {
    showToast({ message: error?.message ?? 'Restore failed. Try again.', type: 'error' });
  };

  return (
    <View style={s.root}>
      {/*
        The <Paywall> component renders the template you configured in the
        RevenueCat dashboard for your default Offering. Swap it to
        presentPaywall() if you prefer an imperative / full-screen native modal.
      */}
      <RevenueCatUI.Paywall
        onDismiss={handleDismiss}
        onPurchaseCompleted={handlePurchaseCompleted}
        onPurchaseCancelled={handleDismiss}
        onRestoreCompleted={handleRestoreCompleted}
        onPurchaseError={handlePurchaseError}
        onRestoreError={handleRestoreError}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
});
