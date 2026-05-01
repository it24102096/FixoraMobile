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
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, FinanceSummary, Payment } from '../types';
import { paymentService } from '../services/paymentService';
import { authService } from '../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentsList'>;

const statusColor: Record<string, string> = {
  pending: '#d4a017',
  paid: '#2d6a4f',
  failed: '#c1440e',
  refunded: '#555',
};

const PaymentsListScreen: React.FC<Props> = ({ navigation }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTechnician, setIsTechnician] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPayments = useCallback(async () => {
    try {
      const user = await authService.getCurrentUser();
      const admin = user?.role === 'admin';
      const technician = user?.role === 'technician';
      setIsAdmin(admin);
      setIsTechnician(technician);

      const res = await paymentService.getPayments();
      setPayments(res.data);

      if (admin) {
        const financeSummary = await paymentService.getFinanceSummary();
        setSummary(financeSummary);
      } else {
        setSummary(null);
      }
    } catch {
      Alert.alert('Error', 'Failed to load payments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPayments();
  };

  const currency = payments[0]?.currency || 'USD';
  const techPaidPayout = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.technicianEarnings ?? p.amount ?? 0), 0);
  const techPendingPayout = payments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const techPaidCount = payments.filter((p) => p.status === 'paid').length;
  const techPendingCount = payments.filter((p) => p.status === 'pending').length;
  const techFailedCount = payments.filter((p) => p.status === 'failed').length;
  const techRefundedCount = payments.filter((p) => p.status === 'refunded').length;
  const techPaidInvoicesTotal = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.total ?? 0), 0);

  const monthLabel = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const monthlyMap = payments
    .filter((p) => p.status === 'paid')
    .reduce((acc, p) => {
      const rawDate = p.paidAt || p.dueDate;
      const d = new Date(rawDate);
      if (Number.isNaN(d.getTime())) return acc;

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const payout = p.technicianEarnings ?? p.amount ?? 0;

      if (!acc[key]) {
        acc[key] = { key, label: monthLabel(d), monthPayout: 0 };
      }
      acc[key].monthPayout += payout;
      return acc;
    }, {} as Record<string, { key: string; label: string; monthPayout: number }>);

  const monthlyRows = Object.values(monthlyMap)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((row, idx, arr) => {
      const cumulative = arr
        .slice(0, idx + 1)
        .reduce((sum, item) => sum + item.monthPayout, 0);
      return { ...row, cumulative };
    });

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthPayout = monthlyMap[currentMonthKey]?.monthPayout || 0;

  const renderItem = ({ item }: { item: Payment }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate('Payment', {
          jobId: typeof item.jobId === 'string' ? item.jobId : (item.jobId as any)?._id ?? '',
          paymentId: item.id,
        })
      }
    >
      <View style={styles.cardTop}>
        <Text style={styles.invoiceNum}>Invoice #{item.invoiceNumber}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor[item.status] ?? '#555' }]}>
          <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.total}>
          {item.currency} {item.total.toFixed(2)}
        </Text>
        <Text style={styles.due}>Due: {new Date(item.dueDate).toLocaleDateString()}</Text>
      </View>
      {item.paidAt && (
        <Text style={styles.paidAt}>
          Paid on {new Date(item.paidAt).toLocaleDateString()}
        </Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payments</Text>
        <View style={{ width: 60 }} />
      </View>

      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          isAdmin && summary ? (
            <View style={styles.summaryWrap}>
              <Text style={styles.summaryTitle}>Finance Summary</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Invoices</Text>
                  <Text style={styles.summaryValue}>{summary.totals.totalInvoices}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Total</Text>
                  <Text style={styles.summaryValue}>${summary.totals.totalAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Paid</Text>
                  <Text style={[styles.summaryValue, { color: '#2d6a4f' }]}>${summary.totals.paidAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Pending</Text>
                  <Text style={[styles.summaryValue, { color: '#d4a017' }]}>${summary.totals.pendingAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Failed</Text>
                  <Text style={[styles.summaryValue, { color: '#c1440e' }]}>${summary.totals.failedAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Refunded</Text>
                  <Text style={[styles.summaryValue, { color: '#8899aa' }]}>${summary.totals.refundedAmount.toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryCard, { borderColor: '#e94560', borderWidth: 1 }]}>
                  <Text style={[styles.summaryLabel, { color: '#e94560' }]}>🏢 Platform Share</Text>
                  <Text style={[styles.summaryValue, { color: '#e94560' }]}>${(summary.totals.platformEarnings ?? 0).toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryCard, { borderColor: '#4a7c59', borderWidth: 1 }]}>
                  <Text style={[styles.summaryLabel, { color: '#4a7c59' }]}>👨‍🔧 Technician Payouts</Text>
                  <Text style={[styles.summaryValue, { color: '#4a7c59' }]}>${(summary.totals.technicianEarningsTotal ?? 0).toFixed(2)}</Text>
                </View>
              </View>
            </View>
          ) : isTechnician ? (
            <View style={styles.summaryWrap}>
              <Text style={styles.summaryTitle}>My Earnings Summary</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>My Invoices</Text>
                  <Text style={styles.summaryValue}>{payments.length}</Text>
                </View>
                <View style={[styles.summaryCard, { borderColor: '#4a7c59', borderWidth: 1 }]}>
                  <Text style={[styles.summaryLabel, { color: '#4a7c59' }]}>This Month Salary</Text>
                  <Text style={[styles.summaryValue, { color: '#4a7c59' }]}>{currency} {currentMonthPayout.toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryCard, { borderColor: '#2d6a4f', borderWidth: 1 }]}>
                  <Text style={[styles.summaryLabel, { color: '#2d6a4f' }]}>Total Earned</Text>
                  <Text style={[styles.summaryValue, { color: '#4a7c59' }]}>{currency} {techPaidPayout.toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryCard, { borderColor: '#d4a017', borderWidth: 1 }]}>
                  <Text style={[styles.summaryLabel, { color: '#d4a017' }]}>Pending Payout</Text>
                  <Text style={[styles.summaryValue, { color: '#d4a017' }]}>{currency} {techPendingPayout.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Full Paid Invoices</Text>
                  <Text style={styles.summaryValue}>{currency} {techPaidInvoicesTotal.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Paid Jobs</Text>
                  <Text style={[styles.summaryValue, { color: '#2d6a4f' }]}>{techPaidCount}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Pending Jobs</Text>
                  <Text style={[styles.summaryValue, { color: '#d4a017' }]}>{techPendingCount}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Failed/Refunded</Text>
                  <Text style={[styles.summaryValue, { color: '#c1440e' }]}>{techFailedCount + techRefundedCount}</Text>
                </View>
              </View>

              <View style={styles.monthlySection}>
                <Text style={styles.monthlyTitle}>Monthly Earnings</Text>
                {monthlyRows.length === 0 ? (
                  <Text style={styles.monthlyEmpty}>No paid payments yet.</Text>
                ) : (
                  monthlyRows.map((row) => (
                    <View key={row.key} style={styles.monthlyRow}>
                      <View>
                        <Text style={styles.monthlyLabel}>{row.label}</Text>
                        <Text style={styles.monthlySub}>Month: {currency} {row.monthPayout.toFixed(2)}</Text>
                      </View>
                      <Text style={styles.monthlyValue}>Total: {currency} {row.cumulative.toFixed(2)}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No payments found.</Text>
            <Text style={styles.emptySubText}>Payments appear once an invoice is created for a job.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  list: { padding: 16, paddingBottom: 32 },
  summaryWrap: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
    padding: 14,
  },
  summaryTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: {
    width: '48%',
    backgroundColor: '#0f1b2e',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  summaryLabel: { color: '#9eb0c3', fontSize: 12, marginBottom: 4 },
  summaryValue: { color: '#fff', fontSize: 15, fontWeight: '700' },
  monthlySection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 12,
  },
  monthlyTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  monthlyEmpty: { color: '#8899aa', fontSize: 12 },
  monthlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  monthlyLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  monthlySub: { color: '#8899aa', fontSize: 12, marginTop: 2 },
  monthlyValue: { color: '#4a7c59', fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  invoiceNum: { fontSize: 15, fontWeight: '700', color: '#fff' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  total: { fontSize: 20, fontWeight: '800', color: '#e94560' },
  due: { fontSize: 13, color: '#8899aa' },
  paidAt: { fontSize: 12, color: '#2d6a4f', marginTop: 6 },
  emptyText: { fontSize: 16, color: '#fff', fontWeight: '600', marginBottom: 8 },
  emptySubText: { fontSize: 13, color: '#8899aa', textAlign: 'center' },
});

export default PaymentsListScreen;
