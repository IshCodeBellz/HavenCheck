import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { schedulesService } from '../../services/schedules';
import { clientsService } from '../../services/clients';
import { usersService } from '../../services/users';
import { Schedule, Client, User } from '../../types';
import { format } from 'date-fns';
import { colors } from '../../theme/colors';

const SchedulesScreen: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [carers, setCarers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    clientId: '',
    carerId: '',
    startTime: '',
    endTime: '',
  });

  useEffect(() => {
    loadSchedules();
    loadOptions();
  }, []);

  const loadSchedules = async () => {
    try {
      const data = await schedulesService.getSchedules();
      setSchedules(data);
    } catch (error) {
      console.error('Error loading schedules:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadOptions = async () => {
    try {
      const [clientsData, usersData] = await Promise.all([
        clientsService.getClients(),
        usersService.getUsers(),
      ]);
      setClients(clientsData.filter((c) => c.active));
      setCarers(usersData.filter((u) => u.isActive && u.role === 'CARER'));
    } catch (error) {
      console.error('Error loading options:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSchedules();
  };

  const handleSubmit = async () => {
    if (!formData.clientId || !formData.carerId || !formData.startTime || !formData.endTime) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setSubmitting(true);
      await schedulesService.createSchedule({
        clientId: formData.clientId,
        carerId: formData.carerId,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
      });
      setShowAddModal(false);
      setFormData({ clientId: '', carerId: '', startTime: '', endTime: '' });
      loadSchedules();
      Alert.alert('Success', 'Schedule created successfully');
    } catch (error: any) {
      const d = error.response?.data;
      Alert.alert('Error', d?.message || d?.error || 'Failed to create schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Schedule', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await schedulesService.deleteSchedule(id);
            loadSchedules();
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to delete schedule');
          }
        },
      },
    ]);
  };

  const renderSchedule = ({ item }: { item: Schedule }) => (
    <View style={styles.scheduleItem}>
      <View style={styles.scheduleHeader}>
        <Text style={styles.scheduleClient}>{item.client.name}</Text>
        <TouchableOpacity onPress={() => handleDelete(item.id)}>
          <Text style={styles.deleteButton}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.scheduleCarer}>Carer: {item.carer.name}</Text>
      <Text style={styles.scheduleTime}>
        {format(new Date(item.startTime), 'MMM d, yyyy HH:mm')} - {format(new Date(item.endTime), 'HH:mm')}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={schedules}
        renderItem={renderSchedule}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No schedules found</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
        <Text style={styles.addButtonText}>+ Add Schedule</Text>
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide" transparent={true} onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Add Schedule</Text>
              <Text style={styles.label}>Client *</Text>
              <ScrollView style={styles.picker}>
                {clients.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    style={[styles.pickerOption, formData.clientId === client.id && styles.pickerOptionActive]}
                    onPress={() => setFormData({ ...formData, clientId: client.id })}
                  >
                    <Text style={[styles.pickerText, formData.clientId === client.id && styles.pickerTextActive]}>
                      {client.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.label}>Carer *</Text>
              <ScrollView style={styles.picker}>
                {carers.map((carer) => (
                  <TouchableOpacity
                    key={carer.id}
                    style={[styles.pickerOption, formData.carerId === carer.id && styles.pickerOptionActive]}
                    onPress={() => setFormData({ ...formData, carerId: carer.id })}
                  >
                    <Text style={[styles.pickerText, formData.carerId === carer.id && styles.pickerTextActive]}>
                      {carer.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.label}>Start Time *</Text>
              <TextInput
                style={styles.input}
                value={formData.startTime}
                onChangeText={(text) => setFormData({ ...formData, startTime: text })}
                placeholder="YYYY-MM-DDTHH:mm"
              />
              <Text style={styles.label}>End Time *</Text>
              <TextInput
                style={styles.input}
                value={formData.endTime}
                onChangeText={(text) => setFormData({ ...formData, endTime: text })}
                placeholder="YYYY-MM-DDTHH:mm"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitButtonText}>Create</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 80 },
  scheduleItem: {
    backgroundColor: colors.white,
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  scheduleClient: { fontSize: 18, fontWeight: '600', color: colors.foreground },
  scheduleCarer: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
  scheduleTime: { fontSize: 14, color: colors.textSecondary },
  deleteButton: { color: '#FF3B30', fontSize: 14, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: colors.textMuted },
  addButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    left: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  addButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: colors.foreground, marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '500', color: colors.foreground, marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: colors.background, borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  picker: { maxHeight: 150, backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  pickerOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerOptionActive: { backgroundColor: colors.primary },
  pickerText: { fontSize: 16, color: colors.foreground },
  pickerTextActive: { color: colors.white },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelButton: { flex: 1, backgroundColor: colors.background, borderRadius: 8, padding: 16, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, color: colors.foreground, fontWeight: '600' },
  submitButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 8, padding: 16, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontSize: 16, color: colors.white, fontWeight: '600' },
});

export default SchedulesScreen;

