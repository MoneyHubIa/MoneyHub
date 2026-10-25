# App, interface e Analytics

Palavras-chave: @frontend | expo | rotas | componentes | tema | interface | analytics

Expo Router compõe o cliente universal; DashboardShell organiza funcionalidades.
A interface usa componentes React Native, StyleSheet e tokens próprios.

## Rotas e estado

- app/(auth): login, registro e solicitação de recuperação.
- app/(app): app autenticado, onboarding e verificação de email.
- app/reset-password.tsx: ação pública de recuperação, fora dos grupos anteriores.
- app/_layout.tsx: ApolloProvider, ThemeProvider, AuthProvider e Stack.
- src/navigation/modules.ts: itens de navegação.
- src/components/ui e layout: componentes reutilizáveis.

Apollo usa InMemoryCache e token SDK por requisição; detalhes de URL e
credenciais ficam em [@setup](SETUP.md) e [@auth](AUTH.md).
Hooks/Context guardam estado local. Formulários/componentes existentes também
declaram operações GraphQL; não presuma uma camada exclusiva de queries.

## Layout e tema

useResponsive usa useWindowDimensions: desktop em width >=1024.
ThemeProvider mantém dark/light no AsyncStorage, chave @moneyhub:theme_mode,
com padrão dark. A troca atualiza StatusBar e componentes consumidores.

O perfil backend aceita SYSTEM/LIGHT/DARK. ThemeProvider não resolve SYSTEM
pelo tema do dispositivo nem faz mutation automática ao alternar.
Ajustes persiste perfil explicitamente; carregar perfil não equivale a
sincronização universal da preferência visual.

ThemedModal usa Modal, backdrop, fechamento e rolagem. TransactionModal é
reutilizado para lançamentos. AccountsPayable/AccountsReceivable compartilham
AccountsManager. O comportamento acessível deve ser validado na plataforma.

Transactions pagina no cliente. Tamanho padrão: desktop com height >850 usa
6 itens; demais desktops, 5. Mobile com height <=850 usa 4; demais mobiles, 6.
customPageSize pode substituir o padrão. Isso não é paginação backend.

Metas usam FinancialGoals com operações reais; FinancialGoalsPreview existente
não representa a funcionalidade principal de metas.

## Analytics: contrato

O contrato AnalyticsAdapter expõe métodos assíncronos logEvent,
setCurrentScreen, setUserId e setUserProperties.
Eventos: login, signup, logout, screen_view, button_click, error_occurred,
feature_used.

Parâmetros e valores passam por allowlist:
- screen_name: login, register, dashboard.
- button_id: login_submit, registration_submit, assistant_open.
- error_code: auth_invalid_credentials, auth_email_in_use,
  auth_network_request_failed, unknown.
- method: email.
- feature_name: authentication, dashboard, financial_assistant.

Propriedades aceitas: account_type personal/business e onboarding_state
not_started/in_progress/completed. Não envie PII, valores financeiros,
senhas, perguntas IA ou error_message livre como parâmetro.

## Analytics: plataformas

Web usa firebase/analytics, isSupported e inicialização memoizada.
setCurrentScreen envia screen_view com firebase_screen/firebase_screen_class.

Nativo carrega @react-native-firebase/analytics e traduz telas para logScreenView.
Os plugins App/Analytics estão em app.json e exigem configuração Firebase
e build nativo. Auth continua usando firebase/auth também no nativo.

Falhas de inicialização/chamada são absorvidas; suporte ausente resulta em
comportamento sem operação. Adapter disponível não comprova recebimento
de eventos. Expo Go não substitui development build com módulos configurados.

## Fontes

[Rotas](../apps/frontend/app),
[layout](../apps/frontend/app/_layout.tsx),
[componentes](../apps/frontend/src/components),
[tema](../apps/frontend/src/theme/ThemeContext.tsx),
[responsividade](../apps/frontend/src/theme/useResponsive.ts),
[contrato Analytics](../apps/frontend/src/services/analytics.ts),
[runtime Web](../apps/frontend/src/services/analyticsRuntime.web.ts),
[runtime nativo](../apps/frontend/src/services/analyticsRuntime.native.ts),
[Expo](../apps/frontend/app.json).

Relacionados: [@project](PROJECT.md), [@tests](TESTING.md), [@limits](LIMITS.md).
