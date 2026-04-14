import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { schedulesService } from '../../services/schedules';
import { Schedule } from '../../types';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { colors } from '../../theme/colors';

const WeeklyRotaScreen: React.FC = () => {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [schedules, setSchedules] = useState<Record<string, Schedule[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    loadRota();
  }, [weekStart]);

  const loadRota = async () => {
    try {
      setLoading(true);
      const data = await schedulesService.getWeeklyRota(undefined, weekStart.toISOString());
      setSchedules(data.schedules);
      // Set selected day to today if it exists, otherwise first day of week
      const today = format(new Date(), 'yyyy-MM-dd');
      if (data.schedules[today]) {
        setSelectedDay(today);
      } else {
        const firstDay = Object.keys(data.schedules)[0];
        if (firstDay) setSelectedDay(firstDay);
      }
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
      label: format(date, 'EEE'),
      day: format(date, 'd'),
    };
  });

  const selectedDaySchedules = schedules[selectedDay] || [];

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysContainer}>
        {days.map((day) => (
          <TouchableOpacity
            key={day.key}
            style={[
              styles.dayButton,
              selectedDay === day.key && styles.dayButtonSelected,
            ]}
            onPress={() => setSelectedDay(day.key)}
          >
            <Text
              style={[
                styles.dayLabel,
                selectedDay === day.key && styles.dayLabelSelected,
              ]}
            >
              {day.label}
            </Text>
            <Text
              style={[
                styles.dayNumber,
                selectedDay === day.key && styles.dayNumberSelected,
              ]}
            >
              {day.day}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={selectedDaySchedules}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.scheduleCard}>
            <Text style={styles.clientName}>{item.client.name}</Text>
            <Text style={styles.address}>{item.client.address}</Text>
            <Text style={styles.time}>
              {format(new Date(item.startTime), 'HH:mm')} -{' '}
              {format(new Date(item.endTime), 'HH:mm')}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No shifts scheduled</Text>
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
  daysContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayButton: {
    padding: 16,
    alignItems: 'center',
    minWidth: 60,
  },
  dayButtonSelected: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  dayLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  dayLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  dayNumber: {
    fontSize: 18,
    color: colors.foreground,
    fontWeight: '500',
  },
  dayNumberSelected: {
    color: colors.primary,
  },
  list: {
    padding: 16,
  },
  scheduleCard: {
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
  clientName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
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

export default WeeklyRotaScreen;

