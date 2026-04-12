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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Payment, PaymentMethod } from '../types';
import { paymentService } from '../services/paymentService';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;

const PAYMENT_METHODS: { label: string; value: PaymentMethod; icon: string }[] = [
  { label: 'Cash', value: 'cash', icon: '💵' },
  { label: 'Card', value: 'card', icon: '💳' },
  { label: 'UPI', value: 'upi', icon: '📱' },
  { label: 'Bank Transfer', value: 'bank_transfer', icon: '🏦' },
];

const PaymentScreen: React.FC<Props> = ({ route, navigation }) => {
  const { jobId, paymentId } = route.params;
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('card');

  const loadPayment = useCallback(async () => {
    setLoading(true);
    try {
      let data: Payment;
      if (paymentId) {
        data = await paymentService.getPaymentById(paymentId);
      } else {
        data = await paymentService.getPaymentByJob(jobId);
      }
      setPayment(data);
    } catch (error: any) {
      // If no existing invoice, offer to create one
      if (error?.response?.status === 404) {
        Alert.alert(
          'No Invoice',
          'No invoice exists for this job. Create one now?',
          [
            {
              text: 'Create Invoice',
              onPress: async () => {
                try {
                  const newPayment = await paymentService.createInvoice(jobId);
                  setPayment(newPayment);
                } catch {
                  Alert.alert('Error', 'Failed to create invoice.');
                }
              },
            },
            {
              text: 'Go Back',
              style: 'cancel',
              onPress: () => navigation.goBack(),
            },
          ],
        );
      } else {
        Alert.alert('Error', 'Failed to load payment details.');
      }
    } finally {
      setLoading(false);
    }
  }, [jobId, paymentId, navigation]);

  useEffect(() => {
    loadPayment();
  }, [loadPayment]);

  const handlePay = async () => {
    if (!payment) return;
    setProcessing(true);
    try {
      const updated = await paymentService.processPayment(payment.id, selectedMethod);
      setPayment(updated);
      Alert.alert('Payment Successful! 🎉', 'The payment has been processed.');
    } catch {
      Alert.alert('Payment Failed', 'Could not process payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRefund = () => {
    if (!payment) return;
    Alert.alert('Refund', 'Enter reason for refund:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Refund',
        style: 'destructive',
        onPress: async () => {
          setProcessing(true);
          try {
            const updated = await paymentService.refundPayment(
              payment.id,
              'Customer requested refund',
            );
            setPayment(updated);
          } catch {
            Alert.alert('Error', 'Refund failed.');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

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
        <Text style={styles.headerTitle}>Invoice & Payment</Text>
        <View style={{ width: 60 }} />
      </View>

      {!payment ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No invoice data available.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Invoice Header */}
          <View style={styles.invoiceHeader}>
            <Text style={styles.invoiceNumber}>
              Invoice #{payment.invoiceNumber}
            </Text>
            <View style={[styles.statusBadge, paymentStatusColor(payment.status)]}>
              <Text style={styles.statusText}>{payment.status}</Text>
            </View>
          </View>

          <Text style={styles.dueDate}>
            Due: {new Date(payment.dueDate).toLocaleDateString()}
          </Text>

          {/* Line Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Line Items</Text>
            {payment.lineItems.map((item, idx) => (
              <View key={idx} style={styles.lineItem}>
                <View style={styles.lineItemLeft}>
                  <Text style={styles.lineItemDesc}>{item.description}</Text>
                  <Text style={styles.lineItemQty}>
                    {item.quantity} × {payment.currency} {item.unitPrice.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.lineItemTotal}>
                  {payment.currency} {item.total.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>
                {payment.currency} {payment.amount.toFixed(2)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text style={styles.totalValue}>
                {payment.currency} {payment.tax.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>
                {payment.currency} {payment.total.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Payment Method Selection */}
          {payment.status === 'pending' && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payment Method</Text>
                <View style={styles.methodsGrid}>
                  {PAYMENT_METHODS.map(method => (
                    <TouchableOpacity
                      key={method.value}
                      style={[
                        styles.methodCard,
                        selectedMethod === method.value &&
                          styles.methodCardActive,
                      ]}
                      onPress={() => setSelectedMethod(method.value)}
                    >
                      <Text style={styles.methodIcon}>{method.icon}</Text>
                      <Text
                        style={[
                          styles.methodLabel,
                          selectedMethod === method.value &&
                            styles.methodLabelActive,
                        ]}
                      >
                        {method.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.payBtn,
                  processing && styles.payBtnDisabled,
                ]}
                onPress={handlePay}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.payBtnText}>
                    Pay {payment.currency} {payment.total.toFixed(2)}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Refund */}
          {payment.status === 'paid' && (
            <TouchableOpacity
              style={[styles.refundBtn, processing && { opacity: 0.5 }]}
              onPress={handleRefund}
              disabled={processing}
            >
              <Text style={styles.refundBtnText}>Request Refund</Text>
            </TouchableOpacity>
          )}

          {payment.paidAt && (
            <Text style={styles.paidAt}>
              Paid on {new Date(payment.paidAt).toLocaleString()}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const paymentStatusColor = (status: string): object => {
  const map: Record<string, object> = {
    pending: { backgroundColor: '#d4a017' },
    paid: { backgroundColor: '#2d6a4f' },
    failed: { backgroundColor: '#c1440e' },
    refunded: { backgroundColor: '#555' },
  };
  return map[status] ?? { backgroundColor: '#555' };
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
  scrollContent: { padding: 16, paddingBottom: 40 },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  invoiceNumber: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  dueDate: { fontSize: 13, color: '#888', marginBottom: 20 },
  section: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e94560',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  lineItemLeft: { flex: 1, marginRight: 8 },
  lineItemDesc: { fontSize: 14, color: '#ddd' },
  lineItemQty: { fontSize: 12, color: '#888', marginTop: 2 },
  lineItemTotal: { fontSize: 14, color: '#fff', fontWeight: '700' },
  totalsCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  totalLabel: { fontSize: 14, color: '#aaa' },
  totalValue: { fontSize: 14, color: '#fff' },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginTop: 6,
    paddingTop: 12,
  },
  grandTotalLabel: { fontSize: 16, fontWeight: '800', color: '#fff' },
  grandTotalValue: { fontSize: 18, fontWeight: '800', color: '#e94560' },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  methodCard: {
    width: '46%',
    backgroundColor: '#0f3460',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodCardActive: { borderColor: '#e94560' },
  methodIcon: { fontSize: 24, marginBottom: 6 },
  methodLabel: { fontSize: 13, color: '#aaa', fontWeight: '600' },
  methodLabelActive: { color: '#e94560' },
  payBtn: {
    backgroundColor: '#e94560',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  refundBtn: {
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  refundBtnText: { color: '#e94560', fontSize: 15, fontWeight: '700' },
  paidAt: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    marginTop: 6,
  },
  emptyText: { color: '#666', fontSize: 15 },
});

export default PaymentScreen;
