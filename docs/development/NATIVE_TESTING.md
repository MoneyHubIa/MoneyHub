# Testes nativos Android e iOS

Os fluxos Maestro ficam em `.maestro/` e usam somente contas sintéticas do projeto Firebase `demo-moneyhub`.

## Requisitos

- Node.js 22.13 ou superior dentro da faixa 22.x;
- Java 21 e Android SDK para Android;
- macOS e Xcode atual para iOS;
- Maestro instalado;
- PostgreSQL E2E, backend e Firebase Auth Emulator executando no mesmo host;
- arquivos Firebase nativos exclusivos de teste, nunca os arquivos de produção.

O perfil deve definir `E2E_NATIVE=1`. Isso seleciona o identificador `com.moneyhub.e2e`. Android Emulator acessa backend e Auth Emulator pelo host `10.0.2.2`; iOS Simulator usa `127.0.0.1`. Configure `APP_URL` e `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` de acordo com a plataforma antes do build.

## Execução

Crie usuário verificado e perfil exclusivos no emulador. Depois gere e instale um development build:

```sh
E2E_NATIVE=1 npx expo run:android
E2E_NATIVE=1 npx expo run:ios
```

Execute os fluxos:

```sh
maestro test \
  --no-reinstall-driver \
  --udid emulator-5554 \
  -e APP_ID=com.moneyhub.e2e \
  -e E2E_DEV_SERVER_URL="http://172.30.160.1:8081" \
  -e E2E_EMAIL=usuario@example.test \
  -e E2E_PASSWORD=Senha-E2E-123! \
  -e E2E_CATEGORY="Geral E2E" \
  .maestro/
```

Os fluxos limpam o estado local antes de cada teste. No Android development build,
`E2E_DEV_SERVER_URL` identifica o cartão do Metro que deve ser selecionado novamente
depois dessa limpeza. Use o URL exibido no launcher do development build. No Windows,
`--no-reinstall-driver` evita reinstalar a instrumentação Maestro entre execuções.

TalkBack e VoiceOver ainda exigem inspeção manual: ordem de foco, descrição dos controles, estado disabled/loading e anúncio de erros. Expo export ou viewport móvel Web não contam como evidência nativa. A conclusão da TASK-015 exige registro de execução real nos dois sistemas.
