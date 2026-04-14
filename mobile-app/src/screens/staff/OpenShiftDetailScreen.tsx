import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { shiftPostingsService } from '../../services/shiftPostings';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import type { ShiftPosting, ShiftApplication } from '../../types';
import { colors } from '../../theme/colors';

const OpenShiftDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { shiftPostingId } = route.params as { shiftPostingId: string };

  const [posting, setPosting] = useState<ShiftPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await shiftPostingsService.getStaffById(shiftPostingId);
      setPosting(data);
      setSelectedIds(new Set());
    } catch {
      setPosting(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shiftPostingId]);

  const selectedCount = useMemo(
    () => posting?.applications.filter((a) => a.status === 'SELECTED').length ?? 0,
    [posting]
  );
  const remainingSlots = posting ? Math.max(0, posting.slotsNeeded - selectedCount) : 0;

  const toggle = (applicationId: string, app: ShiftApplication) => {
    if (app.status !== 'PENDING' || posting?.status !== 'OPEN' || remainingSlots <= 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(applicationId)) next.delete(applicationId);
      else if (next.size < remainingSlots) next.add(applicationId);
      return next;
    });
  };

  const assign = async () => {
    if (!posting || selectedIds.size === 0) return;
    setSaving(true);
    try {
      await shiftPostingsService.selectApplicants(posting.id, Array.from(selectedIds));
      await load();
      Alert.alert('Assigned', 'Schedules and visits were created for selected carers.');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Assignment failed (check availability).';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const cancelPosting = () => {
    if (!posting || posting.status !== 'OPEN') return;
    Alert.alert('Cancel posting?', 'Pending applicants will be marked not selected.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel posting',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await shiftPostingsService.cancelPosting(posting.id);
            const parentTabs = user?.role === UserRole.ADMIN ? 'AdminTabs' : 'ManagerTabs';
            (navigation as any).navigate(parentTabs, { screen: 'OpenShifts' });
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Could not cancel');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!posting) {
    return (
      <View style={styles.center}>
        <Text>Could not load this posting.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{posting.client.name}</Text>
      {posting.title ? <Text style={styles.subtitle}>{posting.title}</Text> : null}
      <Text style={styles.meta}>
        {format(new Date(posting.startTime), 'MMM d, yyyy HH:mm')} – {format(new Date(posting.endTime), 'HH:mm')}
      </Text>
      <Text style={styles.meta}>
        {selectedCount} / {posting.slotsNeeded} slots · {posting.status}
      </Text>

      {posting.status === 'OPEN' && (
        <TouchableOpacity style={styles.dangerOutline} onPress={cancelPosting} disabled={saving}>
          <Text style={styles.dangerOutlineText}>Cancel posting</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Applicants</Text>
      {posting.applications.length === 0 ? (
        <Text style={styles.empty}>No applications yet.</Text>
      ) : (
        posting.applications.map((app) => {
          const selectable =
            app.status === 'PENDING' && posting.status === 'OPEN' && remainingSlots > 0;
          const on = selectedIds.has(app.id);
          return (
            <TouchableOpacity
              key={app.id}
              style={[styles.row, selectable && on && styles.rowSelected]}
              onPress={() => toggle(app.id, app)}
              disabled={!selectable}
            >
              <View style={styles.rowMain}>
                <Text style={styles.carerName}>{app.carer.name}</Text>
                <Text style={styles.email}>{app.carer.email}</Text>
              </View>
              <Text style={styles.badge}>{app.status}</Text>
            </TouchableOpacity>
          );
        })
      )}

      {posting.status === 'OPEN' && remainingSlots > 0 && selectedIds.size > 0 && (
        <TouchableOpacity style={styles.primary} onPress={assign} disabled={saving}>
          <Text style={styles.primaryText}>{saving ? 'Assigning…' : `Assign selected (${selectedIds.size})`}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.foreground },
  subtitle: { fontSize: 16, color: '#555', marginTop: 6 },
  meta: { fontSize: 14, color: colors.textSecondary, marginTop: 8 },
  dangerOutline: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  dangerOutlineText: { color: '#C93400', fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 24, marginBottom: 12, color: colors.foreground },
  empty: { color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.selection },
  rowMain: { flex: 1 },
  carerName: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  email: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  badge: { fontSize: 12, fontWeight: '600', color: colors.primary },
  primary: {
    marginTop: 20,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryText: { color: colors.white, fontWeight: '600', fontSize: 16 },
});

export default OpenShiftDetailScreen;
