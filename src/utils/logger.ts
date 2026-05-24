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

// ── File-save state ───────────────────────────────────────────────────────────
let fileSaveEnabled = false;   // only enabled after permission is granted
let fileSavePending = false;   // debounce: avoid writing while a write is in progress
let fileSaveTimer: ReturnType<typeof setTimeout> | null = null;

/** Request storage permission once, then enable file saving */
async function requestAndEnableFileSave() {
  try {
    const result = await Filesystem.requestPermissions();
    if (result.publicStorage === 'granted') {
      fileSaveEnabled = true;
      // Write accumulated logs now that we have permission
      scheduleSaveToFile();
    }
    // If denied, we silently keep only localStorage logging
  } catch {
    // Permission API not available (web / older Android) — no-op
  }
}

/** Debounced write: waits 3s of inactivity to batch writes together */
function scheduleSaveToFile() {
  if (!fileSaveEnabled) return;
  if (fileSaveTimer) clearTimeout(fileSaveTimer);
  fileSaveTimer = setTimeout(() => {
    fileSaveTimer = null;
    performSaveToFile();
  }, 3000); // 3-second debounce — prevents thrashing on rapid log bursts
}

async function performSaveToFile() {
  if (fileSavePending) return; // already writing
  fileSavePending = true;
  try {
    const text = logs
      .map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`)
      .join('\n');

    // Try public Downloads folder
    await Filesystem.writeFile({
      path: 'Download/iptv-diagnostics.txt',
      data: text,
      directory: Directory.ExternalStorage,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  } catch {
    // Fallback to app-private Documents (no permission needed)
    try {
      const text = logs
        .map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`)
        .join('\n');
      await Filesystem.writeFile({
        path: 'iptv-diagnostics.txt',
        data: text,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    } catch {
      // Both failed — logging continues in localStorage only
    }
  } finally {
    fileSavePending = false;
  }
}

// ── Console interception ──────────────────────────────────────────────────────
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

function formatMessage(args: any[]): string {
  return args
    .map(arg => {
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack || ''}`;
      }
      if (typeof arg === 'object' && arg !== null) {
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

// ── Guard: prevent recursive logging when the error handler itself errors ──────
let isLogging = false;

export const logger = {
  addLog(type: LogEntry['type'], ...args: any[]) {
    if (isLogging) return; // prevent recursive calls
    isLogging = true;

    try {
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

      // Save to localStorage (fast, synchronous, no permissions needed)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
      } catch {
        // localStorage full — remove old logs and retry once
        try {
          logs = logs.slice(0, 50);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
        } catch {}
      }

      // Schedule file save (debounced, only if permitted)
      scheduleSaveToFile();

      listeners.forEach(fn => fn());
    } finally {
      isLogging = false;
    }
  },

  getLogs(): LogEntry[] {
    return logs;
  },

  clear() {
    logs = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    scheduleSaveToFile();
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

    // Intercept console.log (only IPTV/Player markers to avoid noise)
    console.log = (...args: any[]) => {
      originalConsoleLog.apply(console, args);
      const msg = formatMessage(args);
      if (msg.includes('[IPTV]') || msg.includes('[Player]')) {
        logger.addLog('info', msg);
      }
    };

    // Global JS errors — log the full stack
    window.onerror = (message, source, lineno, colno, error) => {
      const src = source ? source.split('/').pop() : 'unknown'; // short filename
      logger.addLog(
        'error',
        `[GlobalError] ${message} @ ${src}:${lineno}:${colno}`,
        error?.stack ? `\nStack: ${error.stack}` : ''
      );
      return false;
    };

    // Unhandled promise rejections — log reason + stack
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      // Suppress noisy "user denied permissions" / fullscreen rejection noise
      const msg = reason?.message || String(reason) || 'Erro desconhecido';

      // Skip logging permission denials as errors (they are expected)
      if (msg.toLowerCase().includes('permissions check failed') ||
          msg.toLowerCase().includes('permission denied') ||
          msg.toLowerCase().includes('notallowederror')) {
        logger.addLog('warn', `[Permission] ${msg} — verifique as permissões da app`);
        return;
      }

      logger.addLog(
        'error',
        `[UnhandledRejection] ${msg}`,
        reason?.stack ? `\nStack: ${reason.stack}` : ''
      );
    });

    logger.addLog('info', 'Logger de diagnóstico inicializado com sucesso.');

    // Request storage permission AFTER a short delay (non-blocking)
    // This prevents blocking app startup and avoids the crash loop
    setTimeout(() => requestAndEnableFileSave(), 2000);
  },
};
