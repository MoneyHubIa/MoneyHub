import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Flag, WalletCards } from 'lucide-react-native';
import { formatBRL } from './content';

type MapNode = 'receitas' | 'compromissos' | 'metas' | 'disponivel';
type Scenario = 'pessoal' | 'negocio';

const examples = {
  pessoal: {
    label: 'Minha vida',
    income: 6800,
    commitments: 4200,
    goals: 800,
    goal: 'Sua próxima viagem',
    goalProgress: 68,
    detail: {
      receitas: 'Salário e renda extra reunidos para entender o que entra no mês.',
      compromissos: 'Moradia, alimentação e contas do mês. Saiba o que já tem destino.',
      metas: 'Um valor separado para a viagem que você está planejando.',
      disponivel: 'O que resta depois dos compromissos e do valor destinado à meta.'
    }
  },
  negocio: {
    label: 'Meu negócio',
    income: 24000,
    commitments: 16500,
    goals: 3000,
    goal: 'Reserva do negócio',
    goalProgress: 45,
    detail: {
      receitas: 'Vendas e serviços reunidos para acompanhar as entradas do negócio.',
      compromissos: 'Fornecedores, aluguel e despesas operacionais no mesmo panorama.',
      metas: 'Uma reserva planejada para os próximos passos do negócio.',
      disponivel: 'O que resta depois das despesas e do valor destinado à reserva.'
    }
  }
} as const;

const nodeLabels: Record<MapNode, string> = {
  receitas: 'Receitas',
  compromissos: 'Compromissos',
  metas: 'Para sua meta',
  disponivel: 'Disponível'
};

export function MoneyMap() {
  const [scenario, setScenario] = useState<Scenario>('pessoal');
  const [selected, setSelected] = useState<MapNode>('disponivel');
  const data = examples[scenario];
  const available = data.income - data.commitments - data.goals;
  const values: Record<MapNode, number> = {
    receitas: data.income,
    compromissos: data.commitments,
    metas: data.goals,
    disponivel: available
  };

  return (
    <section className="mh-map" aria-label="Demonstração interativa do mapa financeiro">
      <div className="mh-map-toolbar">
        <span className="mh-map-live">
          <span aria-hidden={true} />
          Seu mês, conectado
        </span>
        <div className="mh-scenario" role="group" aria-label="Cenário da demonstração">
          <button aria-pressed={scenario === 'pessoal'} onClick={() => setScenario('pessoal')}>
            Pessoal
          </button>
          <button aria-pressed={scenario === 'negocio'} onClick={() => setScenario('negocio')}>
            Negócio
          </button>
        </div>
      </div>
      <div className="mh-map-canvas">
        <svg
          className="mh-map-lines"
          viewBox="0 0 600 410"
          fill="none"
          aria-hidden={true}
          preserveAspectRatio="none"
        >
          <path d="M140 100 C240 100 230 180 300 180" className="mh-path-income" />
          <path d="M300 180 C400 180 360 76 465 76" className="mh-path-commitment" />
          <path d="M300 180 C405 180 365 312 465 312" className="mh-path-goal" />
          <path d="M300 180 C300 260 150 260 150 335" className="mh-path-available" />
        </svg>
        <button
          className="mh-map-node mh-map-income"
          aria-pressed={selected === 'receitas'}
          onClick={() => setSelected('receitas')}
        >
          <span className="mh-node-label">
            <ArrowDownLeft size={16} aria-hidden={true} />
            Receitas
          </span>
          <strong>{formatBRL(data.income)}</strong>
          <span>O que entra</span>
        </button>
        <div className="mh-map-hub">
          <span className="mh-map-hub-icon" aria-hidden={true}>
            <WalletCards size={27} />
          </span>
          <strong>Seu dinheiro</strong>
          <span>Você escolhe a direção</span>
        </div>
        <button
          className="mh-map-node mh-map-commitments"
          aria-pressed={selected === 'compromissos'}
          onClick={() => setSelected('compromissos')}
        >
          <span className="mh-node-label">
            <ArrowUpRight size={16} aria-hidden={true} />
            Compromissos
          </span>
          <strong>{formatBRL(data.commitments)}</strong>
          <span>O que tem destino</span>
        </button>
        <button
          className="mh-map-node mh-map-goals"
          aria-pressed={selected === 'metas'}
          onClick={() => setSelected('metas')}
        >
          <span className="mh-node-label">
            <Flag size={15} aria-hidden={true} />
            Para sua meta
          </span>
          <strong>{formatBRL(data.goals)}</strong>
          <span>{data.goal}</span>
          <span className="mh-goal-track" aria-hidden={true}>
            <span style={{ width: `${data.goalProgress}%` }} />
          </span>
        </button>
        <button
          className="mh-map-node mh-map-available"
          aria-pressed={selected === 'disponivel'}
          onClick={() => setSelected('disponivel')}
        >
          <span className="mh-node-label">Disponível</span>
          <strong>{formatBRL(available)}</strong>
          <span>Espaço para o próximo passo</span>
        </button>
      </div>
      <div className="mh-map-detail" role="status" aria-live="polite" aria-atomic="true">
        <strong>{nodeLabels[selected]}</strong>
        <p>{data.detail[selected]}</p>
        <span className="mh-sr-only">
          {data.label}: {formatBRL(values[selected])}.
        </span>
      </div>
      <p className="mh-map-caption">
        Demonstração com valores fictícios. Toque nos caminhos para explorar.
      </p>
    </section>
  );
}
