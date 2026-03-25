import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons }          from '@expo/vector-icons';
import { AppProvider, useApp }       from './src/context/AppContext';
import { ToastProvider }             from './src/context/ToastContext';
import { SyncProvider }              from './src/context/SyncContext';
import { ThemeProvider }             from './src/context/ThemeContext';
import { ErrorProvider }             from './src/context/ErrorContext';
import SyncStatusBadge               from './src/components/SyncStatusBadge';
import OfflineBanner                 from './src/components/OfflineBanner';
import ScanScreen             from './src/screens/ScanScreen';
import ProcessingScreen       from './src/screens/ProcessingScreen';
import ReceiptsScreen         from './src/screens/ReceiptsScreen';
import ReceiptDetailScreen    from './src/screens/ReceiptDetailScreen';
import EditReceiptScreen      from './src/screens/EditReceiptScreen';
import ExportScreen           from './src/screens/ExportScreen';
import InboxScreen            from './src/screens/InboxScreen';
import ReportsScreen          from './src/screens/ReportsScreen';
import AccountScreen          from './src/screens/AccountScreen';
import SyncManagementScreen   from './src/screens/SyncManagementScreen';
import AnalyticsScreen        from './src/screens/AnalyticsScreen';
import SearchScreen           from './src/screens/SearchScreen';
import OnboardingScreen, { ONBOARDING_KEY } from './src/screens/OnboardingScreen';
import { COLORS }          from './src/constants/theme';

const Tab           = createBottomTabNavigator();
const RootStack     = createNativeStackNavigator();
const ScanStack     = createNativeStackNavigator();
const ReceiptsStack = createNativeStackNavigator();
const InboxStack    = createNativeStackNavigator();
const AccountStack  = createNativeStackNavigator();

const stackOptions = {
  headerStyle:            { backgroundColor: COLORS.bgElevated },
  headerTintColor:        COLORS.textPrimary,
  headerShadowVisible:    false,
  headerTitleStyle:       { fontWeight: '700', fontSize: 17 },
};

function ScanStackNav() {
  return (
    <ScanStack.Navigator screenOptions={stackOptions}>
      <ScanStack.Screen name="ScanHome"   component={ScanScreen}      options={{ title: 'Zenvoy' }} />
      <ScanStack.Screen name="Processing" component={ProcessingScreen} options={{ title: 'Processing', headerBackVisible: false }} />
    </ScanStack.Navigator>
  );
}

function ReceiptsStackNav() {
  return (
    <ReceiptsStack.Navigator screenOptions={stackOptions}>
      <ReceiptsStack.Screen name="ReceiptsList"  component={ReceiptsScreen}      options={{ title: 'Receipts' }} />
      <ReceiptsStack.Screen name="ReceiptDetail" component={ReceiptDetailScreen} options={{ title: 'Detail' }} />
      <ReceiptsStack.Screen name="EditReceipt"   component={EditReceiptScreen}   options={{ title: 'Edit Receipt' }} />
      <ReceiptsStack.Screen name="Export"        component={ExportScreen}        options={{ title: 'Export' }} />
    </ReceiptsStack.Navigator>
  );
}

function InboxStackNav() {
  return (
    <InboxStack.Navigator screenOptions={stackOptions}>
      <InboxStack.Screen name="InboxList"   component={InboxScreen}        options={{ title: 'Inbox' }} />
      <InboxStack.Screen name="InboxDetail" component={ReceiptDetailScreen} options={{ title: 'Review' }} />
      <InboxStack.Screen name="EditReceipt" component={EditReceiptScreen}  options={{ title: 'Edit Receipt' }} />
    </InboxStack.Navigator>
  );
}

function AccountStackNav() {
  return (
    <AccountStack.Navigator screenOptions={stackOptions}>
      <AccountStack.Screen
        name="AccountHome"
        component={AccountScreen}
        options={{ title: 'Account', headerRight: () => <SyncStatusBadge /> }}
      />
      <AccountStack.Screen name="SyncManagement" component={SyncManagementScreen} options={{ title: 'Sync Issues' }} />
    </AccountStack.Navigator>
  );
}

function Tabs() {
  const { inboxCount } = useApp();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle:            { backgroundColor: COLORS.bgElevated },
        headerTintColor:        COLORS.textPrimary,
        headerShadowVisible:    false,
        headerTitleStyle:       { fontWeight: '700', fontSize: 17 },
        tabBarStyle: {
          backgroundColor:  COLORS.bgElevated,
          borderTopColor:   COLORS.border,
          borderTopWidth:   StyleSheet.hairlineWidth,
          height:           60,
          paddingBottom:    8,
        },
        tabBarActiveTintColor:   COLORS.accent,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarLabelStyle:        { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Scan:      'scan-outline',
            Inbox:     'mail-outline',
            Receipts:  'receipt-outline',
            Search:    'search-outline',
            Analytics: 'bar-chart-outline',
            Account:   'person-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Scan"      component={ScanStackNav}     options={{ headerShown: false, tabBarLabel: 'Scan' }} />
      <Tab.Screen name="Inbox"     component={InboxStackNav}    options={{ headerShown: false, tabBarLabel: 'Inbox', tabBarBadge: inboxCount > 0 ? inboxCount : undefined }} />
      <Tab.Screen name="Receipts"  component={ReceiptsStackNav} options={{ headerShown: false, tabBarLabel: 'Receipts' }} />
      <Tab.Screen name="Search"    component={SearchScreen}     options={{ headerShown: false, tabBarLabel: 'Search' }} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen}  options={{ tabBarLabel: 'Analytics', title: 'Analytics' }} />
      <Tab.Screen name="Account"   component={AccountStackNav}  options={{ headerShown: false, tabBarLabel: 'Account' }} />
    </Tab.Navigator>
  );
}

function MainNav() {
  const [onboardingDone, setOnboardingDone] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setOnboardingDone(val === 'true');
    });
  }, []);

  if (onboardingDone === null) return null;

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {!onboardingDone && (
        <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
      )}
      <RootStack.Screen name="Main" component={Tabs} />
    </RootStack.Navigator>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <ToastProvider>
          <ErrorProvider>
            <SyncProvider>
              <NavigationContainer>
                <StatusBar style="light" />
                <View style={{ flex: 1 }}>
                  <MainNav />
                  <OfflineBanner />
                </View>
              </NavigationContainer>
            </SyncProvider>
          </ErrorProvider>
        </ToastProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
