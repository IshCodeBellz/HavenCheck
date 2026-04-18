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
import { UserRole } from '../types';
import TodayVisitsScreen from '../screens/carer/TodayVisitsScreen';
import WeeklyRotaScreen from '../screens/carer/WeeklyRotaScreen';
import HistoryScreen from '../screens/carer/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AvailabilityScreen from '../screens/carer/AvailabilityScreen';
import CarerOpenShiftsScreen from '../screens/carer/CarerOpenShiftsScreen';
import GuardianFeedScreen from '../screens/guardian/GuardianFeedScreen';
import GuardianAlertsScreen from '../screens/guardian/GuardianAlertsScreen';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();
const DRAWER_WIDTH = Dimensions.get('window').width * 0.85;

const CarerTabs: React.FC = () => {
  const { user } = useAuth();
  const isGuardian = user?.role === UserRole.GUARDIAN;
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
                (navigation as any).navigate('CarerTabs', { screen: 'OpenShifts' });
              }}
            >
              <Text style={styles.drawerItemText}>Open shifts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setDrawerVisible(false);
                (navigation as any).navigate('CarerTabs', { screen: 'Availability' });
              }}
            >
              <Text style={styles.drawerItemText}>My Availability</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setDrawerVisible(false);
                (navigation as any).navigate('CarerTabs', { screen: 'Profile' });
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
        {isGuardian ? (
          <>
            <Tab.Screen name="GuardianFeed" component={GuardianFeedScreen} options={{ title: 'Family feed' }} />
            <Tab.Screen name="GuardianAlerts" component={GuardianAlertsScreen} options={{ title: 'Care alerts' }} />
          </>
        ) : (
          <Tab.Screen
            name="Today"
            component={TodayVisitsScreen}
            options={{ title: "Today's Visits" }}
          />
        )}
        {!isGuardian && (
          <Tab.Screen
            name="WeeklyRota"
            component={WeeklyRotaScreen}
            options={{ title: 'Weekly Rota' }}
          />
        )}
        {!isGuardian && (
          <Tab.Screen
            name="OpenShifts"
            component={CarerOpenShiftsScreen}
            options={{ title: 'Open shifts' }}
          />
        )}
        {!isGuardian && (
          <Tab.Screen
            name="History"
            component={HistoryScreen}
            options={{ title: 'History' }}
          />
        )}
        {!isGuardian && (
          <Tab.Screen
            name="Availability"
            component={AvailabilityScreen}
            options={{ title: 'My Availability' }}
          />
        )}
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Profile' }}
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

export default CarerTabs;

