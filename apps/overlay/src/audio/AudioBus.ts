import { STRINGS_VI, type AudioVolumes } from '@but-oi/shared';

export type SfxKey =
  | 'wind_gust'
  | 'chime_soft'
  | 'staff_tap'
  | 'firefly_twinkle'
  | 'water_bloop'
  | 'sparrow'
  | 'page_glow';

export class AudioBus {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private timeData: Uint8Array<ArrayBuffer> | null = null;

  private bgmAudio: HTMLAudioElement | null = null;
  private currentBgmKey: 'bgm.day' | 'bgm.night' | null = null;
  private currentVoiceAudio: HTMLAudioElement | null = null;

  private volumes: AudioVolumes = {
    bgm: 0.35,
    sfx: 0.8,
    voice: 1.0,
  };
  private isDucked = false;
  private duckFactor = 1.0;
  private duckAnimFrame: number | null = null;
  private restoreTimer: ReturnType<typeof setTimeout> | null = null;
  private unlockBtn: HTMLButtonElement | null = null;

  private audioSrcMap: Record<string, string> = {};

  public init(audioManifest: Record<string, { src: string; loop?: boolean; volume?: number }>): void {
    for (const [k, v] of Object.entries(audioManifest)) {
      this.audioSrcMap[k] = v.src;
    }
    this.ensureContext();
  }

