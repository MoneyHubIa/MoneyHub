# Firebase Analytics Adapter Specification

## Status

Approved

## Objective

Planejar e especificar os detalhes do adapter de Firebase Analytics para a aplicação cliente Expo (suportando iOS, Android e Web), definindo o contrato comum de eventos, a estratégia de implementação específica de cada plataforma, as garantias de resiliência e desacoplamento dos fluxos financeiros e o padrão de mock para testes unitários.

---

## 1. Interface Comum do Adapter (Common Contract)

A aplicação cliente deve interagir com o serviço de analytics exclusivamente através de um contrato comum unificado. Isso impede o acoplamento direto com as APIs específicas do Firebase Web ou Firebase Nativo nos componentes de interface de usuário.

O contrato do adapter é definido da seguinte forma:

```typescript
/**
 * Nomes de eventos permitidos para evitar poluição e inconsistência.
 */
export type AppEventName = 
  | 'login'
  | 'signup'
  | 'logout'
  | 'screen_view'
  | 'button_click'
  | 'error_occurred'
  | 'feature_used';

/**
 * Parâmetros permitidos nos eventos.
 * REGRA CRÍTICA: É estritamente proibido enviar dados financeiros (valores, saldos), 
 * senhas, ou PII (dados sensíveis/pessoais como nome, email, CPF).
 */
export type AppEventParams = {
  screen_name?: string;
  button_id?: string;
  error_code?: string;
  error_message?: string;
  method?: string; // ex: 'email', 'google'
  feature_name?: string;
};

export interface AnalyticsAdapter {
  /**
   * Envia um evento de analytics, restrito ao dicionário de eventos e parâmetros permitidos,
   * garantindo que nenhum dado sensível ou financeiro seja trafegado.
   */
  logEvent(name: AppEventName, params?: AppEventParams): Promise<void> | void;

  /**
   * Define a tela atual que o usuário está visualizando.
   */
  setCurrentScreen(screenName: string, screenClass?: string): Promise<void> | void;

  /**
   * Associa um identificador de usuário único (UID) aos eventos futuros.
   * Deve ser definido como null ao deslogar.
   */
  setUserId(userId: string | null): Promise<void> | void;

  /**
   * Define propriedades personalizadas do usuário.
   */
  setUserProperties(properties: Record<string, any>): Promise<void> | void;
}
```

---

## 2. Estratégia e Implementação Web (`analytics.web.ts`)

A implementação Web será executada no navegador do usuário e utilizará o SDK JS do Firebase (`firebase/analytics`).

### Fluxo de Inicialização Web
Nem todos os ambientes Web suportam o Firebase Analytics (por exemplo, navegação anônima estrita, bloqueadores de anúncios ou SSR). Portanto, a inicialização do SDK Web deve obrigatoriamente validar o suporte antes de invocar a API.

```typescript
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported, logEvent as fbLogEvent } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let webAnalyticsInstance: any = null;

// Inicializa de forma assíncrona para não bloquear a thread principal
isSupported().then((supported) => {
  if (supported) {
    // Reutiliza o Firebase App existente (ex: inicializado pelo Auth) ou cria um novo
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    webAnalyticsInstance = getAnalytics(app);
  } else {
    console.warn('Firebase Analytics não é suportado no ambiente web atual.');
  }
}).catch((err) => {
  console.error('Falha ao verificar suporte do Firebase Analytics:', err);
});
```

### Regras de Chamada:
- Cada método do adapter Web deve validar se `webAnalyticsInstance` foi inicializado antes de fazer qualquer chamada.
- Se `webAnalyticsInstance` for nulo, a chamada é descartada silenciosamente (ou registrada em log de debug), garantindo que o app nunca quebre.

---

## 3. Estratégia e Implementação Nativa (`analytics.native.ts`)

A implementação nativa será executada em dispositivos iOS e Android utilizando a biblioteca `@react-native-firebase/analytics`.

