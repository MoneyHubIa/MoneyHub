import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AiAssistant } from '../src/components/AiAssistant';

const mockAiResponse = {
  data: {
    askAiAssistant: {
      answer: 'Com base no seu histórico de Setembro/2026, seu saldo líquido é positivo em R$ 3.500,00.',
      provider: 'ollama',
      model: 'llama3.1:8b',
      latencyMs: 1500,
      usage: {
        promptTokens: 120,
        completionTokens: 45,
        totalTokens: 165
      },
      contextPeriod: '09/2026',
      contextVersion: 'v1'
    }
  }
};

let mockLoading = false;
let mockError: Error | null = null;
const mockAskAiMutation = jest.fn();

jest.mock('@apollo/client/react', () => ({
  useMutation: () => [
    mockAskAiMutation,
    {
      loading: mockLoading,
      error: mockError
    }
  ]
}));

describe('AiAssistant component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoading = false;
    mockError = null;
    mockAskAiMutation.mockResolvedValue(mockAiResponse);
  });

  test('renders floating trigger button (FAB) when closed', async () => {
    const handleToggle = jest.fn();
    await render(<AiAssistant isOpen={false} onToggle={handleToggle} />);

    expect(screen.getByText('IA Financeira')).toBeOnTheScreen();
    const fab = screen.getByRole('button', { name: 'Abrir Assistente Financeiro IA' });
    await act(async () => {
      await fireEvent.press(fab);
    });

    expect(handleToggle).toHaveBeenCalled();
  });

  test('renders header, initial welcome message and quick action suggestions when open', async () => {
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen={true} />);

    expect(
      screen.getByRole('header', { name: 'Assistente Financeiro IA' })
    ).toBeOnTheScreen();
    expect(screen.getByText('Online')).toBeOnTheScreen();
    expect(screen.getByText('Setembro de 2026')).toBeOnTheScreen();
    expect(screen.getByText('Resumo do Mês')).toBeOnTheScreen();
    expect(screen.getByText('Otimizar Despesas')).toBeOnTheScreen();
    expect(screen.getByText('Próximas Contas')).toBeOnTheScreen();
    expect(screen.getByText(/Sou seu assistente financeiro/i)).toBeOnTheScreen();
  });

  test('changes period with previous and next buttons', async () => {
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen={true} />);

    expect(screen.getByText('Setembro de 2026')).toBeOnTheScreen();

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Mês anterior' }));
    });
    expect(screen.getByText('Agosto de 2026')).toBeOnTheScreen();

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Próximo mês' }));
    });
    expect(screen.getByText('Setembro de 2026')).toBeOnTheScreen();
  });

  test('sends a user message and renders AI response', async () => {
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen={true} />);

    const input = screen.getByLabelText('Mensagem para a IA');
    await act(async () => {
      await fireEvent.changeText(input, 'Como economizar este mês?');
    });

    const sendButton = screen.getByRole('button', { name: 'Enviar mensagem' });
    await act(async () => {
      await fireEvent.press(sendButton);
    });

    expect(mockAskAiMutation).toHaveBeenCalledWith({
      variables: {
        input: {
          message: 'Como economizar este mês?',
          month: 9,
          year: 2026,
          templateId: 'GENERAL_FINANCIAL_ASSISTANT'
        }
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Como economizar este mês?')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Com base no seu histórico de Setembro/2026, seu saldo líquido é positivo em R$ 3.500,00.'
        )
      ).toBeOnTheScreen();
      expect(screen.getByText('llama3.1:8b')).toBeOnTheScreen();
      expect(screen.getByText('1.5s')).toBeOnTheScreen();
    });
  });

  test('triggers quick prompt when clicked', async () => {
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen={true} />);

    const quickBtn = screen.getByRole('button', { name: 'Resumo do Mês' });
    await act(async () => {
      await fireEvent.press(quickBtn);
    });

    expect(mockAskAiMutation).toHaveBeenCalledWith({
      variables: {
        input: {
          message: 'Faça um resumo geral da minha saúde financeira deste mês.',
          month: 9,
          year: 2026,
          templateId: 'MONTHLY_SUMMARY'
        }
      }
    });

    await waitFor(() => {
      expect(
        screen.getByText('Faça um resumo geral da minha saúde financeira deste mês.')
      ).toBeOnTheScreen();
    });
  });

  test('clears conversation when clicking Limpar conversa', async () => {
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen={true} />);

    const clearButton = screen.getByRole('button', { name: 'Limpar conversa' });
    await act(async () => {
      await fireEvent.press(clearButton);
    });

    expect(screen.getByText(/Conversa reiniciada!/i)).toBeOnTheScreen();
  });

  test('closes or minimizes when clicking close button', async () => {
    const handleClose = jest.fn();
    await render(<AiAssistant isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByRole('button', { name: 'Fechar assistente' });
    await act(async () => {
      await fireEvent.press(closeBtn);
    });

    expect(handleClose).toHaveBeenCalled();
  });

  test('renders loading state when mutation is executing', async () => {
    mockLoading = true;
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen={true} />);

    expect(
      screen.getByText('Consultando IA e analisando suas finanças...')
    ).toBeOnTheScreen();
  });

  test('renders error message when mutation fails', async () => {
    mockError = new Error('Falha na conexão com Ollama');
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen={true} />);

    expect(
      screen.getByText(
        'Não foi possível obter resposta da IA: Falha na conexão com Ollama'
      )
    ).toBeOnTheScreen();
  });
});
