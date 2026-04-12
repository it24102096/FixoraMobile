import React, { useCallback, useEffect, useState, useMemo } from 'react';
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
import { RootStackParamList, Job, JobStatus } from '../types';
import { jobService } from '../services/jobService';

type Props = NativeStackScreenProps<RootStackParamList, 'Jobs'>;

const STATUS_TABS: { label: string; value: JobStatus | 'all' }[] = [
  { label: 'All Jobs', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const JobsScreen: React.FC<Props> = ({ navigation }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<JobStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  
  // Since we want to compute stats for all items, we'll try to fetch all or use the loaded list.
  // For the sake of the requirement "Show all jobs in a list" and "4 stat cards at top",
  // we'll fetch them all (or assume they exist in local state) to compute stats correctly.
  
  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      // Fetching all jobs to calculate stats properly. You may paginate if API allows stat fetching.
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  const stats = useMemo(() => {
    return {
      pending: jobs.filter(j => j.status === 'pending').length,
      in_progress: jobs.filter(j => j.status === 'in_progress').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      cancelled: jobs.filter(j => j.status === 'cancelled').length,
    };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = 
        job.id.toLowerCase().includes(search.toLowerCase()) || 
        (job.technicianName && job.technicianName.toLowerCase().includes(search.toLowerCase())) ||
        job.title.toLowerCase().includes(search.toLowerCase());
        
      const matchesTab = activeTab === 'all' || job.status === activeTab;
      
      return matchesSearch && matchesTab;
    });
  }, [jobs, search, activeTab]);

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
        <Text style={styles.detailText}>
          <Text style={styles.detailLabel}>Tech: </Text>
          {item.technicianName || 'Unassigned'}
        </Text>
      </View>
      
      <View style={styles.jobFooter}>
        <Text style={styles.dateText}>
          📅 {new Date(item.scheduledAt).toLocaleDateString()} at {new Date(item.scheduledAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071428" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Job Management</Text>
      </View>

      {/* Stats Grid */}
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

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Job ID or Technician..."
          placeholderTextColor="#4a658a"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_TABS}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tab, activeTab === item.value && styles.tabActive]}
              onPress={() => setActiveTab(item.value)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === item.value && styles.tabTextActive,
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
  jobFooter: { 
    borderTopWidth: 1,
    borderTopColor: '#1d3b63',
    paddingTop: 12,
  },
  dateText: { 
    fontSize: 13, 
    color: '#bacbe0', 
    fontWeight: '500' 
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