  private ensureContext(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.timeData = new Uint8Array(this.analyser.frequencyBinCount);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        this.showUnlockButton();
      });
      setTimeout(() => {
        if (this.ctx?.state === 'suspended') {
          this.showUnlockButton();
        }
      }, 500);
    }
  }

  private showUnlockButton(): void {
    if (typeof document === 'undefined' || this.unlockBtn) return;
    const btn = document.createElement('button');
    btn.textContent = STRINGS_VI.ENABLE_AUDIO_BUTTON;
    btn.style.cssText =
      'position:fixed;top:24px;right:24px;z-index:9999;padding:12px 24px;' +
      'background:#0E1719;color:#F0DCA0;border:2px solid #D4AF5A;border-radius:10px;' +
      'font-family:"Be Vietnam Pro",sans-serif;font-size:18px;font-weight:700;cursor:pointer;';
    btn.onclick = () => {
      void this.ctx?.resume();
      if (this.bgmAudio && this.bgmAudio.paused) {
        void this.bgmAudio.play().catch(() => {});
      }
      btn.remove();
      this.unlockBtn = null;
    };
    document.body.appendChild(btn);
    this.unlockBtn = btn;
  }

  public setVolumes(partial: Partial<AudioVolumes>): void {
    this.volumes = { ...this.volumes, ...partial };
    this.applyBgmVolume();
    if (this.currentVoiceAudio) {
      this.currentVoiceAudio.volume = Math.max(0, Math.min(1, this.volumes.voice));
    }
  }

  public playBgm(key: 'bgm.day' | 'bgm.night'): void {
    if (this.currentBgmKey === key && this.bgmAudio) return;
    this.currentBgmKey = key;
    const src = this.audioSrcMap[key];
    if (!src || typeof Audio === 'undefined') return;

    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }
    const audio = new Audio(src);
    audio.loop = true;
    this.bgmAudio = audio;
    this.applyBgmVolume();
    void audio.play().catch(() => {
      this.showUnlockButton();
    });
  }

  public playSfx(name: SfxKey): void {
    const key = `sfx.${name}`;
    const src = this.audioSrcMap[key];
    if (!src || typeof Audio === 'undefined') return;

    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, this.volumes.sfx));
    void audio.play().catch(() => {});
  }

  /**
   * Phát thoại của Bụt kèm ducking nhạc nền xuống 40% trong 300ms, trả lại sau 500ms.
   * Không bao giờ chồng 2 câu thoại cùng lúc.
   */
  public async playVoice(audioUrl: string, fallbackDurationMs = 3000): Promise<void> {
    this.stopCurrentVoice();
    this.duckBgm(true);

    try {
      if (!audioUrl || typeof Audio === 'undefined') {
        await new Promise((r) => setTimeout(r, fallbackDurationMs));
        return;
      }

      await new Promise<void>((resolve) => {
        const audio = new Audio(audioUrl);
        audio.crossOrigin = 'anonymous';
        audio.volume = Math.max(0, Math.min(1, this.volumes.voice));
        this.currentVoiceAudio = audio;

        if (this.ctx && this.analyser) {
          try {
            const srcNode = this.ctx.createMediaElementSource(audio);
            srcNode.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);
          } catch {
            // ignore CORS / media element reuse error
          }
        }

        const safetyTimer = setTimeout(() => {
          resolve();
        }, fallbackDurationMs + 1500);

        audio.onended = () => {
          clearTimeout(safetyTimer);
          resolve();
        };
        audio.onerror = () => {
          clearTimeout(safetyTimer);
          setTimeout(resolve, fallbackDurationMs);
        };

        audio.play().catch(() => {
          clearTimeout(safetyTimer);
          setTimeout(resolve, fallbackDurationMs);
        });
      });
    } finally {
      this.currentVoiceAudio = null;
      if (this.restoreTimer) clearTimeout(this.restoreTimer);
      this.restoreTimer = setTimeout(() => {
        this.duckBgm(false);
      }, 500);
    }
  }

  public stopCurrentVoice(): void {
    if (this.currentVoiceAudio) {
      try {
        this.currentVoiceAudio.pause();
        this.currentVoiceAudio.currentTime = 0;
      } catch {
        // ignore
      }
      this.currentVoiceAudio = null;
    }
  }

  /**
   * Ducking nhạc nền xuống 40% trong 300ms khi có thoại
   */
  public duckBgm(duck: boolean): void {
    this.isDucked = duck;
    const targetFactor = duck ? 0.4 : 1.0;
    const startFactor = this.duckFactor;
    const durationMs = 300;
    const startTime = performance.now();

    if (this.duckAnimFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.duckAnimFrame);
    }

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      this.duckFactor = startFactor + (targetFactor - startFactor) * t;
      this.applyBgmVolume();
      if (t < 1 && typeof requestAnimationFrame !== 'undefined') {
        this.duckAnimFrame = requestAnimationFrame(step);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.duckAnimFrame = requestAnimationFrame(step);
    } else {
      this.duckFactor = targetFactor;
      this.applyBgmVolume();
    }
  }

  private applyBgmVolume(): void {
    if (!this.bgmAudio) return;
    this.bgmAudio.volume = Math.max(0, Math.min(1, this.volumes.bgm * this.duckFactor));
  }

  /**
   * Đo biên độ âm thanh RMS (0..1) từ AnalyserNode để đồng bộ râu Bụt (0-4 độ)
   */
  public getVoiceRms(): number {
    if (!this.currentVoiceAudio || this.currentVoiceAudio.paused) {
      return 0;
    }
    if (!this.analyser || !this.timeData) {
      // Dao động mô phỏng tự nhiên nếu trình duyệt chặn WebAudio CORS
      return 0.35 + 0.35 * Math.abs(Math.sin(performance.now() * 0.014));
    }

    this.analyser.getByteTimeDomainData(this.timeData);
    let sumSq = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const norm = (this.timeData[i]! - 128) / 128;
      sumSq += norm * norm;
    }
    const rms = Math.sqrt(sumSq / this.timeData.length);
    if (rms < 0.01) {
      return 0.3 + 0.3 * Math.abs(Math.sin(performance.now() * 0.014));
    }
    return Math.min(1, rms * 3.5);
  }

  public isVoicePlaying(): boolean {
    return Boolean(this.currentVoiceAudio && !this.currentVoiceAudio.paused);
  }

  public getIsDucked(): boolean {
    return this.isDucked;
  }
}

export const audioBus = new AudioBus();

