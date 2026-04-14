import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { havenNavigationTheme } from '../theme/navigationTheme';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from './types';
import { UserRole } from '../types';

// Screens
import LoginScreen from '../screens/LoginScreen';
import CarerTabs from './CarerTabs';
import ManagerTabs from './ManagerTabs';
import AdminTabs from './AdminTabs';
import VisitDetailScreen from '../screens/carer/VisitDetailScreen';
import ChecklistScreen from '../screens/carer/ChecklistScreen';
import NotesScreen from '../screens/carer/NotesScreen';
import SchedulesScreen from '../screens/admin/SchedulesScreen';
import VisitsScreen from '../screens/admin/VisitsScreen';
import ChecklistsScreen from '../screens/admin/ChecklistsScreen';
import CarersScreen from '../screens/admin/CarersScreen';
import DashboardScreen from '../screens/admin/DashboardScreen';
import StaffOpenShiftsScreen from '../screens/staff/StaffOpenShiftsScreen';
import OpenShiftDetailScreen from '../screens/staff/OpenShiftDetailScreen';
import OpenShiftNewScreen from '../screens/staff/OpenShiftNewScreen';
import { colors } from '../theme/colors';

const Stack = createStackNavigator<RootStackParamList>();

const LoadingScreen: React.FC = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);

const openShiftStackScreens = (
  <>
    <Stack.Screen
      name="OpenShiftDetail"
      component={OpenShiftDetailScreen}
      options={{ headerShown: true, title: 'Open shift' }}
    />
    <Stack.Screen
      name="OpenShiftNew"
      component={OpenShiftNewScreen}
      options={{ headerShown: true, title: 'Post open shift' }}
    />
  </>
);

const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer theme={havenNavigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            {(user.role === UserRole.CARER || user.role === UserRole.GUARDIAN) && (
              <>
                <Stack.Screen name="CarerTabs" component={CarerTabs} />
                <Stack.Screen name="VisitDetail" component={VisitDetailScreen} />
                <Stack.Screen name="Checklist" component={ChecklistScreen} />
                <Stack.Screen name="Notes" component={NotesScreen} />
              </>
            )}
            {user.role === UserRole.MANAGER && (
              <>
                <Stack.Screen name="ManagerTabs" component={ManagerTabs} />
                <Stack.Screen name="VisitDetail" component={VisitDetailScreen} />
                <Stack.Screen name="Schedules" component={SchedulesScreen} />
                <Stack.Screen name="Visits" component={VisitsScreen} />
                <Stack.Screen name="Checklists" component={ChecklistsScreen} />
                <Stack.Screen name="Carers" component={CarersScreen} />
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
                {openShiftStackScreens}
              </>
            )}
            {user.role === UserRole.ADMIN && (
              <>
                <Stack.Screen name="AdminTabs" component={AdminTabs} />
                <Stack.Screen name="VisitDetail" component={VisitDetailScreen} />
                <Stack.Screen name="Schedules" component={SchedulesScreen} />
                <Stack.Screen name="Visits" component={VisitsScreen} />
                <Stack.Screen name="Checklists" component={ChecklistsScreen} />
                <Stack.Screen name="Carers" component={CarersScreen} />
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
                {openShiftStackScreens}
              </>
            )}
            {!Object.values(UserRole).includes(user.role as UserRole) && (
              <Stack.Screen name="Login" component={LoginScreen} />
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});

