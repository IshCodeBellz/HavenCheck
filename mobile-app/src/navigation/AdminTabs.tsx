import React, { useState, useRef, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import DashboardScreen from '../screens/admin/DashboardScreen';
import ClientsScreen from '../screens/admin/ClientsScreen';
import CarersScreen from '../screens/admin/CarersScreen';
import SchedulesScreen from '../screens/admin/SchedulesScreen';
import VisitsScreen from '../screens/admin/VisitsScreen';
import ChecklistsScreen from '../screens/admin/ChecklistsScreen';
import AdminAvailabilityScreen from '../screens/admin/AdminAvailabilityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StaffOpenShiftsScreen from '../screens/staff/StaffOpenShiftsScreen';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();
const DRAWER_WIDTH = Dimensions.get('window').width * 0.85;

const AdminTabs: React.FC = () => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (drawerVisible) {
      // Show modal first, then animate in
      setModalVisible(true);
      // Reset to off-screen before animating in
      slideAnim.setValue(-DRAWER_WIDTH);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out drawer and backdrop together
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -DRAWER_WIDTH,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Hide modal after animation completes
        setModalVisible(false);
      });
    }
  }, [drawerVisible]);

  const CustomDrawer = () => {
    const navigation = useNavigation();
    
    return (
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={() => setDrawerVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Animated.View
            style={[
              styles.modalOverlay,
              {
                opacity: backdropOpacity,
              },
            ]}
          >
            <Pressable 
              style={StyleSheet.absoluteFill}
              onPress={() => setDrawerVisible(false)}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.drawerContainer,
              {
                transform: [{ translateX: slideAnim }],
                paddingTop: insets.top,
              },
            ]}
          >
            <View style={styles.drawerHeader}>
              <View style={styles.profileCircle}>
                <Text style={styles.profileInitial}>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <Text style={styles.drawerName}>{user?.name || 'User'}</Text>
              <Text style={styles.drawerEmail}>{user?.email || ''}</Text>
            </View>
            
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setDrawerVisible(false);
                (navigation as any).navigate('AdminTabs', { screen: 'OpenShifts' });
              }}
            >
              <Text style={styles.drawerItemText}>Open shifts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setDrawerVisible(false);
                (navigation as any).navigate('AdminTabs', { screen: 'Schedules' });
              }}
            >
              <Text style={styles.drawerItemText}>Schedules</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setDrawerVisible(false);
                (navigation as any).navigate('AdminTabs', { screen: 'Visits' });
              }}
            >
              <Text style={styles.drawerItemText}>Visits</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setDrawerVisible(false);
                (navigation as any).navigate('AdminTabs', { screen: 'Checklists' });
              }}
            >
              <Text style={styles.drawerItemText}>Checklists</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setDrawerVisible(false);
                (navigation as any).navigate('AdminTabs', { screen: 'Availability' });
              }}
            >
              <Text style={styles.drawerItemText}>Availability</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setDrawerVisible(false);
                (navigation as any).navigate('AdminTabs', { screen: 'Profile' });
              }}
            >
              <Text style={styles.drawerItemText}>Profile</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
            ...(Platform.OS === 'android' ? { elevation: 2 } : {}),
          },
          headerTitleStyle: { color: colors.foreground, fontWeight: '600', fontSize: 17 },
          headerTintColor: colors.primary,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setDrawerVisible(true)}
              style={styles.headerButton}
            >
              <View style={styles.headerProfileCircle}>
                <Text style={styles.headerProfileInitial}>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            </TouchableOpacity>
          ),
        }}
      >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen
        name="Clients"
        component={ClientsScreen}
        options={{ title: 'Clients' }}
      />
      <Tab.Screen
        name="Carers"
        component={CarersScreen}
        options={{ title: 'Carers' }}
      />
      {/* Hidden screens accessible via drawer */}
      <Tab.Screen
        name="OpenShifts"
        component={StaffOpenShiftsScreen}
        options={{ title: 'Open shifts', tabBarButton: () => null }}
      />
      <Tab.Screen
        name="Schedules"
        component={SchedulesScreen}
        options={{ title: 'Schedules', tabBarButton: () => null }}
      />
      <Tab.Screen
        name="Visits"
        component={VisitsScreen}
        options={{ title: 'Visits', tabBarButton: () => null }}
      />
      <Tab.Screen
        name="Checklists"
        component={ChecklistsScreen}
        options={{ title: 'Checklists', tabBarButton: () => null }}
      />
      <Tab.Screen
        name="Availability"
        component={AdminAvailabilityScreen}
        options={{ title: 'Availability', tabBarButton: () => null }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile', tabBarButton: () => null }}
      />
      </Tab.Navigator>
      <CustomDrawer />
    </>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  drawerHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  profileCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileInitial: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
  },
  drawerName: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  drawerEmail: {
    fontSize: 14,
    color: colors.textMuted,
  },
  drawerItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  drawerItemText: {
    fontSize: 16,
    color: colors.foreground,
  },
  headerButton: {
    marginRight: 16,
  },
  headerProfileCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerProfileInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});

export default AdminTabs;

