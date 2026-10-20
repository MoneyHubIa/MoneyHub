import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Dimensions, Text, View } from 'react-native';
import { useResponsive } from '../src/theme/useResponsive';

function ResponsiveProbe() {
  const { isDesktop, isMobile, width } = useResponsive();
  return (
    <View>
      <Text testID="desktop">{isDesktop ? 'desktop-yes' : 'desktop-no'}</Text>
      <Text testID="mobile">{isMobile ? 'mobile-yes' : 'mobile-no'}</Text>
      <Text testID="width">{String(width)}</Text>
    </View>
  );
}

describe('useResponsive', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('identifies desktop when width is 1024 or higher', async () => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 1200,
      height: 800,
      scale: 1,
      fontScale: 1
    });

    await render(<ResponsiveProbe />);
    expect(screen.getByText('desktop-yes')).toBeOnTheScreen();
    expect(screen.getByText('mobile-no')).toBeOnTheScreen();
    expect(screen.getByText('1200')).toBeOnTheScreen();
  });

  it('identifies mobile when width is less than 1024', async () => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 412,
      height: 915,
      scale: 1,
      fontScale: 1
    });

    await render(<ResponsiveProbe />);
    expect(screen.getByText('desktop-no')).toBeOnTheScreen();
    expect(screen.getByText('mobile-yes')).toBeOnTheScreen();
    expect(screen.getByText('412')).toBeOnTheScreen();
  });
});
