import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { shiftPostingsService } from '../../services/shiftPostings';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import type { CarerOpenShiftRow } from '../../types';
import { colors } from '../../theme/colors';

const CarerOpenShiftsScreen: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<CarerOpenShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isCarer = user?.role === UserRole.CARER;

  const load = useCallback(async () => {
    try {
      const data = await shiftPostingsService.listOpenForCarer();
      setItems(data);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const apply = async (shiftId: string) => {
    setBusyId(shiftId);
    try {
      await shiftPostingsService.applyForShift(shiftId);
      await load();
      Alert.alert('Applied', 'Your interest has been recorded. A manager will assign slots.');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.error || 'Could not apply';
      Alert.alert('Error', msg);
    } finally {
      setBusyId(null);
    }
  };

  const withdraw = async (applicationId: string) => {
    setBusyId(applicationId);
    try {
      await shiftPostingsService.withdrawApplication(applicationId);
      await load();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Could not withdraw';
      Alert.alert('Error', msg);
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: CarerOpenShiftRow }) => {
    const free = Math.max(0, item.slotsNeeded - item.selectedCount);
    const mine = item.myApplicationStatus;
    return (
      <View style={styles.card}>
        <Text style={styles.clientName}>
          {item.client.name}
          {item.title ? ` · ${item.title}` : ''}
        </Text>
        <Text style={styles.meta}>
          {format(new Date(item.startTime), 'EEE d MMM, HH:mm')} – {format(new Date(item.endTime), 'HH:mm')}
        </Text>
        <Text style={styles.meta}>
          {item.selectedCount}/{item.slotsNeeded} filled · {item.applicantCount} applicant
          {item.applicantCount === 1 ? '' : 's'}
          {free > 0 ? ` · ${free} slot(s) open` : ''}
        </Text>
        {mine ? <Text style={styles.mine}>Your status: {mine}</Text> : null}

        <View style={styles.actions}>
          {isCarer && item.status === 'OPEN' && free > 0 && !mine && (
            <TouchableOpacity
              style={styles.primaryBtn}
              disabled={busyId === item.id}
              onPress={() => apply(item.id)}
            >
              <Text style={styles.primaryBtnText}>{busyId === item.id ? 'Applying…' : 'Apply'}</Text>
            </TouchableOpacity>
          )}
          {isCarer && mine === 'PENDING' && item.myApplicationId && (
            <TouchableOpacity
              style={styles.secondaryBtn}
              disabled={busyId === item.myApplicationId}
              onPress={() => withdraw(item.myApplicationId!)}
            >
              <Text style={styles.secondaryBtnText}>
                {busyId === item.myApplicationId ? 'Withdrawing…' : 'Withdraw'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
      {!isCarer && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Applications are for carer accounts. You can still view open shifts.</Text>
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No open shifts right now.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 32 },
  banner: {
    backgroundColor: colors.selection,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
  },
  bannerText: { fontSize: 13, color: colors.foreground },
  card: {
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
  clientName: { fontSize: 17, fontWeight: '600', color: colors.foreground },
  meta: { fontSize: 14, color: colors.textSecondary, marginTop: 6 },
  mine: { fontSize: 13, color: colors.primary, marginTop: 8, fontWeight: '500' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  primaryBtnText: { color: colors.white, fontWeight: '600' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  secondaryBtnText: { color: colors.primary, fontWeight: '600' },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: colors.textMuted },
});

export default CarerOpenShiftsScreen;
