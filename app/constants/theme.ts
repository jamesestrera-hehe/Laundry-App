export const COLORS = {
  primary: '#4A90E2',
  secondary: '#50E3C2',
  background: '#F8F9FA',
  white: '#FFFFFF',
  black: '#1A1A1A',
  gray: '#9B9B9B',
  lightGray: '#E8ECF0',
  danger: '#FF6B6B',
  success: '#4CD964',
  warning: '#FFB347',
  darkBlue: '#2C3E50',
  backgroundColor: '#007aff',
};

export const SIZES = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Default export to fix warning
const theme = { COLORS, SIZES, SHADOWS };
export default theme;