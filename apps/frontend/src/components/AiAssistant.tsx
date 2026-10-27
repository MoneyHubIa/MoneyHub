import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import {
  Bot,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Minus,
  RotateCcw,
  Send,
  Sparkles,
  X,
  Zap
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
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
import { useTheme } from '../theme/ThemeContext';
import { useResponsive } from '../theme/useResponsive';

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
  month?: number | undefined;
  year?: number | undefined;
  templateId?: string | undefined;
};

export type ChatMessage = {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string | undefined;
  latencyMs?: number | undefined;
  tokens?: number | undefined;
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
  textColor: string;
  brandColor: string;
}>;

function renderInlineTokens(
  text: string,
  isUser: boolean,
  keyPrefix: string,
  textColor: string,
  brandColor: string
): React.ReactNode[] {
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
            { color: isUser ? '#FFFFFF' : textColor, fontWeight: '700' }
          ]}
        >
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <Text
          key={key}
          style={[
            styles.messageContent,
            styles.inlineCode,
            { color: brandColor }
          ]}
        >
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <Text
          key={key}
          style={[
            styles.messageContent,
            { color: isUser ? '#FFFFFF' : textColor, fontStyle: 'italic' }
          ]}
        >
          {part.slice(1, -1)}
        </Text>
      );
    }
    return (
      <Text
        key={key}
        style={[
          styles.messageContent,
          { color: isUser ? '#FFFFFF' : textColor }
        ]}
      >
        {part}
      </Text>
    );
  });
}

function FormattedAiMessage({
  content,
  isUser,
  textColor,
  brandColor
}: FormattedAiMessageProps): React.JSX.Element {
  const lines = content.split('\n');

  return (
    <View style={styles.formattedContainer}>
      {lines.map((line, lineIndex) => {
        const trimmed = line.trim();
        const lineKey = `line-${lineIndex}`;

        if (!trimmed) {
          return <View key={lineKey} style={styles.paragraphGap} />;
        }

        const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
        if (headingMatch) {
          const headingText = headingMatch[2] ?? '';
          return (
            <View key={lineKey} style={styles.headingBlock}>
              <Text
                style={[
                  styles.headingText,
                  { color: isUser ? '#FFFFFF' : textColor, fontWeight: '700' }
                ]}
              >
                {headingText}
              </Text>
            </View>
          );
        }

        const bulletMatch = trimmed.match(/^[\*\-•]\s+(.*)$/);
        if (bulletMatch) {
          const bulletText = bulletMatch[1] ?? '';
          return (
            <View key={lineKey} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, { color: isUser ? '#FFFFFF' : brandColor }]}>•</Text>
              <Text style={styles.bulletTextWrapper}>
                {renderInlineTokens(bulletText, isUser, lineKey, textColor, brandColor)}
              </Text>
            </View>
          );
        }

        const numberMatch = trimmed.match(/^(\d+[\.\)])\s+(.*)$/);
        if (numberMatch) {
          const numPrefix = numberMatch[1] ?? '';
          const itemText = numberMatch[2] ?? '';
          return (
            <View key={lineKey} style={styles.bulletRow}>
              <Text style={[styles.numberPrefix, { color: isUser ? '#FFFFFF' : brandColor }]}>
                {numPrefix}
              </Text>
              <Text style={styles.bulletTextWrapper}>
                {renderInlineTokens(itemText, isUser, lineKey, textColor, brandColor)}
              </Text>
            </View>
          );
        }

        return (
          <Text key={lineKey} style={styles.paragraphLine}>
            {renderInlineTokens(line, isUser, lineKey, textColor, brandColor)}
          </Text>
        );
      })}
    </View>
  );
}

export type AiAssistantProps = Readonly<{
  preferredCurrency?: string | undefined;
  initialMonth?: number | undefined;
  initialYear?: number | undefined;
  isOpen?: boolean | undefined;
  viewMode?: 'fullscreen' | 'floating' | undefined;
  hideFloatingTrigger?: boolean | undefined;
  onClose?: (() => void) | undefined;
  onToggle?: (() => void) | undefined;
}>;

