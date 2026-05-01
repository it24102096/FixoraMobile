import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Job, Appointment, User } from '../types';
import { authService } from '../services/authService';
import { jobService } from '../services/jobService';
import { appointmentService } from '../services/appointmentService';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [user, setUser] = useState<User | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();

      const [jobsRes, apptRes] = await Promise.all([
        jobService.getJobs(1, 5, 'in_progress'),
        appointmentService.getAppointments(1, 5, 'scheduled'),
      ]);

      setUser(currentUser);
      setRecentJobs(jobsRes.data);
      setTodayAppointments(apptRes.data);
    } catch {
      Alert.alert('Error', 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await authService.logout();
          navigation.replace('Login');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name ?? 'Technician'} 👋</Text>
          <Text style={styles.subGreeting}>Here's your overview for today</Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity
            onPress={() => navigation.navigate('EditProfile')}
            style={styles.profileBtn}
          >
            <Text style={styles.profileBtnText}>👤</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e94560"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#e94560' }]}>
            <Text style={styles.statNumber}>{recentJobs.length}</Text>
            <Text style={styles.statLabel}>Active Jobs</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#0f3460' }]}>
            <Text style={styles.statNumber}>{todayAppointments.length}</Text>
            <Text style={styles.statLabel}>Appointments</Text>
          </View>
        </View>

        {/* Quick Navigation */}
        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.navGrid}>
          {[
            ...(user?.role === 'customer' || user?.role === 'admin'
              ? [{ label: 'Services', icon: '🛠️', screen: 'Services' as const }]
              : []),
            ...(user?.role === 'admin'
              ? [{ label: 'Add Service', icon: '➕', screen: 'AddService' as const }]
              : []),
            { label: 'Jobs', icon: '🔧', screen: 'Jobs' as const },
            { label: 'Appointments', icon: '📅', screen: 'Appointment' as const },
            { label: 'Payments', icon: '💳', screen: 'PaymentsList' as const },
            { label: 'Support', icon: '💬', screen: 'Support' as const },
          ].map(item => (
            <TouchableOpacity
              key={item.label}
              style={styles.navCard}
              onPress={() => navigation.navigate(item.screen as any)}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={styles.navLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Jobs */}
        <Text style={styles.sectionTitle}>Active Jobs</Text>
        {recentJobs.length === 0 ? (
          <Text style={styles.emptyText}>No active jobs at the moment.</Text>
        ) : (
          recentJobs.map(job => (
            <TouchableOpacity
              key={job.id}
              style={styles.jobCard}
              onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}
            >
              <View style={styles.jobCardHeader}>
                <Text style={styles.jobTitle} numberOfLines={1}>
                  {job.title}
                </Text>
                <View style={[styles.priorityBadge, priorityColor(job.priority)]}>
                  <Text style={styles.priorityText}>{job.priority}</Text>
                </View>
              </View>
              <Text style={styles.jobCustomer}>{job.customerName}</Text>
              <Text style={styles.jobAddress} numberOfLines={1}>
                📍 {job.address}
              </Text>
            </TouchableOpacity>
          ))
        )}

        {/* Today's Appointments */}
        <Text style={styles.sectionTitle}>Today's Appointments</Text>
        {todayAppointments.length === 0 ? (
          <Text style={styles.emptyText}>No appointments scheduled today.</Text>
        ) : (
          todayAppointments.map(appt => (
            <TouchableOpacity
              key={appt.id}
              style={styles.apptCard}
              onPress={() =>
                navigation.navigate('Appointment', { appointmentId: appt.id })
              }
            >
              <Text style={styles.apptTitle}>{appt.jobTitle}</Text>
              <Text style={styles.apptCustomer}>{appt.customerName}</Text>
              <Text style={styles.apptTime}>
                🕐 {new Date(appt.scheduledAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </TouchableOpacity>
          ))
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const priorityColor = (priority: string) => {
  const map: Record<string, object> = {
    low: { backgroundColor: '#2d6a4f' },
    medium: { backgroundColor: '#d4a017' },
    high: { backgroundColor: '#c1440e' },
    urgent: { backgroundColor: '#e94560' },
  };
  return map[priority] ?? { backgroundColor: '#444' };
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#16213e',
  },
  greeting: { fontSize: 20, fontWeight: '700', color: '#fff' },
  subGreeting: { fontSize: 13, color: '#888', marginTop: 2 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileBtn: {
    backgroundColor: 'rgba(76,222,154,0.15)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4cde9a',
  },
  profileBtnText: { fontSize: 18 },
  logoutBtn: {
    backgroundColor: 'rgba(233,69,96,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  logoutText: { color: '#e94560', fontSize: 13, fontWeight: '600' },
  scrollView: { flex: 1 },
  statsRow: {
    flexDirection: 'row',
    margin: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  statNumber: { fontSize: 32, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
  },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 12,
    gap: 10,
    marginBottom: 8,
  },
  navCard: {
    width: '46%',
    backgroundColor: '#16213e',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  navIcon: { fontSize: 28, marginBottom: 8 },
  navLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  jobCard: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
  },
  jobCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobTitle: { fontSize: 15, fontWeight: '700', color: '#fff', flex: 1 },
  priorityBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  priorityText: { fontSize: 11, color: '#fff', fontWeight: '600', textTransform: 'capitalize' },
  jobCustomer: { fontSize: 13, color: '#aaa', marginTop: 4 },
  jobAddress: { fontSize: 12, color: '#888', marginTop: 4 },
  apptCard: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#e94560',
  },
  apptTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  apptCustomer: { fontSize: 13, color: '#aaa', marginTop: 4 },
  apptTime: { fontSize: 12, color: '#e94560', marginTop: 6, fontWeight: '600' },
  emptyText: { fontSize: 14, color: '#666', marginHorizontal: 16, marginBottom: 12 },
  bottomPadding: { height: 40 },
});

export default HomeScreen;
