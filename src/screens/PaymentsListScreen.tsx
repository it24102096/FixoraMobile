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
import { RootStackParamList, Payment } from '../types';
import { paymentService } from '../services/paymentService';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentsList'>;

const statusColor: Record<string, string> = {
  pending: '#d4a017',
  paid: '#2d6a4f',
  failed: '#c1440e',
  refunded: '#555',
};

const PaymentsListScreen: React.FC<Props> = ({ navigation }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPayments = useCallback(async () => {
    try {
      const res = await paymentService.getPayments();
      setPayments(res.data);
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

  const renderItem = ({ item }: { item: Payment }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate('Payment', { jobId: item.jobId, paymentId: item.id })
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
