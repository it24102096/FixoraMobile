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
import { RootStackParamList, Job, Appointment, User, FinanceSummary } from '../types';
import { authService } from '../services/authService';
import { jobService } from '../services/jobService';
import { appointmentService } from '../services/appointmentService';
import { paymentService } from '../services/paymentService';
import { BarChart, PieChart } from 'react-native-gifted-charts';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [user, setUser] = useState<User | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();

      const isAdmin = currentUser?.role === 'admin';

      const [jobsRes, apptRes, financeRes] = await Promise.all([
        jobService.getJobs(1, 5, 'in_progress'),
        appointmentService.getAppointments(1, 5, 'scheduled'),
        isAdmin ? paymentService.getFinanceSummary() : Promise.resolve(null),
      ]);

      setUser(currentUser);
      setRecentJobs(jobsRes.data);
      setTodayAppointments(apptRes.data);
      setFinanceSummary(financeRes);
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

        {/* Payment Summary Chart — admin only */}
        {user?.role === 'admin' && financeSummary && (() => {
          const t = financeSummary.totals;
          const fmt = (v: number) => `$${v.toFixed(0)}`;

          // Bar chart data — payment amounts by status
          const barData = [
            { value: t.paidAmount,     label: 'Paid',     frontColor: '#6a7acb', topLabelComponent: () => <Text style={{ color: '#4cde9a', fontSize: 9 }}>{fmt(t.paidAmount)}</Text> },
            { value: t.pendingAmount,  label: 'Pending',  frontColor: '#d4a017', topLabelComponent: () => <Text style={{ color: '#d4a017', fontSize: 9 }}>{fmt(t.pendingAmount)}</Text> },
            { value: t.failedAmount,   label: 'Failed',   frontColor: '#c1440e', topLabelComponent: () => <Text style={{ color: '#c1440e', fontSize: 9 }}>{fmt(t.failedAmount)}</Text> },
            { value: t.refundedAmount, label: 'Refunded', frontColor: '#888',    topLabelComponent: () => <Text style={{ color: '#888', fontSize: 9 }}>{fmt(t.refundedAmount)}</Text> },
          ];

          // Pie chart data — earnings split
          const pieData = [
            { value: t.platformEarnings || 0,       color: '#e94560', text: 'Platform' },
            { value: t.technicianEarningsTotal || 0, color: '#4e83ad', text: 'Technician' },
          ];
          const pieTotal = (t.platformEarnings || 0) + (t.technicianEarningsTotal || 0);

          return (
            <View style={styles.chartSection}>
              <Text style={styles.chartTitle}>💰 Payment Summary</Text>

              {/* Stat chips */}
              <View style={styles.chartChips}>
                <View style={styles.chip}>
                  <Text style={styles.chipVal}>{t.totalInvoices}</Text>
                  <Text style={styles.chipLbl}>Invoices</Text>
                </View>
                <View style={[styles.chip, { borderColor: '#1e3050' }]}>
                  <Text style={[styles.chipVal, { color: '#7eb8f7' }]}>{fmt(t.totalAmount)}</Text>
                  <Text style={styles.chipLbl}>Total</Text>
                </View>
                <View style={[styles.chip, { borderColor: '#2d6a4f' }]}>
                  <Text style={[styles.chipVal, { color: '#4cde9a' }]}>{fmt(t.paidAmount)}</Text>
                  <Text style={styles.chipLbl}>Collected</Text>
                </View>
              </View>

              {/* Bar Chart — amounts by status */}
              <Text style={styles.chartSubtitle}>Revenue by Status</Text>
              <View style={styles.chartWrap}>
                <BarChart
                  data={barData}
                  barWidth={38}
                  spacing={18}
                  roundedTop
                  hideRules
                  xAxisThickness={1}
                  yAxisThickness={0}
                  xAxisColor="#1e3050"
                  yAxisTextStyle={{ color: '#666', fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: '#aaa', fontSize: 10 }}
                  noOfSections={4}
                  maxValue={Math.max(t.paidAmount, t.pendingAmount, t.failedAmount, t.refundedAmount, 1) * 1.2}
                  barBorderRadius={4}
                  backgroundColor="transparent"
                  isAnimated
                />
              </View>

              {/* Pie Chart — earnings split */}
              <Text style={[styles.chartSubtitle, { marginTop: 16 }]}>Earnings Split</Text>
              <View style={styles.pieRow}>
                <PieChart
                  data={pieData}
                  donut
                  radius={70}
                  innerRadius={44}
                  centerLabelComponent={() => (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{fmt(pieTotal)}</Text>
                      <Text style={{ color: '#888', fontSize: 9 }}>Total</Text>
                    </View>
                  )}
                  isAnimated
                />
                <View style={styles.pieLegend}>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: '#e94560' }]} />
                    <View>
                      <Text style={styles.legendLabel}>Platform</Text>
                      <Text style={styles.legendValue}>{fmt(t.platformEarnings || 0)}</Text>
                    </View>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: '#4cde9a' }]} />
                    <View>
                      <Text style={styles.legendLabel}>Technician</Text>
                      <Text style={styles.legendValue}>{fmt(t.technicianEarningsTotal || 0)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          );
        })()}

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
  // ── Payment chart ──────────────────────────────────────────────────────────
  chartSection: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e3050',
  },
  chartTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  chartChips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    flex: 1,
    backgroundColor: '#0f1f38',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e3050',
    paddingVertical: 8,
    alignItems: 'center',
  },
  chipVal: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  chipLbl: {
    color: '#8899aa',
    fontSize: 11,
    marginTop: 2,
  },
  chartSubtitle: {
    color: '#aab',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  barLabel: {
    color: '#ccc',
    fontSize: 12,
    width: 68,
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#0f1f38',
    borderRadius: 5,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  barValue: {
    color: '#aaa',
    fontSize: 11,
    width: 46,
    textAlign: 'right',
  },
  chartWrap: {
    alignItems: 'flex-start',
    marginLeft: -8,
  },
  pieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 4,
  },
  pieLegend: {
    flex: 1,
    gap: 14,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    color: '#aaa',
    fontSize: 12,
  },
  legendValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default HomeScreen;
