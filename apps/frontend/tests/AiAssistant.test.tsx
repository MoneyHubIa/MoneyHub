import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React, { PropsWithChildren } from 'react';
import { AiAssistant } from '../src/components/AiAssistant';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { loadSpeechRecognition } from '../src/services/speechRecognition';
import { CONFIRM_AI_OPERATION_PLAN, CANCEL_AI_OPERATION_PLAN, type AiOperationPlan } from '../src/services/aiOperations';
import { createSpeechRecognitionMock } from './helpers/speechRecognitionMock';

function Wrapper({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

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

const mockClient = { mutate: jest.fn(), query: jest.fn(), refetchQueries: jest.fn().mockResolvedValue({}) };
jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => mockClient,
  useMutation: () => [
    mockAskAiMutation,
    {
      loading: mockLoading,
      error: mockError
    }
  ]
}));

jest.mock('../src/services/speechRecognition', () => ({ loadSpeechRecognition: jest.fn() }));
let speech: ReturnType<typeof createSpeechRecognitionMock>;

describe('AiAssistant component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    speech = createSpeechRecognitionMock();
    jest.mocked(loadSpeechRecognition).mockResolvedValue(speech.engine);
    mockLoading = false;
    mockError = null;
    mockAskAiMutation.mockResolvedValue(mockAiResponse);
  });

  test('renders floating trigger button (FAB) when closed', async () => {
    const handleToggle = jest.fn();
    await render(<AiAssistant isOpen={false} onToggle={handleToggle} />, {
      wrapper: Wrapper
    });

    expect(screen.getByText('IA Financeira')).toBeOnTheScreen();
    const fab = screen.getByRole('button', { name: 'Abrir Assistente Financeiro IA' });
    await act(async () => {
      await fireEvent.press(fab);
    });

    expect(handleToggle).toHaveBeenCalled();
  });

  test('renders header, initial welcome message and quick action suggestions when open', async () => {
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen={true} />, {
      wrapper: Wrapper
    });

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
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen={true} />, {
      wrapper: Wrapper
    });

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
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen={true} />, {
      wrapper: Wrapper
    });

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
          history: [],
          timeZone: expect.any(String),
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
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen={true} />, {
      wrapper: Wrapper
    });

    const quickBtn = screen.getByRole('button', { name: 'Resumo do Mês' });
    await act(async () => {
      await fireEvent.press(quickBtn);
    });

    expect(mockAskAiMutation).toHaveBeenCalledWith({
      variables: {
        input: {
          message: 'Faça um resumo geral da minha saúde financeira deste mês.',
          history: [],
          timeZone: expect.any(String),
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
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen={true} />, {
      wrapper: Wrapper
    });

    const clearButton = screen.getByRole('button', { name: 'Limpar conversa' });
    await act(async () => {
      await fireEvent.press(clearButton);
    });

    expect(screen.getByText(/Conversa reiniciada!/i)).toBeOnTheScreen();
  });

  test('closes or minimizes when clicking close button', async () => {
    const handleClose = jest.fn();
    await render(<AiAssistant isOpen={true} onClose={handleClose} />, {
      wrapper: Wrapper
    });

    const closeBtn = screen.getByRole('button', { name: 'Fechar assistente' });
    await act(async () => {
      await fireEvent.press(closeBtn);
    });

    expect(handleClose).toHaveBeenCalled();
  });

  test('renders loading state when mutation is executing', async () => {
    mockLoading = true;
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen={true} />, {
      wrapper: Wrapper
    });

    expect(
      screen.getByText('Consultando IA e analisando suas finanças...')
    ).toBeOnTheScreen();
  });

  test('renders error message when mutation fails', async () => {
    mockError = new Error('Falha na conexão com Ollama');
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen={true} />, {
      wrapper: Wrapper
    });

    expect(
      screen.getByText(
        'Não foi possível obter resposta da IA: Falha na conexão com Ollama'
      )
    ).toBeOnTheScreen();
  });

  test('renders fullscreen mode correctly', async () => {
    await render(<AiAssistant viewMode="fullscreen" />, {
      wrapper: Wrapper
    });

    expect(
      screen.getByRole('header', { name: 'Assistente Financeiro IA' })
    ).toBeOnTheScreen();
    expect(screen.getByText('Resumo do Mês')).toBeOnTheScreen();
  });
});


