import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from './src/context/AppContext';
import ScanScreen from './src/screens/ScanScreen';
import ReceiptsScreen from './src/screens/ReceiptsScreen';
import ReceiptDetailScreen from './src/screens/ReceiptDetailScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import AccountScreen from './src/screens/AccountScreen';
import { COLORS } from './src/constants/theme';

const Tab = createBottomTabNavigator();
const ReceiptsStack = createNativeStackNavigator();

function ReceiptsStackNav() {
  return (
    <ReceiptsStack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.bg }, headerTintColor: COLORS.textPrimary }}>
      <ReceiptsStack.Screen name="ReceiptsList" component={ReceiptsScreen} options={{ title: 'Receipts' }} />
      <ReceiptsStack.Screen name="ReceiptDetail" component={ReceiptDetailScreen} options={{ title: 'Detail' }} />
    </ReceiptsStack.Navigator>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: COLORS.bg },
            headerTintColor: COLORS.textPrimary,
            tabBarStyle: { backgroundColor: COLORS.bg, borderTopColor: COLORS.border },
            tabBarActiveTintColor: COLORS.accent,
            tabBarInactiveTintColor: COLORS.textSecondary,
          }}
        >
          <Tab.Screen name="Scan" component={ScanScreen} options={{ tabBarLabel: 'Scan', title: 'ReceiptSnap' }} />
          <Tab.Screen name="Receipts" component={ReceiptsStackNav} options={{ tabBarLabel: 'Receipts', headerShown: false }} />
          <Tab.Screen name="Reports" component={ReportsScreen} options={{ tabBarLabel: 'Reports' }} />
          <Tab.Screen name="Account" component={AccountScreen} options={{ tabBarLabel: 'Account' }} />
        </Tab.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
