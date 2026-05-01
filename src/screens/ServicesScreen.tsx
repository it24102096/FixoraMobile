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
  TextInput,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Service } from '../types';
import { serviceService } from '../services/serviceService';

type Props = NativeStackScreenProps<RootStackParamList, 'Services'>;

const ServicesScreen: React.FC<Props> = ({ navigation }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [svcs, cats] = await Promise.all([
        serviceService.getServices(),
        serviceService.getCategories(),
      ]);
      setServices(svcs);
      setCategories(['All', ...cats]);
    } catch {
      Alert.alert('Error', 'Failed to load services. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const filtered = services.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const renderService = ({ item }: { item: Service }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ServiceBooking', { service: item })}
      activeOpacity={0.85}
    >
      <View style={styles.cardTop}>
        <Text style={styles.icon}>{item.icon || '🔧'}</Text>
        <View style={styles.cardInfo}>
          <Text style={styles.serviceName}>{item.name}</Text>
          <Text style={styles.categoryBadge}>{item.category}</Text>
        </View>
        <View style={styles.priceBox}>
          <Text style={styles.price}>${item.basePrice.toFixed(2)}</Text>
          <Text style={styles.currency}>{item.currency}</Text>
        </View>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.duration}>⏱ ~{item.estimatedDuration} mins</Text>
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() => navigation.navigate('ServiceBooking', { service: item })}
        >
          <Text style={styles.bookBtnText}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071428" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Our Services</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search services..."
          placeholderTextColor="#666"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category Filter */}
      {categories.length > 1 && (
        <View style={styles.categoryRow}>
          <FlatList
            data={categories}
            horizontal
            keyExtractor={c => c}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item: cat }) => (
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  selectedCategory === cat && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === cat && styles.categoryChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.categoryList}
          />
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderService}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#e94560"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No services found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1b2a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: '#071428',
  },
  backBtn: { padding: 4 },
  backText: { color: '#e94560', fontSize: 14, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  searchContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  searchInput: {
    backgroundColor: '#1a2a3a',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#223344',
  },
  categoryRow: { marginTop: 8 },
  categoryList: { paddingHorizontal: 16, gap: 8 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1a2a3a',
    borderWidth: 1,
    borderColor: '#223344',
    marginRight: 8,
  },
  categoryChipActive: { backgroundColor: '#e94560', borderColor: '#e94560' },
  categoryChipText: { color: '#aaa', fontSize: 13 },
  categoryChipTextActive: { color: '#fff', fontWeight: '700' },
  listContent: { padding: 16, gap: 14 },
  card: {
    backgroundColor: '#162032',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e3050',
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  icon: { fontSize: 36, marginRight: 12 },
  cardInfo: { flex: 1 },
  serviceName: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  categoryBadge: {
    color: '#7eb8f7',
    fontSize: 12,
    backgroundColor: '#1a3050',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priceBox: { alignItems: 'flex-end' },
  price: { color: '#4cde9a', fontSize: 18, fontWeight: '800' },
  currency: { color: '#888', fontSize: 11 },
  description: { color: '#aac', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  duration: { color: '#888', fontSize: 13 },
  bookBtn: {
    backgroundColor: '#e94560',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bookBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#666', fontSize: 15 },
});

export default ServicesScreen;
