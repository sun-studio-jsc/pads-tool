import { ComponentBase, customElement, html, inject, state, property } from "fw";
import type { PropertyValues } from 'lit';
import { PreviewService } from "../../services/PreviewService";
import { VideoStorageService } from "../../services/VideoStorageService";
import type { PreviewLanguageOption, PreviewPreset, PreviewRecordingResult } from "../../services/types";
import type { ValidationResult } from "../../services/PreviewServiceValidators";
import "../../assets/pako_inflate.min.js";
import { installIframeScreenshotCapture } from "./iframe-screenshot-capture";
import { PREVIEW_LOCALES, localeLabel } from "../../services/preview-locales";
import "./save-creative-modal";
import { BACKEND_FEATURES_ENABLED, SDK_EVENT_LOG_ENABLED, VALIDATOR_ENABLED } from "../../features";
import "./preview-video-modal";
import "./recordings-list-modal";
import { ANDROID_DEVICES, type DeviceMockup } from "./android-devices";

type PreviewDeviceOption = {
  name: string;
  width?: number;
  height?: number;
  type?: 'phone' | 'tablet';
  disabled?: boolean;
  mockup?: DeviceMockup;
  // Library section heading. Fixed-orientation entries store their portrait size in width/height.
  group?: string;
  orientation?: 'portrait' | 'landscape';
};

type PreviewVideoModalElement = HTMLElement & {
  show: (clip: PreviewRecordingResult, fileBaseName: string) => Promise<void> | void;
};

type PreviewIframeWindow = Window & {
  __ptGuardInstalled?: boolean;
  __ptGuard?: { setLocked: (locked: boolean) => void };
  __ptScreenshotInstalled?: boolean;
};

@customElement("playable-previewer")
export class PlayablePreviewer extends ComponentBase {
  @inject(PreviewService) previewService!: PreviewService;
  @inject(VideoStorageService) videoStorageService!: VideoStorageService;

  private static readonly sdkEventPresetIds = new Set(['preview-cta', 'yandex-games', 'ads-manager', 'applovin']);

  @property() fileName: string = "";

  pageContent: string = "";
  loading: boolean = true;
  error: string = "";
  private uploadedContentUnsubscribe?: () => void;
  private presetUnsubscribe?: () => void;
  private previewLanguageUnsubscribe?: () => void;
  private validationUnsubscribe?: () => void;
  private zipPreviewUnsubscribe?: () => void;
  @state() private currentPreset: PreviewPreset | null = null;
  @state() private currentLanguage: string | null = null;
  @state() private availablePresets: PreviewPreset[] = [];
  @state() private isPresetSwitching: boolean = false;
  @state() private isLanguageMenuOpen: boolean = false;
  @state() private isLocaleMenuOpen: boolean = false;
  @state() private presetSuccessMessage: string = "";
  @state() private validationResults: ValidationResult | null = null;
  @state() private zipPreviewUrl: string | null = null;
  @state() private _sdkEvents: Array<{ event: string; args: any[]; elapsedMs: number }> = [];
  @state() private _iframeLoadMs: number | null = null;
  @state() private _reloadKey: number = 0;
  @state() private _adOverlay: { id: string; kind: 'rewarded' | 'interstitial'; remaining: number; canClose: boolean } | null = null;
  @state() private _adBannerVisible: boolean = false;
  @state() private _stageScale: number = 1;
  @state() private _deviceQuery: string = "";
  @state() private _deviceFilter: 'all' | 'phone' | 'tablet' | 'favorites' = 'all';
  @state() private _favoriteDevices: Set<string> = this._loadFavoriteDevices();
  @state() private _customW: number = 390;
  @state() private _customH: number = 844;
  private _customDeviceIdx: number | null = null;
  @state() private _handMode: boolean = false;
  private _panStart: { x: number; y: number; left: number; top: number } | null = null;

  private _adOverlayTimer?: ReturnType<typeof setInterval>;
  private _sdkEventStart: number | null = null;
  private _iframeLoadStart: number | null = null;
  private _onMessageHandler?: (e: MessageEvent) => void;
  private _onDocumentMouseDown?: (e: MouseEvent) => void;
  private _onDocumentKeyDown?: (e: KeyboardEvent) => void;

  // Android devices with a downloaded frame (see android-devices.ts).
  devices: PreviewDeviceOption[] = ANDROID_DEVICES;
  selectedDeviceIdx: number = 0;
  isPortrait: boolean = true;

  get selectedDevice() {
    return this.devices[this.selectedDeviceIdx];
  }

  connectedCallback() {
    super.connectedCallback();
    
    this.availablePresets = this.previewService.getAvailablePresets();
    this.currentPreset = this.previewService.getCurrentPreset();
    this.currentLanguage = this.previewService.getActivePreviewLanguage();
    
    this.uploadedContentUnsubscribe = this.previewService.onUploadedContentChange((content) => {
      console.log(`📁 playable-previewer: onUploadedContentChange fired, content length: ${content?.length || 0}`);
      if (content) {
        this.pageContent = content;
        this.loading = false;
        this.error = "";
        this._sdkEvents = [];
        this._sdkEventStart = null;
        this._iframeLoadMs = null;
        this._iframeLoadStart = performance.now();
        this._resetAdOverlay();
        console.log(`✅ playable-previewer: Content set, loading=false`);
        this.requestUpdate();
      } else {
        console.log(`📁 Uploaded content cleared`);
        this.pageContent = "";
        this.loading = false;
        this.error = "";
        this._sdkEvents = [];
        this._sdkEventStart = null;
        this._iframeLoadMs = null;
        this._iframeLoadStart = null;
        this._resetAdOverlay();
      }
    });
    
    this.presetUnsubscribe = this.previewService.onPresetChange((preset) => {
      this.currentPreset = preset;
      this.isLanguageMenuOpen = false;
      this._resetAdOverlay();
      this.requestUpdate();
    });

    this.previewLanguageUnsubscribe = this.previewService.onPreviewLanguageChange((language) => {
      this.currentLanguage = language;
      if (!this._supportsLanguageSwitching()) {
        this.isLanguageMenuOpen = false;
      }
      this.requestUpdate();
    });
    
    this.validationUnsubscribe = this.previewService.onValidationChange((results) => {
      this.validationResults = results;
      this.requestUpdate();
    });

    this.zipPreviewUnsubscribe = this.previewService.onZipPreviewUrlChange((url) => {
      this.zipPreviewUrl = url;
      this.requestUpdate();
    });
    this.zipPreviewUrl = this.previewService.getZipPreviewUrl();
    
    const existingContent = this.previewService.getUploadedContent();
    console.log(`🔍 playable-previewer: checking existing content at connectedCallback, length: ${existingContent?.length || 0}`);
    if (existingContent) {
      this.pageContent = existingContent;
      this.loading = false;
      this.error = "";
      console.log(`✅ playable-previewer: Set existing content, loading=false`);
      this.requestUpdate();
    }

    // Get initial validation results
    this.validationResults = this.previewService.getValidationResults();

    // Listen for CTA SDK events posted from the playable iframe
    this._onMessageHandler = (e: MessageEvent) => {
      try {
        const data = e.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'cta-event' || data.type === 'sdk-event') {
          if (this._sdkEventStart === null) this._sdkEventStart = Date.now();
          const elapsedMs = typeof data.elapsedMs === 'number' ? data.elapsedMs : (Date.now() - this._sdkEventStart);
          this._sdkEvents = [...this._sdkEvents, { event: data.event, args: data.args || [], elapsedMs }];
          this.requestUpdate();
        } else if (data.type === 'ads-manager-show' && this.currentPreset?.id === 'ads-manager') {
          this._startAdOverlay(
            data.adKind === 'rewarded' ? 'rewarded' : 'interstitial',
            String(data.id || ''),
            Math.max(0, Number(data.durationMs) || 0),
          );
        } else if (data.type === 'ads-manager-banner' && this.currentPreset?.id === 'ads-manager') {
          this._adBannerVisible = !!data.visible;
          this.requestUpdate();
        } else if (data.type === 'cta-game-start' || data.type === 'sdk-session-start') {
          if (this._sdkEventStart === null) this._sdkEventStart = Date.now();
          this.requestUpdate();
        }
      } catch {
        // ignore malformed messages
      }

      try {
        const data = e.data;
        if (data && data.type === 'RECORDING_COMPLETE' && data.blob) {
          const durationMs = data.durationMs || 0;
          const width = Number.isFinite(data.width) ? data.width : 0;
          const height = Number.isFinite(data.height) ? data.height : 0;
          this._suppressIframe = false; // Restore preview
          this.videoStorageService.saveVideo(data.blob, durationMs).then(() => {
            const clip: PreviewRecordingResult = {
              blob: data.blob,
              mimeType: data.blob.type || 'video/webm',
              fileExtension: (data.blob.type || '').includes('mp4') ? 'mp4' : 'webm',
              durationMs,
              width,
              height,
              startedAt: Date.now() - durationMs
            };
            this._openRecordedClip(clip);
          }).catch(err => {
            this._showTransientError('Failed to save recorded video: ' + String(err));
          });
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('message', this._onMessageHandler);

    this._onDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-preview-locale-switcher]')) {
        return;
      }

      if (this.isLocaleMenuOpen) {
        this.isLocaleMenuOpen = false;
        this.requestUpdate();
      }
    };
    document.addEventListener('mousedown', this._onDocumentMouseDown);

