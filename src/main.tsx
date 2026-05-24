import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { logger } from './utils/logger.ts'

// Inicializa o logger de diagnósticos ANTES de tudo
logger.init();

// ── React Error Boundary — captura crashes em componentes React ───────────────
interface EBState { hasError: boolean; error: Error | null }

class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    logger.addLog(
      'error',
      `[ReactCrash] ${error.message}`,
      `Stack: ${error.stack || ''}`,
      `Component: ${info.componentStack}`
    );
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', background: '#0a0a0f',
          color: '#fff', gap: '1rem', padding: '2rem', textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <h2 style={{ margin: 0, color: '#f87171' }}>A app encontrou um erro</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', maxWidth: '400px' }}>
            {this.state.error?.message || 'Erro desconhecido'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '0.75rem 2rem', background: '#7c3aed', color: '#fff',
              border: 'none', borderRadius: '0.75rem', fontSize: '1rem',
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            Tentar Novamente
          </button>
          <p style={{ color: '#4b5563', fontSize: '0.75rem' }}>
            Logs disponíveis em ⚙️ → Ver Logs de Diagnóstico
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
