import { fireEvent, render, screen } from '@testing-library/react-native';
import { ProfileSettings } from '../src/components/ProfileSettings';

const mockSaveProfile = jest.fn();

jest.mock('@apollo/client/react', () => ({
  useMutation: () => [mockSaveProfile, { loading: false }],
  useQuery: () => ({
    data: {
      myProfile: {
        id: 'profile-1',
        fullName: 'Ana Souza',
        preferredCurrency: 'BRL',
        theme: 'SYSTEM'
      }
    },
    error: undefined,
    loading: false
  })
}));

describe('ProfileSettings', () => {
  beforeEach(() => {
    mockSaveProfile.mockReset();
    mockSaveProfile.mockResolvedValue({
      data: {
        updateMyProfile: {
          id: 'profile-1',
          fullName: 'Ana Silva',
          preferredCurrency: 'USD',
          theme: 'DARK'
        }
      }
    });
  });

  test('loads the persisted profile and saves the supported settings', async () => {
    await render(<ProfileSettings />);

    expect(screen.getByDisplayValue('Ana Souza')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Nome completo'), 'Ana Silva');
    await fireEvent.press(screen.getByRole('button', { name: 'USD' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Escuro' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(mockSaveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: { fullName: 'Ana Silva', preferredCurrency: 'USD', theme: 'DARK' }
        }
      })
    );
  });
});
