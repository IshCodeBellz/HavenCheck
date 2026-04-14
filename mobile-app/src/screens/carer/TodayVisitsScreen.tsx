import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { visitsService } from '../../services/visits';
import { Visit, VisitStatus } from '../../types';
import { format } from 'date-fns';
import { colors } from '../../theme/colors';

const TodayVisitsScreen: React.FC = () => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    loadVisits();
  }, []);

  const loadVisits = async () => {
    try {
      const data = await visitsService.getTodayVisits();
      // Filter out completed visits - they should appear in History instead
      const filteredData = data.filter((visit) => visit.status !== VisitStatus.COMPLETED);
      setVisits(filteredData);
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
      case VisitStatus.NOT_STARTED:
        return colors.textMuted;
      case VisitStatus.IN_PROGRESS:
        return colors.primary;
      case VisitStatus.LATE:
        return '#FF9500'; // Orange for late (still in progress)
      case VisitStatus.COMPLETED:
        return '#34C759';
      case VisitStatus.MISSED:
        return '#FF3B30';
      case VisitStatus.INCOMPLETE:
        return '#FFB300'; // Yellow/amber for incomplete
      default:
        return colors.textMuted;
    }
  };

  const getStatusLabel = (status: VisitStatus) => {
    return status.replace('_', ' ');
  };

  const renderVisit = ({ item }: { item: Visit }) => (
    <TouchableOpacity
      style={styles.visitCard}
      onPress={() => navigation.navigate('VisitDetail', { visitId: item.id })}
    >
      <View style={styles.visitHeader}>
        <Text style={styles.clientName}>{item.client.name}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.address}>{item.client.address}</Text>
      {item.scheduledStart && (
        <Text style={styles.time}>
          {format(new Date(item.scheduledStart), 'HH:mm')} -{' '}
          {item.scheduledEnd && format(new Date(item.scheduledEnd), 'HH:mm')}
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
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No visits scheduled for today</Text>
          </View>
        }
      />
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
  list: {
    padding: 16,
  },
  visitCard: {
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
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  address: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  time: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
  },
});

export default TodayVisitsScreen;

