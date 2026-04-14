import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { schedulesService } from '../../services/schedules';
import { Schedule } from '../../types';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { colors } from '../../theme/colors';

const TeamRotaScreen: React.FC = () => {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [schedules, setSchedules] = useState<Record<string, Schedule[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRota();
  }, [weekStart]);

  const loadRota = async () => {
    try {
      setLoading(true);
      const data = await schedulesService.getWeeklyRota(undefined, weekStart.toISOString());
      setSchedules(data.schedules);
    } catch (error) {
      console.error('Error loading rota:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousWeek = () => {
    setWeekStart(subWeeks(weekStart, 1));
  };

  const goToNextWeek = () => {
    setWeekStart(addWeeks(weekStart, 1));
  };

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date,
      key: format(date, 'yyyy-MM-dd'),
      label: format(date, 'EEE d'),
    };
  });

  // Group schedules by carer
  const carerSchedules: Record<string, Schedule[]> = {};
  Object.values(schedules).flat().forEach((schedule) => {
    if (!carerSchedules[schedule.carerId]) {
      carerSchedules[schedule.carerId] = [];
    }
    carerSchedules[schedule.carerId].push(schedule);
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.weekHeader}>
        <TouchableOpacity onPress={goToPreviousWeek} style={styles.navButton}>
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.weekLabel}>
          {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
        </Text>
        <TouchableOpacity onPress={goToNextWeek} style={styles.navButton}>
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {Object.entries(carerSchedules).map(([carerId, carerScheduleList]) => {
          const carer = carerScheduleList[0].carer;
          return (
            <View key={carerId} style={styles.carerSection}>
              <Text style={styles.carerName}>{carer.name}</Text>
              {days.map((day) => {
                const daySchedules = carerScheduleList.filter(
                  (s) => format(new Date(s.startTime), 'yyyy-MM-dd') === day.key
                );
                return (
                  <View key={day.key} style={styles.dayRow}>
                    <Text style={styles.dayLabel}>{day.label}</Text>
                    <View style={styles.schedulesContainer}>
                      {daySchedules.map((schedule) => (
                        <View key={schedule.id} style={styles.scheduleBlock}>
                          <Text style={styles.scheduleClient}>{schedule.client.name}</Text>
                          <Text style={styles.scheduleTime}>
                            {format(new Date(schedule.startTime), 'HH:mm')} -{' '}
                            {format(new Date(schedule.endTime), 'HH:mm')}
                          </Text>
                        </View>
                      ))}
                      {daySchedules.length === 0 && (
                        <Text style={styles.noSchedule}>No shifts</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
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
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navButton: {
    padding: 8,
  },
  navButtonText: {
    fontSize: 24,
    color: colors.primary,
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  scrollView: {
    flex: 1,
  },
  carerSection: {
    backgroundColor: colors.white,
    marginBottom: 16,
    padding: 16,
  },
  carerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 12,
  },
  dayRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayLabel: {
    width: 80,
    fontSize: 14,
    color: colors.textSecondary,
  },
  schedulesContainer: {
    flex: 1,
  },
  scheduleBlock: {
    backgroundColor: colors.background,
    borderRadius: 6,
    padding: 8,
    marginBottom: 4,
  },
  scheduleClient: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  scheduleTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  noSchedule: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});

export default TeamRotaScreen;

