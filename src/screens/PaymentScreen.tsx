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
  Image,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Payment, PaymentMethod } from '../types';
import { paymentService } from '../services/paymentService';
import { authService } from '../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;

const PAYMENT_METHODS: { label: string; value: PaymentMethod; icon: string }[] = [
  { label: 'Card', value: 'card', icon: '💳' },
  { label: 'Bank Transfer', value: 'bank_transfer', icon: '🏦' },
];

interface CardDetails {
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  cvv: string;
}

interface PaySlipFile {
  uri: string;
  name: string;
  type: string;
  size: number;
}

interface BankTransferDetails {
  paySlip: PaySlipFile | null;
  notice: string;
}

const PaymentScreen: React.FC<Props> = ({ route, navigation }) => {
  const { jobId, paymentId } = route.params;
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('card');
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    cardNumber: '',
    cardholderName: '',
    expiryDate: '',
    cvv: '',
  });
  const [bankTransferDetails, setBankTransferDetails] = useState<BankTransferDetails>({
    paySlip: null,
    notice: '',
  });

  const handlePickPaySlip = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.9,
      });

      if (!result.didCancel && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.fileName || `payslip_${Date.now()}.jpg`;
        const fileType = asset.type || 'image/jpeg';
        const fileSize = asset.fileSize || 0;

        setBankTransferDetails({
          ...bankTransferDetails,
          paySlip: {
            uri: asset.uri!,
            name: fileName,
            type: fileType,
            size: fileSize,
          },
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick file. Please try again.');
      console.error('File picker error:', error);
    }
  }, [bankTransferDetails]);

  const loadPayment = useCallback(async () => {
    setLoading(true);
    try {
      const user = await authService.getCurrentUser();
      setIsAdmin(user?.role === 'admin');

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
        const msg =
          error?.response?.data?.message ||
          error?.message ||
          'Failed to load payment details.';
        Alert.alert('Error', msg);
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

    // Validate card details if card is selected
    if (selectedMethod === 'card') {
      if (!cardDetails.cardNumber.trim()) {
        Alert.alert('Error', 'Please enter card number');
        return;
      }
      if (cardDetails.cardNumber.replace(/\s/g, '').length !== 16) {
        Alert.alert('Error', 'Card number must be 16 digits');
        return;
      }
      if (!cardDetails.cardholderName.trim()) {
        Alert.alert('Error', 'Please enter cardholder name');
        return;
      }
      if (!cardDetails.expiryDate.trim()) {
        Alert.alert('Error', 'Please enter expiry date (MM/YY)');
        return;
      }
      if (!cardDetails.cvv.trim()) {
        Alert.alert('Error', 'Please enter CVV');
        return;
      }
      if (cardDetails.cvv.length !== 3) {
        Alert.alert('Error', 'CVV must be 3 digits');
        return;
      }
    }

    // Validate bank transfer details if bank transfer is selected
    if (selectedMethod === 'bank_transfer') {
      if (!bankTransferDetails.paySlip) {
        Alert.alert('Error', 'Please upload a bank transfer receipt/slip image');
        return;
      }
      if (!bankTransferDetails.notice.trim()) {
        Alert.alert('Error', 'Please add a special notice or payment instructions');
        return;
      }
    }

    setProcessing(true);
    try {
      let updated: Payment;
      if (selectedMethod === 'bank_transfer' && bankTransferDetails.paySlip) {
        updated = await paymentService.processPayment(
          payment.id,
          selectedMethod,
          bankTransferDetails.paySlip,
          bankTransferDetails.notice,
        );
      } else {
        updated = await paymentService.processPayment(payment.id, selectedMethod);
      }
      setPayment(updated);
      Alert.alert('Payment Successful! 🎉', 'The payment has been processed.');
      // Reset form details after successful payment
      setCardDetails({
        cardNumber: '',
        cardholderName: '',
        expiryDate: '',
        cvv: '',
      });
      setBankTransferDetails({
        paySlip: null,
        notice: '',
      });
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || 'Could not process payment. Please try again.';
      Alert.alert('Payment Failed', errorMsg);
      console.error('Payment process error:', err);
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

  const technicianShare = payment
    ? (payment.technicianEarnings ?? payment.amount)
    : 0;
  const platformShare = payment
    ? (payment.platformFee ?? Math.max(payment.total - payment.amount, 0))
    : 0;

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

          {/* CUSTOMER DETAILS SECTION - Always Show First */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: '#4a7c59' }]}>
              👤 CUSTOMER INFORMATION
            </Text>
            
            {typeof payment.jobId === 'object' && payment.jobId?.customerId ? (
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>
                  {typeof payment.jobId.customerId === 'object' 
                    ? payment.jobId.customerId.name 
                    : 'Customer'}
                </Text>
                <Text style={styles.customerDetail}>
                  📧 {typeof payment.jobId.customerId === 'object'
                    ? payment.jobId.customerId.email
                    : 'Email not available'}
                </Text>
                <Text style={styles.customerDetail}>
                  📱 {typeof payment.jobId.customerId === 'object'
                    ? payment.jobId.customerId.phone
                    : 'Phone not available'}
                </Text>
                <Text style={[styles.customerDetail, { marginTop: 10, color: '#4a7c59', fontWeight: '600' }]}>
                  🔧 Service: {payment.jobId.title || 'Service'}
                </Text>
              </View>
            ) : (
              <Text style={styles.customerDetail}>Customer information not available</Text>
            )}
          </View>

          {/* Line Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Line Items</Text>
            {(payment.lineItems || []).map((item, idx) => (
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

            {/* Earnings split — shown only after payment is paid */}
            {payment.status === 'paid' && (
              <>
                <View style={styles.splitDivider} />
                {isAdmin && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: '#9eb0c3' }]}>
                      🏢 Platform Share
                    </Text>
                    <Text style={[styles.totalValue, { color: '#e94560' }]}>
                      {payment.currency} {platformShare.toFixed(2)}
                    </Text>
                  </View>
                )}
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: '#4a7c59' }]}>
                    👨‍🔧 Technician Payout
                  </Text>
                  <Text style={[styles.totalValue, { color: '#4a7c59', fontWeight: '700' }]}>
                    {payment.currency} {technicianShare.toFixed(2)}
                  </Text>
                </View>
              </>
            )}
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

              {/* Card Payment Form - Shows when Card is selected */}
              {selectedMethod === 'card' && (
                <View style={styles.cardFormSection}>
                  <Text style={styles.sectionTitle}>💳 Card Details</Text>

                  {/* Cardholder Name */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Cardholder Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="John Doe"
                      placeholderTextColor="#999"
                      value={cardDetails.cardholderName}
                      onChangeText={(text) =>
                        setCardDetails({ ...cardDetails, cardholderName: text })
                      }
                      editable={!processing}
                    />
                  </View>

                  {/* Card Number */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Card Number</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="1234 5678 9012 3456"
                      placeholderTextColor="#999"
                      value={cardDetails.cardNumber}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/\D/g, '').slice(0, 16);
                        const formatted = cleaned
                          .match(/.{1,4}/g)
                          ?.join(' ') || cleaned;
                        setCardDetails({ ...cardDetails, cardNumber: formatted });
                      }}
                      keyboardType="numeric"
                      maxLength={19}
                      editable={!processing}
                    />
                  </View>

                  {/* Expiry Date and CVV */}
                  <View style={styles.rowContainer}>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Expiry Date</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="MM/YY"
                        placeholderTextColor="#999"
                        value={cardDetails.expiryDate}
                        onChangeText={(text) => {
                          let formatted = text.replace(/\D/g, '');
                          if (formatted.length >= 2) {
                            formatted = formatted.slice(0, 2) + '/' + formatted.slice(2, 4);
                          }
                          setCardDetails({ ...cardDetails, expiryDate: formatted });
                        }}
                        keyboardType="numeric"
                        maxLength={5}
                        editable={!processing}
                      />
                    </View>

                    <View style={[styles.formGroup, { flex: 1, marginLeft: 12 }]}>
                      <Text style={styles.label}>CVV</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="123"
                        placeholderTextColor="#999"
                        value={cardDetails.cvv}
                        onChangeText={(text) =>
                          setCardDetails({
                            ...cardDetails,
                            cvv: text.replace(/\D/g, '').slice(0, 3),
                          })
                        }
                        keyboardType="numeric"
                        maxLength={3}
                        secureTextEntry
                        editable={!processing}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Bank Transfer Form - Shows when Bank Transfer is selected */}
              {selectedMethod === 'bank_transfer' && (
                <View style={styles.bankTransferSection}>
                  <Text style={styles.sectionTitle}>🏦 Bank Transfer</Text>

                  {/* Pay Slip Upload */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>📄 Upload Bank Transfer Receipt</Text>
                    
                    {!bankTransferDetails.paySlip ? (
                      <TouchableOpacity
                        style={styles.uploadBtn}
                        onPress={handlePickPaySlip}
                        disabled={processing}
                      >
                        <Text style={styles.uploadBtnIcon}>📸</Text>
                        <Text style={styles.uploadBtnText}>Select Pay Slip Image</Text>
                        <Text style={styles.uploadBtnSubText}>JPG, PNG (Max 5MB)</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.imageContainer}>
                        {bankTransferDetails.paySlip.uri && (
                          <Image
                            source={{ uri: bankTransferDetails.paySlip.uri }}
                            style={styles.slipImage}
                          />
                        )}
                        <View style={styles.fileInfoBox}>
                          <Text style={styles.fileName}>{bankTransferDetails.paySlip.name}</Text>
                          <Text style={styles.fileSize}>
                            {(bankTransferDetails.paySlip.size / 1024).toFixed(2)} KB
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.changeImageBtn}
                          onPress={handlePickPaySlip}
                          disabled={processing}
                        >
                          <Text style={styles.changeBtnText}>Change Image</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Special Notice / Payment Instructions */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>⚠️ Payment Instructions / Notes</Text>
                    <TextInput
                      style={[styles.input, styles.noteInput]}
                      placeholder="e.g., Processing in 2-3 hours, Reference: INV-001234"
                      placeholderTextColor="#666"
                      value={bankTransferDetails.notice}
                      onChangeText={(text) =>
                        setBankTransferDetails({ ...bankTransferDetails, notice: text })
                      }
                      multiline
                      numberOfLines={3}
                      editable={!processing}
                      textAlignVertical="top"
                    />
                  </View>

                  <View style={styles.instructionBox}>
                    <Text style={styles.instructionTitle}>✓ Please ensure:</Text>
                    <Text style={styles.instructionText}>• Receipt clearly shows the amount transferred</Text>
                    <Text style={styles.instructionText}>• Receipt includes transaction date & time</Text>
                    <Text style={styles.instructionText}>• Receipt is readable and not cropped</Text>
                  </View>
                </View>
              )}

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
  splitDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 8,
  },
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

  // Card Form Styles
  cardFormSection: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f1620',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // Bank Transfer Styles
  bankTransferSection: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#4a7c59',
  },
  uploadBtn: {
    backgroundColor: '#0f1620',
    borderWidth: 2,
    borderColor: '#4a7c59',
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnIcon: {
    fontSize: 44,
    marginBottom: 8,
  },
  uploadBtnText: {
    color: '#4a7c59',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  uploadBtnSubText: {
    color: '#888',
    fontSize: 12,
  },
  imageContainer: {
    backgroundColor: '#0f1620',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  slipImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  changeImageBtn: {
    backgroundColor: '#4a7c59',
    paddingVertical: 12,
    alignItems: 'center',
  },
  changeBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  noteInput: {
    height: 120,
    paddingTop: 12,
  },
  helpText: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  helpSubText: {
    color: '#4a7c59',
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
  },
  customerSection: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#4a7c59',
  },
  customerInfo: {
    marginTop: 10,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  customerDetail: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 6,
  },
  jobTitle: {
    fontSize: 13,
    color: '#4a7c59',
    marginTop: 8,
    fontWeight: '600',
  },
  fileInfoBox: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  fileName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  fileSize: {
    color: '#888',
    fontSize: 12,
  },
  instructionBox: {
    backgroundColor: 'rgba(74, 124, 89, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#4a7c59',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  instructionTitle: {
    color: '#4a7c59',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  instructionText: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 4,
  },
});

export default PaymentScreen;
