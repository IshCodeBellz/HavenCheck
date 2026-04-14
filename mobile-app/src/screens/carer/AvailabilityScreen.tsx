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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { availabilityService, Availability } from '../../services/availability';
import { format } from 'date-fns';
import { colors } from '../../theme/colors';

const AvailabilityScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
  });

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      setLoading(true);
      // Load next 4 weeks
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 28);
      
      const data = await availabilityService.getAvailability(
        startDate.toISOString(),
        endDate.toISOString()
      );
      setAvailability(data);
    } catch (error) {
      console.error('Error loading availability:', error);
      Alert.alert('Error', 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setSubmitting(true);
      // Format: YYYY-MM-DDTHH:MM
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

      await availabilityService.createAvailability(
        startDateTime.toISOString(),
        endDateTime.toISOString(),
        false // false = unavailable (blocking this time)
      );

      setFormData({
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
      });
      setShowAddForm(false);
      loadAvailability();
      Alert.alert('Success', 'Unavailability added successfully');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to add unavailability');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
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
              await availabilityService.deleteAvailability(id);
              loadAvailability();
              Alert.alert('Success', 'Unavailability deleted');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>My Availability</Text>
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
          <Text style={styles.formTitle}>Add Unavailable Period</Text>
          
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
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>Add</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.list}>
        {availability.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No unavailability periods set. You can be scheduled at any time.
            </Text>
            <Text style={styles.emptySubtext}>
              Add unavailable periods to block times when you cannot work.
            </Text>
          </View>
        ) : (
          availability
            .filter((a) => !a.isAvailable)
            .map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Unavailable</Text>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id)}
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
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginTop: 12,
    marginBottom: 4,
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
    marginTop: 16,
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

export default AvailabilityScreen;

