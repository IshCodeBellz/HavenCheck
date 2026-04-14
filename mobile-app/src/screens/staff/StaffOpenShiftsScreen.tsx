import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { format } from 'date-fns';
import { shiftPostingsService } from '../../services/shiftPostings';
import type { RootStackParamList } from '../../navigation/types';
import type { ShiftPosting } from '../../types';
import { colors } from '../../theme/colors';

type Nav = StackNavigationProp<RootStackParamList>;

const StaffOpenShiftsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<ShiftPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await shiftPostingsService.listStaff();
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

  const renderItem = ({ item }: { item: ShiftPosting }) => {
    const selected = item.applications?.filter((a) => a.status === 'SELECTED').length ?? 0;
    const applicants = item.applications?.length ?? 0;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('OpenShiftDetail', { shiftPostingId: item.id })}
      >
        <Text style={styles.clientName}>
          {item.client.name}
          {item.title ? ` · ${item.title}` : ''}
        </Text>
        <Text style={styles.meta}>
          {format(new Date(item.startTime), 'MMM d, yyyy HH:mm')} – {format(new Date(item.endTime), 'HH:mm')}
        </Text>
        <Text style={styles.meta}>
          {selected}/{item.slotsNeeded} filled · {applicants} application{applicants === 1 ? '' : 's'}
        </Text>
        <Text style={[styles.status, item.status === 'OPEN' ? styles.statusOpen : styles.statusOther]}>
          {item.status}
        </Text>
      </TouchableOpacity>
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
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No shift postings yet.</Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('OpenShiftNew')}>
        <Text style={styles.fabText}>+ Post shift</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 88 },
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
  status: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  statusOpen: { color: '#34C759' },
  statusOther: { color: colors.textSecondary },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: colors.textMuted },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    left: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    elevation: 5,
  },
  fabText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});

export default StaffOpenShiftsScreen;
