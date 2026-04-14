import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { visitsService } from '../../services/visits';
import { Visit, VisitStatus } from '../../types';
import { format, subDays } from 'date-fns';
import { colors } from '../../theme/colors';

const VisitsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadVisits();
  }, []);

  const loadVisits = async () => {
    try {
      const startDate = subDays(new Date(), 7).toISOString();
      const data = await visitsService.getVisits({ startDate });
      setVisits(data);
    } catch (error) {
      console.error('Error loading visits:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadVisits();
  };

  const getStatusColor = (status: VisitStatus) => {
    switch (status) {
      case VisitStatus.COMPLETED:
        return '#34C759';
      case VisitStatus.IN_PROGRESS:
        return colors.primary;
      case VisitStatus.LATE:
        return '#FF9500';
      case VisitStatus.MISSED:
        return '#FF3B30';
      case VisitStatus.INCOMPLETE:
        return '#FFCC00';
      default:
        return colors.textMuted;
    }
  };

  const renderVisit = ({ item }: { item: Visit }) => (
    <TouchableOpacity
      style={styles.visitItem}
      onPress={() => {
        (navigation as any).navigate('VisitDetail', { visitId: item.id });
      }}
    >
      <View style={styles.visitHeader}>
        <Text style={styles.visitClient}>{item.client.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
        </View>
      </View>
      <Text style={styles.visitAddress}>{item.client.address}</Text>
      <Text style={styles.visitCarer}>Carer: {item.carer.name}</Text>
      {item.scheduledStart && (
        <Text style={styles.visitTime}>
          Scheduled: {format(new Date(item.scheduledStart), 'MMM d, HH:mm')}
        </Text>
      )}
      {item.clockInTime && (
        <Text style={styles.visitTime}>
          Clocked In: {format(new Date(item.clockInTime), 'MMM d, HH:mm')}
        </Text>
      )}
    </TouchableOpacity>
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
        data={visits}
        renderItem={renderVisit}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No visits found</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  visitItem: {
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
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  visitClient: { fontSize: 18, fontWeight: '600', color: colors.foreground, flex: 1 },
  visitAddress: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
  visitCarer: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
  visitTime: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, color: colors.white, fontWeight: '600', textTransform: 'uppercase' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: colors.textMuted },
});

export default VisitsScreen;

