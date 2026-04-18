import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query } from 'firebase/firestore';
import { router } from 'expo-router';

interface Service {
  id: string;
  name: string;
  pricePerKg: number;
  icon: string;
  description: string;
  deliveryTime: string;
  active: boolean;
  features?: string[];
}

const ManageServicesScreen = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    pricePerKg: '',
    icon: '',
    description: '',
    deliveryTime: '',
    features: '',
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const servicesQuery = query(collection(db, 'services'));
      const servicesSnapshot = await getDocs(servicesQuery);
      const servicesList = servicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Service[];
      setServices(servicesList);
    } catch (error) {
      Alert.alert('Error', 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.pricePerKg || !formData.icon) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const featuresArray = formData.features ? formData.features.split(',').map(f => f.trim()) : [];
      
      const serviceData = {
        name: formData.name.trim(),
        pricePerKg: parseFloat(formData.pricePerKg),
        icon: formData.icon,
        description: formData.description.trim(),
        deliveryTime: formData.deliveryTime || '24 hours',
        features: featuresArray,
        active: true,
        updatedAt: new Date().toISOString(),
      };

      if (editingService) {
        await updateDoc(doc(db, 'services', editingService.id), serviceData);
        Alert.alert('Success', 'Service updated successfully');
      } else {
        await addDoc(collection(db, 'services'), {
          ...serviceData,
          createdAt: new Date().toISOString(),
        });
        Alert.alert('Success', 'Service added successfully');
      }

      setModalVisible(false);
      resetForm();
      fetchServices();
    } catch (error) {
      Alert.alert('Error', 'Failed to save service');
    }
  };

  const handleDelete = async (serviceId: string) => {
    Alert.alert(
      'Delete Service',
      'Are you sure you want to delete this service?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'services', serviceId));
              fetchServices();
              Alert.alert('Success', 'Service deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete service');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      pricePerKg: service.pricePerKg.toString(),
      icon: service.icon,
      description: service.description || '',
      deliveryTime: service.deliveryTime || '',
      features: service.features?.join(', ') || '',
    });
    setModalVisible(true);
  };

  const resetForm = () => {
    setEditingService(null);
    setFormData({
      name: '',
      pricePerKg: '',
      icon: '',
      description: '',
      deliveryTime: '',
      features: '',
    });
  };

  const toggleServiceStatus = async (service: Service) => {
    try {
      await updateDoc(doc(db, 'services', service.id), {
        active: !service.active,
      });
      fetchServices();
    } catch (error) {
      Alert.alert('Error', 'Failed to update service status');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007aff" />
        <Text style={styles.loadingText}>Loading services...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Services</Text>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.servicesList}>
        {services.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No Services Yet</Text>
            <Text style={styles.emptyText}>Tap the + button to add your first service</Text>
          </View>
        ) : (
          services.map((service) => (
            <View key={service.id} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Text style={styles.serviceIcon}>{service.icon}</Text>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  <Text style={styles.servicePrice}>₱{service.pricePerKg}/kg</Text>
                  <Text style={styles.serviceTime}>{service.deliveryTime}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.statusBadge, { backgroundColor: service.active ? '#28a745' : '#dc3545' }]}
                  onPress={() => toggleServiceStatus(service)}
                >
                  <Text style={styles.statusText}>
                    {service.active ? 'Active' : 'Inactive'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {service.description ? (
                <Text style={styles.serviceDescription}>{service.description}</Text>
              ) : null}
              
              {service.features && service.features.length > 0 && (
                <View style={styles.featuresContainer}>
                  {service.features.map((feature, idx) => (
                    <View key={idx} style={styles.featureTag}>
                      <Text style={styles.featureTagText}>{feature}</Text>
                    </View>
                  ))}
                </View>
              )}
              
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(service)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(service.id)}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingService ? 'Edit Service' : 'New Service'}
            </Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Service Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="e.g., Wash & Fold"
                  placeholderTextColor="#adb5bd"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Price per KG (₱) *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.pricePerKg}
                  onChangeText={(text) => setFormData({ ...formData, pricePerKg: text })}
                  placeholder="e.g., 60"
                  keyboardType="numeric"
                  placeholderTextColor="#adb5bd"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Icon (Emoji) *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.icon}
                  onChangeText={(text) => setFormData({ ...formData, icon: text })}
                  placeholder="e.g., 👕"
                  placeholderTextColor="#adb5bd"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Delivery Time</Text>
                <TextInput
                  style={styles.input}
                  value={formData.deliveryTime}
                  onChangeText={(text) => setFormData({ ...formData, deliveryTime: text })}
                  placeholder="e.g., 24 hours"
                  placeholderTextColor="#adb5bd"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Describe the service"
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#adb5bd"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Features (comma separated)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.features}
                  onChangeText={(text) => setFormData({ ...formData, features: text })}
                  placeholder="e.g., Free pickup, Eco-friendly, Fast delivery"
                  multiline
                  numberOfLines={2}
                  placeholderTextColor="#adb5bd"
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.submitBtn]} 
                onPress={handleSubmit}
              >
                <Text style={styles.submitBtnText}>
                  {editingService ? 'Update' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007aff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  servicesList: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  serviceHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  serviceIcon: {
    fontSize: 40,
    marginRight: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007aff',
    marginBottom: 2,
  },
  serviceTime: {
    fontSize: 12,
    color: '#6c757d',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  serviceDescription: {
    fontSize: 13,
    color: '#6c757d',
    marginBottom: 10,
    lineHeight: 18,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 6,
  },
  featureTag: {
    backgroundColor: '#e7f1ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featureTagText: {
    fontSize: 11,
    color: '#007aff',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#e7f1ff',
  },
  editBtnText: {
    color: '#007aff',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ffe7e7',
  },
  deleteBtnText: {
    color: '#dc3545',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
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
  cancelBtn: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  cancelBtnText: {
    color: '#6c757d',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#007aff',
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ManageServicesScreen;