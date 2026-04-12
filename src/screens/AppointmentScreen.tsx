import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Appointment } from '../types';
import { appointmentService } from '../services/appointmentService';

type Props = NativeStackScreenProps<RootStackParamList, 'Appointment'>;

const AppointmentScreen: React.FC<Props> = ({ route, navigation }) => {
  const { appointmentId, jobId } = route.params ?? {};
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      if (jobId && !appointmentId) {
        const data = await appointmentService.getAppointmentsByJob(jobId);
        setAppointments(data);
      } else {
        const result = await appointmentService.getAppointments(1, 20);
        setAppointments(result.data);
      }
    } catch {
      Alert.alert('Error', 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [jobId, appointmentId]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleCancel = (id: string) => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(id);
            try {
              await appointmentService.cancelAppointment(id);
              setAppointments(prev => prev.filter(a => a.id !== id));
            } catch {
              Alert.alert('Error', 'Failed to cancel appointment.');
            } finally {
              setCancelling(null);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: Appointment }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.jobTitle}</Text>
        <View style={[styles.statusBadge, apptStatusColor(item.status)]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <Text style={styles.customerName}>👤 {item.customerName}</Text>
      <Text style={styles.address}>📍 {item.address}</Text>

      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>Scheduled</Text>
        <Text style={styles.timeValue}>
          {new Date(item.scheduledAt).toLocaleString()}
        </Text>
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>Duration</Text>
        <Text style={styles.timeValue}>{item.duration} min</Text>
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>Technician</Text>
        <Text style={styles.timeValue}>{item.technicianName}</Text>
      </View>

      {item.notes ? (
        <Text style={styles.notes}>{item.notes}</Text>
      ) : null}

      {item.status === 'scheduled' || item.status === 'confirmed' ? (
        <TouchableOpacity
          style={[
            styles.cancelBtn,
            cancelling === item.id && styles.cancelBtnDisabled,
          ]}
          onPress={() => handleCancel(item.id)}
          disabled={cancelling === item.id}
        >
          {cancelling === item.id ? (
            <ActivityIndicator size="small" color="#e94560" />
          ) : (
            <Text style={styles.cancelBtnText}>Cancel Appointment</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointments</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No appointments found.</Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const apptStatusColor = (status: string): object => {
  const map: Record<string, object> = {
    scheduled: { backgroundColor: '#0f3460' },
    confirmed: { backgroundColor: '#2d6a4f' },
    completed: { backgroundColor: '#444' },
    cancelled: { backgroundColor: '#c1440e' },
  };
  return map[status] ?? { backgroundColor: '#444' };
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#16213e',
  },
  backBtn: { width: 60 },
  backText: { color: '#e94560', fontSize: 15, fontWeight: '600' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  listContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#e94560',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  customerName: { fontSize: 13, color: '#aaa', marginBottom: 4 },
  address: { fontSize: 12, color: '#888', marginBottom: 10 },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  timeLabel: { fontSize: 13, color: '#888' },
  timeValue: { fontSize: 13, color: '#ccc', fontWeight: '600' },
  notes: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 10,
    fontStyle: 'italic',
  },
  cancelBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnDisabled: { opacity: 0.5 },
  cancelBtnText: { color: '#e94560', fontWeight: '700', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 60, fontSize: 15 },
});

export default AppointmentScreen;
