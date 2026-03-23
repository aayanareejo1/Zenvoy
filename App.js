import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AppProvider, useApp } from './src/context/AppContext';
import { ToastProvider }       from './src/context/ToastContext';
import ScanScreen         from './src/screens/ScanScreen';
import ProcessingScreen   from './src/screens/ProcessingScreen';
import ReceiptsScreen     from './src/screens/ReceiptsScreen';
import ReceiptDetailScreen from './src/screens/ReceiptDetailScreen';
import InboxScreen        from './src/screens/InboxScreen';
import ReportsScreen      from './src/screens/ReportsScreen';
import AccountScreen      from './src/screens/AccountScreen';
import { COLORS }         from './src/constants/theme';

const Tab         = createBottomTabNavigator();
const ScanStack   = createNativeStackNavigator();
const ReceiptsStack = createNativeStackNavigator();
const InboxStack  = createNativeStackNavigator();

const stackOptions = {
  headerStyle:     { backgroundColor: COLORS.bg },
  headerTintColor: COLORS.textPrimary,
};

function ScanStackNav() {
  return (
    <ScanStack.Navigator screenOptions={stackOptions}>
      <ScanStack.Screen name="ScanHome"   component={ScanScreen}       options={{ title: 'Zenvoy' }} />
      <ScanStack.Screen name="Processing" component={ProcessingScreen}  options={{ title: 'Processing', headerBackVisible: false }} />
    </ScanStack.Navigator>
  );
}

function ReceiptsStackNav() {
  return (
    <ReceiptsStack.Navigator screenOptions={stackOptions}>
      <ReceiptsStack.Screen name="ReceiptsList"  component={ReceiptsScreen}       options={{ title: 'Receipts' }} />
      <ReceiptsStack.Screen name="ReceiptDetail" component={ReceiptDetailScreen}  options={{ title: 'Detail' }} />
    </ReceiptsStack.Navigator>
  );
}

function InboxStackNav() {
  return (
    <InboxStack.Navigator screenOptions={stackOptions}>
      <InboxStack.Screen name="InboxList"   component={InboxScreen}         options={{ title: 'Inbox' }} />
      <InboxStack.Screen name="InboxDetail" component={ReceiptDetailScreen} options={{ title: 'Review' }} />
    </InboxStack.Navigator>
  );
}

function Tabs() {
  const { inboxCount } = useApp();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle:           { backgroundColor: COLORS.bg },
        headerTintColor:       COLORS.textPrimary,
        tabBarStyle:           { backgroundColor: COLORS.bg, borderTopColor: COLORS.border },
        tabBarActiveTintColor:   COLORS.accent,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Scan:     'scan-outline',
            Inbox:    'mail-outline',
            Receipts: 'receipt-outline',
            Reports:  'bar-chart-outline',
            Account:  'person-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Scan"     component={ScanStackNav}    options={{ headerShown: false, tabBarLabel: 'Scan' }} />
      <Tab.Screen name="Inbox"    component={InboxStackNav}   options={{ headerShown: false, tabBarLabel: 'Inbox', tabBarBadge: inboxCount > 0 ? inboxCount : undefined }} />
      <Tab.Screen name="Receipts" component={ReceiptsStackNav} options={{ headerShown: false, tabBarLabel: 'Receipts' }} />
      <Tab.Screen name="Reports"  component={ReportsScreen}   options={{ tabBarLabel: 'Reports' }} />
      <Tab.Screen name="Account"  component={AccountScreen}   options={{ tabBarLabel: 'Account' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <Tabs />
        </NavigationContainer>
      </ToastProvider>
    </AppProvider>
  );
}
