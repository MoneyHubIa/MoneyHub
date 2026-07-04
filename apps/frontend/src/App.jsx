import {
  BarChart3,
  Bot,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Settings,
  Target,
  WalletCards
} from 'lucide-react';
import { useState } from 'react';

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'financeiro', label: 'Financeiro', icon: WalletCards },
  { id: 'contas', label: 'Contas', icon: CreditCard },
  { id: 'metas', label: 'Metas', icon: Target },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'ia', label: 'IA', icon: Bot },
  { id: 'ajustes', label: 'Ajustes', icon: Settings }
];

export function App() {
  const [activeSectionId, setActiveSectionId] = useState('dashboard');
  const activeSection = navigationItems.find(
    (item) => item.id === activeSectionId
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <WalletCards aria-hidden="true" size={28} />
          <h1>MoneyHub</h1>
        </div>

        <nav aria-label="Primary" className="primary-nav">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSectionId === item.id;

            return (
              <button
                aria-current={isActive ? 'page' : undefined}
                className={`nav-button${isActive ? ' is-active' : ''}`}
                key={item.id}
                onClick={() => setActiveSectionId(item.id)}
                type="button"
              >
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="dashboard">
        {activeSectionId === 'dashboard' ? (
          <>
            <section className="dashboard-header">
              <p className="eyebrow">Controle financeiro inteligente</p>
              <h2>Dashboard financeiro</h2>
              <p>
                Acompanhe saldo, receitas, despesas, metas e próximos compromissos
                em uma experiência mobile first.
              </p>
            </section>

            <section className="kpi-grid" aria-label="Resumo financeiro">
              <article className="kpi-card">
                <span>Saldo previsto</span>
                <strong>R$ 0,00</strong>
              </article>
              <article className="kpi-card">
                <span>Receitas do mês</span>
                <strong>R$ 0,00</strong>
              </article>
              <article className="kpi-card">
                <span>Despesas do mês</span>
                <strong>R$ 0,00</strong>
              </article>
            </section>

            <section className="assistant-panel">
              <div>
                <p className="eyebrow">IA Financeira</p>
                <h3>Insights contextualizados</h3>
              </div>
              <button className="primary-action" type="button">
                <Bot aria-hidden="true" size={18} />
                <span>Consultar IA</span>
              </button>
            </section>

            <section className="chart-placeholder" aria-label="Indicadores">
              <BarChart3 aria-hidden="true" size={40} />
              <p>Os gráficos serão conectados aos dados financeiros nas próximas tasks.</p>
            </section>
          </>
        ) : (
          <section className="dashboard-header">
            <p className="eyebrow">MoneyHub</p>
            <h2>{activeSection.label}</h2>
            <p>
              O conteúdo de {activeSection.label} estará disponível em breve.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