describe('AiAssistant voice input', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    speech = createSpeechRecognitionMock();
    jest.mocked(loadSpeechRecognition).mockResolvedValue(speech.engine);
    mockLoading = false;
    mockError = null;
    mockAskAiMutation.mockResolvedValue(mockAiResponse);
  });

  test.each(['floating', 'fullscreen'] as const)('dictates in %s mode, then sends only after review', async (viewMode) => {
    await render(<AiAssistant initialMonth={9} initialYear={2026} isOpen viewMode={viewMode} />, { wrapper: Wrapper });
    const input = screen.getByLabelText('Mensagem para a IA');
    await fireEvent.changeText(input, 'Analise');
    const microphone = screen.getByRole('button', { name: 'Iniciar entrada por voz' });
    await waitFor(() => expect(microphone).toBeEnabled());
    await fireEvent.press(microphone);
    expect(screen.getByText('Ouvindo… Toque no botão para parar.')).toBeOnTheScreen();
    expect(input).toHaveProp('editable', false);
    expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Resumo do Mês' })).toBeDisabled();
    await act(async () => { speech.sessions[0]!.result('meus gastos', false); });
    expect(input.props.value).toBe('Analise meus gastos');
    await fireEvent.press(screen.getByRole('button', { name: 'Parar entrada por voz' }));
    expect(screen.getByText('Finalizando…')).toBeOnTheScreen();
    await act(async () => {
      speech.sessions[0]!.result('meus gastos?', true);
      speech.sessions[0]!.end();
    });
    expect(mockAskAiMutation).not.toHaveBeenCalled();
    expect(input).toHaveProp('editable', true);
    await fireEvent.changeText(input, 'Analise meus gastos de setembro?');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar mensagem' }));
    expect(mockAskAiMutation).toHaveBeenCalledWith({ variables: { input: {
      message: 'Analise meus gastos de setembro?', history: [], timeZone: expect.any(String), month: 9, year: 2026,
      templateId: 'GENERAL_FINANCIAL_ASSISTANT'
    } } });
  });

  test('unavailable recognition shows feedback and preserves typed messaging', async () => {
    jest.mocked(loadSpeechRecognition).mockResolvedValue(null);
    await render(<AiAssistant />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText(/Entrada por voz indisponível/)).toBeOnTheScreen());
    expect(screen.getByRole('button', { name: 'Iniciar entrada por voz' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Mensagem para a IA'), 'Minha pergunta');
    expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toBeEnabled();
  });

  test.each(['Fechar assistente', 'Minimizar assistente', 'Limpar conversa'])('cancels capture on %s', async (action) => {
    const onClose = jest.fn();
    await render(<AiAssistant isOpen onClose={onClose} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Iniciar entrada por voz' })).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar entrada por voz' }));
    await fireEvent.press(screen.getByRole('button', { name: action }));
    expect(speech.engine.abort).toHaveBeenCalledTimes(1);
    expect(mockAskAiMutation).not.toHaveBeenCalled();
  });

  test('disables microphone while AI request is loading', async () => {
    mockLoading = true;
    await render(<AiAssistant />, { wrapper: Wrapper });
    expect(screen.getByRole('button', { name: 'Iniciar entrada por voz' })).toBeDisabled();
    expect(speech.engine.requestPermissions).not.toHaveBeenCalled();
  });

  test('shows voice error next to draft and keeps editing available', async () => {
    await render(<AiAssistant />, { wrapper: Wrapper });
    await fireEvent.changeText(screen.getByLabelText('Mensagem para a IA'), 'Rascunho');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Iniciar entrada por voz' })).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar entrada por voz' }));
    await act(async () => { speech.sessions[0]!.error('network'); });
    expect(screen.getByText(/Falha de conexão no reconhecimento/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Mensagem para a IA').props.value).toBe('Rascunho');
    expect(screen.getByLabelText('Mensagem para a IA')).toHaveProp('editable', true);
  });
});


