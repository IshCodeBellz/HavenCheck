import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { availabilityService, Availability } from '../../services/availability';
import { usersService } from '../../services/users';
import { User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import { colors } from '../../theme/colors';

type Tab = 'my' | 'staff';

const AdminAvailabilityScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('my');
  const [myAvailability, setMyAvailability] = useState<Availability[]>([]);
  const [staffAvailability, setStaffAvailability] = useState<Availability[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
  });

  useEffect(() => {
    loadStaff();
    if (activeTab === 'my') {
      loadMyAvailability();
    } else {
      loadStaffAvailability();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'staff' && selectedStaffId) {
      loadStaffAvailability();
    }
  }, [selectedStaffId]);

  const loadStaff = async () => {
    try {
      const data = await usersService.getUsers();
      // Filter to show carers and managers (staff)
      const staffData = data.filter((u) => (u.role === 'CARER' || u.role === 'MANAGER') && u.isActive);
      setStaff(staffData);
    } catch (error) {
      console.error('Error loading staff:', error);
    }
  };

  const loadMyAvailability = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 28);

      const data = await availabilityService.getAvailability(
        startDate.toISOString(),
        endDate.toISOString()
      );
      setMyAvailability(data);
    } catch (error) {
      console.error('Error loading my availability:', error);
      Alert.alert('Error', 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const loadStaffAvailability = async () => {
    try {
      setLoadingStaff(true);
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 28);

      if (selectedStaffId === 'all') {
        // Load availability for all staff
        const allAvailability: Availability[] = [];
        for (const staffMember of staff) {
          try {
            const data = await availabilityService.getAvailability(
              startDate.toISOString(),
              endDate.toISOString(),
              staffMember.id
            );
            allAvailability.push(...data);
          } catch (error) {
            console.error(`Error loading availability for ${staffMember.id}:`, error);
          }
        }
        setStaffAvailability(allAvailability);
      } else {
        // Load availability for selected staff member
        const data = await availabilityService.getAvailability(
          startDate.toISOString(),
          endDate.toISOString(),
          selectedStaffId
        );
        setStaffAvailability(data);
      }
    } catch (error) {
      console.error('Error loading staff availability:', error);
      Alert.alert('Error', 'Failed to load staff availability');
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setSubmitting(true);
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}:00`);
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}:00`);

      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        Alert.alert('Error', 'Invalid date or time format');
        return;
      }

      if (endDateTime <= startDateTime) {
        Alert.alert('Error', 'End time must be after start time');
        return;
      }

      const carerId = activeTab === 'my' ? undefined : (selectedStaffId === 'all' ? undefined : selectedStaffId);
      
      if (activeTab === 'staff' && !carerId) {
        Alert.alert('Error', 'Please select a staff member');
        return;
      }

      await availabilityService.createAvailability(
        startDateTime.toISOString(),
        endDateTime.toISOString(),
        false, // false = unavailable (blocking this time)
        carerId
      );

      setFormData({
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
      });
      setShowAddForm(false);
      
      if (activeTab === 'my') {
        loadMyAvailability();
      } else {
        loadStaffAvailability();
      }
      Alert.alert('Success', 'Unavailability added successfully');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to add unavailability');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string, carerId?: string) => {
    Alert.alert(
      'Delete Unavailability',
      'Are you sure you want to delete this unavailability period?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await availabilityService.deleteAvailability(id, carerId);
              if (activeTab === 'my') {
                loadMyAvailability();
              } else {
                loadStaffAvailability();
              }
              Alert.alert('Success', 'Unavailability deleted');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const getStaffName = (carerId: string) => {
    const staffMember = staff.find((s) => s.id === carerId);
    return staffMember ? staffMember.name : 'Unknown';
  };

  const currentAvailability = activeTab === 'my' ? myAvailability : staffAvailability;
  const unavailability = currentAvailability.filter((a) => !a.isAvailable);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>Availability</Text>
        
        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'my' && styles.tabActive]}
            onPress={() => setActiveTab('my')}
          >
            <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
              My Availability
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'staff' && styles.tabActive]}
            onPress={() => setActiveTab('staff')}
          >
            <Text style={[styles.tabText, activeTab === 'staff' && styles.tabTextActive]}>
              Staff Availability
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'staff' && (
          <View style={styles.staffSelector}>
            <Text style={styles.label}>Select Staff:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.staffScroll}>
              <TouchableOpacity
                style={[styles.staffChip, selectedStaffId === 'all' && styles.staffChipActive]}
                onPress={() => setSelectedStaffId('all')}
              >
                <Text style={[styles.staffChipText, selectedStaffId === 'all' && styles.staffChipTextActive]}>
                  All Staff
                </Text>
              </TouchableOpacity>
              {staff.map((staffMember) => (
                <TouchableOpacity
                  key={staffMember.id}
                  style={[styles.staffChip, selectedStaffId === staffMember.id && styles.staffChipActive]}
                  onPress={() => setSelectedStaffId(staffMember.id)}
                >
                  <Text style={[styles.staffChipText, selectedStaffId === staffMember.id && styles.staffChipTextActive]}>
                    {staffMember.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddForm(!showAddForm)}
        >
          <Text style={styles.addButtonText}>
            {showAddForm ? 'Cancel' : '+ Add Unavailable'}
          </Text>
        </TouchableOpacity>
      </View>

      {showAddForm && (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>
            Add Unavailable Period {activeTab === 'staff' && selectedStaffId !== 'all' ? `for ${getStaffName(selectedStaffId)}` : ''}
          </Text>
          
          {activeTab === 'staff' && selectedStaffId === 'all' && (
            <Text style={styles.warningText}>Please select a staff member first</Text>
          )}

          <Text style={styles.label}>Start Date & Time</Text>
          <View style={styles.dateTimeRow}>
            <TextInput
              style={[styles.input, styles.dateInput]}
              value={formData.startDate}
              onChangeText={(text) => setFormData({ ...formData, startDate: text })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={[styles.input, styles.timeInput]}
              value={formData.startTime}
              onChangeText={(text) => setFormData({ ...formData, startTime: text })}
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Text style={styles.label}>End Date & Time</Text>
          <View style={styles.dateTimeRow}>
            <TextInput
              style={[styles.input, styles.dateInput]}
              value={formData.endDate}
              onChangeText={(text) => setFormData({ ...formData, endDate: text })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={[styles.input, styles.timeInput]}
              value={formData.endTime}
              onChangeText={(text) => setFormData({ ...formData, endTime: text })}
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || (activeTab === 'staff' && selectedStaffId === 'all')}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>Add</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {(loading || (activeTab === 'staff' && loadingStaff)) ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.list}>
          {unavailability.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {activeTab === 'my'
                  ? 'No unavailability periods set. You can be scheduled at any time.'
                  : 'No unavailability periods found for the selected staff.'}
              </Text>
              <Text style={styles.emptySubtext}>
                {activeTab === 'my'
                  ? 'Add unavailable periods to block times when you cannot work.'
                  : 'Add unavailable periods to block times when staff cannot work.'}
              </Text>
            </View>
          ) : (
            unavailability.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>Unavailable</Text>
                    {activeTab === 'staff' && selectedStaffId === 'all' && (
                      <Text style={styles.cardStaffName}>{getStaffName(item.carerId)}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id, activeTab === 'staff' ? item.carerId : undefined)}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.cardText}>
                  {format(new Date(item.startTime), 'MMM d, yyyy HH:mm')} -{' '}
                  {format(new Date(item.endTime), 'MMM d, yyyy HH:mm')}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: colors.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
  },
  staffSelector: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 8,
  },
  staffScroll: {
    maxHeight: 50,
  },
  staffChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  staffChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  staffChipText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  staffChipTextActive: {
    color: colors.white,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    backgroundColor: colors.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dateInput: {
    flex: 2,
  },
  timeInput: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    flex: 1,
    padding: 16,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  cardStaffName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  cardText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});

export default AdminAvailabilityScreen;

