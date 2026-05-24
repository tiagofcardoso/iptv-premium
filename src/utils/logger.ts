import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export interface LogEntry {
  timestamp: string;
  type: 'info' | 'warn' | 'error';
  message: string;
}

const MAX_LOGS = 150;
const STORAGE_KEY = 'iptv-diagnostics-logs';
let logs: LogEntry[] = [];

// Try to load logs from localStorage initially
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    logs = JSON.parse(raw);
  }
} catch {}

const listeners = new Set<() => void>();

async function saveLogsToFile() {
  try {
    const text = logs
      .map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`)
      .join('\n');

    // 1. Try public Download folder on ExternalStorage
    await Filesystem.writeFile({
      path: 'Download/iptv-diagnostics.txt',
      data: text,
      directory: Directory.ExternalStorage,
      encoding: Encoding.UTF8,
      recursive: true
    });
  } catch (err) {
    try {
      const text = logs
        .map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`)
        .join('\n');

      // 2. Fallback to App Documents folder
      await Filesystem.writeFile({
        path: 'iptv-diagnostics.txt',
        data: text,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true
      });
    } catch {}
  }
}

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

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch {}

    // Save to file
    saveLogsToFile();

    listeners.forEach(fn => fn());
  },

  getLogs(): LogEntry[] {
    return logs;
  },

  clear() {
    logs = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    saveLogsToFile();
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
