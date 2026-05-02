import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, Job, JobStatus } from '../types';
import { jobService } from '../services/jobService';
import { authService } from '../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'Jobs'>;
type JobsViewTab = 'active' | 'history';

const VIEW_TABS: { label: string; value: JobsViewTab }[] = [
  { label: 'Active', value: 'active' },
  { label: 'History', value: 'history' },
];

const ACTIVE_STATUS_TABS: { label: string; value: JobStatus | 'all' }[] = [
  { label: 'All Active', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
];

const HISTORY_STATUS_TABS: { label: string; value: JobStatus | 'all' }[] = [
  { label: 'All History', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const parseDateInput = (value: string): Date | null => {
  if (!value.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const dt = new Date(`${value}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const JobsScreen: React.FC<Props> = ({ navigation }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewTab, setViewTab] = useState<JobsViewTab>('active');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const result = await jobService.getJobs(1, 100);
      setJobs(result.data);
    } catch {
      Alert.alert('Error', 'Failed to load jobs. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useFocusEffect(
    useCallback(() => {
      const loadUserRole = async () => {
        const localUser = await authService.getCurrentUser();
        const meUser = await authService.getMe();
        const roleCandidate =
          (meUser as any)?.role ||
          (meUser as any)?.data?.role ||
          (localUser as any)?.role ||
          (localUser as any)?.data?.role ||
          '';

        const normalizedRole = String(roleCandidate).trim().toLowerCase();
        setIsAdmin(normalizedRole === 'admin');
      };

      loadUserRole();
      return undefined;
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  useEffect(() => {
    setStatusFilter('all');
  }, [viewTab]);

  const stats = useMemo(() => {
    return {
      pending: jobs.filter(j => j.status === 'pending').length,
      in_progress: jobs.filter(j => j.status === 'in_progress').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      cancelled: jobs.filter(j => j.status === 'cancelled').length,
    };
  }, [jobs]);

  const statusTabs = useMemo(
    () => (viewTab === 'history' ? HISTORY_STATUS_TABS : ACTIVE_STATUS_TABS),
    [viewTab],
  );

  const hasDateFilterError = useMemo(() => {
    const hasFrom = fromDate.trim().length > 0;
    const hasTo = toDate.trim().length > 0;

    if (hasFrom && !parseDateInput(fromDate)) return true;
    if (hasTo && !parseDateInput(toDate)) return true;

    return false;
  }, [fromDate, toDate]);

  const filteredJobs = useMemo(() => {
    const from = parseDateInput(fromDate);
    const to = parseDateInput(toDate);
    const applyDateFilter = viewTab === 'history' && !hasDateFilterError;

    return jobs.filter(job => {
      const isHistoryJob = job.status === 'completed' || job.status === 'cancelled';
      const matchesView = viewTab === 'history' ? isHistoryJob : !isHistoryJob;
      if (!matchesView) return false;

      const searchLower = search.toLowerCase();
      const matchesSearch =
        job.id.toLowerCase().includes(searchLower) ||
        (job.technicianName && job.technicianName.toLowerCase().includes(searchLower)) ||
        (job.customerName && job.customerName.toLowerCase().includes(searchLower)) ||
        job.title.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;

      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
      if (!matchesStatus) return false;

      if (applyDateFilter && (from || to)) {
        const jobDate = new Date(job.scheduledAt);
        if (Number.isNaN(jobDate.getTime())) return false;

        if (from && jobDate < from) return false;
        if (to) {
          const toEnd = new Date(to);
          toEnd.setHours(23, 59, 59, 999);
          if (jobDate > toEnd) return false;
        }
      }

      return true;
    });
  }, [jobs, viewTab, search, statusFilter, fromDate, toDate, hasDateFilterError]);

  const renderJob = ({ item }: { item: Job }) => (
    <TouchableOpacity
      style={styles.jobCard}
      onPress={() => navigation.navigate('JobDetails', { jobId: item.id })}
    >
      <View style={styles.jobHeader}>
        <Text style={styles.jobIdText}>ID: {item.id.substring(0, 8).toUpperCase()}</Text>
        <View style={[styles.statusBadge, statusColor(item.status)]}>
          <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
        </View>
      </View>

      <Text style={styles.jobTitle}>{item.title}</Text>

      <View style={styles.jobDetailsRow}>
        <Text style={[styles.detailText, !item.technicianName && styles.unassignedText]}>
          <Text style={styles.detailLabel}>Tech : </Text>
          {item.technicianName || 'Registered'}
        </Text>
      </View>

      <View style={styles.jobFooter}>
        <Text style={styles.dateText}>
          📅 {new Date(item.scheduledAt).toLocaleDateString()} at {new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {viewTab === 'history' ? (
          <TouchableOpacity
            style={styles.invoiceBtn}
            onPress={() => navigation.navigate('Payment', { jobId: item.id })}
          >
            <Text style={styles.invoiceBtnText}>💳 Invoice</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const handleAddServicePress = async () => {
    const localUser = await authService.getCurrentUser();
    const meUser = await authService.getMe();
    const roleCandidate =
      (meUser as any)?.role ||
      (meUser as any)?.data?.role ||
      (localUser as any)?.role ||
      (localUser as any)?.data?.role ||
      '';
    const normalizedRole = String(roleCandidate).trim().toLowerCase();

    if (normalizedRole !== 'admin') {
      Alert.alert('Access denied', 'Only admin can add new services.');
      return;
    }

    navigation.navigate('AddService');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071428" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Job Management</Text>
        {isAdmin ? (
          <TouchableOpacity
            style={styles.addServiceBtn}
            onPress={handleAddServicePress}
          >
            <Text style={styles.addServiceBtnText}>+ Add Service</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#f39c12' }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#00d4e8' }]}>{stats.in_progress}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#2ecc71' }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#e74c3c' }]}>{stats.cancelled}</Text>
          <Text style={styles.statLabel}>Cancelled</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Job ID, technician, or customer..."
          placeholderTextColor="#4a658a"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.viewTabsContainer}>
        {VIEW_TABS.map(item => (
          <TouchableOpacity
            key={item.value}
            style={[styles.viewTab, viewTab === item.value && styles.viewTabActive]}
            onPress={() => setViewTab(item.value)}
          >
            <Text style={[styles.viewTabText, viewTab === item.value && styles.viewTabTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewTab === 'history' ? (
        <View style={styles.dateFiltersWrap}>
          <TextInput
            style={styles.dateInput}
            value={fromDate}
            onChangeText={setFromDate}
            placeholder="From YYYY-MM-DD"
            placeholderTextColor="#6b82a3"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.dateInput}
            value={toDate}
            onChangeText={setToDate}
            placeholder="To YYYY-MM-DD"
            placeholderTextColor="#6b82a3"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.clearDateBtn}
            onPress={() => {
              setFromDate('');
              setToDate('');
            }}
          >
            <Text style={styles.clearDateBtnText}>Clear</Text>
          </TouchableOpacity>
          {hasDateFilterError ? (
            <Text style={styles.dateErrorText}>Use valid dates in YYYY-MM-DD format.</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={statusTabs}
          keyExtractor={item => item.value}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tab, statusFilter === item.value && styles.tabActive]}
              onPress={() => setStatusFilter(item.value)}
            >
              <Text
                style={[
                  styles.tabText,
                  statusFilter === item.value && styles.tabTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00d4e8" />
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={item => item.id}
          renderItem={renderJob}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No jobs found matching your criteria.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const statusColor = (status: JobStatus): object => {
  const map: Record<JobStatus, object> = {
    pending: { backgroundColor: 'rgba(243, 156, 18, 0.15)', borderColor: '#f39c12', borderWidth: 1 },
    in_progress: { backgroundColor: 'rgba(0, 212, 232, 0.15)', borderColor: '#00d4e8', borderWidth: 1 },
    completed: { backgroundColor: 'rgba(46, 204, 113, 0.15)', borderColor: '#2ecc71', borderWidth: 1 },
    cancelled: { backgroundColor: 'rgba(231, 76, 60, 0.15)', borderColor: '#e74c3c', borderWidth: 1 },
  };
  return map[status];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071428'
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#0a1a35',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  addServiceBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 212, 232, 0.15)',
    borderWidth: 1,
    borderColor: '#00d4e8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addServiceBtnText: {
    color: '#00d4e8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '47%',
    backgroundColor: '#0c2242',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1d3b63',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#bacbe0',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16
  },
  searchInput: {
    backgroundColor: '#0c2242',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 232, 0.3)',
  },
  viewTabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#0c2242',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1d3b63',
    gap: 6,
  },
  viewTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  viewTabActive: {
    backgroundColor: 'rgba(0, 212, 232, 0.12)',
    borderWidth: 1,
    borderColor: '#00d4e8',
  },
  viewTabText: {
    color: '#bacbe0',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  viewTabTextActive: {
    color: '#00d4e8',
  },
  dateFiltersWrap: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  dateInput: {
    backgroundColor: '#0c2242',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#1d3b63',
    fontSize: 14,
  },
  clearDateBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(107, 130, 163, 0.18)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#35506f',
  },
  clearDateBtnText: {
    color: '#d7e2f0',
    fontSize: 12,
    fontWeight: '700',
  },
  dateErrorText: {
    color: '#ff7b7b',
    fontSize: 12,
    fontWeight: '600',
  },
  tabsContainer: {
    marginBottom: 16,
    height: 38,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0c2242',
    borderWidth: 1,
    borderColor: '#1d3b63',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(0, 212, 232, 0.1)',
    borderColor: '#00d4e8'
  },
  tabText: {
    fontSize: 13,
    color: '#bacbe0',
    fontWeight: '600'
  },
  tabTextActive: {
    color: '#00d4e8',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32
  },
  jobCard: {
    backgroundColor: '#0a1a35',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1d3b63',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  jobIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b82a3',
    letterSpacing: 1
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 10
  },
  jobDetailsRow: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#ffffff',
  },
  detailLabel: {
    color: '#6b82a3',
  },
  unassignedText: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  jobFooter: {
    borderTopWidth: 1,
    borderTopColor: '#1d3b63',
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dateText: {
    fontSize: 13,
    color: '#bacbe0',
    fontWeight: '500',
    flex: 1,
  },
  invoiceBtn: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    borderWidth: 1,
    borderColor: '#2ecc71',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  invoiceBtnText: {
    color: '#6ef4ac',
    fontSize: 12,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: '#6b82a3',
    fontSize: 15
  },
});

export default JobsScreen;