export function AiAssistant({
  initialMonth,
  initialYear,
  isOpen: controlledIsOpen,
  viewMode = 'floating',
  hideFloatingTrigger = false,
  onClose,
  onToggle
}: AiAssistantProps): React.JSX.Element {
  const { theme } = useTheme();
  const { isDesktop } = useResponsive();
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
    if (isWidgetOpen || viewMode === 'fullscreen') {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, loading, isWidgetOpen, viewMode]);

  const monthLabel = MONTH_NAMES[selectedMonth - 1] ?? `Mês ${selectedMonth}`;

  // When widget is closed and in floating mode: render minimal circular FAB
  if (viewMode === 'floating' && !isWidgetOpen) {
    if (hideFloatingTrigger) {
      return <></>;
    }
    return (
      <View style={[styles.fabWrapper, !isDesktop && styles.fabWrapperMobile]}>
        <Pressable
          accessibilityLabel="Abrir Assistente Financeiro IA"
          accessibilityRole="button"
          onPress={handleToggle}
          style={({ pressed }) => [
            styles.fabButton,
            { backgroundColor: theme.brandAI, opacity: pressed ? 0.85 : 1 }
          ]}
        >
          <View style={styles.fabIconContainer}>
            <Bot color="#ffffff" size={24} />
            <View style={[styles.fabOnlineDot, { backgroundColor: theme.income }]} />
          </View>
          <Text style={styles.srOnly}>IA Financeira</Text>
        </Pressable>
      </View>
    );
  }

  const isFullscreen = viewMode === 'fullscreen';

  return (
    <View
      style={
        isFullscreen
          ? [styles.fullscreenContainer, { backgroundColor: theme.bgSurface, borderColor: theme.border }]
          : [styles.widgetWrapper, !isDesktop && styles.widgetWrapperMobile]
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.chatWindow,
          {
            backgroundColor: theme.bgSurface,
            borderColor: theme.border
          },
          !isDesktop && styles.chatWindowMobile,
          isFullscreen && styles.chatWindowFullscreen
        ]}
      >
        {/* Header Bar */}
        <View
          style={[
            styles.windowHeader,
            {
              backgroundColor: theme.bgElevated,
              borderBottomColor: theme.borderElevated
            }
          ]}
        >
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.headerAvatar,
                { backgroundColor: theme.bgSurface, borderColor: theme.brandAI }
              ]}
            >
              <Bot color={theme.brandAI} size={20} />
              <View style={[styles.headerDot, { backgroundColor: theme.income }]} />
            </View>
            <View>
              <View style={styles.headerTitleRow}>
                <Text
                  accessibilityRole="header"
                  style={[styles.headerTitle, { color: theme.textPrimary }]}
                >
                  Assistente Financeiro IA
                </Text>
                <View style={[styles.onlineBadge, { backgroundColor: theme.incomeBadge }]}>
                  <Text style={[styles.onlineText, { color: theme.income }]}>Online</Text>
                </View>
              </View>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                MoneyHub AI • llama3.1:8b
              </Text>
            </View>
          </View>

          <View style={styles.headerControls}>
            <Pressable
              accessibilityLabel="Limpar conversa"
              accessibilityRole="button"
              onPress={handleResetConversation}
              style={[styles.iconButton, { backgroundColor: theme.bgSurface }]}
            >
              <RotateCcw color={theme.textSecondary} size={15} />
            </Pressable>

            {!isFullscreen && (
              <>
                <Pressable
                  accessibilityLabel="Minimizar assistente"
                  accessibilityRole="button"
                  onPress={handleClose}
                  style={[styles.iconButton, { backgroundColor: theme.bgSurface }]}
                >
                  <Minus color={theme.textSecondary} size={16} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Fechar assistente"
                  accessibilityRole="button"
                  onPress={handleClose}
                  style={[styles.iconButton, { backgroundColor: theme.bgSurface }]}
                >
                  <X color={theme.textSecondary} size={16} />
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Period Selector Bar */}
        <View
          style={[
            styles.periodBar,
            {
              backgroundColor: theme.bgSurface,
              borderBottomColor: theme.borderElevated
            }
          ]}
        >
          <Pressable
            accessibilityLabel="Mês anterior"
            accessibilityRole="button"
            onPress={handlePreviousMonth}
            style={[styles.periodNavBtn, { backgroundColor: theme.bgElevated }]}
          >
            <ChevronLeft color={theme.textSecondary} size={16} />
          </Pressable>
          <View style={styles.periodCenter}>
            <Calendar color={theme.brandAI} size={14} />
            <Text style={[styles.periodText, { color: theme.textSecondary }]}>
              Contexto:{' '}
              <Text style={[styles.periodTextHighlight, { color: theme.brandAI }]}>
                {monthLabel} de {selectedYear}
              </Text>
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Próximo mês"
            accessibilityRole="button"
            onPress={handleNextMonth}
            style={[styles.periodNavBtn, { backgroundColor: theme.bgElevated }]}
          >
            <ChevronRight color={theme.textSecondary} size={16} />
          </Pressable>
        </View>

        {/* Quick Prompts Bar */}
        <View
          style={[
            styles.quickPromptsBar,
            {
              backgroundColor: theme.bgElevated,
              borderBottomColor: theme.borderElevated
            }
          ]}
        >
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
                    {
                      backgroundColor: theme.bgSurface,
                      borderColor: theme.borderElevated
                    },
                    loading && styles.quickPillDisabled
                  ]}
                >
                  <Icon color={theme.brandAI} size={13} />
                  <Text style={[styles.quickPillText, { color: theme.textPrimary }]}>
                    {item.label}
                  </Text>
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
                    <View
                      style={[
                        styles.assistantAvatar,
                        { backgroundColor: theme.brandAI }
                      ]}
                    >
                      <Bot color="#ffffff" size={14} />
                    </View>
                  )}

                  <View
                    style={[
                      styles.messageBubble,
                      isUser
                        ? [styles.userBubble, { backgroundColor: theme.brandAI }]
                        : [
                            styles.assistantBubble,
                            {
                              backgroundColor: theme.bgElevated,
                              borderColor: theme.borderElevated
                            }
                          ]
                    ]}
                  >
                    <FormattedAiMessage
                      brandColor={theme.brandAI}
                      content={item.content}
                      isUser={isUser}
                      textColor={theme.textPrimary}
                    />

                    {!isUser && (item.model || item.latencyMs !== undefined) && (
                      <View style={styles.messageFooter}>
                        {item.model && (
                          <View
                            style={[
                              styles.modelBadge,
                              { backgroundColor: theme.bgSurface, borderColor: theme.borderElevated }
                            ]}
                          >
                            <Cpu color={theme.textMuted} size={10} />
                            <Text style={[styles.modelBadgeText, { color: theme.textSecondary }]}>
                              {item.model}
                            </Text>
                          </View>
                        )}
                        {item.latencyMs !== undefined && (
                          <View
                            style={[
                              styles.latencyBadge,
                              { backgroundColor: theme.incomeBadge, borderColor: theme.income }
                            ]}
                          >
                            <Clock color={theme.income} size={10} />
                            <Text style={[styles.latencyBadgeText, { color: theme.income }]}>
                              {(item.latencyMs / 1000).toFixed(1)}s
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />

          {loading && (
            <View
              style={[
                styles.loadingBubble,
                { backgroundColor: theme.bgElevated, borderColor: theme.borderElevated }
              ]}
            >
              <ActivityIndicator color={theme.brandAI} size="small" />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Consultando IA e analisando suas finanças...
              </Text>
            </View>
          )}

          {error && (
            <View style={[styles.errorBox, { backgroundColor: theme.expenseBadge }]}>
              <Text style={[styles.errorText, { color: theme.expense }]}>
                Não foi possível obter resposta da IA: {error.message}
              </Text>
              <Pressable
                onPress={() => handleSendMessage()}
                style={[styles.retryButton, { backgroundColor: theme.expense }]}
              >
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Input Bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: theme.bgElevated,
              borderTopColor: theme.borderElevated
            }
          ]}
        >
          <TextInput
            accessibilityLabel="Mensagem para a IA"
            multiline
            onChangeText={setInputText}
            placeholder="Pergunte sobre seus gastos, receitas ou metas..."
            placeholderTextColor={theme.textMuted}
            style={[
              styles.textInput,
              {
                backgroundColor: theme.bgSurface,
                borderColor: theme.borderElevated,
                color: theme.textPrimary
              }
            ]}
            value={inputText}
          />

          <Pressable
            accessibilityLabel="Enviar mensagem"
            accessibilityRole="button"
            disabled={!inputText.trim() || loading}
            onPress={() => handleSendMessage()}
            style={[
              styles.sendButton,
              { backgroundColor: theme.brandAI },
              (!inputText.trim() || loading) && styles.sendButtonDisabled
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Send color="#ffffff" size={17} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  assistantAvatar: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    marginRight: 6,
    width: 28
  },
  assistantBubble: {
    borderTopLeftRadius: 4,
    borderWidth: 1
  },
  assistantRow: {
    justifyContent: 'flex-start'
  },
  bulletDot: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19
  },
  bulletRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    marginVertical: 1
  },
  bulletTextWrapper: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    lineHeight: 19
  },
  chatWindow: {
    borderRadius: 14,
    borderWidth: 1,
    elevation: 8,
    height: 520,
    overflow: 'hidden',
    boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.25)',
    width: 380
  },
  chatWindowFullscreen: {
    borderRadius: 12,
    elevation: 0,
    height: '100%',
    boxShadow: 'none',
    width: '100%'
  },
  errorBox: {
    borderRadius: 6,
    gap: 6,
    margin: 8,
    padding: 10
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600'
  },
  fabButton: {
    alignItems: 'center',
    borderRadius: 24,
    elevation: 6,
    height: 48,
    justifyContent: 'center',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    width: 48
  },
  fabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  fabLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  fabLabelContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4
  },
  fabOnlineDot: {
    borderColor: '#ffffff',
    borderRadius: 5,
    borderWidth: 1.5,
    bottom: -1,
    height: 10,
    position: 'absolute',
    right: -1,
    width: 10
  },
  fabWrapper: {
    bottom: 24,
    position: 'absolute',
    right: 24,
    zIndex: 999
  },
  fabWrapperMobile: {
    bottom: 80,
    right: 16
  },
  srOnly: {
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    position: 'absolute',
    width: 1
  },
  formattedContainer: {
    gap: 2
  },
  fullscreenContainer: {
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 600,
    width: '100%'
  },
  headerAvatar: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    height: 36,
    justifyContent: 'center',
    position: 'relative',
    width: 36
  },
  headerControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  headerDot: {
    borderColor: '#ffffff',
    borderRadius: 4,
    borderWidth: 1,
    bottom: 0,
    height: 8,
    position: 'absolute',
    right: 0,
    width: 8
  },
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700'
  },
  headerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  headingBlock: {
    marginVertical: 4
  },
  headingText: {
    fontSize: 14
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 6,
    height: 30,
    justifyContent: 'center',
    width: 30
  },
  inlineCode: {
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    paddingHorizontal: 4
  },
  inputBar: {
    alignItems: 'flex-end',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 10
  },
  latencyBadge: {
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  latencyBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  loadingBubble: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 12,
    marginVertical: 4,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  loadingText: {
    fontSize: 12,
    fontStyle: 'italic'
  },
  messageBubble: {
    borderRadius: 14,
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  messageContent: {
    fontSize: 13,
    lineHeight: 19
  },
  messageFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 6
  },
  messageListContent: {
    gap: 10,
    padding: 12
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 2
  },
  messagesContainer: {
    flex: 1
  },
  modelBadge: {
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  modelBadgeText: {
    fontSize: 11,
    fontWeight: '600'
  },
  numberPrefix: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19
  },
  onlineBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '700'
  },
  paragraphGap: {
    height: 4
  },
  paragraphLine: {
    lineHeight: 19
  },
  periodBar: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  periodCenter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  periodNavBtn: {
    alignItems: 'center',
    borderRadius: 6,
    height: 28,
    justifyContent: 'center',
    width: 28
  },
  periodText: {
    fontSize: 12
  },
  periodTextHighlight: {
    fontWeight: '700'
  },
  quickPill: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  quickPillDisabled: {
    opacity: 0.5
  },
  quickPillText: {
    fontSize: 12,
    fontWeight: '600'
  },
  quickPromptsBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  sendButtonDisabled: {
    opacity: 0.5
  },
  textInput: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    fontSize: 13,
    maxHeight: 80,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  userBubble: {
    borderTopRightRadius: 4
  },
  userRow: {
    justifyContent: 'flex-end'
  },
  widgetWrapper: {
    bottom: 24,
    position: 'absolute',
    right: 24,
    zIndex: 999
  },
  widgetWrapperMobile: {
    bottom: 74,
    left: 12,
    right: 12
  },
  chatWindowMobile: {
    maxHeight: 480,
    width: '100%'
  },
  windowHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10
  }
});
