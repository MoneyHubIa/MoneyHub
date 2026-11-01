import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  ['/apresentacao', 'Seu dinheiro tem um caminho. Dê a direção.', 'MoneyHub |'],
  ['/informacoes', 'Organizar o dinheiro é abrir possibilidades.', 'Como funciona'],
  ['/planos', 'Uma direção para cada fase.', 'Planos Gratuito'],
  ['/contato', 'Vamos encontrar o próximo passo?', 'Fale com a gente'],
  ['/privacidade', 'Seus dados merecem clareza.', 'Privacidade e dados'],
  ['/termos', 'Uma relação começa com clareza.', 'Termos de uso']
] as const;

test('visitor enters through presentation and can explore both financial examples', async ({
  page
}) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Seu dinheiro');
  await expect(page).toHaveURL('/');
  const map = page.getByRole('region', { name: 'Demonstração interativa do mapa financeiro' });
  await expect(map.getByRole('button', { name: /Disponível/ })).toContainText('1.800,00');
  await map.getByRole('button', { name: /Receitas/ }).click();
  await expect(map.getByRole('status')).toContainText('Salário e renda extra');
  await map.getByRole('button', { name: 'Negócio', exact: true }).click();
  await expect(map.getByRole('button', { name: /Disponível/ })).toContainText('4.500,00');
  await expect(map.getByRole('status')).toContainText('Vendas e serviços');
  await map.getByRole('button', { name: /Para sua meta/ }).click();
  await expect(map.getByRole('status')).toContainText('Uma reserva planejada');
  await page.getByRole('link', { name: 'Começar gratuitamente', exact: true }).first().click();
  await expect(page).toHaveURL('/register');
  await page.getByRole('link', { name: 'Voltar à apresentação' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Seu dinheiro');
  expect(errors).toEqual([]);
});

for (const [route, heading, title] of pages) {
  test(`public page ${route} survives refresh with metadata and accessible content`, async ({
    page
  }) => {
    const errors: Error[] = [];
    page.on('pageerror', (error) => errors.push(error));
    await page.goto(route);
    await page.reload();
    // Inner text removes the visual line breaks while preserving accessible words.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading, {
      useInnerText: true
    });
    await expect(page).toHaveTitle(new RegExp(title.replace('|', '\\|')));
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /MoneyHub/);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('plans show monthly prices and hand off a recognized plan to real contact channels', async ({
  page
}) => {
  await page.goto('/planos');
  const plans = page.getByRole('region', { name: 'Planos mensais' });
  await expect(plans).toContainText('R$ 0,00');
  await expect(plans).toContainText('R$ 14,99');
  await expect(plans).toContainText('R$ 99,99');
  await expect(plans).toContainText('10 licenças incluídas');
  for (const [id, name] of [
    ['plus', 'Plus'],
    ['ultra', 'Ultra']
  ]) {
    await page.goto('/planos');
    await page.getByRole('link', { name: `Consultar ${name}` }).click();
    await expect(page).toHaveURL(`/contato?plano=${id}`);
    await expect(page.getByRole('heading', { name: `Plano ${name}` })).toBeVisible();
    const whatsapp = new URL(
      (await page.getByRole('link', { name: /Converse pelo WhatsApp/ }).getAttribute('href'))!
    );
    expect(whatsapp.origin + whatsapp.pathname).toBe('https://wa.me/5516988015612');
    expect(whatsapp.searchParams.get('text')).toContain(`plano ${name}`);
    expect(
      await page.getByRole('link', { name: /Escreva para a gente/ }).getAttribute('href')
    ).toContain('mailto:igorcardosofrancolin@gmail.com');
  }
  await page.goto('/contato?plano=unknown');
  await expect(page.getByRole('heading', { name: /^Plano / })).toHaveCount(0);
  await page.goto('/contato?plano=plus&plano=ultra');
  await expect(page.getByRole('heading', { name: /^Plano / })).toHaveCount(0);
});

test('mobile navigation and FAQ work with keyboard and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Abrir menu' });
  await menu.click();
  await expect(page.getByRole('navigation', { name: 'Navegação móvel' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Navegação móvel' })
    .getByRole('link', { name: 'Como funciona' })
    .focus();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await page
    .getByRole('navigation', { name: 'Navegação móvel' })
    .getByRole('link', { name: 'Como funciona' })
    .click();
  await expect(page).toHaveURL('/informacoes');
  const question = page
    .locator('summary')
    .filter({ hasText: 'Os planos pagos já podem ser contratados?' });
  await question.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('Os planos Plus e Ultra são propostas iniciais.', { exact: false })
  ).toBeVisible();
});

test('public layouts fit mobile, tablet and desktop without horizontal overflow', async ({
  page
}) => {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [route] of pages) {
      await page.goto(route);
      await expect(page.locator('main h1')).toBeVisible();
      const overflow = await page
        .locator('.mh-public')
        .evaluate((element) => element.scrollWidth > element.clientWidth);
      expect(overflow, `${route} at ${width}px`).toBe(false);
    }
  }
  const font = await page.request.get('/fonts/Manrope.ttf');
  expect(font.ok()).toBe(true);
  expect((await font.body()).byteLength).toBeGreaterThan(10000);
});

test('privacy fragment links scroll to the technology notice after routing and refresh', async ({
  page
}) => {
  await page.goto('/apresentacao');
  await page.getByRole('link', { name: 'Cookies e tecnologias' }).click();
  await expect(page).toHaveURL('/privacidade#tecnologias');
  await expect(
    page.getByRole('heading', { name: 'Cookies e tecnologias de armazenamento' })
  ).toBeInViewport();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Cookies e tecnologias de armazenamento' })
  ).toBeInViewport();
});
