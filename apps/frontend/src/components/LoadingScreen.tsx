import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function LoadingScreen() {
  return (
    <View accessibilityLabel="Carregando sessao" style={styles.container}>
      <ActivityIndicator color="#0f766e" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flex: 1,
    justifyContent: 'center'
  }
});
