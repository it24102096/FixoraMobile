import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { authService } from '../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'TechnicianAvailability'>;

interface WorkingHours {
  startTime: string;
  endTime: string;
}

interface DayConfig {
  key: string;
  label: string;
  short: string;
  isWeekend: boolean;
}

const ALL_DAYS: DayConfig[] = [
  { key: 'monday',    label: 'Monday',    short: 'Mon', isWeekend: false },
  { key: 'tuesday',   label: 'Tuesday',   short: 'Tue', isWeekend: false },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed', isWeekend: false },
  { key: 'thursday',  label: 'Thursday',  short: 'Thu', isWeekend: false },
  { key: 'friday',    label: 'Friday',    short: 'Fri', isWeekend: false },
  { key: 'saturday',  label: 'Saturday',  short: 'Sat', isWeekend: true  },
  { key: 'sunday',    label: 'Sunday',    short: 'Sun', isWeekend: true  },
];

const WEEKDAYS = ALL_DAYS.filter(d => !d.isWeekend);
const WEEKEND  = ALL_DAYS.filter(d =>  d.isWeekend);

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const TechnicianAvailabilityScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState(false);

  const [workingHours, setWorkingHours] = useState<WorkingHours>({ startTime: '09:00', endTime: '17:00' });
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [tab, setTab] = useState<'hours' | 'days'>('hours');

  const loadProfile = useCallback(async () => {
    try {
      const currentUser = (await authService.getMe()) || (await authService.getCurrentUser());
      if (currentUser?.workingHours) {
        setWorkingHours(currentUser.workingHours);
      }
      if (currentUser?.availableDates) {
        setSelectedDays(currentUser.availableDates);
      }
    } catch {
      Alert.alert('Error', 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const toggleDay = (key: string) => {
    setSelectedDays(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key],
    );
  };

  const selectGroup = (days: DayConfig[]) => {
    const keys = days.map(d => d.key);
    const allOn = keys.every(k => selectedDays.includes(k));
    setSelectedDays(prev =>
      allOn ? prev.filter(k => !keys.includes(k)) : Array.from(new Set([...prev, ...keys])),
    );
  };

  const handleSave = async () => {
    if (!HHMM_REGEX.test(workingHours.startTime) || !HHMM_REGEX.test(workingHours.endTime)) {
      Alert.alert('Invalid Time', 'Please use HH:mm format — e.g. 09:00 or 17:30');
      return;
    }
    const [sH, sM] = workingHours.startTime.split(':').map(Number);
    const [eH, eM] = workingHours.endTime.split(':').map(Number);
    if (sH * 60 + sM >= eH * 60 + eM) {
      Alert.alert('Invalid Time', 'Start time must be earlier than end time');
      return;
    }
    if (selectedDays.length === 0) {
      Alert.alert('No Days Selected', 'Please select at least one working day');
      return;
    }
    setUpdating(true);
    try {
      await authService.updateAvailability({ workingHours, availableDates: selectedDays });
      Alert.alert('Saved ✅', 'Your availability has been updated!');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update availability');
      console.error('Availability update error:', err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4cde9a" />
      </View>
    );
  }

  const weekdaysAllOn = WEEKDAYS.every(d => selectedDays.includes(d.key));
  const weekendAllOn  = WEEKEND.every(d  => selectedDays.includes(d.key));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071428" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set Availability</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'hours' && styles.tabButtonActive]}
          onPress={() => setTab('hours')}
        >
          <Text style={[styles.tabText, tab === 'hours' && styles.tabTextActive]}>⏰ Working Hours</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'days' && styles.tabButtonActive]}
          onPress={() => setTab('days')}
        >
          <Text style={[styles.tabText, tab === 'days' && styles.tabTextActive]}>📅 Working Days</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Working Hours Tab ── */}
        {tab === 'hours' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Working Hours</Text>
            <Text style={styles.description}>24-hour format  (e.g. 09:00 — 17:30)</Text>

            <Text style={styles.label}>Start Time</Text>
            <TextInput
              style={styles.input}
              value={workingHours.startTime}
              onChangeText={t => setWorkingHours(p => ({ ...p, startTime: t }))}
              placeholder="09:00"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.label, { marginTop: 14 }]}>End Time</Text>
            <TextInput
              style={styles.input}
              value={workingHours.endTime}
              onChangeText={t => setWorkingHours(p => ({ ...p, endTime: t }))}
              placeholder="17:00"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>🕐  {workingHours.startTime}  —  {workingHours.endTime}</Text>
            </View>
          </View>
        )}

        {/* ── Working Days Tab ── */}
        {tab === 'days' && (
          <>
            {/* Weekdays */}
            <View style={styles.section}>
              <View style={styles.groupHeader}>
                <Text style={styles.sectionTitle}>Weekdays</Text>
                <TouchableOpacity
                  style={[styles.selectAllBtn, weekdaysAllOn && styles.selectAllBtnActive]}
                  onPress={() => selectGroup(WEEKDAYS)}
                >
                  <Text style={[styles.selectAllText, weekdaysAllOn && styles.selectAllTextActive]}>
                    {weekdaysAllOn ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dayGrid}>
                {WEEKDAYS.map(day => {
                  const on = selectedDays.includes(day.key);
                  return (
                    <TouchableOpacity
                      key={day.key}
                      style={[styles.dayCard, on && styles.dayCardActive]}
                      onPress={() => toggleDay(day.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dayShort, on && styles.dayShortActive]}>{day.short}</Text>
                      <Text style={[styles.dayLabel, on && styles.dayLabelActive]}>{day.label}</Text>
                      {on && <View style={styles.tick}><Text style={styles.tickText}>✓</Text></View>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Weekend */}
            <View style={[styles.section, { marginTop: 14 }]}>
              <View style={styles.groupHeader}>
                <Text style={styles.sectionTitle}>Weekend</Text>
                <TouchableOpacity
                  style={[styles.selectAllBtn, weekendAllOn && styles.selectAllBtnActive]}
                  onPress={() => selectGroup(WEEKEND)}
                >
                  <Text style={[styles.selectAllText, weekendAllOn && styles.selectAllTextActive]}>
                    {weekendAllOn ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dayGrid}>
                {WEEKEND.map(day => {
                  const on = selectedDays.includes(day.key);
                  return (
                    <TouchableOpacity
                      key={day.key}
                      style={[styles.dayCard, styles.dayCardWide, on && styles.dayCardWeekendActive]}
                      onPress={() => toggleDay(day.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dayShort, on && styles.dayShortActive]}>{day.short}</Text>
                      <Text style={[styles.dayLabel, on && styles.dayLabelActive]}>{day.label}</Text>
                      {on && <View style={styles.tick}><Text style={styles.tickText}>✓</Text></View>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Summary */}
            {selectedDays.length > 0 && (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Selected ({selectedDays.length} days)</Text>
                <Text style={styles.summaryText}>
                  {ALL_DAYS.filter(d => selectedDays.includes(d.key)).map(d => d.label).join(', ')}
                </Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={updating}>
          {updating
            ? <ActivityIndicator color="#071428" />
            : <Text style={styles.saveButtonText}>Save Availability</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0d1b2a' },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d1b2a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: '#071428',
  },
  backBtn:     { padding: 4 },
  backText:    { color: '#e94560', fontSize: 14, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#162032',
    borderBottomWidth: 1,
    borderBottomColor: '#1e3050',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: { borderBottomColor: '#4cde9a' },
  tabText:         { color: '#555', fontSize: 13, fontWeight: '600' },
  tabTextActive:   { color: '#4cde9a' },
  scrollContent: { padding: 16, paddingBottom: 110 },
  section: {
    backgroundColor: '#162032',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e3050',
  },
  sectionTitle: {
    color: '#4cde9a',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  description: { color: '#666', fontSize: 12, marginBottom: 14, marginTop: 4 },
  label:       { color: '#aab', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: '#0d1b2a',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#223344',
    fontSize: 15,
  },
  infoBox: {
    backgroundColor: 'rgba(76,222,154,0.1)',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4cde9a',
    marginTop: 16,
    alignItems: 'center',
  },
  infoText: { color: '#4cde9a', fontSize: 15, fontWeight: '700' },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  selectAllBtn: {
    borderWidth: 1,
    borderColor: '#4cde9a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  selectAllBtnActive:  { backgroundColor: '#4cde9a' },
  selectAllText:       { color: '#4cde9a', fontSize: 12, fontWeight: '600' },
  selectAllTextActive: { color: '#071428', fontWeight: '700' },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dayCard: {
    width: '28%',
    backgroundColor: '#0d1b2a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#223344',
    position: 'relative',
  },
  dayCardActive: {
    borderColor: '#4cde9a',
    backgroundColor: 'rgba(76,222,154,0.1)',
  },
  dayCardWide: { width: '44%' },
  dayCardWeekendActive: {
    borderColor: '#7eb8f7',
    backgroundColor: 'rgba(126,184,247,0.1)',
  },
  dayShort:       { color: '#888', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  dayShortActive: { color: '#fff' },
  dayLabel:       { color: '#aaa', fontSize: 12, textAlign: 'center' },
  dayLabelActive: { color: '#fff', fontWeight: '600' },
  tick: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4cde9a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickText: { color: '#071428', fontSize: 10, fontWeight: '800' },
  summaryBox: {
    marginTop: 14,
    backgroundColor: 'rgba(76,222,154,0.07)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(76,222,154,0.3)',
  },
  summaryTitle: { color: '#4cde9a', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  summaryText:  { color: '#ccc', fontSize: 12, lineHeight: 18 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#162032',
    borderTopWidth: 1,
    borderTopColor: '#1e3050',
  },
  saveButton: {
    backgroundColor: '#4cde9a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: '#071428', fontSize: 16, fontWeight: '700' },
});

export default TechnicianAvailabilityScreen;
