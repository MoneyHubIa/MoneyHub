import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import {
  Bot,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CornerDownLeft,
  Cpu,
  MessageSquare,
  Minus,
  RotateCcw,
  Send,
  Sparkles,
  User,
  X,
  Zap
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

export const ASK_AI_ASSISTANT_MUTATION = gql`
  mutation AskAiAssistant($input: AskAiAssistantInput!) {
    askAiAssistant(input: $input) {
      answer
      provider
      model
      latencyMs
      usage {
        promptTokens
        completionTokens
        totalTokens
      }
      contextPeriod
      contextVersion
    }
  }
`;

export type AiAssistantUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AiAssistantResponse = {
  answer: string;
  provider: string;
  model: string;
  latencyMs: number;
  usage: AiAssistantUsage;
  contextPeriod: string;
  contextVersion: string;
};

export type AskAiAssistantData = {
  askAiAssistant: AiAssistantResponse;
};

export type AskAiAssistantInput = {
  message: string;
  month?: number;
  year?: number;
  templateId?: string;
};

export type ChatMessage = {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
  latencyMs?: number;
  tokens?: number;
};

const QUICK_PROMPTS = [
  {
    id: 'monthly_summary',
    label: 'Resumo do Mês',
    prompt: 'Faça um resumo geral da minha saúde financeira deste mês.',
    templateId: 'MONTHLY_SUMMARY',
    icon: Sparkles
  },
  {
    id: 'expense_optimization',
    label: 'Otimizar Despesas',
    prompt: 'Como posso otimizar minhas despesas e onde estou gastando mais?',
    templateId: 'EXPENSE_OPTIMIZATION',
    icon: Zap
  },
  {
    id: 'bills_due',
    label: 'Próximas Contas',
    prompt: 'Quais são as minhas próximas contas a pagar e quando vencem?',
    templateId: 'GENERAL_FINANCIAL_ASSISTANT',
    icon: Calendar
  }
] as const;

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
] as const;

type FormattedAiMessageProps = Readonly<{
  content: string;
  isUser: boolean;
}>;

function renderInlineTokens(
  text: string,
  isUser: boolean,
  keyPrefix: string
): React.ReactNode[] {
  // Matches **bold**, *italic*, and `code`
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-token-${index}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <Text
          key={key}
          style={[
            styles.messageContent,
            isUser ? styles.userBold : styles.assistantBold
          ]}
        >
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <Text key={key} style={[styles.messageContent, styles.inlineCode]}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <Text key={key} style={[styles.messageContent, styles.italicText]}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return (
      <Text
        key={key}
        style={[
          styles.messageContent,
          isUser ? styles.userContent : styles.assistantContent
        ]}
      >
        {part}
      </Text>
    );
  });
}

function FormattedAiMessage({ content, isUser }: FormattedAiMessageProps) {
  const lines = content.split('\n');

  return (
    <View style={styles.formattedContainer}>
      {lines.map((line, lineIndex) => {
        const trimmed = line.trim();
        const lineKey = `line-${lineIndex}`;

        if (!trimmed) {
          return <View key={lineKey} style={styles.paragraphGap} />;
        }

        // Headings: ### Heading, ## Heading, # Heading
        const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
        if (headingMatch) {
          const headingText = headingMatch[2] ?? '';
          return (
            <View key={lineKey} style={styles.headingBlock}>
              <Text
                style={[
                  styles.headingText,
                  isUser ? styles.userBold : styles.assistantHeading
                ]}
              >
                {headingText}
              </Text>
            </View>
          );
        }

        // Bullet lists: * item, - item, • item
        const bulletMatch = trimmed.match(/^[\*\-•]\s+(.*)$/);
        if (bulletMatch) {
          const bulletText = bulletMatch[1] ?? '';
          return (
            <View key={lineKey} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, isUser && styles.userBullet]}>•</Text>
              <Text style={styles.bulletTextWrapper}>
                {renderInlineTokens(bulletText, isUser, lineKey)}
              </Text>
            </View>
          );
        }

        // Numbered lists: 1. item, 1) item
        const numberMatch = trimmed.match(/^(\d+[\.\)])\s+(.*)$/);
        if (numberMatch) {
          const numPrefix = numberMatch[1] ?? '';
          const itemText = numberMatch[2] ?? '';
          return (
            <View key={lineKey} style={styles.bulletRow}>
              <Text style={[styles.numberPrefix, isUser && styles.userBullet]}>
                {numPrefix}
              </Text>
              <Text style={styles.bulletTextWrapper}>
                {renderInlineTokens(itemText, isUser, lineKey)}
              </Text>
            </View>
          );
        }

        // Regular line
        return (
          <Text key={lineKey} style={styles.paragraphLine}>
            {renderInlineTokens(line, isUser, lineKey)}
          </Text>
        );
      })}
    </View>
  );
}

