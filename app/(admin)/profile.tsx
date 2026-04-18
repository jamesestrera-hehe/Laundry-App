import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { router } from 'expo-router';
import AppButton from '../components/Appbutton';
import AppInput from '../components/AppInput';

interface Feedback {
  id: string;
  type: string;
  description: string;
  email: string;
  userId: string;
  userName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const AdminProfileScreen = () => {
  const { user, logout } = useAuth();
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    role: '',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [showFeedbacks, setShowFeedbacks] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid) {
      fetchUserData();
      fetchFeedbacks();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user?.uid) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUserData({
          name: userDoc.data().name || '',
          email: user.email || '',
          phone: userDoc.data().phone || '',
          address: userDoc.data().address || '',
          role: userDoc.data().role || 'admin',
        });
      } else {
        setUserData({
          name: '',
          email: user.email || '',
          phone: '',
          address: '',
          role: 'admin',
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedbacks = async () => {
    if (!user?.uid) {
      console.log('No user logged in');
      Alert.alert('Error', 'You must be logged in to view feedback');
      return;
    }

    try {
      setRefreshing(true);
      setError(null);
      
      console.log('=== FETCHING FEEDBACKS ===');
      console.log('User ID:', user.uid);
      console.log('User Email:', user.email);
      
      // First, verify user has admin role
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userRole = userDoc.data()?.role;
      console.log('User Role:', userRole);
      
      if (userRole !== 'admin') {
        console.log('User is not admin, access denied');
        setError('You do not have admin privileges');
        Alert.alert('Access Denied', 'You do not have permission to view feedback');
        setRefreshing(false);
        return;
      }
      
      // Check if collection exists by trying to get any document
      const feedbackRef = collection(db, 'feedback');
      console.log('Collection path:', feedbackRef.path);
      
      // Try without ordering first to debug
      const testSnapshot = await getDocs(feedbackRef);
      console.log('Total documents in feedback collection:', testSnapshot.size);
      console.log('Collection exists:', !testSnapshot.empty);
      
      if (testSnapshot.empty) {
        console.log('No documents found in feedback collection');
        setFeedbacks([]);
        setError('No feedback submissions yet');
        setRefreshing(false);
        return;
      }
      
      // Log all document IDs and their data
      testSnapshot.docs.forEach((doc, index) => {
        console.log(`Document ${index + 1}:`, {
          id: doc.id,
          data: doc.data()
        });
      });
      
      // Now fetch with ordering
      const feedbacksQuery = query(feedbackRef, orderBy('createdAt', 'desc'));
      const feedbacksSnapshot = await getDocs(feedbacksQuery);
      
      console.log('Query snapshot size:', feedbacksSnapshot.size);
      
      const feedbacksList = feedbacksSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Mapping feedback:', {
          id: doc.id,
          type: data.type,
          description: data.description?.substring(0, 50),
          email: data.email,
          createdAt: data.createdAt
        });
        
        return {
          id: doc.id,
          type: data.type || 'general',
          description: data.description || '',
          email: data.email || '',
          userId: data.userId || '',
          userName: data.userName || 'Anonymous',
          status: data.status || 'pending',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        };
      });
      
      setFeedbacks(feedbacksList);
      console.log(`✅ Successfully fetched ${feedbacksList.length} feedback entries`);
      
      if (feedbacksList.length > 0) {
        Alert.alert('Success', `Loaded ${feedbacksList.length} feedback entries`);
      }
      
    } catch (error: any) {
      console.error('❌ Error fetching feedbacks:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      let errorMessage = 'Failed to load feedback data';
      
      if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Check Firebase security rules.';
        console.log('Permission denied - security rules blocking access');
      } else if (error.code === 'unavailable') {
        errorMessage = 'Network error. Check your connection.';
      } else if (error.code === 'not-found') {
        errorMessage = 'Feedback collection does not exist.';
      }
      
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not found');
      return;
    }

    if (!userData.name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: userData.name.trim(),
        phone: userData.phone.trim(),
        address: userData.address.trim(),
        updatedAt: new Date().toISOString(),
      });
      Alert.alert('Success', 'Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const getInitials = () => {
    if (userData.name) {
      return userData.name.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'A';
  };

  const getFeedbackTypeColor = (type: string) => {
    switch(type) {
      case 'bug': return '#dc3545';
      case 'feature': return '#28a745';
      case 'rating': return '#ffc107';
      default: return '#007aff';
    }
  };

  const getFeedbackTypeLabel = (type: string) => {
    switch(type) {
      case 'bug': return 'Bug Report';
      case 'feature': return 'Feature Request';
      case 'rating': return 'Rating';
      default: return 'General';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch(status) {
      case 'pending': return '#ffc107';
      case 'reviewed': return '#28a745';
      case 'resolved': return '#007aff';
      default: return '#6c757d';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'pending': return 'Pending';
      case 'reviewed': return 'Reviewed';
      case 'resolved': return 'Resolved';
      default: return status;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007aff" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Profile</Text>
        <TouchableOpacity 
          style={styles.editButton} 
          onPress={() => setIsEditing(!isEditing)}
        >
          <Text style={styles.editButtonText}>
            {isEditing ? 'Cancel' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
        </View>

        <Text style={styles.userName}>{userData.name || 'Add your name'}</Text>
        <Text style={styles.userEmail}>{userData.email}</Text>
        
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>Administrator</Text>
        </View>
      </View>

      {/* Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        
        {isEditing ? (
          // Edit Mode
          <View style={styles.editForm}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <AppInput
                value={userData.name}
                onChangeText={(text) => setUserData({ ...userData, name: text })}
                placeholder="Enter your name"
                style={styles.input}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Email</Text>
              <AppInput
                value={userData.email}
                editable={false}
                placeholder="Email"
                style={[styles.input, styles.disabledInput]}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <AppInput
                value={userData.phone}
                onChangeText={(text) => setUserData({ ...userData, phone: text })}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Address</Text>
              <AppInput
                value={userData.address}
                onChangeText={(text) => setUserData({ ...userData, address: text })}
                placeholder="Enter your address"
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textArea]}
              />
            </View>

            <View style={styles.buttonGroup}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.cancelButton]} 
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.saveButton]} 
                onPress={handleUpdateProfile}
                disabled={updating}
              >
                <Text style={styles.saveButtonText}>
                  {updating ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // View Mode
          <View style={styles.infoContainer}>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Text style={styles.infoIconText}>📞</Text>
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <Text style={styles.infoValue}>{userData.phone || 'Not provided'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Text style={styles.infoIconText}>📍</Text>
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue}>{userData.address || 'Not provided'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Text style={styles.infoIconText}>📧</Text>
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email Address</Text>
                  <Text style={styles.infoValue}>{userData.email}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Admin Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Admin Actions</Text>
        
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(admin)/manage-services')}>
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>🛠️</Text>
            <View>
              <Text style={styles.actionTitle}>Manage Services</Text>
              <Text style={styles.actionSubtitle}>Add, edit or remove services</Text>
            </View>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(admin)/manage-users')}>
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>👥</Text>
            <View>
              <Text style={styles.actionTitle}>Manage Users</Text>
              <Text style={styles.actionSubtitle}>View all customers</Text>
            </View>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard} 
          onPress={() => {
            if (!showFeedbacks) {
              fetchFeedbacks(); // Refresh feedbacks when opening
            }
            setShowFeedbacks(!showFeedbacks);
          }}
        >
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>💬</Text>
            <View>
              <Text style={styles.actionTitle}>Customer Feedback</Text>
              <Text style={styles.actionSubtitle}>
                {feedbacks.length} feedback{feedbacks.length !== 1 ? 's' : ''} received
              </Text>
            </View>
          </View>
          <Text style={styles.actionArrow}>{showFeedbacks ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showFeedbacks && (
          <View style={styles.feedbacksContainer}>
            {refreshing && feedbacks.length === 0 ? (
              <View style={styles.emptyFeedbacks}>
                <ActivityIndicator size="small" color="#007aff" />
                <Text style={styles.emptyFeedbackText}>Loading feedback...</Text>
              </View>
            ) : error ? (
              <View style={styles.emptyFeedbacks}>
                <Text style={styles.emptyFeedbackIcon}>⚠️</Text>
                <Text style={styles.emptyFeedbackText}>Error loading feedback</Text>
                <Text style={styles.emptyFeedbackSubtext}>{error}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={fetchFeedbacks}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : feedbacks.length === 0 ? (
              <View style={styles.emptyFeedbacks}>
                <Text style={styles.emptyFeedbackIcon}>📭</Text>
                <Text style={styles.emptyFeedbackText}>No feedback yet</Text>
                <Text style={styles.emptyFeedbackSubtext}>Customer feedback will appear here</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity 
                  style={styles.refreshButton}
                  onPress={fetchFeedbacks}
                >
                  <Text style={styles.refreshButtonText}>↻ Refresh</Text>
                </TouchableOpacity>
                {feedbacks.map((feedback) => (
                  <View key={feedback.id} style={styles.feedbackCard}>
                    <View style={styles.feedbackHeader}>
                      <View style={[styles.feedbackTypeBadge, { backgroundColor: getFeedbackTypeColor(feedback.type) }]}>
                        <Text style={styles.feedbackTypeText}>{getFeedbackTypeLabel(feedback.type)}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusBadgeColor(feedback.status) }]}>
                        <Text style={styles.statusText}>{getStatusLabel(feedback.status)}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.feedbackHeader}>
                      <Text style={styles.feedbackDate}>{formatDate(feedback.createdAt)}</Text>
                    </View>
                    
                    <Text style={styles.feedbackEmail}>
                      From: {feedback.userName || feedback.email || 'Anonymous'}
                    </Text>
                    <Text style={styles.feedbackEmail}>
                      Email: {feedback.email}
                    </Text>
                    
                    <View style={styles.divider} />
                    
                    <Text style={styles.feedbackDescription}>{feedback.description}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutCard} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* App Version */}
      <Text style={styles.versionText}>Admin Version 1.0.0</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6c757d',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 28,
    color: '#007aff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007aff',
    borderRadius: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007aff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#e7f1ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    color: '#007aff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
  },
  editForm: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212529',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  disabledInput: {
    backgroundColor: '#f8f9fa',
    color: '#6c757d',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cancelButtonText: {
    color: '#6c757d',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007aff',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  infoContainer: {
    gap: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e7f1ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoIconText: {
    fontSize: 20,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#212529',
    fontWeight: '500',
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 12,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#6c757d',
  },
  actionArrow: {
    fontSize: 18,
    color: '#6c757d',
  },
  feedbacksContainer: {
    marginTop: 8,
    gap: 12,
  },
  emptyFeedbacks: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  emptyFeedbackIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyFeedbackText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  emptyFeedbackSubtext: {
    fontSize: 12,
    color: '#adb5bd',
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#e7f1ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  refreshButtonText: {
    color: '#007aff',
    fontSize: 12,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#007aff',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedbackTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  feedbackTypeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  feedbackDate: {
    fontSize: 11,
    color: '#6c757d',
    marginBottom: 8,
  },
  feedbackEmail: {
    fontSize: 12,
    color: '#007aff',
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 12,
  },
  feedbackDescription: {
    fontSize: 13,
    color: '#212529',
    lineHeight: 18,
  },
  logoutCard: {
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffe0e0',
  },
  logoutIcon: {
    fontSize: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc3545',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 30,
  },
});

export default AdminProfileScreen;