function proposal(status = 'PENDING'): AiOperationPlan {
  return {
    id: 'plan-1',status,confirmedAt:status==='PENDING'||status==='CANCELLED'?null:new Date().toISOString(),createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+1800000).toISOString(),
    totals:['Contas a pagar: R$ 4.000,00'],
    actions:[1,2].map(number=>({id:'action-'+number,key:'bill'+number,operation:'createAccountPayable',title:'Criar conta a pagar '+number,status:status==='COMPLETED'?'SUCCEEDED':'PENDING',resultJson:null,error:null,
      details:[{label:'Descrição',before:null,after:'Conta '+number},{label:'Valor',before:null,after:'R$ 2.000,00'},{label:'Vencimento',before:null,after:'10/12/2026'}]}))
  };
}
describe('AiAssistant operational proposals',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();mockLoading=false;mockError=null;
    speech=createSpeechRecognitionMock();jest.mocked(loadSpeechRecognition).mockResolvedValue(speech.engine);
    mockClient.mutate.mockReset();mockClient.query.mockReset();mockClient.refetchQueries.mockReset().mockResolvedValue({});
    mockAskAiMutation.mockResolvedValue({data:{askAiAssistant:{...mockAiResponse.data.askAiAssistant,answer:'Revise e confirme.',pendingPlan:proposal()}}});
  });
  async function requestProposal(){
    await render(<AiAssistant isOpen />, {wrapper:Wrapper});
    await fireEvent.changeText(screen.getByLabelText('Mensagem para a IA'),'Crie duas contas de 2000 reais');
    await fireEvent.press(screen.getByRole('button',{name:'Enviar mensagem'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Confirmar operações'})).toBeOnTheScreen());
  }
  test('shows individual amounts and total, then saves only after confirmation',async()=>{
    await requestProposal();
    expect(screen.getByText('Total proposto — Contas a pagar: R$ 4.000,00')).toBeOnTheScreen();
    expect(screen.getAllByText('R$ 2.000,00')).toHaveLength(2);
    expect(mockClient.mutate).not.toHaveBeenCalled();
    mockClient.mutate.mockResolvedValue({data:{confirmAiOperationPlan:proposal('COMPLETED')}});
    await fireEvent.press(screen.getByRole('button',{name:'Confirmar operações'}));
    expect(mockClient.mutate).toHaveBeenCalledWith({mutation:CONFIRM_AI_OPERATION_PLAN,variables:{id:'plan-1'}});
    await waitFor(()=>expect(screen.getByText('Operações concluídas')).toBeOnTheScreen());
    expect(screen.queryByRole('button',{name:'Confirmar operações'})).toBeNull();
    expect(mockClient.refetchQueries).toHaveBeenCalled();
  });
  test('cancels without confirming and lets user correct through chat',async()=>{
    await requestProposal();
    await fireEvent.press(screen.getByRole('button',{name:'Corrigir pedido'}));
    expect(screen.getByRole('button',{name:'Confirmar operações'})).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Mensagem para a IA'),'Mude vencimento para dia 20');
    await fireEvent.press(screen.getByRole('button',{name:'Enviar mensagem'}));
    expect(mockAskAiMutation).toHaveBeenLastCalledWith({variables:{input:expect.objectContaining({planId:'plan-1',history:expect.arrayContaining([expect.objectContaining({role:'user'})])})}});
    expect(mockClient.mutate).not.toHaveBeenCalled();
  });
  test('cancel button uses cancellation endpoint',async()=>{
    await requestProposal();
    mockClient.mutate.mockResolvedValue({data:{cancelAiOperationPlan:proposal('CANCELLED')}});
    await fireEvent.press(screen.getByRole('button',{name:'Cancelar proposta'}));
    expect(mockClient.mutate).toHaveBeenCalledWith({mutation:CANCEL_AI_OPERATION_PLAN,variables:{id:'plan-1'}});
    expect(screen.getByText('Proposta cancelada')).toBeOnTheScreen();
  });
  test('recovers saved results after losing confirmation response',async()=>{
    await requestProposal();
    mockClient.mutate.mockRejectedValue(new Error('network'));
    mockClient.query.mockResolvedValue({data:{aiOperationPlan:proposal('COMPLETED')}});
    await fireEvent.press(screen.getByRole('button',{name:'Confirmar operações'}));
    await waitFor(()=>expect(screen.getByText('Operações concluídas')).toBeOnTheScreen());
    expect(mockClient.mutate).toHaveBeenCalledTimes(1);
    expect(mockClient.query).toHaveBeenCalledTimes(1);
    expect(mockClient.refetchQueries).toHaveBeenCalledTimes(1);
  });
  test('keeps receipts visible when refreshing financial screens fails',async()=>{
    await requestProposal();
    mockClient.mutate.mockResolvedValue({data:{confirmAiOperationPlan:proposal('COMPLETED')}});
    mockClient.refetchQueries.mockRejectedValue(new Error('refresh failed'));
    await fireEvent.press(screen.getByRole('button',{name:'Confirmar operações'}));
    expect(screen.getByText('Operações concluídas')).toBeOnTheScreen();
    expect(screen.getByText(/Operações salvas. Não foi possível atualizar/)).toBeOnTheScreen();
  });
  test('shows partial result and allows review of failed actions',async()=>{
    await requestProposal();
    const partial=proposal('PARTIAL');partial.actions[0]!.status='SUCCEEDED';partial.actions[1]!.status='FAILED';partial.actions[1]!.error='Categoria removida.';
    mockClient.mutate.mockResolvedValue({data:{confirmAiOperationPlan:partial}});
    await fireEvent.press(screen.getByRole('button',{name:'Confirmar operações'}));
    expect(screen.getByText('Conclusão parcial')).toBeOnTheScreen();
    expect(screen.getByText('Categoria removida.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button',{name:'Revisar pendências'}));
    expect(mockClient.mutate).toHaveBeenCalledTimes(1);
  });
});
