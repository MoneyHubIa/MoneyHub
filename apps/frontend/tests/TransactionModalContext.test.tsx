import { ApolloClient, ApolloLink, InMemoryCache } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { Observable } from 'rxjs';
import { TransactionModal, type CategoryItem } from '../src/components/TransactionModal';
import { ThemeProvider } from '../src/theme/ThemeContext';

let client: ApolloClient;
let serverCategories: CategoryItem[];
let serverError: boolean;
const request = jest.fn();

function Wrapper({ children }: PropsWithChildren) {
  return <ApolloProvider client={client}><ThemeProvider>{children}</ThemeProvider></ApolloProvider>;
}

beforeEach(() => {
  request.mockClear();
  serverCategories = [];
  serverError = false;
  client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(() => new Observable((observer) => {
      request();
      if (serverError) {
        observer.error(new Error('Serviço indisponível'));
        return;
      }
      observer.next({ data: {
        myCategories: serverCategories,
        myProfile: { id: 'profile-1', preferredCurrency: 'BRL' }
      } });
      observer.complete();
    }))
  });
});

afterEach(() => { client.stop(); });

test('fetches only when open and refreshes an initially empty category list on reopening', async () => {
  const onClose = jest.fn();
  const view = await render(<TransactionModal onClose={onClose} preferredCurrency="BRL" visible={false} />, { wrapper: Wrapper });
  expect(request).not.toHaveBeenCalled();
  await view.rerender(<TransactionModal onClose={onClose} preferredCurrency="BRL" visible />);
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Crie categorias primeiro.')).toBeOnTheScreen();
  await view.rerender(<TransactionModal onClose={onClose} preferredCurrency="BRL" visible={false} />);
  serverCategories = [{ id: 'new', name: 'Categoria nova', type: 'EXPENSE', color: '#F43F5E' }];
  await view.rerender(<TransactionModal onClose={onClose} preferredCurrency="BRL" visible />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Categoria nova' })).toBeOnTheScreen());
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('Crie categorias primeiro.')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Descrição da transação'), 'Compra');
  await fireEvent.press(screen.getByRole('button', { name: 'Categoria nova' }));
  expect(screen.getByLabelText('Descrição da transação')).toHaveProp('value', 'Compra');
});

test('preserves categories and currency supplied by the parent without requesting context', async () => {
  await render(<TransactionModal
    onClose={jest.fn()} visible preferredCurrency="USD"
    categories={[{ id: 'provided', name: 'Categoria fornecida', type: 'EXPENSE', color: '#F43F5E' }]}
  />, { wrapper: Wrapper });
  expect(screen.getByRole('button', { name: 'Categoria fornecida' })).toBeOnTheScreen();
  expect(screen.getByText('Valor (USD)')).toBeOnTheScreen();
  expect(request).not.toHaveBeenCalled();
});

test('shows context failure and retries without closing the modal', async () => {
  serverError = true;
  await render(<TransactionModal onClose={jest.fn()} preferredCurrency="BRL" visible />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível atualizar as categorias. Tente novamente.'));
  serverError = false;
  serverCategories = [{ id: 'retry', name: 'Categoria recuperada', type: 'EXPENSE', color: '#F43F5E' }];
  await fireEvent.press(screen.getByRole('button', { name: 'Tentar atualizar categorias novamente' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Categoria recuperada' })).toBeOnTheScreen());
  expect(screen.queryByRole('alert')).toBeNull();
  expect(request).toHaveBeenCalledTimes(2);
});