    this._onDocumentKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isLocaleMenuOpen) {
        this.isLocaleMenuOpen = false;
        this.requestUpdate();
      }
    };
    document.addEventListener('keydown', this._onDocumentKeyDown);

    // Listen for playable-screen-lock events so external emitters (service or page) can update UI
    this._playableLockHandler = (e: Event) => {
      try {
        const ev = e as CustomEvent<{ locked: boolean }>;
        this._locked = !!ev.detail?.locked;
        this.requestUpdate();
      } catch (err) {
        console.warn('playable-previewer: lock handler error', err);
      }
    };
    window.addEventListener('playable-screen-lock', this._playableLockHandler as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.uploadedContentUnsubscribe) {
      this.uploadedContentUnsubscribe();
    }
    if (this.presetUnsubscribe) {
      this.presetUnsubscribe();
    }
    if (this.previewLanguageUnsubscribe) {
      this.previewLanguageUnsubscribe();
    }
    if (this.validationUnsubscribe) {
      this.validationUnsubscribe();
    }
    if (this.zipPreviewUnsubscribe) {
      this.zipPreviewUnsubscribe();
    }
    if (this._playableLockHandler) {
      window.removeEventListener('playable-screen-lock', this._playableLockHandler as EventListener);
    }
    if (this._onMessageHandler) {
      window.removeEventListener('message', this._onMessageHandler);
    }
    if (this._onDocumentMouseDown) {
      document.removeEventListener('mousedown', this._onDocumentMouseDown);
    }
    if (this._onDocumentKeyDown) {
      document.removeEventListener('keydown', this._onDocumentKeyDown);
    }
    if (this._adOverlayTimer) {
      clearInterval(this._adOverlayTimer);
      this._adOverlayTimer = undefined;
    }
    this._stageObserver?.disconnect();
  }

  private _resetAdOverlay() {
    if (this._adOverlayTimer) {
      clearInterval(this._adOverlayTimer);
      this._adOverlayTimer = undefined;
    }
    this._adOverlay = null;
    this._adBannerVisible = false;
  }

  protected override firstUpdated(): void {
    const stage = this.querySelector('.playable-stage') as HTMLElement | null;
    if (stage && typeof ResizeObserver !== 'undefined') {
      this._stageObserver = new ResizeObserver(() => {
        if (this._autoFit) {
          this._fitStage();
        }
      });
      this._stageObserver.observe(stage);
    }
  }

  private _stageObserver?: ResizeObserver;
  private _autoFit = true;
  private _lastFitKey = '';

  protected override updated(_changedProps: PropertyValues): void {
    const fitKey = `${this.selectedDeviceIdx}:${this.isPortrait}`;
    if (fitKey !== this._lastFitKey) {
      this._lastFitKey = fitKey;
      this._autoFit = true;
      this._fitStage();
      const frame = this._getFrameElement();
      if (this._fadePending && frame && typeof frame.animate === 'function') {
        frame.getAnimations().forEach(a => a.cancel());
        frame.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      }
      this._fadePending = false;
    }
    const logEl = this.querySelector('#sdk-log-scroll') as HTMLElement | null;
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
  }

  private _playableLockHandler?: (e: Event) => void;
  @state() private _locked: boolean = false;
  @state() private _muted: boolean = false;
  @state() private _suppressIframe: boolean = false;

  private _restartPlayable() {
    this._reloadKey++;
    this._sdkEvents = [];
    this._sdkEventStart = null;
    this._iframeLoadMs = null;
    this._iframeLoadStart = performance.now();
    this._resetAdOverlay();
    this.requestUpdate();
  }

  private _toggleLock() {
    this._locked = !this._locked;
    try {
      this.previewService.handleScreenLockChange(this._locked);
    } catch (err) {
      console.warn('playable-previewer: failed to notify service about lock change', err);
    }
    this.requestUpdate();
    
    // Tell iframe to allow/disallow blur events and simulate accordingly
    this._setPlayableLocked(this._locked);
    
    // Refocus the iframe when unlocking to restore interaction
    if (!this._locked) {
      this._refocusIframe();
    }
  }

  private _toggleMute() {
    this._muted = !this._muted;
    try {
      // Dispatch custom event for mute state change (host window)
      window.dispatchEvent(new CustomEvent('playable-audio-mute', {
        detail: { muted: this._muted }
      }));
      // Also dispatch inside the playable iframe so in-iframe listeners (e.g., mraid shim) receive it
      this._dispatchToIframe('playable-audio-mute', { muted: this._muted });
    } catch (err) {
      console.warn('playable-previewer: failed to dispatch mute event', err);
    }
    this.requestUpdate();
    
    // When unmuting, restore focus to the playable content
    if (!this._muted) {
      this._refocusIframe();
    }
  }
  
  private _refocusIframe() {
    const iframe = this._getIframeEl();
    if (iframe) {
      try {
        iframe.focus();
        // Best-effort focus to the inner document as well
        iframe.contentWindow?.focus();
      } catch (err) {
        console.warn('playable-previewer: failed to refocus iframe', err);
      }
    }
  }
  
  private _getIframeEl(): HTMLIFrameElement | null {
    // ComponentBase renders in light DOM, so query directly
    return (this as unknown as HTMLElement).querySelector('.playable-iframe');
  }

  // ---- AdsManager ad-stub overlay (rendered on top of the simulator) --------
  private _startAdOverlay(kind: 'rewarded' | 'interstitial', id: string, durationMs: number) {
    if (this._adOverlayTimer) {
      clearInterval(this._adOverlayTimer);
      this._adOverlayTimer = undefined;
    }

    const remaining = Math.max(0, Math.ceil(durationMs / 1000));
    this._adOverlay = { id, kind, remaining, canClose: remaining === 0 };
    this.requestUpdate();

    if (remaining === 0) return;

    this._adOverlayTimer = setInterval(() => {
      if (!this._adOverlay) {
        if (this._adOverlayTimer) clearInterval(this._adOverlayTimer);
        this._adOverlayTimer = undefined;
        return;
      }
      const next = this._adOverlay.remaining - 1;
      if (next <= 0) {
        if (this._adOverlayTimer) clearInterval(this._adOverlayTimer);
        this._adOverlayTimer = undefined;
        this._adOverlay = { ...this._adOverlay, remaining: 0, canClose: true };
      } else {
        this._adOverlay = { ...this._adOverlay, remaining: next };
      }
      this.requestUpdate();
    }, 1000);
  }

  private _renderAdOverlay(overlay: { id: string; kind: 'rewarded' | 'interstitial'; remaining: number; canClose: boolean }) {
    const isRewarded = overlay.kind === 'rewarded';
    const title = isRewarded ? 'Simulated Rewarded Video' : 'Simulated Interstitial';
    const subtitle = isRewarded ? 'Watch to the end to earn your reward' : 'This is a full-screen ad';
    const statusLine = overlay.canClose
      ? 'Tap ✕ to close'
      : isRewarded
        ? `Reward in ${overlay.remaining}s…`
        : `You can close in ${overlay.remaining}s…`;

    return html`
      <div class="absolute inset-0 z-[60] flex flex-col items-center justify-center text-center select-none"
           style="background:#0b1020;color:#fff;">
        <div class="absolute top-3 left-3 bg-yellow-400 text-black text-[11px] font-bold leading-none px-2 py-1 rounded tracking-wide">Ad</div>

        <button
          @click=${() => { if (overlay.canClose) this._finishAdOverlay(isRewarded ? 'rewarded' : 'dismissed'); }}
          ?disabled=${!overlay.canClose}
          aria-label="Close ad"
          class="absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center text-base p-0 border-0 ${overlay.canClose ? 'bg-white/30 text-white cursor-pointer opacity-100' : 'bg-white/20 text-white cursor-not-allowed opacity-40'}"
        >✕</button>

        <div class="text-[18px] font-semibold mb-2.5 opacity-95">${title}</div>
        <div class="text-[13px] opacity-60 mb-5 max-w-[80%]">${subtitle}</div>

        <div class="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-[3px] ${overlay.canClose ? (isRewarded ? 'border-emerald-400' : 'border-white/55') : 'border-white/25'}">
          ${overlay.remaining > 0 ? overlay.remaining : '✓'}
        </div>

        <div class="absolute bottom-[18px] text-xs opacity-55">${statusLine}</div>

        ${isRewarded && !overlay.canClose ? html`
          <button
            @click=${() => this._finishAdOverlay('dismissed')}
            class="absolute bottom-11 border border-white/30 bg-transparent text-white/70 text-xs px-3.5 py-1.5 rounded-md cursor-pointer"
          >Skip (no reward)</button>
        ` : null}
      </div>
    `;
  }

  private _finishAdOverlay(status: 'rewarded' | 'dismissed') {
    const overlay = this._adOverlay;
    if (!overlay) return;

    if (this._adOverlayTimer) {
      clearInterval(this._adOverlayTimer);
      this._adOverlayTimer = undefined;
    }
    this._adOverlay = null;
    this.requestUpdate();

    try {
      this._getIframeEl()?.contentWindow?.postMessage(
        { type: 'ads-manager-result', id: overlay.id, status },
        '*',
      );
    } catch (err) {
      console.warn('playable-previewer: failed to post ad result to iframe', err);
    }
  }
  
  private _dispatchToIframe(eventName: string, detail?: any) {
    try {
      const win = this._getIframeEl()?.contentWindow;
      if (win) {
        win.dispatchEvent(new CustomEvent(eventName, { detail }));
      }
    } catch (err) {
      console.warn('playable-previewer: failed to dispatch event into iframe', eventName, err);
    }
  }
  
  // Install event guards inside the iframe so normal page clicks do not pause the playable.
  // We stop blur/visibility events from reaching the playable unless the lock button is used.
  private _installFocusGuards = (e: Event) => {
    // Record iframe load time
    if (this._iframeLoadStart !== null) {
      this._iframeLoadMs = performance.now() - this._iframeLoadStart;
      this.requestUpdate();
    }

    const iframe = e.currentTarget as HTMLIFrameElement;
  const win = iframe?.contentWindow as PreviewIframeWindow | null;
    const doc = win?.document;
    if (!win || !doc) return;
    
    if (win.__ptGuardInstalled) return;
    win.__ptGuardInstalled = true;
    
  const state: { guardActive: boolean; locked: boolean } = { guardActive: true, locked: false };
    
    const stop = (ev: Event) => {
      if (state.guardActive) {
        try { (ev as any).stopImmediatePropagation?.(); } catch {}
        try { ev.stopPropagation(); } catch {}
        try { ev.preventDefault(); } catch {}
      }
    };
    
    // Block common events that playables use to pause when losing focus
    const windowEvents = ['blur'];
    const docEvents = ['blur', 'visibilitychange', 'pagehide'];
    windowEvents.forEach(t => win.addEventListener(t, stop, true));
    docEvents.forEach(t => doc.addEventListener(t, stop, true));

    // Stronger guard: override dispatchEvent so even earlier listeners don't receive these events
    try {
      const blocked = new Set(['blur', 'visibilitychange', 'pagehide']);
      const origDispatchEvent = EventTarget.prototype.dispatchEvent;
      (EventTarget.prototype as any).dispatchEvent = function(ev: Event) {
        try {
          if ((blocked as Set<string>).has(ev?.type) && state.guardActive) {
            return true; // swallow
          }
        } catch {}
        return origDispatchEvent.call(this, ev);
      };
    } catch {}
    
    // Optional: keep document.hasFocus() returning true unless locked
    try {
      const origHasFocus = doc.hasFocus.bind(doc);
      (doc as any).hasFocus = () => !state.guardActive ? origHasFocus() : true;
    } catch {}

    // Visibility state shim: reflect locked state as hidden for APIs that read it (e.g., MRAID shims)
    try {
      const visDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
      const hiddenDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
      const getVis = visDesc && visDesc.get ? () => visDesc.get!.call(doc) : () => 'visible';
      const getHidden = hiddenDesc && hiddenDesc.get ? () => hiddenDesc.get!.call(doc) : () => false;

      Object.defineProperty(doc, 'visibilityState', {
        get() { return state.locked ? 'hidden' as DocumentVisibilityState : (getVis() as DocumentVisibilityState); },
        configurable: true
      });
      Object.defineProperty(doc, 'hidden', {
        get() { return state.locked ? true : !!getHidden(); },
        configurable: true
      });
    } catch {}
    
    // API to toggle lock behavior from host
    win.__ptGuard = {
      setLocked(locked: boolean) {
        state.locked = locked;
        state.guardActive = !locked; // when locked, allow events through
        try {
          if (locked) {
            // Simulate blur/visibility change so playable can pause itself
            try { win.dispatchEvent(new Event('blur', { bubbles: false })); } catch {}
            try { doc.dispatchEvent(new Event('visibilitychange', { bubbles: true })); } catch {}
          } else {
            // Simulate focus back
            // Temporarily disable guard so synthetic events are delivered
            const prev = state.guardActive;
            state.guardActive = false;
            try { win.dispatchEvent(new Event('focus', { bubbles: false })); } catch {}
            try { doc.dispatchEvent(new Event('visibilitychange', { bubbles: true })); } catch {}
            state.guardActive = prev;
            try { win.focus(); } catch {}
          }
        } catch {}
      }
    };


    this._installScreenshotCaptureHelper(doc, win);
  };


  private _installScreenshotCaptureHelper(doc: Document, win: PreviewIframeWindow) {
    installIframeScreenshotCapture(win, doc);
  }
  private renderPlayableIframe() {
    if (this._suppressIframe) {
      return html`
        <div class="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-400 p-6 text-center">
          <div>
            <span class="material-icons-outlined text-4xl mb-2 opacity-50">videocam</span>
            <p>Recording in progress in a popup window...</p>
            <button class="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors text-sm" @click=${() => this._suppressIframe = false}>
              Restore Preview
            </button>
          </div>
        </div>
      `;
    }

    if (this.zipPreviewUrl) {
      // Append reload key as query param so the browser considers it a new URL
      const reloadUrl = this.zipPreviewUrl.split('?')[0] + (this._reloadKey ? `?_r=${this._reloadKey}` : '');
      return html`<iframe
        src="${reloadUrl}"
        class="playable-iframe"
        frameborder="0"
        allowfullscreen
        style="width:100%; height:100%; border:none;"
        @load="${this._installFocusGuards}"
      ></iframe>`;
    }
    
    // If content has a base href (ZIP playable), don't render srcdoc until ZIP preview URL is ready
    if (this.pageContent && this.pageContent.includes('<base href=')) {
      console.log(`⏳ playable-previewer: Waiting for ZIP preview URL to be set before rendering`);
      return html`<div class="flex items-center justify-center h-full bg-slate-100 dark:bg-slate-800">
        <div class="text-center">
          <div class="inline-flex items-center justify-center mb-4">
            <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          </div>
          <p class="text-slate-600 dark:text-slate-400">Initializing ZIP preview...</p>
        </div>
      </div>`;
    }
    
    if (this.pageContent) {
      // Prepend a reload comment so Lit sees a new srcdoc string and destroys/recreates the iframe
      const reloadedContent = this._reloadKey > 0 ? `<!-- reload:${this._reloadKey} -->\n${this.pageContent}` : this.pageContent;
      return html`<iframe
        srcdoc="${reloadedContent}"
        class="playable-iframe"
        frameborder="0"
        allowfullscreen
        style="width:100%; height:100%; border:none;"
        @load="${this._installFocusGuards}"
      ></iframe>`;
    }
    return null;
  }
  
  private _setPlayableLocked(locked: boolean) {
    const iframe = this._getIframeEl();
    const win = iframe?.contentWindow as (Window & { __ptGuard?: { setLocked: (b: boolean) => void } });
    try {
      win?.__ptGuard?.setLocked(locked);
    } catch (err) {
      // Guard may not yet be installed if iframe hasn't loaded; try again shortly.
      setTimeout(() => {
        try { iframe?.contentWindow && (iframe.contentWindow as any).__ptGuard?.setLocked(locked); } catch {}
      }, 50);
    }
  }

  private _supportsSdkEventLog(): boolean {
    return PlayablePreviewer.sdkEventPresetIds.has(this.currentPreset?.id || '');
  }

  async _captureScreenshot() {
    try {
      this.requestUpdate();
      const iframe = this._getIframeEl();
      if (!iframe) {
        throw new Error('Playable iframe not found');
      }
      const blob = await this.previewService.captureScreenshot(iframe);
      
      // Open in new tab
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Cleanup
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      this.error = `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`;
      this.requestUpdate();
      setTimeout(() => {
        this.error = '';
        this.requestUpdate();
      }, 3000);
    }
  }

  private _getRecordingBaseName(): string {
    const rawName = (this.fileName || this.previewService.getUploadedFileName() || 'playable-preview')
      .replace(/\.(html?|zip)$/i, '')
      .trim();
    const normalizedName = rawName.length > 0 ? rawName : 'playable-preview';
    return normalizedName.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'playable-preview';
  }

  private _showTransientError(message: string, timeoutMs: number = 4000) {
    this.error = message;
    this.requestUpdate();
    window.setTimeout(() => {
      if (this.error === message) {
        this.error = '';
        this.requestUpdate();
      }
    }, timeoutMs);
  }

  private _openRecordedClip(clip: PreviewRecordingResult) {
    const modal = ((this as unknown as HTMLElement).querySelector('preview-video-modal')
      || document.querySelector('preview-video-modal')) as PreviewVideoModalElement | null;

    if (modal) {
      void modal.show(clip, this._getRecordingBaseName());
      return;
    }

    this._showTransientError('Recorded clip is ready, but the export modal is unavailable.');
  }



  private async _toggleRecording() {
    let iframeUrl = '';
    if (this.zipPreviewUrl) {
      iframeUrl = this.zipPreviewUrl.split('?')[0] + (this._reloadKey ? `?_r=${this._reloadKey}` : '');
    } else if (this.pageContent) {
      const blob = new Blob([this.pageContent], { type: 'text/html' });
      iframeUrl = URL.createObjectURL(blob);
    }

    if (!iframeUrl) {
      this._showTransientError('No content available for recording.');
      return;
    }

    const device = this.selectedDevice;
    const width = (this.isPortrait ? device.width : device.height) || 375;
    const height = (this.isPortrait ? device.height : device.width) || 667;
    const popupOuterWidth = width + 420;
    const popupOuterHeight = Math.max(height + 120, 620);

    const popupUrl = `/recorder-popup?url=${encodeURIComponent(iframeUrl)}&width=${width}&height=${height}`;
    
    // Suspend the main iframe so we don't have overlapping audio
    this._suppressIframe = true;

    // Popup window options with dimensions to accommodate the device size
    window.open(
      popupUrl,
      'RecorderPopup',
      `width=${popupOuterWidth},height=${popupOuterHeight},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no`,
    );
  }

  private _openRecordingsList() {
    const modal = (this as any).querySelector('recordings-list-modal') || document.querySelector('recordings-list-modal');
    if (modal) {
      (modal as any).show();
    } else {
      this._showTransientError('Recordings list modal is unavailable.');
    }
  }

  private _formatAspectRatio(width?: number, height?: number): string {
    if (!width || !height) {
      return 'n/a';
    }

    const normalizedRatio = Math.max(width, height) / Math.min(width, height);
    const ratioCandidates = [
      { label: '4:3', value: 4 / 3 },
      { label: '3:2', value: 3 / 2 },
      { label: '16:10', value: 16 / 10 },
      { label: '16:9', value: 16 / 9 },
      { label: '18:9', value: 18 / 9 },
      { label: '19:9', value: 19 / 9 },
      { label: '19.5:9', value: 19.5 / 9 },
      { label: '20:9', value: 20 / 9 },
      { label: '21:9', value: 21 / 9 },
    ];

    let bestCandidate = ratioCandidates[0];
    let bestDistance = Math.abs(normalizedRatio - bestCandidate.value);
    for (const candidate of ratioCandidates.slice(1)) {
      const distance = Math.abs(normalizedRatio - candidate.value);
      if (distance < bestDistance) {
        bestCandidate = candidate;
        bestDistance = distance;
      }
    }

    if (bestDistance <= 0.04) {
      return bestCandidate.label;
    }

    const normalizedToNine = (normalizedRatio * 9).toFixed(1).replace(/\.0$/, '');
    return `${normalizedToNine}:9`;
  }

  private _getDeviceSummary(width: number, height: number): string {
    return `${width} x ${height} px • ${this._formatAspectRatio(width, height)}`;
  }
  
  handleDeviceChange(e: Event) {
    const idx = Number((e.target as HTMLSelectElement).value);
    if (idx === this.selectedDeviceIdx) {
      return;
    }
    this._withFrameFade(() => {
      this.selectedDeviceIdx = idx;
      this.requestUpdate();
    });
  }

  toggleOrientation() {
    this._withFrameFade(() => {
      this.isPortrait = !this.isPortrait;
      this.requestUpdate();
    });
  }

  private _fadePending = false;
  private _fadingOut = false;

  private _getFrameElement(): HTMLElement | null {
    return this.querySelector('[data-device-frame]') as HTMLElement | null;
  }

  /** Fades the phone frame out, applies the change, then updated() fades the new frame in. */
  private _withFrameFade(change: () => void) {
    const frame = this._getFrameElement();
    const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!frame || typeof frame.animate !== 'function' || reduceMotion || this._fadingOut) {
      change();
      return;
    }
    this._fadingOut = true;
    const fadeOut = frame.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'ease-in', fill: 'forwards' });
    const apply = () => {
      this._fadingOut = false;
      this._fadePending = true;
      change();
    };
    fadeOut.finished.then(apply, apply);
  }

  async handlePresetChange(e: Event) {
    const presetId = (e.target as HTMLSelectElement).value;
    const preset = this.previewService.getPresetById(presetId);
    
    if (preset) {
      this.isPresetSwitching = true;
      this.error = "";
      this.requestUpdate();
      
      try {
        this.previewService.setCurrentPreset(preset);
        
        // Reprocess existing content with new preset (works for both uploaded and GitHub content)
        await this.previewService.reloadContentWithPreset(preset);
        
        this.presetSuccessMessage = `✅ Applied ${preset.name} preset`;
        setTimeout(() => {
          this.presetSuccessMessage = "";
          this.requestUpdate();
        }, 3000);
        
      } catch (error) {
        console.error(`❌ Failed to switch preset:`, error);
        this.error = `Failed to apply preset: ${error instanceof Error ? error.message : String(error)}`;
      } finally {
        this.isPresetSwitching = false;
        this.requestUpdate();
      }
    }
  }

  private _supportsLanguageSwitching(): boolean {
    return !!this.currentPreset?.supportsLanguageSwitching
      && (this.currentPreset.availableLanguages?.length || 0) > 1;
  }

  private _getAvailableLanguages(): PreviewLanguageOption[] {
    return this.previewService.getAvailableLanguagesForPreset(this.currentPreset);
  }

  private _getCurrentLanguageOption(): PreviewLanguageOption | null {
    const currentLanguage = this.currentLanguage;
    if (!currentLanguage) {
      return null;
    }

    return this._getAvailableLanguages().find(language => language.code === currentLanguage) || null;
  }

  private _toggleLanguageMenu(e: Event) {
    e.stopPropagation();
    if (!this._supportsLanguageSwitching() || this.isPresetSwitching) {
      return;
    }

    this.isLanguageMenuOpen = !this.isLanguageMenuOpen;
    this.requestUpdate();
  }

  private _toggleLocaleMenu(e: Event) {
    e.stopPropagation();
    if (this.isPresetSwitching) {
      return;
    }

    this.isLocaleMenuOpen = !this.isLocaleMenuOpen;
    this.requestUpdate();
  }

  private async _handleLocaleSelection(code: string) {
    this.isLocaleMenuOpen = false;
    if (this.currentLanguage === code) {
      this.requestUpdate();
      return;
    }

    this.isPresetSwitching = true;
    this.error = "";
    this.requestUpdate();

    try {
      await this.previewService.setPreviewLocale(code);
      this._restartPlayable();
    } catch (error) {
      console.error(`❌ Failed to change preview locale:`, error);
      this.error = `Failed to change language: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      this.isPresetSwitching = false;
      this.requestUpdate();
    }
  }

  private async _handleLanguageSelection(languageCode: string) {
    if (!this._supportsLanguageSwitching()) {
      return;
    }

    const selectedLanguage = this._getAvailableLanguages().find(language => language.code === languageCode);
    if (!selectedLanguage) {
      return;
    }

    if (this.currentLanguage === languageCode) {
      this.isLanguageMenuOpen = false;
      this.requestUpdate();
      return;
    }

    this.isPresetSwitching = true;
    this.isLanguageMenuOpen = false;
    this.error = "";
    this.requestUpdate();

    try {
      await this.previewService.reloadContentWithCurrentLanguage(languageCode);
      this._restartPlayable();

      this.presetSuccessMessage = `✅ Language: ${selectedLanguage.label}`;
      setTimeout(() => {
        this.presetSuccessMessage = "";
        this.requestUpdate();
      }, 3000);
    } catch (error) {
      console.error(`❌ Failed to switch preview language:`, error);
      this.error = `Failed to switch language: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      this.isPresetSwitching = false;
      this.requestUpdate();
    }
  }

  async handleSaveToLibrary() {
    try {
      const iframe = this._getIframeEl();
      if (!iframe) {
        throw new Error('Playable iframe not found');
      }
      
      const blob = await this.previewService.captureScreenshot(iframe);
      
      // Modal is in light DOM, so query from the element itself (fallback to document)
      const modal = (this as any).querySelector('save-creative-modal') || document.querySelector('save-creative-modal');
      if (modal) {
        const content = this.previewService.getOriginalSourceContent() || this.pageContent;
        // Use fileName property or default
        const name = this.fileName || "Playable Ad.html";
        // Check if current preview is from ZIP
        const zipFile = this.previewService.getOriginalZipFile();
        console.log(`📱 playable-previewer.handleSaveToLibrary: zipFile=${zipFile ? `File(${zipFile.name}, ${zipFile.size} bytes)` : 'null'}, passing to modal.show()`);
        await modal.show(blob, content, name, zipFile);
      } else {
        console.warn('Modal not found in DOM');
      }
    } catch (error) {
      console.error('Failed to capture screenshot for library:', error);
      this.error = `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`;
      this.requestUpdate();
      setTimeout(() => {
        this.error = '';
        this.requestUpdate();
      }, 3000);
    }
  }

  private _renderSidePanels() {
    const showSidePanels = VALIDATOR_ENABLED || SDK_EVENT_LOG_ENABLED;
    if (!showSidePanels) {
      return null;
    }

    const availableLanguages = this._getAvailableLanguages();
    const currentLanguageOption = this._getCurrentLanguageOption();
    const uploadedSizeBytes = this.previewService.getUploadedSizeBytes?.() ?? 0;
    const sizeKb = uploadedSizeBytes > 0 ? (uploadedSizeBytes / 1024).toFixed(1) : null;
    const loadSec = this._iframeLoadMs !== null ? (this._iframeLoadMs / 1000).toFixed(2) : null;

    return html`
      <div class="flex flex-col gap-4">
          ${VALIDATOR_ENABLED ? html`
          <!-- Validation Results -->
          <div class="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
            <div class="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Validation Results</h2>
                ${sizeKb || loadSec ? html`
                  <div class="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                    ${sizeKb ? html`<span class="flex items-center gap-1"><span class="material-icons-outlined" style="font-size:13px">description</span> ${sizeKb} KB</span>` : ''}
                    ${loadSec ? html`<span class="flex items-center gap-1"><span class="material-icons-outlined" style="font-size:13px">timer</span> ${loadSec}s load</span>` : ''}
                  </div>
                ` : ''}
              </div>

              <div class="flex flex-col items-end gap-2">
                <div class="flex items-center gap-2">
                  <label for="preset-select" class="text-sm font-medium text-slate-500 dark:text-slate-400">Validator:</label>
                  <div class="relative">
                    <select 
                      id="preset-select"
                      @change="${this.handlePresetChange.bind(this)}" 
                      class="w-48 appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
                      title="${this.currentPreset?.description || ''}"
                      ?disabled="${this.isPresetSwitching}"
                    >
                      ${this.availablePresets.map(preset =>
                        html`<option 
                          value="${preset.id}" 
                          ?selected="${preset.id === this.currentPreset?.id}"
                        >
                          ${preset.name}
                        </option>`
                      )}
                    </select>
                    <span class="material-icons-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500">expand_more</span>
                  </div>
                  ${this.isPresetSwitching ? html`
                    <div class="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                  ` : ''}
                </div>

                ${this._supportsLanguageSwitching() ? html`
                  <div class="relative" data-preview-language-switcher>
                    <button
                      type="button"
                      @click=${this._toggleLanguageMenu}
                      class="inline-flex items-center gap-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                      title="Preview language"
                      ?disabled=${this.isPresetSwitching}
                    >
                      <span class="material-icons-outlined" style="font-size:18px">translate</span>
                      <span>${currentLanguageOption?.label || 'Language'}</span>
                      <span class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">${currentLanguageOption?.code || ''}</span>
                      <span class="material-icons-outlined text-slate-400 dark:text-slate-500" style="font-size:18px">expand_more</span>
                    </button>

                    ${this.isLanguageMenuOpen ? html`
                      <div class="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                        ${availableLanguages.map(language => html`
                          <button
                            type="button"
                            @click=${() => this._handleLanguageSelection(language.code)}
                            class="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors ${language.code === this.currentLanguage ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}"
                          >
                            <span>${language.label}</span>
                            <span class="text-xs uppercase tracking-wide ${language.code === this.currentLanguage ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}">${language.code}</span>
                          </button>
                        `)}
                      </div>
                    ` : ''}
                  </div>
                ` : ''}

                ${this.currentPreset ? html`
                  <div class="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span>
                      Max size: ${this.currentPreset.maxFileSizeMB}MB
                      ${this.currentPreset.injectScripts.length > 0 ? html`• Scripts: ${this.currentPreset.injectScripts.length}` : ''}
                      ${currentLanguageOption ? html`• Language: ${currentLanguageOption.code.toUpperCase()}` : ''}
                    </span>
                    ${this.presetSuccessMessage ? html`
                      <span class="text-green-500 font-medium animate-fade-in-out">
                        ${this.presetSuccessMessage}
                      </span>
                    ` : ''}
                  </div>
                ` : ''}
              </div>
            </div>
            
            ${this.validationResults && this.validationResults.categories.length > 0 ? html`
              <div class="space-y-6">
                ${this.validationResults.categories.map(category => html`
                  <div>
                    <div class="flex items-center gap-2 mb-4">
                      <span class="material-icons-outlined ${category.checks.every(check => check.passed) ? 'text-green-500' : 'text-yellow-500'}">
                        ${category.checks.every(check => check.passed) ? 'check_circle' : 'warning'}
                      </span>
                      <h3 class="font-semibold text-slate-800 dark:text-slate-200">${category.name}</h3>
                    </div>
                    <ul class="space-y-3 pl-7">
                      ${category.checks.map(check => html`
                        <li class="flex items-start gap-3">
                          <span class="material-icons-outlined ${check.passed ? 'text-green-500' : check.isWarning ? 'text-yellow-500' : 'text-red-500'}">
                            ${check.passed ? 'check_circle' : check.isWarning ? 'warning' : 'cancel'}
                          </span>
                          <div>
                            <p class="${check.passed ? '' : 'font-medium text-red-600 dark:text-red-500'}">
                              ${check.name}
                            </p>
                            ${check.details ? html`
                              <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">${check.details}</p>
                            ` : ''}
                          </div>
                        </li>
                      `)}
                    </ul>
                  </div>
                `)}
              </div>
            ` : html`
              <div class="text-center text-slate-500 dark:text-slate-400 italic">
                No validation results available
              </div>
            `}
          </div>
          ` : null}

          <!-- SDK Event Log -->
          ${SDK_EVENT_LOG_ENABLED ? html`
          <div class="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div class="flex items-center gap-2">
                <span class="material-icons-outlined text-indigo-500" style="font-size:18px">terminal</span>
                <h2 class="text-sm font-semibold text-slate-900 dark:text-white">SDK Event Log</h2>
                ${this._sdkEvents.length > 0 ? html`
                  <span class="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full px-2 py-0.5">${this._sdkEvents.length}</span>
                ` : ''}
                ${!this._supportsSdkEventLog() ? html`
                  <span class="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span class="material-icons-outlined" style="font-size:13px">info</span>
                    Select &ldquo;CTA SDK&rdquo; or &ldquo;Yandex Games SDK&rdquo; preset to capture events
                  </span>
                ` : ''}
              </div>
              ${this._sdkEvents.length > 0 ? html`
                <button @click=${() => { this._sdkEvents = []; this._sdkEventStart = null; this.requestUpdate(); }}
                  class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  title="Clear log"
                >Clear</button>
              ` : ''}
            </div>
            <div class="font-mono text-xs overflow-y-auto" style="max-height: 180px; min-height: 56px;" id="sdk-log-scroll">
              ${this._sdkEvents.length === 0 ? html`
                <div class="px-4 py-3 text-slate-400 dark:text-slate-500 italic">
                  No SDK events captured yet${this._supportsSdkEventLog() ? ' — interact with the playable to see events' : ''}.
                </div>
              ` : this._sdkEvents.map((ev, i) => {
                const ms = ev.elapsedMs;
                const timeStr = ms < 1000 ? `+${ms}ms` : `+${(ms/1000).toFixed(2)}s`;
                const argsStr = ev.args.length > 0 ? ev.args.map(a => JSON.stringify(a)).join(', ') : '';
                const isClick = ev.event === 'onClick';
                const isReady = ev.event === 'gameReady';
                return html`
                  <div class="px-4 py-1.5 flex items-baseline gap-3 border-b border-slate-100 dark:border-slate-800 last:border-0 ${isClick ? 'bg-green-50 dark:bg-green-900/10' : isReady ? 'bg-blue-50 dark:bg-blue-900/10' : ''} hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span class="text-slate-400 dark:text-slate-500 shrink-0" style="min-width:60px">[${timeStr}]</span>
                    <span class="font-semibold ${isClick ? 'text-green-700 dark:text-green-400' : isReady ? 'text-blue-700 dark:text-blue-400' : 'text-indigo-700 dark:text-indigo-300'}">${ev.event}</span>
                    ${argsStr ? html`<span class="text-slate-500 dark:text-slate-400 truncate">(${argsStr})</span>` : html`<span class="text-slate-400">()</span>`}
                    <span class="ml-auto text-slate-300 dark:text-slate-600 shrink-0">#${i + 1}</span>
                  </div>
                `;
              })}
            </div>
          </div>
          ` : null}
      </div>
    `;
  }

  private _getReadinessSummary() {
    const checks = (this.validationResults?.categories ?? []).flatMap(category => category.checks);
    const passed = checks.filter(check => check.passed).length;
    const failing = checks.filter(check => !check.passed);
    const score = checks.length > 0 ? Math.round((passed / checks.length) * 100) : null;
    return { total: checks.length, failing, score };
  }

  private _getFilteredDevices() {
    const query = this._deviceQuery.trim().toLowerCase();
    return this.devices
      .map((device, idx) => ({ device, idx }))
      .filter(({ device }) => {
        if (device.disabled) {
          return false;
        }
        if (this._deviceFilter === 'favorites') {
          if (!this._favoriteDevices.has(device.name)) {
            return false;
          }
        } else if (this._deviceFilter !== 'all' && device.type !== this._deviceFilter) {
          return false;
        }
        if (!query) {
          return true;
        }
        const { width, height } = this._getDisplayDims(device);
        return device.name.toLowerCase().includes(query)
          || `${width}x${height}`.includes(query)
          || `${width} × ${height}`.includes(query);
      });
  }

  private _loadFavoriteDevices(): Set<string> {
    try {
      const raw = localStorage.getItem('preview-favorite-devices');
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : []);
    } catch {
      return new Set();
    }
  }

  private _toggleFavoriteDevice(name: string) {
    const next = new Set(this._favoriteDevices);
    if (!next.delete(name)) {
      next.add(name);
    }
    this._favoriteDevices = next;
    try {
      localStorage.setItem('preview-favorite-devices', JSON.stringify([...next]));
    } catch {
      // Storage unavailable: favourites last for this session only.
    }
  }

  private _selectDevice(idx: number) {
    if (idx === this.selectedDeviceIdx) {
      return;
    }
    this._withFrameFade(() => {
      this.selectedDeviceIdx = idx;
      const orientation = this.devices[idx]?.orientation;
      if (orientation) {
        this.isPortrait = orientation === 'portrait';
      }
      this.requestUpdate();
    });
  }

  private _setStageScale(value: number, manual = true) {
    if (manual) {
      this._autoFit = false;
    }
    const clamped = Math.min(2, Math.max(0.2, Math.round(value * 100) / 100));
    this._stageScale = clamped;
  }

  private _toggleHandMode() {
    this._handMode = !this._handMode;
    this._panStart = null;
  }

  // Hand mode: drag the stage to scroll it. The phone ignores pointer events in this mode
  // so the drag reaches the stage instead of the playable's iframe.
  private _startPan(e: PointerEvent) {
    if (!this._handMode) {
      return;
    }
    const stage = e.currentTarget as HTMLElement;
    this._panStart = { x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    stage.setPointerCapture(e.pointerId);
    stage.style.cursor = 'grabbing';
  }

  private _movePan(e: PointerEvent) {
    if (!this._panStart) {
      return;
    }
    const stage = e.currentTarget as HTMLElement;
    stage.scrollLeft = this._panStart.left - (e.clientX - this._panStart.x);
    stage.scrollTop = this._panStart.top - (e.clientY - this._panStart.y);
  }

  private _endPan(e: PointerEvent) {
    if (!this._panStart) {
      return;
    }
    this._panStart = null;
    const stage = e.currentTarget as HTMLElement;
    stage.style.cursor = '';
    if (stage.hasPointerCapture(e.pointerId)) {
      stage.releasePointerCapture(e.pointerId);
    }
  }

  /**
   * Mockup frame geometry for the current orientation. Landscape reuses the portrait PNG rotated
   * 90° counter-clockwise, so the screen opening is remapped to match.
   */
  private _getFrameLayout(mockup: DeviceMockup, width: number, height: number) {
    const { imageWidth: iw, imageHeight: ih, screen, src } = mockup;
    if (this.isPortrait) {
      const sx = width / screen.width;
      const sy = height / screen.height;
      return {
        src,
        frameW: iw * sx,
        frameH: ih * sy,
        screenLeft: screen.x * sx,
        screenTop: screen.y * sy,
        radius: screen.radius * sx,
        imgStyle: 'inset: 0; width: 100%; height: 100%;',
      };
    }
    // Rotated space: horizontal scale a maps the image's height, vertical scale b maps its width.
    const a = width / screen.height;
    const b = height / screen.width;
    const frameW = ih * a;
    const frameH = iw * b;
    const imgW = iw * b;
    const imgH = ih * a;
    return {
      src,
      frameW,
      frameH,
      screenLeft: screen.y * a,
      screenTop: (iw - screen.x - screen.width) * b,
      radius: screen.radius * ((a + b) / 2),
      imgStyle: `left: ${(frameW - imgW) / 2}px; top: ${(frameH - imgH) / 2}px; width: ${imgW}px; height: ${imgH}px; transform: rotate(-90deg);`,
    };
  }

  private _fitStage() {
    const stage = this.querySelector('.playable-stage') as HTMLElement | null;
    if (!stage) {
      return;
    }
    const device = this.selectedDevice;
    const width = (this.isPortrait ? device.width : device.height) || 375;
    const height = (this.isPortrait ? device.height : device.width) || 667;
    // Outer size of the frame at scale 1 (mockup PNG scaled to the viewport, or the plain frame).
    const layout = device.mockup ? this._getFrameLayout(device.mockup, width, height) : undefined;
    const frameW = layout ? layout.frameW : width + 20;
    const frameH = layout ? layout.frameH : height + 20;
    const padding = 48; // matches the p-6 gutter around the stage
    const fitScale = Math.min((stage.clientWidth - padding) / frameW, (stage.clientHeight - padding) / frameH);
    this._autoFit = true;
    this._setStageScale(Math.min(1.5, fitScale), false);
  }

  private _applyCustomViewport() {
    const width = Math.round(this._customW);
    const height = Math.round(this._customH);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 200 || height < 200) {
      this._showTransientError('Custom viewport needs at least 200 × 200 px.');
      return;
    }

    const customDevice: PreviewDeviceOption = { name: 'Custom viewport', width, height, type: 'phone' };
    if (this._customDeviceIdx !== null && this.devices[this._customDeviceIdx]) {
      this.devices[this._customDeviceIdx] = customDevice;
      this.selectedDeviceIdx = this._customDeviceIdx;
    } else {
      this.devices = [...this.devices, customDevice];
      this._customDeviceIdx = this.devices.length - 1;
      this.selectedDeviceIdx = this._customDeviceIdx;
    }
    this.isPortrait = true;
    this.requestUpdate();
  }

  private _getDisplayDims(device: PreviewDeviceOption): { width: number; height: number } {
    const w = device.width || 0;
    const h = device.height || 0;
    return device.orientation === 'landscape' ? { width: h, height: w } : { width: w, height: h };
  }

  private _renderDeviceGroups(devices: Array<{ device: PreviewDeviceOption; idx: number }>) {
    if (devices.length === 0) {
      return html`<p class="col-span-2 text-sm italic text-slate-500 dark:text-slate-400">No devices match.</p>`;
    }
    const heading = 'col-span-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500';
    const google = devices.filter(({ device }) => device.group === 'Google');
    const others = devices.filter(({ device }) => device.group !== 'Google');
    return html`
      ${google.length > 0 ? html`<p class="${heading}">Google</p>${google.map(({ device, idx }) => this._renderDeviceCard(device, idx))}` : null}
      ${others.length > 0 ? html`<p class="${heading}">Other devices</p>${others.map(({ device, idx }) => this._renderDeviceCard(device, idx))}` : null}
    `;
  }

  private _renderDeviceCard(device: PreviewDeviceOption, idx: number) {
    const selected = idx === this.selectedDeviceIdx;
    const { width, height } = this._getDisplayDims(device);
    const favorite = this._favoriteDevices.has(device.name);
    return html`
      <div class="relative">
        <button
          type="button"
          @click=${() => this._selectDevice(idx)}
          class="flex w-full items-center gap-2.5 rounded-lg border p-2.5 pr-9 text-left transition-colors ${selected
            ? 'border-red-500 bg-red-50 ring-1 ring-red-500 dark:bg-red-900/20'
            : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}"
        >
          <span class="material-icons-outlined shrink-0 text-slate-500 dark:text-slate-400" style="font-size:22px">${device.type === 'tablet' ? 'tablet_mac' : 'smartphone'}</span>
          <span class="min-w-0">
            <span class="block truncate text-xs font-semibold text-slate-900 dark:text-white">${device.name}</span>
            <span class="block truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">${width} × ${height} · ${this._formatAspectRatio(width, height)}</span>
          </span>
        </button>
        <button
          type="button"
          title=${favorite ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed=${favorite ? 'true' : 'false'}
          @click=${(e: Event) => { e.stopPropagation(); this._toggleFavoriteDevice(device.name); }}
          class="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 ${favorite ? 'text-amber-500' : 'text-slate-400'}"
        >
          <span class="material-icons-outlined" style="font-size:18px">${favorite ? 'star' : 'star_border'}</span>
        </button>
      </div>
    `;
  }

  private _renderFilterChip(value: 'all' | 'phone' | 'tablet' | 'favorites', label: string) {
    const active = this._deviceFilter === value;
    return html`
      <button
        type="button"
        @click=${() => { this._deviceFilter = value; }}
        class="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${active
          ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
          : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}"
      >${label}</button>
    `;
  }

  private _renderToolbarButton(
    icon: string,
    label: string,
    onClick: () => void,
    options: { active?: boolean; disabled?: boolean; title?: string } = {},
  ) {
    const tone = options.active
      ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
    return html`
      <button
        type="button"
        title=${options.title ?? label}
        ?disabled=${!!options.disabled}
        @click=${onClick}
        class="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tone}"
      >
        <span class="material-icons-outlined" style="font-size:18px">${icon}</span>
        <span>${label}</span>
      </button>
    `;
  }

  private _renderReadinessRing(score: number) {
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const color = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-500' : 'text-red-600';
    return html`
      <svg width="52" height="52" viewBox="0 0 48 48" class="shrink-0">
        <circle cx="24" cy="24" r="${radius}" fill="none" stroke="currentColor" stroke-opacity="0.15" stroke-width="4" class="text-slate-500" />
        <circle
          cx="24" cy="24" r="${radius}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${circumference * (1 - score / 100)}"
          transform="rotate(-90 24 24)"
          class="${color}"
        />
        <text x="24" y="28" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor" class="${color}">${score}</text>
      </svg>
    `;
  }

  render() {
    const device = this.selectedDevice;
    const width = (this.isPortrait ? device.width : device.height) || 375;
    const height = (this.isPortrait ? device.height : device.width) || 667;
    // Mockup frame: scale so the PNG's transparent screen opening matches the device viewport exactly.
    const mockup = device.mockup ? this._getFrameLayout(device.mockup, width, height) : undefined;
    const hasContent = !!this.zipPreviewUrl || !!this.pageContent;
    const readiness = this._getReadinessSummary();
    const filteredDevices = this._getFilteredDevices();
    const scalePercent = Math.round(this._stageScale * 100);

    // Log render state for debugging
    console.log(`🎨 playable-previewer render: loading=${this.loading}, error='${this.error}', zipPreview=${!!this.zipPreviewUrl}, pageContent=${!!this.pageContent}`);

    return html`
      <div class="flex h-full min-h-[480px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <!-- Top bar -->
        <div class="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Testing</p>
            <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">${this.fileName || 'Playable preview'}</p>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">${device.name}</p>
            <p class="font-mono text-xs text-slate-500 dark:text-slate-400">${this._getDeviceSummary(width, height)}</p>
          </div>
        </div>

        <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
          <!-- Stage -->
          <div class="flex min-w-0 flex-1 flex-col bg-slate-100 dark:bg-slate-900">
            <div
              class="playable-stage min-h-0 flex-1 overflow-auto p-6 ${this._handMode ? 'cursor-grab select-none' : ''}"
              @pointerdown=${(e: PointerEvent) => this._startPan(e)}
              @pointermove=${(e: PointerEvent) => this._movePan(e)}
              @pointerup=${(e: PointerEvent) => this._endPan(e)}
              @pointercancel=${(e: PointerEvent) => this._endPan(e)}
              style="background-image: radial-gradient(rgba(100,116,139,0.18) 1px, transparent 1px); background-size: 20px 20px;">
              <div class="mx-auto w-max" style="zoom: ${this._stageScale};${this._handMode ? ' pointer-events: none;' : ''}">
                <!-- Phone Frame: downloaded mockup PNG when the device has one (rotated in landscape), otherwise the plain frame -->
                <div
                  data-device-frame
                  class=${mockup ? 'relative shrink-0' : 'rounded-[40px] bg-slate-800 p-2.5 shadow-2xl dark:bg-black'}
                  style=${mockup
                    ? `width: ${mockup.frameW}px; height: ${mockup.frameH}px;`
                    : `width: ${width + 20}px; height: ${height + 20}px;`}>
                  <div
                    class=${mockup ? 'playable-capture-surface absolute overflow-hidden bg-slate-900' : 'playable-capture-surface relative h-full w-full overflow-hidden rounded-[30px] bg-slate-900'}
                    style=${mockup
                      ? `left: ${mockup.screenLeft}px; top: ${mockup.screenTop}px; width: ${width}px; height: ${height}px; border-radius: ${mockup.radius}px;`
                      : ''}>
                    ${this.loading
                      ? html`
                          <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                            <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
                            <div class="text-lg">
                              ${this.isPresetSwitching ? `Applying ${this.currentPreset?.name} preset...` : 'Loading playable content...'}
                            </div>
                          </div>
                        `
                      : this.error
                      ? html`
                          <div class="absolute inset-0 flex items-center justify-center p-4">
                            <div class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded text-center">
                              <p class="font-bold mb-2">${this.error.includes('re-upload') ? '⚠️ Warning' : '❌ Error'}</p>
                              <p>${this.error}</p>
                            </div>
                          </div>
                        `
                      : hasContent
                      ? html`
                          <div class="w-full h-full relative">
                            ${this.renderPlayableIframe()}

                            ${this.isPresetSwitching ? html`
                              <div class="absolute inset-0 bg-primary/10 backdrop-blur-[1px] flex items-center justify-center z-50">
                                <div class="bg-primary/90 text-white px-6 py-3 rounded-lg flex items-center gap-3 shadow-lg">
                                  <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                  <span>Applying ${this.currentPreset?.name} preset...</span>
                                </div>
                              </div>
                            ` : ''}

                            ${this._locked ? html`
                              <div class="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                                <div class="bg-black/60 text-white px-6 py-3 rounded-lg text-lg backdrop-blur-sm">
                                  Screen is locked
                                </div>
                              </div>
                            ` : null}

                            ${this._adBannerVisible && !this._adOverlay ? html`
                              <div class="absolute left-0 right-0 bottom-0 h-[50px] z-40 flex items-center justify-center bg-slate-800 text-slate-300 text-xs border-t border-white/10">
                                Ad banner (simulated)
                              </div>
                            ` : null}

                            ${this._adOverlay ? this._renderAdOverlay(this._adOverlay) : null}
                          </div>
                        `
                      : html`
                          <div class="absolute inset-0 flex items-center justify-center p-4 text-center text-slate-500 dark:text-slate-400">
                            Ready to preview content
                          </div>
                        `}
                  </div>
                  ${mockup ? html`
                    <img class="pointer-events-none absolute select-none" style=${mockup.imgStyle} src=${mockup.src} alt="" draggable="false" />
                  ` : null}
                </div>
              </div>
            </div>

            <!-- Bottom toolbar -->
            <div class="flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <div class="flex items-center gap-1 rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
                <button type="button" title="Zoom out" @click=${() => this._setStageScale(this._stageScale - 0.05)} class="flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
                  <span class="material-icons-outlined" style="font-size:18px">remove</span>
                </button>
                <span class="w-12 text-center font-mono text-xs tabular-nums text-slate-700 dark:text-slate-200">${scalePercent}%</span>
                <button type="button" title="Zoom in" @click=${() => this._setStageScale(this._stageScale + 0.05)} class="flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
                  <span class="material-icons-outlined" style="font-size:18px">add</span>
                </button>
              </div>

              ${this._renderToolbarButton('fit_screen', 'Fit', () => this._fitStage(), { title: 'Fit playable to the stage' })}
              ${this._renderToolbarButton('pan_tool', 'Hand', () => this._toggleHandMode(), { active: this._handMode, title: this._handMode ? 'Exit hand mode' : 'Hand mode: drag to move the stage' })}

              ${this._renderToolbarButton(
                this.isPortrait ? 'stay_current_portrait' : 'stay_current_landscape',
                this.isPortrait ? 'Portrait' : 'Landscape',
                () => this.toggleOrientation(),
                { title: this.isPortrait ? 'Switch to landscape' : 'Switch to portrait' },
              )}
              ${this._renderToolbarButton(this._locked ? 'lock' : 'lock_open', this._locked ? 'Locked' : 'Lock', () => this._toggleLock(), { title: 'Lock / Unlock' })}
              ${this._renderToolbarButton(this._muted ? 'volume_off' : 'volume_up', this._muted ? 'Muted' : 'Sound', () => this._toggleMute(), { title: this._muted ? 'Unmute audio' : 'Mute audio' })}
              ${this._renderToolbarButton('replay', 'Reload', () => this._restartPlayable(), { title: 'Restart content' })}

              <div class="relative" data-preview-locale-switcher>
                <button
                  type="button"
                  @click=${this._toggleLocaleMenu}
                  title="Language"
                  ?disabled=${this.isPresetSwitching}
                  class="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <span class="material-icons-outlined" style="font-size:18px">translate</span>
                  <span class="text-xs font-semibold uppercase">${this.currentLanguage ?? 'en'}</span>
                </button>
                ${this.isLocaleMenuOpen ? html`
                  <div class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 w-48 max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                    ${PREVIEW_LOCALES.map(code => html`
                      <button
                        type="button"
                        @click=${() => this._handleLocaleSelection(code)}
                        class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${code === this.currentLanguage ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}"
                      >
                        <span>${localeLabel(code)}</span>
                        <span class="text-xs uppercase ${code === this.currentLanguage ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}">${code}</span>
                      </button>
                    `)}
                  </div>
                ` : ''}
              </div>

              ${this._renderToolbarButton('photo_camera', 'Screenshot', () => this._captureScreenshot(), { active: true, title: 'Capture screenshot' })}
              ${this._renderToolbarButton(
                'fiber_manual_record',
                this._suppressIframe ? 'Recording' : 'Record',
                () => this._toggleRecording(),
                {
                  active: this._suppressIframe,
                  disabled: this.loading || !hasContent,
                  title: this._suppressIframe ? 'Recording in progress (in new tab)' : 'Record gameplay video',
                },
              )}
              ${this._renderToolbarButton('video_library', 'Recordings', () => this._openRecordingsList(), { title: 'Previous recordings' })}
            </div>
          </div>

          <!-- Sidebar -->
          <aside class="flex w-full shrink-0 flex-col gap-6 overflow-y-auto border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:w-[300px] lg:border-l lg:border-t-0">
            <!-- Viewport library -->
            <section class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Viewport library</h3>
                <span class="text-xs text-slate-500 dark:text-slate-400">${filteredDevices.length}</span>
              </div>
              <input
                type="search"
                placeholder="Search devices and dimensions"
                .value=${this._deviceQuery}
                @input=${(e: Event) => { this._deviceQuery = (e.target as HTMLInputElement).value; }}
                class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <div class="flex flex-wrap gap-1.5">
                ${this._renderFilterChip('all', 'All')}
                ${this._renderFilterChip('phone', 'Phone')}
                ${this._renderFilterChip('tablet', 'Tablet')}
                ${this._renderFilterChip('favorites', '★ Favourites')}
              </div>
              <div class="grid grid-cols-2 gap-2">
                ${this._renderDeviceGroups(filteredDevices)}
              </div>
            </section>

            <!-- Custom viewport -->
            <section class="flex flex-col gap-3">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Custom viewport</h3>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  min="200"
                  max="3840"
                  aria-label="Viewport width"
                  .value=${String(this._customW)}
                  @input=${(e: Event) => { this._customW = Number((e.target as HTMLInputElement).value); }}
                  class="w-20 rounded-md border border-slate-300 bg-white px-2.5 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <span class="text-slate-400">×</span>
                <input
                  type="number"
                  min="200"
                  max="3840"
                  aria-label="Viewport height"
                  .value=${String(this._customH)}
                  @input=${(e: Event) => { this._customH = Number((e.target as HTMLInputElement).value); }}
                  class="w-20 rounded-md border border-slate-300 bg-white px-2.5 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  @click=${() => this._applyCustomViewport()}
                  class="ml-auto rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >Apply</button>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-xs text-slate-500 dark:text-slate-400">Stage zoom</span>
                <input
                  type="range"
                  min="0.2"
                  max="2"
                  step="0.01"
                  aria-label="Stage zoom"
                  .value=${String(this._stageScale)}
                  @input=${(e: Event) => this._setStageScale(Number((e.target as HTMLInputElement).value))}
                  class="flex-1 accent-red-600"
                />
                <span class="w-10 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">${scalePercent}%</span>
              </div>
            </section>

            <!-- Readiness report -->
            <section class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Readiness report</h3>
                ${readiness.failing.length > 0
                  ? html`<span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">${readiness.failing.length}</span>`
                  : null}
              </div>
              <div class="flex items-center gap-4 rounded-lg border p-4 ${readiness.score !== null && readiness.score < 80
                ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20'
                : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'}">
                ${readiness.score !== null
                  ? this._renderReadinessRing(readiness.score)
                  : html`<div class="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400 dark:border-slate-600">–</div>`}
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-slate-900 dark:text-white">
                    ${readiness.score === null
                      ? 'No readiness checks yet'
                      : readiness.failing.length > 0
                      ? 'Issues need attention'
                      : 'All checks passed'}
                  </p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    ${readiness.score === null
                      ? 'Results appear once the playable has been validated.'
                      : `${readiness.total - readiness.failing.length} of ${readiness.total} checks passed`}
                  </p>
                </div>
              </div>
              ${readiness.failing.length > 0 ? html`
                <ul class="flex flex-col gap-1.5 text-xs">
                  ${readiness.failing.slice(0, 5).map(check => html`
                    <li class="flex items-start gap-2 text-red-600 dark:text-red-400">
                      <span class="material-icons-outlined shrink-0" style="font-size:14px">error</span>
                      <span>${check.name}</span>
                    </li>
                  `)}
                </ul>
              ` : null}
            </section>

            ${this._renderSidePanels()}
          </aside>
        </div>

        ${BACKEND_FEATURES_ENABLED ? html`<save-creative-modal id="save-modal"></save-creative-modal>` : null}
        <preview-video-modal id="preview-video-modal"></preview-video-modal>
        <recordings-list-modal id="recordings-list-modal"></recordings-list-modal>
      </div>
    `;
  }
}
