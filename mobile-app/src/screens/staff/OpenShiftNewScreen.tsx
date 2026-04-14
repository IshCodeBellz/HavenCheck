import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { clientsService } from '../../services/clients';
import { shiftPostingsService } from '../../services/shiftPostings';
import type { Client } from '../../types';
import { colors } from '../../theme/colors';

const OpenShiftNewScreen: React.FC = () => {
  const navigation = useNavigation();
  const [clients, setClients] = useState<Client[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    clientId: '',
    slotsNeeded: '5',
    title: '',
    startTime: '',
    endTime: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const list = await clientsService.getManagerClients();
        setClients(list.filter((c) => c.active));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const submit = async () => {
    const slots = parseInt(form.slotsNeeded, 10);
    if (!form.clientId || !form.startTime || !form.endTime || Number.isNaN(slots) || slots < 1) {
      Alert.alert('Check fields', 'Choose a client, valid slot count, and start/end times.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await shiftPostingsService.createStaff({
        clientId: form.clientId,
        slotsNeeded: slots,
        title: form.title.trim() || undefined,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
      });
      (navigation as any).replace('OpenShiftDetail', { shiftPostingId: created.id });
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Could not create posting';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Client *</Text>
      <ScrollView style={styles.picker} nestedScrollEnabled>
        {clients.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.pickerOption, form.clientId === c.id && styles.pickerOptionActive]}
            onPress={() => setForm((f) => ({ ...f, clientId: c.id }))}
          >
            <Text style={[styles.pickerText, form.clientId === c.id && styles.pickerTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.label}>Carers needed *</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={form.slotsNeeded}
        onChangeText={(t) => setForm((f) => ({ ...f, slotsNeeded: t }))}
      />

      <Text style={styles.label}>Title (optional)</Text>
      <TextInput
        style={styles.input}
        value={form.title}
        onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
        placeholder="e.g. Night cover"
      />

      <Text style={styles.label}>Start * (ISO or parseable date)</Text>
      <TextInput
        style={styles.input}
        value={form.startTime}
        onChangeText={(t) => setForm((f) => ({ ...f, startTime: t }))}
        placeholder="2026-04-15T14:00"
      />

      <Text style={styles.label}>End *</Text>
      <TextInput
        style={styles.input}
        value={form.endTime}
        onChangeText={(t) => setForm((f) => ({ ...f, endTime: t }))}
        placeholder="2026-04-15T22:00"
      />

      <TouchableOpacity style={styles.submit} onPress={submit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.submitText}>Post shift</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 16, fontWeight: '500', color: colors.foreground, marginTop: 16, marginBottom: 8 },
  input: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  picker: { maxHeight: 160, backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  pickerOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerOptionActive: { backgroundColor: colors.primary },
  pickerText: { fontSize: 16, color: colors.foreground },
  pickerTextActive: { color: colors.white },
  submit: {
    marginTop: 28,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { color: colors.white, fontWeight: '600', fontSize: 16 },
});

export default OpenShiftNewScreen;
