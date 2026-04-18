import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import AppButton from '../components/Appbutton';
import AppInput from '../components/AppInput';
import { router } from 'expo-router'; 

const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Feedback Modal States
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState('general');
  const [feedbackDescription, setFeedbackDescription] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      fetchUserData();
      // Pre-fill email for feedback
      setFeedbackEmail(user.email || '');
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
        });
      } else {
        setUserData({
          name: '',
          email: user.email || '',
          phone: '',
          address: '',
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not found. Please login again.');
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
    } catch (error: any) {
      console.error('Update error:', error);
      if (error.code === 'permission-denied') {
        Alert.alert('Error', 'You don\'t have permission to update this profile');
      } else if (error.code === 'not-found') {
        Alert.alert('Error', 'User document not found');
      } else {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
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

  const handleSubmitFeedback = async () => {
    if (!feedbackDescription.trim()) {
      Alert.alert('Error', 'Please enter your feedback');
      return;
    }

    setSubmittingFeedback(true);
    try {
      // Save feedback to Firebase 'feedback' collection
      await addDoc(collection(db, 'feedback'), {
        type: feedbackType,
        description: feedbackDescription.trim(),
        email: feedbackEmail || 'anonymous',
        userId: user?.uid || null,
        userName: userData.name || 'Anonymous',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      Alert.alert(
        'Thank You!', 
        'Your feedback has been submitted successfully. We appreciate your input!'
      );
      setShowFeedbackModal(false);
      resetFeedbackForm();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const resetFeedbackForm = () => {
    setFeedbackType('general');
    setFeedbackDescription('');
    setFeedbackEmail(user?.email || '');
  };

  const getInitials = () => {
    if (userData.name) {
      return userData.name.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
        <Text style={styles.headerTitle}>Profile</Text>
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

      {/* Account Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Actions</Text>
        
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(customer)')}>
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>📦</Text>
            <View>
              <Text style={styles.actionTitle}>My Orders</Text>
              <Text style={styles.actionSubtitle}>View your order history</Text>
            </View>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => setShowFeedbackModal(true)}>
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>💬</Text>
            <View>
              <Text style={styles.actionTitle}>Feedback</Text>
              <Text style={styles.actionSubtitle}>Send us your thoughts</Text>
            </View>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(customer)/support')}>
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>🆘</Text>
            <View>
              <Text style={styles.actionTitle}>Support</Text>
              <Text style={styles.actionSubtitle}>Get help with your account</Text>
            </View>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutCard} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* App Version */}
      <Text style={styles.versionText}>Version 1.0.0</Text>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Send Feedback</Text>
            
            {/* Feedback Type */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Feedback Type</Text>
              <View style={styles.typeContainer}>
                {['General', 'Bug', 'Feature', 'Rating'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      feedbackType === type.toLowerCase() && styles.typeButtonActive,
                    ]}
                    onPress={() => setFeedbackType(type.toLowerCase())}
                  >
                    <Text style={[
                      styles.typeText,
                      feedbackType === type.toLowerCase() && styles.typeTextActive,
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Feedback Description */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Your Feedback <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.modalTextArea}
                placeholder="Tell us what you think..."
                value={feedbackDescription}
                onChangeText={setFeedbackDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor="#adb5bd"
              />
            </View>

            {/* Email */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Your Email</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="email@example.com"
                value={feedbackEmail}
                onChangeText={setFeedbackEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#adb5bd"
                editable={false}
              />
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelModalBtn]} 
                onPress={() => {
                  setShowFeedbackModal(false);
                  resetFeedbackForm();
                }}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.submitModalBtn]} 
                onPress={handleSubmitFeedback}
                disabled={submittingFeedback}
              >
                <Text style={styles.submitModalBtnText}>
                  {submittingFeedback ? 'Submitting...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background || '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.gray || '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: COLORS.white || '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 28,
    color: COLORS.primary || '#007aff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black || '#000',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.primary || '#007aff',
    borderRadius: 8,
  },
  editButtonText: {
    color: COLORS.white || '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: COLORS.white || '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary || '#007aff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.white || '#fff',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black || '#000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.gray || '#666',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black || '#000',
    marginBottom: 12,
  },
  editForm: {
    backgroundColor: COLORS.white || '#fff',
    borderRadius: 12,
    padding: 16,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.black || '#000',
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
    color: COLORS.gray || '#666',
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
    color: COLORS.gray || '#666',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.primary || '#007aff',
  },
  saveButtonText: {
    color: COLORS.white || '#fff',
    fontWeight: '600',
  },
  infoContainer: {
    gap: 12,
  },
  infoCard: {
    backgroundColor: COLORS.white || '#fff',
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
    backgroundColor: `${COLORS.primary}10`,
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
    color: COLORS.gray || '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.black || '#000',
    fontWeight: '500',
  },
  actionCard: {
    backgroundColor: COLORS.white || '#fff',
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
    color: COLORS.black || '#000',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: COLORS.gray || '#666',
  },
  actionArrow: {
    fontSize: 18,
    color: COLORS.gray || '#666',
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
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.danger || '#ff4444',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.gray || '#666',
    marginBottom: 30,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  required: {
    color: '#dc3545',
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dee2e6',
    backgroundColor: '#fff',
  },
  typeButtonActive: {
    backgroundColor: '#007aff',
    borderColor: '#007aff',
  },
  typeText: {
    fontSize: 14,
    color: '#6c757d',
  },
  typeTextActive: {
    color: '#fff',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#f8f9fa',
  },
  modalTextArea: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelModalBtn: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  cancelModalBtnText: {
    color: '#6c757d',
    fontWeight: '600',
  },
  submitModalBtn: {
    backgroundColor: '#007aff',
  },
  submitModalBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ProfileScreen;