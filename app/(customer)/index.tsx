import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { router } from 'expo-router';
import { COLORS, SIZES } from '../constants/theme';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

interface Order {
  id: string;
  serviceName: string;
  weight: number;
  total: number;
  status: string;
  createdAt: string;
  pickupDate: string;
}

export default function CustomerHome() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [userPoints, setUserPoints] = useState(450);
  const [nextReward, setNextReward] = useState(500);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [activePromos, setActivePromos] = useState([
    {
      id: 1,
      title: "Welcome Discount",
      description: "20% off on first order",
      code: "WELCOME20",
      discount: "20% OFF",
    },
  ]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    if (!user?.uid) return;
    
    try {
      const ordersQuery = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersList = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Order[];
      setOrders(ordersList);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }, []);

  const handleCopyCode = (code: string) => {
    Alert.alert('Success', `Code ${code} copied`);
  };

  const getPointsProgress = () => {
    return (userPoints / nextReward) * 100;
  };

  const addPoints = (points: number) => {
    setUserPoints(prev => prev + points);
    if (userPoints + points >= nextReward) {
      Alert.alert(
        'Reward Unlocked!',
        `Congratulations! You've earned ${nextReward} points and unlocked a reward!`,
        [{ text: 'Awesome!', onPress: () => setNextReward(prev => prev + 500) }]
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return '#28a745';
      case 'pending': return '#ffc107';
      case 'processing': return '#007aff';
      case 'cancelled': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'completed': return 'Completed';
      case 'pending': return 'Pending';
      case 'processing': return 'Processing';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Points Card */}
      <TouchableOpacity 
        style={styles.pointsCard}
        onPress={() => addPoints(10)}
        activeOpacity={0.9}
      >
        <View style={styles.pointsHeader}>
          <Text style={styles.pointsTitle}>Loyalty Points</Text>
          <Text style={styles.pointsValue}>{userPoints}</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${getPointsProgress()}%` }]} />
        </View>
        <Text style={styles.pointsProgress}>
          {nextReward - userPoints} more points to next reward
        </Text>
        <Text style={styles.tapHint}>👆 Tap to add test points</Text>
      </TouchableOpacity>

      {/* Order History Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Order History</Text>
          {orders.length > 0 && (
            <TouchableOpacity onPress={() => router.push('/(customer')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {loadingOrders ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading orders...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptyText}>Your orders will appear here</Text>
          </View>
        ) : (
          orders.slice(0, 3).map((order) => (
            <TouchableOpacity 
              key={order.id} 
              style={styles.orderCard}
              onPress={() => router.push(`/(customer)/order-details?id=${order.id}`)}
            >
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderService}>{order.serviceName}</Text>
                  <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                </View>
                <View style={[styles.orderStatus, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                  <Text style={[styles.orderStatusText, { color: getStatusColor(order.status) }]}>
                    {getStatusText(order.status)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.orderDetails}>
                <View style={styles.orderDetailRow}>
                  <Text style={styles.orderDetailLabel}>Weight:</Text>
                  <Text style={styles.orderDetailValue}>{order.weight} kg</Text>
                </View>
                <View style={styles.orderDetailRow}>
                  <Text style={styles.orderDetailLabel}>Total:</Text>
                  <Text style={styles.orderDetailValue}>₱{order.total.toFixed(2)}</Text>
                </View>
                <View style={styles.orderDetailRow}>
                  <Text style={styles.orderDetailLabel}>Pickup:</Text>
                  <Text style={styles.orderDetailValue}>{order.pickupDate}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Special Offers Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Special Offer</Text>
        </View>
        
        {activePromos.map((promo) => (
          <View key={promo.id} style={styles.promoCard}>
            <View style={styles.promoHeader}>
              <View>
                <Text style={styles.promoTitle}>{promo.title}</Text>
                <Text style={styles.promoDescription}>{promo.description}</Text>
              </View>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>{promo.discount}</Text>
              </View>
            </View>
            
            <View style={styles.promoFooter}>
              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>Promo Code:</Text>
                <TouchableOpacity 
                  style={styles.codeBox}
                  onPress={() => handleCopyCode(promo.code)}
                >
                  <Text style={styles.codeText}>{promo.code}</Text>
                  <Text style={styles.copyButton}>Copy</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Referral Section */}
      <View style={styles.referralCard}>
        <Text style={styles.referralTitle}>Invite Friends, Earn Rewards</Text>
        <Text style={styles.referralDescription}>
          Share your code and get $10 credit for each friend who joins
        </Text>
        
        <View style={styles.referralCodeContainer}>
          <Text style={styles.referralCode}>
            {user?.email?.split('@')[0]?.toUpperCase() || 'USER'}2024
          </Text>
          <TouchableOpacity style={styles.shareButton}>
            <Text style={styles.shareButtonText}>Share Code</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.referralBonus}>
          Your friends also get 15% off their first order!
        </Text>
      </View>

      {/* Bottom padding */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  pointsCard: {
    backgroundColor: '#007aff',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  pointsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pointsTitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  pointsValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  pointsProgress: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
  },
  tapHint: {
    fontSize: 10,
    color: '#fff',
    opacity: 0.6,
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  viewAll: {
    fontSize: 14,
    color: '#007aff',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#6c757d',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderService: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: '#6c757d',
  },
  orderStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderDetails: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  orderDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  orderDetailLabel: {
    fontSize: 12,
    color: '#6c757d',
  },
  orderDetailValue: {
    fontSize: 12,
    color: '#212529',
    fontWeight: '500',
  },
  promoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  promoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  promoDescription: {
    fontSize: 13,
    color: '#6c757d',
  },
  discountBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  promoFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 12,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeLabel: {
    fontSize: 12,
    color: '#6c757d',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 8,
  },
  codeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007aff',
  },
  copyButton: {
    fontSize: 12,
    color: '#007aff',
    fontWeight: '500',
  },
  referralCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
  },
  referralTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  referralDescription: {
    fontSize: 13,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 16,
  },
  referralCodeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  referralCode: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#007aff',
  },
  shareButton: {
    backgroundColor: '#007aff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  referralBonus: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '500',
  },
  bottomPadding: {
    height: 20,
  },
});