import {
  useEffect, useRef, useState, forwardRef, useImperativeHandle,
} from 'react';
import Hls from 'hls.js';
import { WifiOff, RefreshCw, Loader2, Play, Maximize2 } from 'lucide-react';
import type { PlayerStatus } from '../types/index.ts';
import { proxyUrl } from '../utils/proxy.ts';

interface VideoPlayerProps {
  url: string | null;
}

export interface VideoPlayerHandle {
  /** Call synchronously inside a user-gesture handler to go fullscreen */
  requestFullscreen: () => void;
}

function detectStreamType(url: string): 'hls' | 'direct' {
  const lower = url.toLowerCase().split('?')[0];
  if (lower.endsWith('.ts')) return 'direct';
  return 'hls';
}

const LOAD_TIMEOUT_MS = 20000;

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(({ url }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const retryCountRef = useRef(0);
  const currentUrlRef = useRef<string | null>(null);

  // Expose requestFullscreen to parent so it can be called on user click
  useImperativeHandle(ref, () => ({
    requestFullscreen: () => {
      containerRef.current?.requestFullscreen().catch(() => {});
    },
  }));

  const destroyHls = () => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
  };

  const clearLoadTimeout = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  const startLoadTimeout = () => {
    clearLoadTimeout();
    timeoutRef.current = setTimeout(() => {
      if (currentUrlRef.current) {
        const video = videoRef.current;
        if (video) {
          destroyHls();
          setStatus('loading');
          video.src = proxyUrl(currentUrlRef.current);
          video.load();
          video.play()
            .then(() => setStatus('playing'))
            .catch(() => {
              setStatus('error');
              setErrorMsg('Stream unavailable. This channel may require a native player like VLC.');
            });
        }
      }
    }, LOAD_TIMEOUT_MS);
  };

  const showError = (msg: string) => {
    clearLoadTimeout();
    destroyHls();
    setStatus('error');
    setErrorMsg(msg);
  };

  const goFullscreen = () => {
    containerRef.current?.requestFullscreen().catch(() => {});
  };

  const initPlayer = (streamUrl: string) => {
    const video = videoRef.current;
    if (!video) return;

    destroyHls();
    clearLoadTimeout();
    currentUrlRef.current = streamUrl;
    setStatus('loading');
    setErrorMsg('');
    retryCountRef.current = 0;

    const proxied = proxyUrl(streamUrl);
    const streamType = detectStreamType(streamUrl);

    // ── HLS.js strategy ──────────────────────────────────────────────────────
    if (streamType === 'hls' && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 4,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        // Force a high bandwidth estimate so it starts at a higher quality
        abrEwmaDefaultEstimate: 5000000,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
          xhr.setRequestHeader('Accept', '*/*');
        },
      });

      hlsRef.current = hls;
      hls.loadSource(proxied);
      hls.attachMedia(video);
      startLoadTimeout();

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        clearLoadTimeout();
        // Force the highest available quality level immediately
        if (hls.levels && hls.levels.length > 0) {
          hls.currentLevel = hls.levels.length - 1;
        }
        video.play().catch(console.warn);
        setStatus('playing');
        // Auto fullscreen when stream starts playing
        goFullscreen();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        const httpStatus = data.response?.code;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retryCountRef.current < 2) {
          retryCountRef.current++;
          setStatus('recovering');
          setTimeout(() => { if (hlsRef.current) hlsRef.current.startLoad(); }, 2000);
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retryCountRef.current < 1) {
          retryCountRef.current++;
          setStatus('recovering');
          hls.recoverMediaError();
          return;
        }

        // Fatal — try direct video fallback
        destroyHls();
        clearLoadTimeout();
        video.src = proxied;
        video.load();
        video.play()
          .then(() => { setStatus('playing'); goFullscreen(); })
          .catch(() =>
            showError(
              httpStatus === 403
                ? 'Access denied (403). The stream may be geo-blocked.'
                : httpStatus === 404
                ? 'Stream not found (404). This channel may be offline.'
                : 'Signal unavailable. The stream could not be loaded.'
            )
          );
      });

    // ── Native HLS (Safari / iOS) ─────────────────────────────────────────────
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = proxied;
      startLoadTimeout();
      video.addEventListener('loadedmetadata', () => {
        clearLoadTimeout();
        video.play().catch(console.warn);
        setStatus('playing');
        goFullscreen();
      }, { once: true });
      video.addEventListener('error', () =>
        showError('Stream unavailable. The source may be offline or geo-blocked.')
      , { once: true });

    // ── Direct <video> (raw MPEG-TS / MP4 / etc.) ─────────────────────────────
    } else {
      video.src = proxied;
      video.load();
      startLoadTimeout();
      video.addEventListener('canplay', () => {
        clearLoadTimeout();
        video.play().catch(console.warn);
        setStatus('playing');
        goFullscreen();
      }, { once: true });
      video.addEventListener('error', () =>
        showError('Stream unavailable. This format may not be supported or the stream is offline.')
      , { once: true });
    }
  };

  useEffect(() => {
    if (!url) { destroyHls(); clearLoadTimeout(); setStatus('idle'); return; }
    initPlayer(url);
    return () => { destroyHls(); clearLoadTimeout(); };
  }, [url]);

  const handleRetry = () => { if (url) initPlayer(url); };

  return (
    <div ref={containerRef} className="relative w-full bg-black rounded-xl overflow-hidden aspect-video shadow-2xl group">
      <video
        ref={videoRef}
        className="w-full h-full object-contain brightness-105 contrast-105 saturate-110"
        controls
        playsInline
        autoPlay
      />

      {/* Loading / Recovering */}
      {(status === 'loading' || status === 'recovering') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 pointer-events-none">
          <Loader2 className="w-12 h-12 text-violet-400 animate-spin" />
          <p className="text-gray-300 text-sm font-medium">
            {status === 'recovering' ? 'Recovering stream…' : 'Loading stream…'}
          </p>
        </div>
      )}

      {/* Idle */}
      {status === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-violet-950/30">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto">
              <Play className="w-9 h-9 text-violet-400 ml-1" />
            </div>
            <p className="text-gray-400 text-sm">Select a channel to start watching</p>
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 gap-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-red-400" />
          </div>
          <div className="text-center space-y-1 px-6 max-w-sm">
            <p className="text-white font-semibold">Signal Unavailable</p>
            <p className="text-gray-400 text-xs leading-relaxed">{errorMsg}</p>
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
          <p className="text-gray-700 text-xs px-6 text-center max-w-xs">
            Tip: If this keeps failing, try a native player like VLC.
          </p>
        </div>
      )}

      {/* Fullscreen hint button (visible on hover when playing) */}
      {status === 'playing' && (
        <button
          onClick={goFullscreen}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-black/50 rounded-lg text-white hover:bg-black/70"
          title="Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
