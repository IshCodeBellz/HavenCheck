import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { visitsService } from '../../services/visits';
import { Visit, VisitStatus } from '../../types';
import { format } from 'date-fns';
import { colors } from '../../theme/colors';

const TodayOverviewScreen: React.FC = () => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadVisits();
  }, []);

  const loadVisits = async () => {
    try {
      const data = await visitsService.getTodayVisits();
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

  // Include both IN_PROGRESS and LATE as active carers (both are in progress, LATE just indicates lateness)
  const activeCarers = visits
    .filter((v) => v.status === VisitStatus.IN_PROGRESS || v.status === VisitStatus.LATE)
    .map((v) => ({
      carer: v.carer,
      client: v.client,
      clockInTime: v.clockInTime,
      status: v.status,
    }));

  const groupedVisits = {
    [VisitStatus.NOT_STARTED]: visits.filter((v) => v.status === VisitStatus.NOT_STARTED),
    [VisitStatus.IN_PROGRESS]: visits.filter((v) => v.status === VisitStatus.IN_PROGRESS),
    [VisitStatus.LATE]: visits.filter((v) => v.status === VisitStatus.LATE),
    [VisitStatus.COMPLETED]: visits.filter((v) => v.status === VisitStatus.COMPLETED),
    [VisitStatus.MISSED]: visits.filter((v) => v.status === VisitStatus.MISSED),
    [VisitStatus.INCOMPLETE]: visits.filter((v) => v.status === VisitStatus.INCOMPLETE),
  };

  const renderSection = (title: string, data: Visit[], color: string) => {
    if (data.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionCount}>{data.length}</Text>
        </View>
        {data.map((visit) => (
          <View key={visit.id} style={styles.visitItem}>
            <Text style={styles.visitClient}>{visit.client.name}</Text>
            <Text style={styles.visitCarer}>Carer: {visit.carer.name}</Text>
            {visit.scheduledStart && (
              <Text style={styles.visitTime}>
                {format(new Date(visit.scheduledStart), 'HH:mm')}
              </Text>
            )}
          </View>
        ))}
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
      {activeCarers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Carers</Text>
          {activeCarers.map((item, index) => (
            <View key={index} style={styles.carerItem}>
              <Text style={styles.carerName}>{item.carer.name}</Text>
              <Text style={styles.carerClient}>{item.client.name}</Text>
              {item.clockInTime && (
                <Text style={styles.carerTime}>
                  Since {format(new Date(item.clockInTime), 'HH:mm')}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      <FlatList
        data={[]}
        renderItem={() => null}
        keyExtractor={() => 'list'}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <>
            {renderSection('Not Started', groupedVisits[VisitStatus.NOT_STARTED], colors.textMuted)}
            {renderSection('In Progress', groupedVisits[VisitStatus.IN_PROGRESS], colors.primary)}
            {renderSection('Late', groupedVisits[VisitStatus.LATE], '#FF9500')}
            {renderSection('Completed', groupedVisits[VisitStatus.COMPLETED], '#34C759')}
            {renderSection('Incomplete', groupedVisits[VisitStatus.INCOMPLETE], '#FFB300')}
            {renderSection('Missed', groupedVisits[VisitStatus.MISSED], '#FF3B30')}
          </>
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
  section: {
    backgroundColor: colors.white,
    marginBottom: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 12,
    borderLeftWidth: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  sectionCount: {
    fontSize: 16,
    color: colors.textMuted,
  },
  carerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  carerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  carerClient: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  carerTime: {
    fontSize: 14,
    color: colors.primary,
  },
  visitItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  visitClient: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  visitCarer: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  visitTime: {
    fontSize: 14,
    color: colors.primary,
  },
});

export default TodayOverviewScreen;

