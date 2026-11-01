import { contactLinks, publicPlans } from '../src/components/public/content';

describe('public plan contact handoff', () => {
  test.each(['plus', 'ultra'])('prepares %s contact without subscribing or sending', (id) => {
    const plan = publicPlans.find((item) => item.id === id)!;
    const links = contactLinks(id);
    expect(links.plan).toBe(plan);
    expect(links.email).toMatch(/^mailto:igorcardosofrancolin@gmail.com\?/);
    expect(decodeURIComponent(links.email)).toContain(`plano ${plan.name}`);
    const whatsapp = new URL(links.whatsapp);
    expect(whatsapp.origin + whatsapp.pathname).toBe('https://wa.me/5516988015612');
    expect(whatsapp.searchParams.get('text')).toContain(
      `${plan.licenses} ${plan.licenses === 1 ? 'licença' : 'licenças'}`
    );
    expect(whatsapp.searchParams.get('text')).toContain('/mês');
  });

  test.each([
    undefined,
    '',
    'gratuito',
    'PLUS',
    'unknown',
    '<script>alert(1)</script>',
    ['plus', 'ultra']
  ])('ignores unrecognized or repeated plan parameter %j', (value) => {
    const links = contactLinks(value);
    expect(links.plan).toBeUndefined();
    expect(new URL(links.whatsapp).searchParams.get('text')).toBe(
      'Olá! Gostaria de saber mais sobre o MoneyHub.'
    );
  });
});