### Inicialização e Configuração:
- Os SDKs nativos do Firebase dependem dos arquivos de configuração adicionados no build nativo (`GoogleService-Info.plist` para iOS e `google-services.json` para Android).
- A biblioteca nativa gerencia sua própria inicialização em segundo plano no carregamento do aplicativo.

### Exemplo de Implementação:
```typescript
import analytics from '@react-native-firebase/analytics';
import { AnalyticsAdapter, AppEventName, AppEventParams } from './analytics';

export class NativeAnalyticsAdapter implements AnalyticsAdapter {
  async logEvent(name: AppEventName, params?: AppEventParams): Promise<void> {
    try {
      await analytics().logEvent(name, params);
    } catch (error) {
      console.error(`Erro ao registrar evento nativo [${name}]:`, error);
    }
  }

  async setCurrentScreen(screenName: string, screenClass?: string): Promise<void> {
    try {
      await analytics().logScreenView({
        screen_name: screenName,
        screen_class: screenClass || screenName,
      });
    } catch (error) {
      console.error('Erro ao definir tela ativa nativa:', error);
    }
  }

  async setUserId(userId: string | null): Promise<void> {
    try {
      await analytics().setUserId(userId);
    } catch (error) {
      console.error('Erro ao definir userId nativo:', error);
    }
  }

  async setUserProperties(properties: Record<string, any>): Promise<void> {
    try {
      await analytics().setUserProperties(properties);
    } catch (error) {
      console.error('Erro ao definir propriedades de usuário nativas:', error);
    }
  }
}
```

---

## 4. Resiliência e Desacoplamento Financeiro (`analytics.noop.ts`)

Conforme as diretrizes de arquitetura, falhas no rastreamento de analytics **nunca devem bloquear ou impactar os fluxos financeiros do usuário** (criação de receitas/despesas, visualização de saldos, etc.).

Para garantir esse isolamento:
1. **Fallback Silencioso:** Qualquer exceção lançada pelas chamadas do SDK do Firebase deve ser capturada dentro do adapter e nunca propagada para o componente chamador.
2. **Implementação No-Op (Sem Operação):** Uma classe `NoOpAnalyticsAdapter` que implementa `AnalyticsAdapter` com métodos vazios será utilizada caso ocorram erros graves de inicialização ou caso o suporte a analytics seja ausente.

```typescript
import { AnalyticsAdapter, AppEventName, AppEventParams } from './analytics';

export class NoOpAnalyticsAdapter implements AnalyticsAdapter {
  logEvent(name: AppEventName, params?: AppEventParams): void {}
  setCurrentScreen(screenName: string, screenClass?: string): void {}
  setUserId(userId: string | null): void {}
  setUserProperties(properties: Record<string, any>): void {}
}
```

---

## 5. Estratégia de Testes Unitários

Para garantir que os testes unitários da aplicação cliente rodem de forma rápida, isolada e sem conexões de rede ativas:
- O adapter de Firebase Analytics real **deve** ser mockado em todos os testes unitários.
- A suite de testes pode utilizar o `NoOpAnalyticsAdapter` ou um mock espião do Jest (`jest.fn()`) para verificar se os eventos corretos estão sendo disparados pelo fluxo sob teste.

*Exemplo de Mock em Testes:*
```typescript
jest.mock('./services/analytics', () => {
  return {
    analytics: {
      logEvent: jest.fn(),
      setCurrentScreen: jest.fn(),
      setUserId: jest.fn(),
      setUserProperties: jest.fn(),
    }
  };
});
```

---

## Requisitos para Futura Implementação

* Definição do contrato comum de `AnalyticsAdapter` e restrições de eventos em TypeScript.
* Criação do adapter Web utilizando o Firebase JS SDK com verificação via `isSupported()` e compartilhamento do app inicializado (`getApps()`).
* Criação do adapter Nativo utilizando `@react-native-firebase/analytics`.
* Uso automático do arquivo correto por plataforma (`analytics.web.ts` e `analytics.native.ts` exportando a instância unificada).
* Fallback silencioso (sem lançar erros fatais) para um comportamento No-Op em caso de falha.
* Garantia de 100% de cobertura nos testes unitários mockando o comportamento do Analytics.
