import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { Bell } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

const MY_NOTIFICATIONS_QUERY = gql`
  query MyNotifications {
    myNotifications {
      id
      source
      sourceId
      title
      occurrenceDate
      reminderDate
      readAt
      createdAt
    }
  }
`;

const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      readAt
    }
  }
`;

const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

export type NotificationItem = {
  id: string;
  source: 'EVENT' | 'PAYABLE' | 'RECEIVABLE';
  sourceId: string;
  title: string;
  occurrenceDate: string;
  reminderDate: string;
  readAt?: string | null;
  createdAt: string;
};

type NotificationCenterProps = {
  onOpenSource?: (notification: NotificationItem) => void;
};

type NotificationsData = {
  myNotifications?: NotificationItem[];
};

function sourceLabel(source: NotificationItem['source']): string {
  if (source === 'PAYABLE') return 'Conta a pagar';
  if (source === 'RECEIVABLE') return 'Conta a receber';
  return 'Evento';
}

export function NotificationCenter({ onOpenSource }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const { data, loading, error, refetch } = useQuery<NotificationsData>(MY_NOTIFICATIONS_QUERY, {
    fetchPolicy: 'cache-and-network'
  });
  const [markNotificationRead, { loading: markingNotificationRead }] = useMutation(
    MARK_NOTIFICATION_READ
  );
  const [markAllNotificationsRead, { loading: markingAllNotificationsRead }] = useMutation(
    MARK_ALL_NOTIFICATIONS_READ
  );
  const notifications = data?.myNotifications ?? [];
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications]
  );
  const isMarkingRead = markingNotificationRead || markingAllNotificationsRead;
  const buttonLabel = unreadCount > 0
    ? `Notificações, ${unreadCount} não lida${unreadCount === 1 ? '' : 's'}`
    : 'Notificações';

  const handleMarkRead = async (id: string) => {
    await markNotificationRead({ variables: { id } });
    await refetch();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    await refetch();
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={buttonLabel}
        accessibilityRole="button"
        onPress={() => setOpen((current) => !current)}
        style={styles.trigger}
      >
        <Bell color="#0f766e" size={21} />
        {unreadCount > 0 ? (
          <View accessibilityLabel={`${unreadCount} notificações não lidas`} style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>

      {open ? (
        <View accessibilityLabel="Painel de notificações" style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text accessibilityRole="header" style={styles.title}>Notificações</Text>
            {unreadCount > 0 ? (
              <Pressable
                accessibilityLabel="Marcar todas como lidas"
                accessibilityRole="button"
                disabled={isMarkingRead}
                onPress={() => void handleMarkAllRead()}
                style={[styles.markAllButton, isMarkingRead && styles.buttonDisabled]}
              >
                <Text style={styles.markAllText}>Marcar todas como lidas</Text>
              </Pressable>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.state}>
              <ActivityIndicator color="#0f766e" size="small" />
              <Text style={styles.stateText}>Carregando notificações...</Text>
            </View>
          ) : error ? (
            <Text style={[styles.stateText, styles.errorText]}>Não foi possível carregar notificações.</Text>
          ) : notifications.length === 0 ? (
            <Text style={styles.stateText}>Nenhuma notificação por enquanto.</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.list} style={styles.listScroll}>
              {notifications.map((notification) => {
                const unread = !notification.readAt;
                return (
                  <View
                    accessibilityLabel={unread ? 'Notificação não lida' : 'Notificação lida'}
                    key={notification.id}
                    style={[styles.item, unread && styles.itemUnread]}
                  >
                    <View style={styles.itemCopy}>
                      <Text style={styles.itemTitle}>{notification.title}</Text>
                      <Text style={styles.itemMeta}>
                        {sourceLabel(notification.source)} · {notification.occurrenceDate}
                      </Text>
                    </View>
                    <View style={styles.itemActions}>
                      {onOpenSource ? (
                        <Pressable
                          accessibilityLabel={`Ver ${notification.title} na agenda`}
                          accessibilityRole="button"
                          onPress={() => onOpenSource(notification)}
                          style={styles.actionButton}
                        >
                          <Text style={styles.actionText}>Ver na agenda</Text>
                        </Pressable>
                      ) : null}
                      {unread ? (
                        <Pressable
                          accessibilityLabel={`Marcar ${notification.title} como lida`}
                          accessibilityRole="button"
                          disabled={isMarkingRead}
                          onPress={() => void handleMarkRead(notification.id)}
                          style={[styles.actionButton, isMarkingRead && styles.buttonDisabled]}
                        >
                          <Text style={styles.actionText}>Marcar como lida</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  trigger: { alignItems: 'center', borderColor: '#ccfbf1', borderRadius: 6, borderWidth: 1, justifyContent: 'center', minHeight: 40, minWidth: 40, padding: 8 },
  badge: { alignItems: 'center', backgroundColor: '#dc2626', borderColor: '#ffffff', borderRadius: 10, borderWidth: 1, justifyContent: 'center', minHeight: 18, minWidth: 18, paddingHorizontal: 4, position: 'absolute', right: -6, top: -6 },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  panel: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: 8, borderWidth: 1, elevation: 3, gap: 12, maxHeight: 420, padding: 14, position: 'absolute', right: 0, top: 48, width: 360, zIndex: 10 },
  panelHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  title: { color: '#0f172a', fontSize: 18, fontWeight: '700' },
  markAllButton: { paddingVertical: 4 },
  markAllText: { color: '#0f766e', fontSize: 12, fontWeight: '700' },
  state: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingVertical: 8 },
  stateText: { color: '#64748b', fontSize: 14, lineHeight: 20 },
  errorText: { color: '#b91c1c' },
  listScroll: { maxHeight: 330 },
  list: { gap: 8 },
  item: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderRadius: 6, borderWidth: 1, gap: 10, padding: 12 },
  itemUnread: { backgroundColor: '#ecfdf5', borderColor: '#5eead4' },
  itemCopy: { gap: 4 },
  itemTitle: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  itemMeta: { color: '#64748b', fontSize: 12 },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionButton: { paddingVertical: 2 },
  actionText: { color: '#0f766e', fontSize: 12, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 }
});
