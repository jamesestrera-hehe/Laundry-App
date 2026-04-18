import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

interface WeightInputProps {
  weight: string;
  onWeightChange: (weight: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

const WeightInput: React.FC<WeightInputProps> = ({
  weight,
  onWeightChange,
  onIncrement,
  onDecrement,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Weight (kg)</Text>
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.button} onPress={onDecrement}>
          <Text style={styles.buttonText}>-</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={onWeightChange}
          keyboardType="numeric"
          placeholder="0"
          textAlign="center"
        />
        <TouchableOpacity style={styles.button} onPress={onIncrement}>
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>Minimum weight: 1 kg</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SIZES.md,
  },
  label: {
    fontSize: SIZES.sm,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: SIZES.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  button: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    margin: 4,
  },
  buttonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.black,
    padding: SIZES.md,
  },
  hint: {
    fontSize: SIZES.xs,
    color: COLORS.gray,
    marginTop: 4,
  },
});

export default WeightInput;