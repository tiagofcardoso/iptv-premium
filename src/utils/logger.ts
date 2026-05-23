export interface LogEntry {
  timestamp: string;
  type: 'info' | 'warn' | 'error';
  message: string;
}

const MAX_LOGS = 150;
let logs: LogEntry[] = [];
const listeners = new Set<() => void>();

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

function formatMessage(args: any[]): string {
  return args
    .map(arg => {
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack || ''}`;
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
}

export const logger = {
  addLog(type: LogEntry['type'], ...args: any[]) {
    const message = formatMessage(args);
    const timestamp = new Date().toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    logs.unshift({ timestamp, type, message });

    if (logs.length > MAX_LOGS) {
      logs = logs.slice(0, MAX_LOGS);
    }

    listeners.forEach(fn => fn());
  },

  getLogs(): LogEntry[] {
    return logs;
  },

  clear() {
    logs = [];
    listeners.forEach(fn => fn());
  },

  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  init() {
    // Intercept console.error
    console.error = (...args: any[]) => {
      originalConsoleError.apply(console, args);
      logger.addLog('error', ...args);
    };

    // Intercept console.warn
    console.warn = (...args: any[]) => {
      originalConsoleWarn.apply(console, args);
      logger.addLog('warn', ...args);
    };

    // Intercept console.log (only for specific IPTV-related markers to avoid bloating)
    console.log = (...args: any[]) => {
      originalConsoleLog.apply(console, args);
      const msg = formatMessage(args);
      if (msg.includes('[IPTV]') || msg.includes('[Player]')) {
        logger.addLog('info', msg);
      }
    };

    // Global Javascript errors
    window.onerror = (message, source, lineno, colno, error) => {
      logger.addLog(
        'error',
        `Erro global: ${message} em ${source}:${lineno}:${colno}`,
        error || ''
      );
      return false; // let it propagate to browser console
    };

    // Unhandled promise rejections (very common in network fetches/video loads)
    window.onunhandledrejection = (event) => {
      logger.addLog(
        'error',
        `Rejeição não tratada: ${event.reason?.message || event.reason || 'Erro desconhecido'}`
      );
    };

    logger.addLog('info', 'Logger de diagnóstico inicializado com sucesso.');
  },
};