export type AiAssistantProps = Readonly<{
  preferredCurrency?: string;
  initialMonth?: number;
  initialYear?: number;
  isOpen?: boolean;
  onClose?: () => void;
  onToggle?: () => void;
}>;

export function AiAssistant({
  preferredCurrency: _preferredCurrency = 'BRL',
  initialMonth,
  initialYear,
  isOpen: controlledIsOpen,
  onClose,
  onToggle
}: AiAssistantProps) {
  const currentDate = new Date();
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(true);
  const isWidgetOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const [selectedMonth, setSelectedMonth] = useState<number>(
    initialMonth ?? currentDate.getMonth() + 1
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    initialYear ?? currentDate.getFullYear()
  );
  const [inputText, setInputText] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      content:
        'Olá! Sou seu assistente financeiro no MoneyHub. Posso analisar suas receitas, despesas, contas a pagar e metas para sugerir otimizações.',
      timestamp: new Date(),
      model: 'MoneyHub AI'
    }
  ]);

  const flatListRef = useRef<FlatList<ChatMessage> | null>(null);

  const [askAi, { loading, error }] = useMutation<
    AskAiAssistantData,
    { input: AskAiAssistantInput }
  >(ASK_AI_ASSISTANT_MUTATION);

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else if (onClose && isWidgetOpen) {
      onClose();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handlePreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const handleResetConversation = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        content:
          'Conversa reiniciada! Como posso ajudar na gestão das suas finanças hoje?',
        timestamp: new Date(),
        model: 'MoneyHub AI'
      }
    ]);
  };

  const handleSendMessage = async (customMessage?: string, templateId?: string) => {
    const textToSend = (customMessage ?? inputText).trim();
    if (!textToSend || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: textToSend,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!customMessage) {
      setInputText('');
    }

    try {
      const response = await askAi({
        variables: {
          input: {
            message: textToSend,
            month: selectedMonth,
            year: selectedYear,
            templateId: templateId ?? 'GENERAL_FINANCIAL_ASSISTANT'
          }
        }
      });

      if (response.data?.askAiAssistant) {
        const aiData = response.data.askAiAssistant;
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          content: aiData.answer,
          timestamp: new Date(),
          model: aiData.model,
          latencyMs: aiData.latencyMs,
          tokens: aiData.usage?.totalTokens
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch {
      // Error handled by mutation state
    }
  };

  useEffect(() => {
    if (isWidgetOpen) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, loading, isWidgetOpen]);

  const monthLabel = MONTH_NAMES[selectedMonth - 1] ?? `Mês ${selectedMonth}`;

  // When widget is closed: render Floating Action Button (FAB)
  if (!isWidgetOpen) {
    return (
      <View style={styles.fabWrapper}>
        <Pressable
          accessibilityLabel="Abrir Assistente Financeiro IA"
          accessibilityRole="button"
          onPress={handleToggle}
          style={styles.fabButton}
        >
          <View style={styles.fabIconContainer}>
            <Bot color="#ffffff" size={24} />
            <View style={styles.fabOnlineDot} />
          </View>
          <View style={styles.fabLabelContainer}>
            <Text style={styles.fabLabel}>IA Financeira</Text>
            <Sparkles color="#6ee7b7" size={13} />
          </View>
        </Pressable>
      </View>
    );
  }

  // When widget is open: render Floating Chat Window
  return (
    <View style={styles.widgetWrapper}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.chatWindow}
      >
        {/* Header Bar */}
        <View style={styles.windowHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.headerAvatar}>
              <Bot color="#0f766e" size={20} />
              <View style={styles.headerDot} />
            </View>
            <View>
              <View style={styles.headerTitleRow}>
                <Text accessibilityRole="header" style={styles.headerTitle}>
                  Assistente Financeiro IA
                </Text>
                <View style={styles.onlineBadge}>
                  <Text style={styles.onlineText}>Online</Text>
                </View>
              </View>
              <Text style={styles.headerSubtitle}>MoneyHub AI • llama3.1:8b</Text>
            </View>
          </View>

          <View style={styles.headerControls}>
            <Pressable
              accessibilityLabel="Limpar conversa"
              accessibilityRole="button"
              onPress={handleResetConversation}
              style={styles.iconButton}
            >
              <RotateCcw color="#64748b" size={15} />
            </Pressable>
            <Pressable
              accessibilityLabel="Minimizar assistente"
              accessibilityRole="button"
              onPress={handleClose}
              style={styles.iconButton}
            >
              <Minus color="#64748b" size={16} />
            </Pressable>
            <Pressable
              accessibilityLabel="Fechar assistente"
              accessibilityRole="button"
              onPress={handleClose}
              style={[styles.iconButton, styles.closeButton]}
            >
              <X color="#64748b" size={16} />
            </Pressable>
          </View>
        </View>

        {/* Period Selector Bar */}
        <View style={styles.periodBar}>
          <Pressable
            accessibilityLabel="Mês anterior"
            accessibilityRole="button"
            onPress={handlePreviousMonth}
            style={styles.periodNavBtn}
          >
            <ChevronLeft color="#475569" size={16} />
          </Pressable>
          <View style={styles.periodCenter}>
            <Calendar color="#0f766e" size={14} />
            <Text style={styles.periodText}>
              Contexto: <Text style={styles.periodTextHighlight}>{monthLabel} de {selectedYear}</Text>
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Próximo mês"
            accessibilityRole="button"
            onPress={handleNextMonth}
            style={styles.periodNavBtn}
          >
            <ChevronRight color="#475569" size={16} />
          </Pressable>
        </View>

        {/* Quick Prompts Bar */}
        <View style={styles.quickPromptsBar}>
          <FlatList
            data={QUICK_PROMPTS}
            horizontal
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const Icon = item.icon;
              return (
                <Pressable
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={() => handleSendMessage(item.prompt, item.templateId)}
                  style={[
                    styles.quickPill,
                    loading && styles.quickPillDisabled
                  ]}
                >
                  <Icon color="#0f766e" size={13} />
                  <Text style={styles.quickPillText}>{item.label}</Text>
                </Pressable>
              );
            }}
            showsHorizontalScrollIndicator={false}
          />
        </View>

        {/* Messages Feed */}
        <View style={styles.messagesContainer}>
          <FlatList
            contentContainerStyle={styles.messageListContent}
            data={messages}
            keyExtractor={(item) => item.id}
            ref={flatListRef}
            renderItem={({ item }) => {
              const isUser = item.sender === 'user';
              return (
                <View
                  style={[
                    styles.messageRow,
                    isUser ? styles.userRow : styles.assistantRow
                  ]}
                >
                  {!isUser && (
                    <View style={styles.assistantAvatar}>
                      <Bot color="#ffffff" size={14} />
                    </View>
                  )}

                  <View
                    style={[
                      styles.messageBubble,
                      isUser ? styles.userBubble : styles.assistantBubble
                    ]}
                  >
                    <FormattedAiMessage content={item.content} isUser={isUser} />

                    <View style={styles.messageFooter}>
                      {!isUser && item.model && (
                        <View style={styles.modelBadge}>
                          <Cpu color="#64748b" size={10} />
                          <Text style={styles.modelBadgeText}>{item.model}</Text>
                        </View>
                      )}
                      {!isUser && typeof item.latencyMs === 'number' && (
                        <View style={styles.latencyBadge}>
                          <Clock color="#059669" size={10} />
                          <Text style={styles.latencyBadgeText}>
                            {(item.latencyMs / 1000).toFixed(1)}s
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {isUser && (
                    <View style={styles.userAvatar}>
                      <User color="#ffffff" size={14} />
                    </View>
                  )}
                </View>
              );
            }}
            testID="chat-messages-list"
          />

          {/* Loading Indicator */}
          {loading && (
            <View style={[styles.messageRow, styles.assistantRow]}>
              <View style={styles.assistantAvatar}>
                <Bot color="#ffffff" size={14} />
              </View>
              <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
                <ActivityIndicator color="#0f766e" size="small" />
                <Text style={styles.loadingText}>
                  Consultando IA e analisando suas finanças...
                </Text>
              </View>
            </View>
          )}

          {/* Error Notice */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                Não foi possível obter resposta da IA: {error.message}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleSendMessage()}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            accessibilityLabel="Mensagem para a IA"
            editable={!loading}
            multiline
            onChangeText={setInputText}
            onSubmitEditing={() => handleSendMessage()}
            placeholder="Pergunte sobre seus gastos, contas ou saldo..."
            placeholderTextColor="#94a3b8"
            style={styles.textInput}
            value={inputText}
          />
          <Pressable
            accessibilityLabel="Enviar mensagem"
            accessibilityRole="button"
            disabled={!inputText.trim() || loading}
            onPress={() => handleSendMessage()}
            style={[
              styles.sendButton,
              (!inputText.trim() || loading) && styles.sendButtonDisabled
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Send color="#ffffff" size={16} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Floating wrapper on bottom-right
  fabWrapper: {
    bottom: 24,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 24,
    zIndex: 999
  },
  fabButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderColor: '#115e59',
    borderRadius: 28,
    borderWidth: 1,
    elevation: 8,
    flexDirection: 'row',
    gap: 10,
    height: 52,
    paddingHorizontal: 16,
    boxShadow: '0px 6px 10px rgba(15, 118, 110, 0.35)'
  },
  fabIconContainer: {
    position: 'relative'
  },
  fabOnlineDot: {
    backgroundColor: '#22c55e',
    borderColor: '#0f766e',
    borderRadius: 5,
    borderWidth: 1.5,
    bottom: -2,
    height: 10,
    position: 'absolute',
    right: -2,
    width: 10
  },
  fabLabelContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  fabLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  widgetWrapper: {
    bottom: 20,
    maxHeight: '85%',
    maxWidth: '94%',
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 20,
    width: 400,
    zIndex: 999
  },
  chatWindow: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    elevation: 12,
    flexDirection: 'column',
    height: 560,
    overflow: 'hidden',
    boxShadow: '0px 10px 20px rgba(15, 23, 42, 0.18)',
    width: '100%'
  },
  windowHeader: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10
  },
  headerAvatar: {
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    position: 'relative',
    width: 36
  },
  headerDot: {
    backgroundColor: '#16a34a',
    borderRadius: 4,
    bottom: -1,
    height: 7,
    position: 'absolute',
    right: -1,
    width: 7
  },
  headerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700'
  },
  onlineBadge: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1
  },
  onlineText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '600'
  },
  headerSubtitle: {
    color: '#64748b',
    fontSize: 11
  },
  headerControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 4,
    height: 28,
    justifyContent: 'center',
    width: 28
  },
  closeButton: {
    backgroundColor: '#f1f5f9'
  },
  periodBar: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  periodNavBtn: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 4,
    borderWidth: 1,
    height: 26,
    justifyContent: 'center',
    width: 26
  },
  periodCenter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  periodText: {
    color: '#475569',
    fontSize: 12
  },
  periodTextHighlight: {
    color: '#0f172a',
    fontWeight: '700'
  },
  quickPromptsBar: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#f1f5f9',
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  quickPill: {
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    borderColor: '#99f6e4',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginRight: 6,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  quickPillDisabled: {
    opacity: 0.5
  },
  quickPillText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '600'
  },
  messagesContainer: {
    backgroundColor: '#f8fafc',
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  messageListContent: {
    gap: 10,
    paddingBottom: 4
  },
  messageRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginVertical: 2
  },
  userRow: {
    justifyContent: 'flex-end'
  },
  assistantRow: {
    justifyContent: 'flex-start'
  },
  assistantAvatar: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28
  },
  userAvatar: {
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28
  },
  messageBubble: {
    borderRadius: 8,
    maxWidth: '85%',
    padding: 10
  },
  userBubble: {
    backgroundColor: '#0f766e',
    borderBottomRightRadius: 2
  },
  assistantBubble: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderTopLeftRadius: 2,
    borderWidth: 1
  },
  messageContent: {
    fontSize: 13,
    lineHeight: 19
  },
  userContent: {
    color: '#ffffff'
  },
  assistantContent: {
    color: '#1e293b'
  },
  formattedContainer: {
    gap: 3
  },
  paragraphGap: {
    height: 6
  },
  paragraphLine: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  headingBlock: {
    marginVertical: 3
  },
  headingText: {
    fontSize: 14,
    fontWeight: '700'
  },
  assistantHeading: {
    color: '#0f172a'
  },
  bulletRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    marginVertical: 1
  },
  bulletDot: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19
  },
  numberPrefix: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19
  },
  userBullet: {
    color: '#ffffff'
  },
  bulletTextWrapper: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    lineHeight: 19
  },
  userBold: {
    color: '#ffffff',
    fontWeight: '700'
  },
  assistantBold: {
    color: '#0f172a',
    fontWeight: '700'
  },
  italicText: {
    fontStyle: 'italic'
  },
  inlineCode: {
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    color: '#0f766e',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    paddingHorizontal: 4
  },
  messageFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6
  },
  modelBadge: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1
  },
  modelBadgeText: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '600'
  },
  latencyBadge: {
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1
  },
  latencyBadgeText: {
    color: '#065f46',
    fontSize: 9,
    fontWeight: '700'
  },
  loadingBubble: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  loadingText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic'
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
    marginTop: 6,
    padding: 8
  },
  errorText: {
    color: '#991b1b',
    fontSize: 12
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#fee2e2',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  retryButtonText: {
    color: '#991b1b',
    fontSize: 11,
    fontWeight: '700'
  },
  inputBar: {
    alignItems: 'flex-end',
    backgroundColor: '#ffffff',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 8
  },
  textInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    maxHeight: 80,
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 6,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  sendButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.7
  }
});
