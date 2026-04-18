import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { router } from 'expo-router';
import AppInput from '../components/AppInput';
import AppButton from '../components/Appbutton';
import { COLORS, SIZES } from '../constants/theme';

const SignupScreen = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'customer'>('customer');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      await signUp(email, password, name, selectedRole);
      Alert.alert('Success', 'Account created successfully! Please login.');
      router.push('/(auth)/login');
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to get started</Text>
          </View>

          <View style={styles.form}>
            {/* Role Selection */}
            <Text style={styles.roleLabel}>Register as:</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[
                  styles.roleOption,
                  selectedRole === 'customer' && styles.roleOptionActive
                ]}
                onPress={() => setSelectedRole('customer')}
              >
                <Text style={[
                  styles.roleText,
                  selectedRole === 'customer' && styles.roleTextActive
                ]}>👤 Customer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleOption,
                  selectedRole === 'admin' && styles.roleOptionActive
                ]}
                onPress={() => setSelectedRole('admin')}
              >
                <Text style={[
                  styles.roleText,
                  selectedRole === 'admin' && styles.roleTextActive
                ]}>👑 Admin</Text>
              </TouchableOpacity>
            </View>

            <AppInput 
              label="Full Name" 
              value={name} 
              onChangeText={setName} 
              placeholder="Enter your full name" 
            />
            
            <AppInput 
              label="Email" 
              value={email} 
              onChangeText={setEmail} 
              placeholder="Enter your email" 
              keyboardType="email-address" 
              autoCapitalize="none"
            />
            
            <AppInput 
              label="Password" 
              value={password} 
              onChangeText={setPassword} 
              placeholder="Enter your password" 
              secureTextEntry 
            />
            
            <AppInput 
              label="Confirm Password" 
              value={confirmPassword} 
              onChangeText={setConfirmPassword} 
              placeholder="Confirm your password" 
              secureTextEntry 
            />
            
            <AppButton title="Sign Up" onPress={handleSignup} loading={loading} />
            
            <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.linkContainer}>
              <Text style={styles.linkText}>Already have an account? <Text style={styles.link}>Login</Text></Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.xxl,
  },
  header: {
    marginBottom: SIZES.xxxl,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: SIZES.sm,
  },
  form: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SIZES.lg,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  roleLabel: {
    fontSize: SIZES.sm,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: SIZES.sm,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: SIZES.md,
    marginBottom: SIZES.lg,
  },
  roleOption: {
    flex: 1,
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  roleOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleText: {
    fontSize: SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray,
  },
  roleTextActive: {
    color: COLORS.white,
  },
  button: {
    marginTop: SIZES.md,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: SIZES.sm,
    marginBottom: SIZES.md,
    textAlign: 'center',
  },
  linkContainer: {
    marginTop: SIZES.lg,
    alignItems: 'center',
  },
  linkText: {
    fontSize: SIZES.sm,
    color: COLORS.gray,
  },
  link: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default SignupScreen;