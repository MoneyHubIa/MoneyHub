import { useWindowDimensions } from 'react-native';

export interface ResponsiveInfo {
  isDesktop: boolean;
  isMobile: boolean;
  width: number;
  height: number;
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 1024;

  return {
    isDesktop,
    isMobile: !isDesktop,
    width,
    height
  };
}
