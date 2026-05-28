import React, { useEffect } from 'react';
import { I18nManager, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';

import { FadersScreen } from './src/screens/FadersScreen';
import { KeyboardScreen } from './src/screens/KeyboardScreen';
import { PatchScreen } from './src/screens/PatchScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { RdmScreen } from './src/screens/RdmScreen';
import { useDmxStore } from './src/store/dmxStore';
import { colors } from './src/utils/theme';
import { t } from './src/utils/i18n';

const Tab = createBottomTabNavigator();

if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
}

export default function App() {
  const initFromStorage = useDmxStore((s) => s.initFromStorage);
  const lang = useDmxStore((s) => s.settings.lang);

  useEffect(() => {
    void initFromStorage();
    ScreenOrientation.unlockAsync().catch(() => {});
  }, [initFromStorage]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Faders"
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '600',
            },
          }}
        >
          <Tab.Screen
            name="Faders"
            component={FadersScreen}
            options={{ tabBarLabel: t(lang, 'faders') }}
          />
          <Tab.Screen
            name="Keyboard"
            component={KeyboardScreen}
            options={{ tabBarLabel: t(lang, 'keyboard') }}
          />
          <Tab.Screen
            name="Patch"
            component={PatchScreen}
            options={{ tabBarLabel: t(lang, 'patch') }}
          />
          <Tab.Screen
            name="RDM"
            component={RdmScreen}
            options={{ tabBarLabel: 'RDM' }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ tabBarLabel: t(lang, 'settings') }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
