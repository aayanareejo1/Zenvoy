import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { COLORS, TYPE, SPACE, H_PAD, RADIUS } from '../constants/theme';

export default function PrivacyScreen({ navigation }) {
  return (
    <SafeAreaView style={s.safe}>
      <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <Text style={s.backTxt}>← Back</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Privacy Policy</Text>
        <Text style={s.meta}>Last updated: [DATE]</Text>

        <Section title="Data Collection">
          <Text style={s.body}>
            [YOUR COMPANY NAME] ("we", "us", or "our") collects the following types of information
            when you use Zenvoy:
            {'\n\n'}
            • Receipt images you capture or upload within the app.
            {'\n'}
            • Extracted receipt data including vendor name, date, total amount, and category.
            {'\n'}
            • Account information (email address) when you create an account.
            {'\n'}
            • Anonymous usage analytics to improve app performance.
          </Text>
        </Section>

        <Section title="How We Use Data">
          <Text style={s.body}>
            We use your data solely to provide and improve the Zenvoy service:
            {'\n\n'}
            • Receipt images are sent to Anthropic's Claude AI for text extraction and are not
            stored on Anthropic's servers beyond the duration of a single API call.
            {'\n'}
            • Extracted receipt data is stored locally on your device and, if you enable cloud
            sync, in your private Firebase account.
            {'\n'}
            • We do not sell, rent, or share your personal data with third parties for marketing
            purposes.
          </Text>
        </Section>

        <Section title="Data Storage">
          <Text style={s.body}>
            • All receipt data is stored locally on your device using SQLite.
            {'\n'}
            • If cloud sync is enabled, data is stored in Google Firebase Firestore under your
            authenticated user account. Only you can access your data.
            {'\n'}
            • You may delete your data at any time from the Account screen.
            {'\n'}
            • Uninstalling the app removes all locally stored data.
          </Text>
        </Section>

        <Section title="Third-Party Services">
          <Text style={s.body}>
            Zenvoy uses the following third-party services:
            {'\n\n'}
            • <Text style={s.bold}>Firebase (Google)</Text> — authentication and optional cloud
            sync. Subject to Google's Privacy Policy.
            {'\n'}
            • <Text style={s.bold}>Anthropic Claude API</Text> — AI receipt parsing. Images are
            processed in real time and not retained. Subject to Anthropic's Privacy Policy.
            {'\n'}
            • <Text style={s.bold}>RevenueCat</Text> — subscription management. Subject to
            RevenueCat's Privacy Policy.
          </Text>
        </Section>

        <Section title="Your Rights">
          <Text style={s.body}>
            You have the right to:
            {'\n\n'}
            • Access the personal data we hold about you.
            {'\n'}
            • Request deletion of your account and associated data.
            {'\n'}
            • Opt out of analytics collection (available in Account settings).
            {'\n'}
            • Export your receipt data at any time via the Export screen.
          </Text>
        </Section>

        <Section title="Contact Us">
          <Text style={s.body}>
            If you have questions about this Privacy Policy or how your data is handled, please
            contact us at:
            {'\n\n'}
            [YOUR COMPANY NAME]{'\n'}
            [EMAIL]{'\n\n'}
            We will respond to all inquiries within 5 business days.
          </Text>
        </Section>

        <View style={s.footer}>
          <Text style={s.footerTxt}>© [DATE] [YOUR COMPANY NAME]. All rights reserved.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.bg,
  },
  backBtn: {
    paddingHorizontal: H_PAD,
    paddingTop:        SPACE.lg,
    paddingBottom:     SPACE.sm,
  },
  backTxt: {
    ...TYPE.callout,
    color: COLORS.accent,
  },
  content: {
    paddingHorizontal: H_PAD,
    paddingBottom:     64,
  },
  title: {
    ...TYPE.h1,
    marginBottom: SPACE.xs,
  },
  meta: {
    ...TYPE.sub,
    marginBottom: SPACE.xxxl,
  },
  section: {
    marginBottom: SPACE.xxl,
  },
  sectionTitle: {
    ...TYPE.h3,
    marginBottom: SPACE.sm,
  },
  body: {
    ...TYPE.body,
    color:      COLORS.textSecondary,
    lineHeight: 24,
  },
  bold: {
    fontWeight: '600',
    color:      COLORS.textPrimary,
  },
  footer: {
    marginTop:    SPACE.xxxl,
    paddingTop:   SPACE.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerTxt: {
    ...TYPE.caption,
    textAlign: 'center',
  },
});
