(() => {
  'use strict';

  if (window.__andreaUniverseInitialized) return;
  window.__andreaUniverseInitialized = true;

  /* CONFIG */
  const CONFIG = Object.freeze({
    sceneCount: 10,
    readingPace: 1.35,
    transitionMs: 820,
    transitionLowMs: 560,
    audioSource: './cancion/algo-que-se-quede.mp3',
    audioVolume: 0.22,
    audioFadeMs: 3000,
    shootingMinMs: 12000,
    shootingMaxMs: 20000
  });

  const STORAGE_KEYS = Object.freeze({
    started: 'experienceStarted',
    scene: 'currentScene',
    musicTime: 'musicCurrentTime',
    musicMuted: 'musicMuted',
    interactive: 'interactiveState'
  });

  const SUNFLOWER_WORDS = Object.freeze([
    'Escucharte',
    'Buscarte',
    'Proponer',
    'Estar',
    'Aprender',
    'Cuidar',
    'Sorprender',
    'Demostrar'
  ]);

  const CONSTELLATION_POSITIONS = Object.freeze([
    [13, 61], [29, 27], [47, 44], [65, 19], [84, 48], [64, 79]
  ]);

  const ANDREA_LAYOUT = Object.freeze([
    { letter: 'A', points: [[0, 6], [.7, 3.9], [1.35, 1.8], [2, 0], [2.65, 1.8], [3.3, 3.9], [4, 6], [1, 3.55], [3, 3.55]] },
    { letter: 'N', points: [[0, 6], [0, 3], [0, 0], [1, 1.5], [2, 3], [3, 4.5], [4, 6], [4, 3], [4, 0]] },
    { letter: 'D', points: [[0, 0], [0, 2], [0, 4], [0, 6], [1.25, 0], [3.35, .75], [4, 3], [3.35, 5.25], [1.25, 6]] },
    { letter: 'R', points: [[0, 6], [0, 4], [0, 2], [0, 0], [1.35, 0], [3.55, .8], [3.45, 2.35], [1.35, 3], [2.6, 3.55], [4, 6]] },
    { letter: 'E', points: [[0, 0], [0, 2], [0, 4], [0, 6], [2, 0], [4, 0], [3.6, 3], [4, 6]] },
    { letter: 'A', points: [[0, 6], [.7, 3.9], [1.35, 1.8], [2, 0], [2.65, 1.8], [3.3, 3.9], [4, 6], [1, 3.55], [3, 3.55]] }
  ]);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);
  const number = (value, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function seeded(index, salt = 0) {
    const raw = Math.sin((index + 1) * 12.9898 + (salt + 1) * 78.233) * 43758.5453;
    return raw - Math.floor(raw);
  }

  const motionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false, addEventListener: null };
  const memory = number(navigator.deviceMemory, 8);

  function createInteractiveState() {
    return {
      version: 2,
      sceneStatus: Array(CONFIG.sceneCount).fill('unplayed'),
      reveals: {},
      insight: false,
      proof: false,
      sunflowerBloomed: false,
      sunflowerPetals: [],
      sunflowerCenter: false,
      future: false,
      universeReady: false,
      constellationVisited: [],
      secret: false,
      andrea: false,
      final: false
    };
  }

  const state = {
    reducedMotion: Boolean(motionQuery.matches),
    lowPerformance: Boolean(motionQuery.matches) || memory <= 4,
    started: false,
    currentScene: 0,
    interactive: createInteractiveState(),
    runtime: null,
    suspended: false,
    pausedAnimations: [],
    lastDialogTrigger: null
  };

  function duration(milliseconds) {
    return state.reducedMotion ? Math.min(220, Math.round(milliseconds * .06)) : milliseconds;
  }

  /* STORAGE */
  const Storage = {
    get(key) {
      try {
        return window.sessionStorage.getItem(key);
      } catch (_error) {
        return null;
      }
    },

    set(key, value) {
      try {
        window.sessionStorage.setItem(key, String(value));
      } catch (_error) {
        // Private or full storage must never block the experience.
      }
    },

    remove(key) {
      try {
        window.sessionStorage.removeItem(key);
      } catch (_error) {
        // Ignore unavailable storage.
      }
    },

    readJson(key) {
      try {
        const raw = this.get(key);
        return raw ? JSON.parse(raw) : null;
      } catch (_error) {
        return null;
      }
    },

    saveInteractive() {
      this.set(STORAGE_KEYS.interactive, JSON.stringify(state.interactive));
    },

    flush() {
      this.set(STORAGE_KEYS.started, state.started ? 'true' : 'false');
      this.set(STORAGE_KEYS.scene, state.currentScene);
      this.saveInteractive();
      Audio.saveTime();
    }
  };

  function normalizeInteractive(raw) {
    const clean = createInteractiveState();
    if (!raw || typeof raw !== 'object') return clean;

    clean.sceneStatus = Array.from({ length: CONFIG.sceneCount }, (_item, index) => {
      const candidate = Array.isArray(raw.sceneStatus) ? raw.sceneStatus[index] : null;
      return ['unplayed', 'playing', 'complete'].includes(candidate) ? candidate : 'unplayed';
    });
    clean.reveals = raw.reveals && typeof raw.reveals === 'object' ? { ...raw.reveals } : {};
    ['insight', 'proof', 'sunflowerBloomed', 'sunflowerCenter', 'future', 'universeReady', 'secret', 'andrea', 'final'].forEach((key) => {
      clean[key] = Boolean(raw[key]);
    });
    clean.sunflowerPetals = Array.isArray(raw.sunflowerPetals)
      ? [...new Set(raw.sunflowerPetals.map((value) => Math.trunc(number(value, -1))).filter((value) => value >= 0 && value < 8))]
      : [];
    clean.constellationVisited = Array.isArray(raw.constellationVisited)
      ? [...new Set(raw.constellationVisited.map((value) => Math.trunc(number(value, -1))).filter((value) => value >= 0 && value < 6))]
      : [];
    return clean;
  }

  function migrateLegacyStorage() {
    if (Storage.get(STORAGE_KEYS.scene) !== null) return;
    const legacyScene = Storage.get('lastScene');
    const legacyInteractive = Storage.readJson('endingState');
    if (legacyScene === null && !legacyInteractive) return;

    const legacyMap = {
      '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 4,
      '6': 5, '7': 6, '8': 6, '9': 7, '10': 8, '11': 8,
      '12': 8, '13': 8, closing: 9, finale: 9
    };
    const migratedScene = legacyMap[String(legacyScene)] ?? 1;
    const migrated = createInteractiveState();

    for (let index = 0; index < migratedScene; index += 1) migrated.sceneStatus[index] = 'complete';
    migrated.sceneStatus[migratedScene] = migratedScene === 9 && legacyInteractive?.finale ? 'complete' : 'playing';

    if (legacyInteractive) {
      migrated.insight = Boolean(legacyInteractive.insight);
      migrated.proof = Boolean(legacyInteractive.proof);
      migrated.sunflowerBloomed = migratedScene > 4 || Boolean(legacyInteractive.sunflowerCenter);
      migrated.sunflowerPetals = Array.isArray(legacyInteractive.sunflowerPetals) ? legacyInteractive.sunflowerPetals.slice(0, 8) : [];
      migrated.sunflowerCenter = Boolean(legacyInteractive.sunflowerCenter);
      migrated.future = Boolean(legacyInteractive.future);
      migrated.constellationVisited = Array.isArray(legacyInteractive.constellationVisited) ? legacyInteractive.constellationVisited.slice(0, 6) : [];
      migrated.universeReady = migratedScene > 7 || migrated.constellationVisited.length > 0;
      migrated.secret = Boolean(legacyInteractive.secret);
      migrated.andrea = Boolean(legacyInteractive.andrea);
      migrated.final = Boolean(legacyInteractive.finale);
    }

    Storage.set(STORAGE_KEYS.scene, migratedScene);
    Storage.set(STORAGE_KEYS.interactive, JSON.stringify(migrated));
    Storage.set(STORAGE_KEYS.musicMuted, 'false');
    Storage.remove('lastScrollPosition');
    Storage.remove('lastScene');
    Storage.remove('endingState');
  }

  function loadState() {
    migrateLegacyStorage();
    state.started = Storage.get(STORAGE_KEYS.started) === 'true';
    state.interactive = normalizeInteractive(Storage.readJson(STORAGE_KEYS.interactive));
    state.currentScene = state.started
      ? clamp(Math.trunc(number(Storage.get(STORAGE_KEYS.scene), 1)), 0, CONFIG.sceneCount - 1)
      : 0;

    if (state.started) {
      state.interactive.sceneStatus[0] = 'complete';
      for (let index = 0; index < state.currentScene; index += 1) {
        state.interactive.sceneStatus[index] = 'complete';
      }
    }
    Storage.remove('lastScrollPosition');
    Storage.remove('lastScene');
    Storage.remove('endingState');
  }

  /* SCENE RUNTIME */
  class SceneRuntime {
    constructor(index) {
      this.index = index;
      this.items = new Set();
      this.animations = new Set();
      this.groups = new Set();
      this.paused = false;
      this.cleared = false;
    }

    after(delay, callback) {
      if (this.cleared) return null;
      const item = {
        callback,
        remaining: Math.max(0, delay),
        startedAt: 0,
        id: 0
      };
      this.items.add(item);
      this.arm(item);
      return item;
    }

    arm(item) {
      if (this.paused || this.cleared) return;
      item.startedAt = performance.now();
      item.id = window.setTimeout(() => {
        this.items.delete(item);
        item.id = 0;
        if (!this.cleared) item.callback();
      }, item.remaining);
    }

    track(animation) {
      if (!animation) return animation;
      this.animations.add(animation);
      animation.finished.finally(() => this.animations.delete(animation)).catch(() => {});
      return animation;
    }

    pause() {
      if (this.paused || this.cleared) return;
      this.paused = true;
      const now = performance.now();
      this.items.forEach((item) => {
        if (!item.id) return;
        window.clearTimeout(item.id);
        item.id = 0;
        item.remaining = Math.max(0, item.remaining - (now - item.startedAt));
      });
      this.animations.forEach((animation) => {
        try {
          if (animation.playState === 'running') animation.pause();
        } catch (_error) {}
      });
    }

    resume() {
      if (!this.paused || this.cleared) return;
      this.paused = false;
      this.items.forEach((item) => this.arm(item));
      this.animations.forEach((animation) => {
        try {
          if (animation.playState === 'paused') animation.play();
        } catch (_error) {}
      });
    }

    clear() {
      if (this.cleared) return;
      this.cleared = true;
      this.items.forEach((item) => {
        if (item.id) window.clearTimeout(item.id);
      });
      this.items.clear();
      this.animations.forEach((animation) => {
        try { animation.cancel(); } catch (_error) {}
      });
      this.animations.clear();
      this.groups.clear();
    }
  }

  function currentRuntime(index = state.currentScene) {
    return state.runtime && state.runtime.index === index ? state.runtime : null;
  }

  /* AUDIO */
  const Audio = {
    element: null,
    toggle: null,
    resumeButton: null,
    attached: false,
    seekApplied: false,
    available: true,
    playPending: false,
    fadeFrame: 0,
    savedAt: 0,

    init() {
      this.element = $('#background-music');
      this.toggle = $('#audio-toggle');
      this.resumeButton = $('#resume-audio');
      if (!this.element || !this.toggle || !this.resumeButton) return;

      this.element.removeAttribute('src');
      this.element.dataset.src = CONFIG.audioSource;
      this.element.preload = 'metadata';
      this.element.loop = true;
      this.element.volume = 0;
      this.element.muted = Storage.get(STORAGE_KEYS.musicMuted) === 'true';
      Storage.set(STORAGE_KEYS.musicMuted, this.element.muted ? 'true' : 'false');

      this.element.addEventListener('timeupdate', () => {
        const now = performance.now();
        if (now - this.savedAt > 900) {
          this.savedAt = now;
          this.saveTime();
        }
      });
      this.element.addEventListener('playing', () => this.updateControls());
      this.element.addEventListener('pause', () => this.updateControls());
      this.element.addEventListener('error', () => {
        this.available = false;
        this.cancelFade();
        this.resumeButton.hidden = true;
        this.toggle.hidden = true;
      });

      this.toggle.addEventListener('click', () => this.toggleMute());
      this.resumeButton.addEventListener('click', () => this.playFromGesture());
      this.updateControls();
    },

    attach() {
      if (!this.element || this.attached || !this.available) return;
      this.attached = true;
      this.element.src = this.element.dataset.src || CONFIG.audioSource;
      this.element.load();
      const applySavedTime = () => this.applySavedTime();
      this.element.addEventListener('loadedmetadata', applySavedTime, { once: true });
    },

    applySavedTime() {
      if (!this.element || this.seekApplied) return;
      const saved = Math.max(0, number(Storage.get(STORAGE_KEYS.musicTime), 0));
      if (!saved) {
        this.seekApplied = true;
        return;
      }
      if (this.element.readyState < 1) return;
      try {
        const limit = Number.isFinite(this.element.duration) ? Math.max(0, this.element.duration - .25) : saved;
        this.element.currentTime = Math.min(saved, limit);
        this.seekApplied = true;
      } catch (_error) {}
    },

    async playFromGesture() {
      if (!this.element || !this.available || this.playPending) return;
      this.playPending = true;
      this.resumeButton.disabled = true;
      this.attach();
      this.applySavedTime();
      this.element.muted = false;
      Storage.set(STORAGE_KEYS.musicMuted, 'false');
      this.element.volume = Math.min(this.element.volume, .01);
      try {
        await this.element.play();
        this.resumeButton.hidden = true;
        this.fadeToTarget();
      } catch (_error) {
        this.resumeButton.hidden = !state.started || !this.available;
      } finally {
        this.playPending = false;
        this.resumeButton.disabled = false;
      }
      this.updateControls();
    },

    fadeToTarget() {
      if (!this.element || this.element.paused || this.element.muted) return;
      this.cancelFade();
      if (state.reducedMotion) {
        this.element.volume = CONFIG.audioVolume;
        return;
      }
      const initial = this.element.volume;
      const startedAt = performance.now();
      const tick = (now) => {
        const progress = clamp((now - startedAt) / CONFIG.audioFadeMs, 0, 1);
        this.element.volume = initial + (CONFIG.audioVolume - initial) * (1 - Math.pow(1 - progress, 3));
        if (progress < 1 && !document.hidden) this.fadeFrame = requestAnimationFrame(tick);
        else this.fadeFrame = 0;
      };
      this.fadeFrame = requestAnimationFrame(tick);
    },

    cancelFade() {
      if (this.fadeFrame) cancelAnimationFrame(this.fadeFrame);
      this.fadeFrame = 0;
    },

    async toggleMute() {
      if (!this.element || !this.available) return;
      if (this.element.muted) {
        this.element.muted = false;
        Storage.set(STORAGE_KEYS.musicMuted, 'false');
        if (this.element.paused) await this.playFromGesture();
        else this.fadeToTarget();
      } else {
        this.element.muted = true;
        Storage.set(STORAGE_KEYS.musicMuted, 'true');
        this.resumeButton.hidden = true;
      }
      this.updateControls();
    },

    updateControls() {
      if (!this.element || !this.toggle) return;
      const muted = this.element.muted;
      this.toggle.hidden = !state.started || !this.available;
      this.toggle.setAttribute('aria-pressed', muted ? 'true' : 'false');
      this.toggle.setAttribute('aria-label', muted ? 'Activar música' : 'Silenciar música');
      const icon = $('[data-audio-icon]', this.toggle);
      const label = $('[data-audio-label]', this.toggle);
      if (icon) icon.textContent = muted ? '×' : '♪';
      if (label) label.textContent = muted ? 'Música silenciada' : 'Música activada';
    },

    offerResume() {
      if (!this.element || !this.resumeButton || !state.started || this.element.muted || !this.available || this.playPending) return;
      if (this.element.paused) this.resumeButton.hidden = false;
    },

    saveTime() {
      if (!this.element || !Number.isFinite(this.element.currentTime)) return;
      if (!this.attached && this.element.currentTime === 0 && Storage.get(STORAGE_KEYS.musicTime) !== null) return;
      Storage.set(STORAGE_KEYS.musicTime, Math.max(0, this.element.currentTime).toFixed(2));
    },

    suspend() {
      this.saveTime();
      this.cancelFade();
    },

    resume() {
      if (this.element && !this.element.paused && !this.element.muted) this.fadeToTarget();
      else this.offerResume();
    }
  };

  /* AMBIENT UNIVERSE */
  const Ambient = {
    field: null,
    shootingStar: null,
    shootingTimer: 0,
    shootingResetTimer: 0,
    orientationFrame: 0,
    suspended: false,

    init() {
      this.field = $('#star-field');
      this.shootingStar = $('#ambient-shooting-star');
      this.syncStars();
      this.scheduleShootingStar();
      this.initOrientation();
      window.addEventListener('resize', () => {
        this.syncStars();
        if (state.currentScene === 6 && state.interactive.future) finishFuture();
      }, { passive: true });
    },

    starTarget() {
      const shortSide = Math.min(window.innerWidth, window.innerHeight);
      if (state.lowPerformance || shortSide <= 360) return 22;
      if (window.innerWidth <= 600 || shortSide <= 430) return 30;
      return 40;
    },

    syncStars() {
      if (!this.field) return;
      const target = this.starTarget();
      let stars = $$('[data-ambient-star]', this.field);
      while (stars.length > target) stars.pop().remove();
      if (stars.length >= target) return;

      const fragment = document.createDocumentFragment();
      for (let index = stars.length; index < target; index += 1) {
        const star = document.createElement('span');
        const size = .9 + seeded(index, 2) * 2.15;
        star.className = 'ambient-star';
        star.dataset.ambientStar = '';
        star.style.left = (2 + seeded(index, 3) * 96).toFixed(2) + '%';
        star.style.top = (2 + seeded(index, 4) * 96).toFixed(2) + '%';
        star.style.setProperty('--star-size', size.toFixed(2) + 'px');
        star.style.setProperty('--star-low', (.08 + seeded(index, 5) * .18).toFixed(2));
        star.style.setProperty('--star-high', (.38 + seeded(index, 6) * .5).toFixed(2));
        star.style.setProperty('--star-duration', (4.8 + seeded(index, 7) * 5.2).toFixed(2) + 's');
        star.style.setProperty('--star-delay', (-seeded(index, 8) * 7).toFixed(2) + 's');
        fragment.appendChild(star);
      }
      this.field.appendChild(fragment);
    },

    scheduleShootingStar() {
      if (!state.started || state.reducedMotion || this.suspended || !this.shootingStar) return;
      window.clearTimeout(this.shootingTimer);
      const delay = CONFIG.shootingMinMs + Math.random() * (CONFIG.shootingMaxMs - CONFIG.shootingMinMs);
      this.shootingTimer = window.setTimeout(() => {
        this.triggerShootingStar();
        this.scheduleShootingStar();
      }, delay);
    },

    triggerShootingStar() {
      if (!this.shootingStar || state.reducedMotion || this.shootingStar.classList.contains('is-active')) return;
      this.shootingStar.style.setProperty('--shoot-y', (10 + Math.random() * 42).toFixed(1) + '%');
      this.shootingStar.classList.remove('is-active');
      void this.shootingStar.offsetWidth;
      this.shootingStar.classList.add('is-active');
      window.clearTimeout(this.shootingResetTimer);
      this.shootingResetTimer = window.setTimeout(() => this.shootingStar.classList.remove('is-active'), 1400);
    },

    initOrientation() {
      if (state.lowPerformance || state.reducedMotion || typeof window.DeviceOrientationEvent === 'undefined') return;
      if (typeof window.DeviceOrientationEvent.requestPermission === 'function') return;
      window.addEventListener('deviceorientation', (event) => {
        if (this.orientationFrame || this.suspended) return;
        const gamma = number(event.gamma, 0);
        const beta = number(event.beta, 0);
        this.orientationFrame = requestAnimationFrame(() => {
          this.orientationFrame = 0;
          const universe = $('#ambient-universe');
          if (!universe) return;
          universe.style.setProperty('--parallax-x', clamp(gamma / 15, -3, 3).toFixed(2) + 'px');
          universe.style.setProperty('--parallax-y', clamp((beta - 45) / 25, -3, 3).toFixed(2) + 'px');
        });
      }, { passive: true });
    },

    pause() {
      if (this.suspended) return;
      this.suspended = true;
      window.clearTimeout(this.shootingTimer);
      window.clearTimeout(this.shootingResetTimer);
      this.shootingTimer = 0;
      this.shootingResetTimer = 0;
      this.shootingStar?.classList.remove('is-active');
      if (this.orientationFrame) cancelAnimationFrame(this.orientationFrame);
      this.orientationFrame = 0;
    },

    resume() {
      if (state.reducedMotion || document.hidden) return;
      this.suspended = false;
      this.scheduleShootingStar();
    }
  };

  /* NARRATIVE TIMELINE */
  function timelineKey(timeline) {
    const scene = timeline.closest('[data-scene-index]');
    return (scene?.dataset.sceneIndex || '0') + ':' + (timeline.dataset.timeline || 'main');
  }

  function timelineBeats(timeline) {
    return $$(':scope > [data-beat]', timeline);
  }

  function storedRevealCount(timeline) {
    return clamp(Math.trunc(number(state.interactive.reveals[timelineKey(timeline)], 0)), 0, timelineBeats(timeline).length);
  }

  function saveRevealCount(timeline, count) {
    state.interactive.reveals[timelineKey(timeline)] = count;
    Storage.saveInteractive();
  }

  function renderTimeline(timeline, count, applyCues = false) {
    const beats = timelineBeats(timeline);
    const current = count - 1;
    timeline.classList.toggle('has-history', current > 0);

    beats.forEach((beat, index) => {
      const isRevealed = index < count;
      const distance = current - index;
      beat.hidden = !isRevealed;
      beat.classList.toggle('is-revealed', isRevealed);
      beat.classList.toggle('is-current-line', isRevealed && distance === 0);
      beat.classList.toggle('is-past-line', isRevealed && distance > 0);
      beat.classList.toggle('history-1', isRevealed && distance === 1);
      beat.classList.toggle('history-2', false);
      beat.classList.toggle('is-retired-line', isRevealed && distance > 1);
      beat.setAttribute('aria-hidden', isRevealed && distance <= 1 ? 'false' : 'true');
      if (applyCues && isRevealed && beat.dataset.cue) handleCue(beat.dataset.cue, true);
    });
  }

  function revealBeat(timeline, index) {
    const count = Math.max(storedRevealCount(timeline), index + 1);
    saveRevealCount(timeline, count);
    renderTimeline(timeline, count);
    const beat = timelineBeats(timeline)[index];
    if (beat?.dataset.cue) handleCue(beat.dataset.cue, false);
  }

  function revealEntireTimeline(timeline) {
    const count = timelineBeats(timeline).length;
    saveRevealCount(timeline, count);
    renderTimeline(timeline, count, true);
  }

  function playTimeline(timeline, onComplete = () => {}) {
    const runtime = currentRuntime();
    if (!timeline || !runtime) return;
    const key = timelineKey(timeline);
    if (runtime.groups.has(key)) return;
    runtime.groups.add(key);
    const pace = clamp(number(timeline.dataset.pace, CONFIG.readingPace), 1, 1.7);

    const beats = timelineBeats(timeline);
    const count = storedRevealCount(timeline);
    renderTimeline(timeline, count, true);
    if (!beats.length) {
      onComplete();
      return;
    }

    let cursor = 0;
    let previousAt = count > 0 ? number(beats[count - 1]?.dataset.at, 0) : 0;
    for (let index = count; index < beats.length; index += 1) {
      const at = number(beats[index].dataset.at, previousAt);
      let gap = at - previousAt;
      if (index === count && count > 0) gap = clamp(gap, 320, 720);
      if (index === 0) gap = at;
      cursor += duration(Math.max(0, gap) * pace);
      runtime.after(cursor, () => revealBeat(timeline, index));
      previousAt = at;
    }

    const finalAt = number(beats[beats.length - 1].dataset.at, 0);
    const completeAt = Math.max(finalAt, number(timeline.dataset.completeAt, finalAt + 900));
    const tail = Math.max(120, completeAt - finalAt);
    runtime.after(cursor + duration(tail * pace), onComplete);
  }

  function handleCue(cue, restoring) {
    const scene = SceneController.activeScene();
    if (!scene) return;
    if (cue === 'love') {
      scene.classList.add('love-is-visible');
      document.body.classList.add('love-is-visible');
    }
    if (cue === 'future') animateFuture(restoring);
    if (cue === 'andrea-light') $('#andrea-stars')?.classList.add('is-illuminated');
    if (cue === 'joke' && !restoring) {
      currentRuntime()?.after(duration(720), () => Ambient.triggerShootingStar());
    }
    if (cue === 'constellation') {
      scene.classList.add('constellation-is-visible');
      updateConstellation();
    }
  }

  function showSceneAction(scene) {
    const action = scene?.matches('[data-scene-index="0"]') ? $('[data-enter]', scene) : $('[data-scene-next]', scene);
    if (!action) return;
    action.hidden = false;
    const reveal = () => action.classList.add('is-ready');
    const runtime = currentRuntime(number(scene.dataset.sceneIndex, state.currentScene));
    if (runtime) runtime.after(16, reveal);
    else reveal();
    if (scene.dataset.sceneIndex === '0' && state.started) action.firstChild.textContent = 'Continuar ';
  }

  function completeScene(index) {
    state.interactive.sceneStatus[index] = 'complete';
    if (index === 9) {
      state.interactive.final = true;
      SceneController.scenes[index].classList.add('is-complete');
    } else {
      showSceneAction(SceneController.scenes[index]);
    }
    Storage.saveInteractive();
  }

  /* TAP FEEDBACK */
  function initTapFeedback() {
    document.addEventListener('pointerdown', (event) => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      button.classList.add('is-tapped');
      const rectangle = button.getBoundingClientRect();
      const glow = document.createElement('span');
      glow.className = 'tap-glow';
      glow.style.left = (event.clientX - rectangle.left) + 'px';
      glow.style.top = (event.clientY - rectangle.top) + 'px';
      glow.setAttribute('aria-hidden', 'true');
      button.appendChild(glow);
      window.setTimeout(() => {
        button.classList.remove('is-tapped');
        glow.remove();
      }, 460);
    }, { passive: true });
  }

  /* SUNFLOWER */
  function svgElement(name, attributes = {}) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function sunflowerPoint(centerX, centerY, angle, radial, tangent = 0) {
    const radians = angle * Math.PI / 180;
    const radialX = Math.cos(radians);
    const radialY = Math.sin(radians);
    return [
      centerX + radialX * radial - radialY * tangent,
      centerY + radialY * radial + radialX * tangent
    ];
  }

  function pathPoint(point) {
    return point[0].toFixed(2) + ' ' + point[1].toFixed(2);
  }

  function createOrganicPetalPath(index, centerX, centerY) {
    const baseAngle = -90 + index * 15;
    const angle = baseAngle + (seeded(index, 31) - .5) * 4.6;
    const length = 77 + seeded(index, 32) * 22;
    const width = 9.5 + seeded(index, 33) * 6;
    const lean = (seeded(index, 34) - .5) * 8;
    const startLeft = sunflowerPoint(centerX, centerY, angle, 21, -4.5);
    const controlLeftOne = sunflowerPoint(centerX, centerY, angle, 43, -width);
    const controlLeftTwo = sunflowerPoint(centerX, centerY, angle, length * .76, -width * .6 + lean);
    const tip = sunflowerPoint(centerX, centerY, angle, length, lean * .28);
    const controlRightTwo = sunflowerPoint(centerX, centerY, angle, length * .7, width * .58 + lean);
    const controlRightOne = sunflowerPoint(centerX, centerY, angle, 41, width);
    const startRight = sunflowerPoint(centerX, centerY, angle, 21, 4.5);
    return 'M ' + pathPoint(startLeft)
      + ' C ' + pathPoint(controlLeftOne) + ', ' + pathPoint(controlLeftTwo) + ', ' + pathPoint(tip)
      + ' C ' + pathPoint(controlRightTwo) + ', ' + pathPoint(controlRightOne) + ', ' + pathPoint(startRight)
      + ' Q ' + centerX + ' ' + centerY + ', ' + pathPoint(startLeft) + ' Z';
  }

  function createSunflowerSvg(miniature = false) {
    const svg = svgElement('svg', {
      viewBox: '0 0 320 320',
      role: 'img',
      'aria-label': miniature ? 'Un pequeño girasol entre las estrellas' : 'Un girasol dorado creciendo entre las estrellas',
      preserveAspectRatio: 'xMidYMid meet'
    });
    svg.classList.add('sunflower-svg');
    if (miniature) svg.classList.add('sunflower-svg--miniature');

    const petals = svgElement('g', { class: 'sunflower-petals', 'aria-hidden': 'true' });
    const palette = ['#d99e32', '#e7b64c', '#c98728', '#efc663', '#dca63c', '#bc7924'];
    for (let index = 0; index < 24; index += 1) {
      const petal = svgElement('path', {
        d: createOrganicPetalPath(index, 160, 151),
        fill: palette[index % palette.length],
        class: 'sunflower-petal sunflower-petal--visual',
        'data-petal-index': index,
        opacity: (.72 + seeded(index, 35) * .24).toFixed(2)
      });
      petals.appendChild(petal);
    }
    svg.appendChild(petals);

    const originPoints = Array.from({ length: 10 }, (_item, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const radius = index % 2 ? 3.1 : 7;
      return (160 + Math.cos(angle) * radius).toFixed(2) + ',' + (151 + Math.sin(angle) * radius).toFixed(2);
    }).join(' ');
    svg.appendChild(svgElement('polygon', {
      points: originPoints, class: 'sunflower-origin', fill: '#e7b64c', 'aria-hidden': 'true'
    }));
    const center = svgElement('g', { class: 'sunflower-center-art', 'aria-hidden': 'true' });
    center.style.transformBox = 'fill-box';
    center.style.transformOrigin = 'center';
    center.appendChild(svgElement('circle', { cx: 160, cy: 151, r: 35, fill: '#3d281d', stroke: '#a86f28', 'stroke-width': 2.2 }));
    center.appendChild(svgElement('circle', { cx: 160, cy: 151, r: 29, fill: '#55331e', opacity: .96 }));
    for (let index = 0; index < 58; index += 1) {
      const radius = 3.55 * Math.sqrt(index);
      const angle = index * 137.508 * Math.PI / 180;
      center.appendChild(svgElement('circle', {
        cx: (160 + Math.cos(angle) * radius).toFixed(2),
        cy: (151 + Math.sin(angle) * radius).toFixed(2),
        r: (.9 + seeded(index, 38) * .72).toFixed(2),
        fill: index % 3 === 0 ? '#c68b38' : index % 3 === 1 ? '#8d5a28' : '#e0ad51',
        opacity: (.56 + seeded(index, 39) * .37).toFixed(2)
      }));
    }
    svg.appendChild(center);
    return svg;
  }

  function ensureSunflowerMemory() {
    const mount = $('#sunflower-memory');
    if (mount && !$('.sunflower-svg', mount)) mount.appendChild(createSunflowerSvg(true));
  }

  function buildSunflowerPetals() {
    const wrapper = $('#cosmic-sunflower');
    const hitLayer = $('[data-sunflower-petal-hits]', wrapper);
    const wordsLayer = $('[data-sunflower-words]', wrapper);
    if (!wrapper || !hitLayer || !wordsLayer || hitLayer.children.length) return;
    const selectedPetals = [0, 3, 6, 9, 12, 15, 18, 21];

    selectedPetals.forEach((petalIndex, index) => {
      const angle = -90 + petalIndex * 15;
      const radians = angle * Math.PI / 180;
      const x = 50 + Math.cos(radians) * 31;
      const y = 47.2 + Math.sin(radians) * 31;
      const button = document.createElement('button');
      const spark = document.createElement('span');
      button.type = 'button';
      button.className = 'sunflower-petal-hit';
      button.dataset.sunflowerPetal = '';
      button.dataset.index = String(index);
      button.setAttribute('aria-label', 'Revelar: ' + SUNFLOWER_WORDS[index]);
      button.setAttribute('aria-pressed', 'false');
      button.disabled = true;
      button.style.left = x.toFixed(2) + '%';
      button.style.top = y.toFixed(2) + '%';
      spark.className = 'sunflower-petal-hit__spark';
      spark.style.setProperty('--petal-angle', angle + 'deg');
      spark.setAttribute('aria-hidden', 'true');
      button.appendChild(spark);
      hitLayer.appendChild(button);

      const wordRadius = index % 2 ? 41 : 39;
      const word = document.createElement('span');
      word.className = 'sunflower-word';
      word.dataset.sunflowerWord = '';
      word.dataset.index = String(index);
      word.textContent = SUNFLOWER_WORDS[index];
      word.hidden = true;
      word.style.left = (50 + Math.cos(radians) * wordRadius).toFixed(2) + '%';
      word.style.top = (47.2 + Math.sin(radians) * wordRadius).toFixed(2) + '%';
      wordsLayer.appendChild(word);

      button.addEventListener('click', () => chooseSunflowerPetal(button, word, index));
    });
  }

  function chooseSunflowerPetal(button, word, index) {
    if (!state.interactive.sunflowerPetals.includes(index)) {
      state.interactive.sunflowerPetals.push(index);
      state.interactive.sunflowerPetals.sort((a, b) => a - b);
    }
    button.classList.add('is-chosen', 'is-pulsing');
    button.setAttribute('aria-pressed', 'true');
    word.hidden = false;
    const runtime = currentRuntime(4);
    if (runtime) {
      runtime.after(16, () => word.classList.add('is-visible'));
      runtime.after(340, () => button.classList.remove('is-pulsing'));
    } else {
      word.classList.add('is-visible');
      button.classList.remove('is-pulsing');
    }
    const announcer = $('#sunflower-word-live');
    if (announcer) announcer.textContent = SUNFLOWER_WORDS[index];
    if (state.interactive.sunflowerPetals.length >= 2) enableSunflowerCenter();
    Storage.saveInteractive();
  }

  function enableSunflowerPetals() {
    const wrapper = $('#cosmic-sunflower');
    if (!wrapper) return;
    wrapper.classList.add('petals-are-ready');
    $$('[data-sunflower-petal]', wrapper).forEach((button) => { button.disabled = false; });
    const instruction = $('#sunflower-explore-instruction');
    if (instruction) instruction.hidden = false;
  }

  function enableSunflowerCenter() {
    if (state.interactive.sunflowerCenter) return;
    const center = $('#sunflower-center');
    const instruction = $('#sunflower-center-instruction');
    if (!center) return;
    center.hidden = false;
    center.disabled = false;
    center.classList.add('is-ready');
    if (instruction) instruction.hidden = false;
  }

  function finishSunflowerBloom() {
    const wrapper = $('#cosmic-sunflower');
    if (!wrapper) return;
    $$('.sunflower-petal--visual, .sunflower-center-art, .sunflower-origin', wrapper).forEach((node) => {
      node.style.opacity = node.getAttribute('opacity') || '1';
      node.style.transform = 'none';
      node.style.willChange = '';
    });
    wrapper.classList.add('is-bloomed');
    wrapper.classList.remove('is-blooming');
    state.interactive.sunflowerBloomed = true;
    enableSunflowerPetals();
    ensureSunflowerMemory();
    Storage.saveInteractive();
    if (state.interactive.sunflowerPetals.length >= 2) enableSunflowerCenter();
    else currentRuntime(4)?.after(duration(4000), enableSunflowerCenter);
  }

  function startSunflowerBloom() {
    const wrapper = $('#cosmic-sunflower');
    const runtime = currentRuntime(4);
    if (!wrapper || !runtime) return;
    if (state.interactive.sunflowerBloomed) {
      finishSunflowerBloom();
      return;
    }
    wrapper.classList.add('is-blooming');
    const origin = $('.sunflower-origin', wrapper);
    const center = $('.sunflower-center-art', wrapper);
    const petals = $$('.sunflower-petal--visual', wrapper);
    if (state.reducedMotion || typeof Element.prototype.animate !== 'function') {
      finishSunflowerBloom();
      return;
    }

    if (origin) {
      origin.style.willChange = 'opacity, transform';
      runtime.track(origin.animate([
        { opacity: 0, transform: 'scale(.12)' }, { opacity: 1, transform: 'scale(1)' }
      ], { duration: 700, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'both' }));
    }
    if (center) {
      center.style.willChange = 'opacity, transform';
      runtime.track(center.animate([
        { opacity: 0, transform: 'scale(.08)' }, { opacity: 1, transform: 'scale(1)' }
      ], { duration: 1150, delay: 280, easing: 'cubic-bezier(.16,.72,.24,1)', fill: 'both' }));
    }
    petals.forEach((petal, index) => {
      petal.style.willChange = 'opacity, transform';
      runtime.track(petal.animate([
        { opacity: 0, transform: 'scale(.08) rotate(' + ((index % 2 ? 1 : -1) * 3) + 'deg)' },
        { opacity: number(petal.getAttribute('opacity'), .9), transform: 'scale(1) rotate(0deg)' }
      ], {
        duration: 780 + seeded(index, 41) * 210,
        delay: 470 + index * 68,
        easing: 'cubic-bezier(.17,.68,.2,1)',
        fill: 'both'
      }));
    });
    runtime.after(3100, finishSunflowerBloom);
  }

  function openSunflowerCenter() {
    if (state.interactive.sunflowerCenter) return;
    const wrapper = $('#cosmic-sunflower');
    const center = $('#sunflower-center');
    const revelation = $('#sunflower-revelation');
    const timeline = $('[data-timeline="sunflower"]', revelation);
    if (!wrapper || !center || !revelation || !timeline) return;
    state.interactive.sunflowerCenter = true;
    center.disabled = true;
    center.classList.add('is-open');
    center.setAttribute('aria-expanded', 'true');
    wrapper.classList.add('has-open-center');
    $$('[data-sunflower-petal]', wrapper).forEach((button) => { button.disabled = true; });
    $('#sunflower-explore-instruction').hidden = true;
    $('#sunflower-center-instruction').hidden = true;
    revelation.hidden = false;
    const runtime = currentRuntime(4);
    if (runtime) runtime.after(16, () => revelation.classList.add('is-active'));
    else revelation.classList.add('is-active');
    Storage.saveInteractive();
    playTimeline(timeline, () => completeScene(4));
  }

  function initSunflower() {
    const wrapper = $('#cosmic-sunflower');
    const mount = $('[data-sunflower-mount]', wrapper);
    if (!wrapper || !mount) return;
    if (!$('.sunflower-svg', mount)) mount.appendChild(createSunflowerSvg(false));
    buildSunflowerPetals();
    $('#sunflower-center')?.addEventListener('click', openSunflowerCenter);
  }

  function restoreSunflower() {
    const wrapper = $('#cosmic-sunflower');
    if (!wrapper) return;
    if (state.interactive.sunflowerBloomed || state.interactive.sunflowerCenter) finishSunflowerBloom();
    state.interactive.sunflowerPetals.forEach((index) => {
      const button = $('[data-sunflower-petal][data-index="' + index + '"]', wrapper);
      const word = $('[data-sunflower-word][data-index="' + index + '"]', wrapper);
      if (button) {
        button.classList.add('is-chosen');
        button.setAttribute('aria-pressed', 'true');
      }
      if (word) {
        word.hidden = false;
        word.classList.add('is-visible');
      }
    });
    if (state.interactive.sunflowerCenter) {
      const center = $('#sunflower-center');
      const revelation = $('#sunflower-revelation');
      wrapper.classList.add('has-open-center');
      if (center) {
        center.hidden = false;
        center.disabled = true;
        center.classList.add('is-open');
        center.setAttribute('aria-expanded', 'true');
      }
      $$('[data-sunflower-petal]', wrapper).forEach((button) => { button.disabled = true; });
      if (revelation) {
        revelation.hidden = false;
        revelation.classList.add('is-active');
      }
    } else if (state.interactive.sunflowerPetals.length >= 2) {
      enableSunflowerCenter();
    }
  }

  /* INSIGHT AND PROOF */
  function revealOrbitWords(container) {
    const runtime = currentRuntime();
    if (!container || !runtime) return;
    $$('span', container).forEach((word, index) => {
      runtime.after(duration(index * 120), () => word.classList.add('is-visible'));
    });
  }

  function restoreInsight() {
    if (!state.interactive.insight) return;
    const scene = $('#scene-2');
    const button = $('#insight-star');
    const result = $('#insight-result');
    scene.classList.add('is-interacted');
    button.disabled = true;
    button.setAttribute('aria-expanded', 'true');
    result.hidden = false;
    $$('[data-insight-word]', result).forEach((word) => word.classList.add('is-visible'));
  }

  function activateInsight() {
    if (state.interactive.insight) return;
    const scene = $('#scene-2');
    const button = $('#insight-star');
    const result = $('#insight-result');
    state.interactive.insight = true;
    scene.classList.add('is-interacted');
    button.disabled = true;
    button.setAttribute('aria-expanded', 'true');
    result.hidden = false;
    revealOrbitWords($('.insight-orbit', result));
    currentRuntime(2)?.after(duration(850), () => scene.classList.add('copy-is-speaking'));
    Storage.saveInteractive();
    playTimeline($('[data-timeline="insight"]', scene), () => completeScene(2));
  }

  function initInsight() {
    $('#insight-star')?.addEventListener('click', activateInsight);
  }

  function restoreProof() {
    if (!state.interactive.proof) return;
    const scene = $('#scene-3');
    const button = $('#proof-button');
    const result = $('#proof-result');
    scene.classList.add('is-interacted', 'copy-is-speaking');
    button.disabled = true;
    button.setAttribute('aria-expanded', 'true');
    result.hidden = false;
    $$('.proof-orbit span', result).forEach((word) => word.classList.add('is-visible'));
  }

  function activateProof() {
    if (state.interactive.proof) return;
    const scene = $('#scene-3');
    const button = $('#proof-button');
    const result = $('#proof-result');
    state.interactive.proof = true;
    scene.classList.add('is-interacted');
    button.disabled = true;
    button.setAttribute('aria-expanded', 'true');
    result.hidden = false;
    revealOrbitWords($('.proof-orbit', result));
    currentRuntime(3)?.after(duration(700), () => scene.classList.add('copy-is-speaking'));
    Storage.saveInteractive();
    playTimeline($('[data-timeline="proof"]', scene), () => completeScene(3));
  }

  function initProof() {
    $('#proof-button')?.addEventListener('click', activateProof);
  }

  /* FUTURE */
  function futureMetrics(stage) {
    const rectangle = stage.getBoundingClientRect();
    return { x: rectangle.width * .74, y: -rectangle.height * .18 };
  }

  function finishFuture() {
    const stage = $('#future-path');
    if (!stage) return;
    const movement = futureMetrics(stage);
    $$('[data-future-star]', stage).forEach((star) => {
      star.style.transform = 'translate3d(' + movement.x.toFixed(2) + 'px,' + movement.y.toFixed(2) + 'px,0)';
      star.style.opacity = '1';
      star.style.willChange = '';
    });
    $$('.future-route', stage).forEach((route) => {
      route.style.strokeDashoffset = '0';
      route.style.opacity = '.2';
      route.style.willChange = '';
    });
    stage.classList.add('is-aligned');
    state.interactive.future = true;
    Storage.saveInteractive();
  }

  function animateFuture(restoring = false) {
    const stage = $('#future-path');
    const runtime = currentRuntime(6);
    if (!stage) return;
    if (state.interactive.future) {
      finishFuture();
      return;
    }
    if (!runtime || stage.dataset.animating === 'true') return;
    stage.dataset.animating = 'true';
    const movement = futureMetrics(stage);
    if (state.reducedMotion || restoring || typeof Element.prototype.animate !== 'function') {
      finishFuture();
      return;
    }
    $$('[data-future-star]', stage).forEach((star, index) => {
      star.style.willChange = 'transform, opacity';
      runtime.track(star.animate([
        { opacity: .65, transform: 'translate3d(0,0,0)' },
        { opacity: 1, transform: 'translate3d(' + (movement.x * .5).toFixed(2) + 'px,' + (movement.y * .5 + (index ? 3 : -3)).toFixed(2) + 'px,0)', offset: .5 },
        { opacity: 1, transform: 'translate3d(' + movement.x.toFixed(2) + 'px,' + movement.y.toFixed(2) + 'px,0)' }
      ], { duration: 2700, delay: index * 80, easing: 'cubic-bezier(.38,0,.2,1)', fill: 'both' }));
    });
    $$('.future-route', stage).forEach((route, index) => {
      route.style.willChange = 'stroke-dashoffset, opacity';
      runtime.track(route.animate([
        { strokeDashoffset: 1, opacity: 0 }, { strokeDashoffset: 0, opacity: .2 }
      ], { duration: 2700, delay: index * 80, easing: 'ease-in-out', fill: 'both' }));
    });
    runtime.after(2860, finishFuture);
  }

  function resetFutureIfIncomplete() {
    if (state.interactive.future) return;
    const stage = $('#future-path');
    if (!stage) return;
    stage.dataset.animating = '';
    $$('[data-future-star]', stage).forEach((star) => {
      star.style.transform = '';
      star.style.opacity = '';
      star.style.willChange = '';
    });
    $$('.future-route', stage).forEach((route) => {
      route.style.strokeDashoffset = '';
      route.style.opacity = '';
      route.style.willChange = '';
    });
  }

  /* CONSTELLATION, GALAXY AND SECRET */
  function createConstellationLines() {
    const container = $('#constellation');
    if (!container || $('.constellation-lines', container)) return;
    const svg = svgElement('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', class: 'constellation-lines', 'aria-hidden': 'true' });
    [[0, 1], [1, 2], [2, 3], [2, 5], [3, 4], [4, 5]].forEach(([from, to]) => {
      svg.appendChild(svgElement('line', {
        x1: CONSTELLATION_POSITIONS[from][0], y1: CONSTELLATION_POSITIONS[from][1],
        x2: CONSTELLATION_POSITIONS[to][0], y2: CONSTELLATION_POSITIONS[to][1],
        class: 'constellation-line', 'data-from': from, 'data-to': to
      }));
    });
    container.insertBefore(svg, container.firstChild);
  }

  function updateConstellation() {
    const container = $('#constellation');
    if (!container) return;
    const visited = new Set(state.interactive.constellationVisited);
    $$('[data-constellation-star]', container).forEach((star) => {
      star.classList.toggle('is-visited', visited.has(Math.trunc(number(star.dataset.index, -1))));
    });
    $$('.constellation-line', container).forEach((line) => {
      line.classList.toggle('is-lit', visited.has(number(line.dataset.from, -1)) && visited.has(number(line.dataset.to, -1)));
    });
  }

  function openConstellation(star) {
    const panel = $('#constellation-panel');
    if (!panel) return;
    const index = Math.trunc(number(star.dataset.index, -1));
    if (!state.interactive.constellationVisited.includes(index)) state.interactive.constellationVisited.push(index);
    state.lastDialogTrigger = star;
    $('#constellation-title').textContent = star.dataset.title || '';
    $('#constellation-message').textContent = star.dataset.message || '';
    panel.hidden = false;
    star.setAttribute('aria-expanded', 'true');
    updateConstellation();
    Storage.saveInteractive();
    if (state.interactive.universeReady) completeScene(7);
    try { panel.focus({ preventScroll: true }); } catch (_error) {}
  }

  function closeConstellation() {
    const panel = $('#constellation-panel');
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    $$('[data-constellation-star]').forEach((star) => star.removeAttribute('aria-expanded'));
    try { state.lastDialogTrigger?.focus({ preventScroll: true }); } catch (_error) {}
    state.lastDialogTrigger = null;
  }

  function openSecret() {
    const trigger = $('#secret-star');
    const message = $('#secret-message');
    if (!trigger || !message) return;
    state.interactive.secret = true;
    state.lastDialogTrigger = trigger;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-found');
    message.hidden = false;
    Storage.saveInteractive();
    try { message.focus({ preventScroll: true }); } catch (_error) {}
  }

  function closeSecret() {
    const trigger = $('#secret-star');
    const message = $('#secret-message');
    if (!message || message.hidden) return;
    message.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
    try { state.lastDialogTrigger?.focus({ preventScroll: true }); } catch (_error) {}
    state.lastDialogTrigger = null;
  }

  function closeDialogs() {
    closeConstellation();
    closeSecret();
  }

  function createGalaxyDust() {
    const mount = $('[data-galaxy-dust]');
    if (!mount || mount.children.length) return;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 8; index += 1) {
      const particle = document.createElement('span');
      particle.className = 'dust-particle';
      particle.style.left = (8 + seeded(index, 61) * 84).toFixed(2) + '%';
      particle.style.top = (12 + seeded(index, 62) * 76).toFixed(2) + '%';
      particle.style.setProperty('--dust-time', (5 + seeded(index, 63) * 4).toFixed(2) + 's');
      particle.style.setProperty('--dust-delay', (-seeded(index, 64) * 5).toFixed(2) + 's');
      fragment.appendChild(particle);
    }
    mount.appendChild(fragment);
  }

  function initUniverse() {
    createConstellationLines();
    createGalaxyDust();
    $$('[data-constellation-star]').forEach((star) => star.addEventListener('click', () => openConstellation(star)));
    $('#constellation-close')?.addEventListener('click', closeConstellation);
    $('#secret-star')?.addEventListener('click', openSecret);
    $('#secret-close')?.addEventListener('click', closeSecret);
    updateConstellation();
    if (state.interactive.secret) $('#secret-star')?.classList.add('is-found');
  }

  /* ANDREA */
  function flattenAndreaLayout() {
    const points = [];
    const advance = 6;
    ANDREA_LAYOUT.forEach((glyph, letterIndex) => {
      glyph.points.forEach((point, pointIndex) => {
        points.push({ letter: glyph.letter, letterIndex, pointIndex, x: letterIndex * advance + point[0], y: point[1] });
      });
    });
    return points;
  }

  function initAndrea() {
    const mount = $('[data-andrea-mount]');
    if (!mount || mount.children.length) return;
    const points = flattenAndreaLayout();
    const totalWidth = (ANDREA_LAYOUT.length - 1) * 6 + 4;
    const fragment = document.createDocumentFragment();
    points.forEach((point, index) => {
      const star = document.createElement('span');
      const targetX = 5 + point.x / totalWidth * 90;
      const targetY = 18 + point.y / 6 * 64;
      star.className = 'andrea-star' + (index === 37 ? ' is-special' : '');
      star.dataset.andreaStar = '';
      star.dataset.fromX = (2 + seeded(index, 71) * 96).toFixed(3);
      star.dataset.fromY = (2 + seeded(index, 72) * 96).toFixed(3);
      star.dataset.targetX = targetX.toFixed(3);
      star.dataset.targetY = targetY.toFixed(3);
      star.dataset.targetOpacity = (.76 + seeded(index, 73) * .24).toFixed(2);
      star.style.left = star.dataset.targetX + '%';
      star.style.top = star.dataset.targetY + '%';
      star.style.setProperty('--andrea-star-size', (2.1 + seeded(index, 74) * 2.6).toFixed(2) + 'px');
      star.setAttribute('aria-hidden', 'true');
      fragment.appendChild(star);
    });
    mount.appendChild(fragment);
  }

  function setAndreaFormed() {
    const stage = $('#andrea-stars');
    if (!stage) return;
    $$('[data-andrea-star]', stage).forEach((star) => {
      star.style.opacity = star.dataset.targetOpacity || '1';
      star.style.transform = 'translate3d(0,0,0) scale(1)';
      star.style.willChange = '';
    });
    stage.classList.add('is-formed');
    stage.classList.remove('is-forming');
    document.body.classList.remove('andrea-is-forming');
    state.interactive.andrea = true;
    Storage.saveInteractive();
  }

  function startAndreaCopy() {
    const scene = $('#scene-8');
    const timeline = $('[data-timeline="andrea"]', scene);
    if (!scene || !timeline) return;
    scene.classList.add('andrea-copy-is-visible');
    timeline.hidden = false;
    playTimeline(timeline, () => completeScene(8));
  }

  function finishAndrea() {
    setAndreaFormed();
    currentRuntime(8)?.after(duration(1500), startAndreaCopy);
  }

  function formAndrea() {
    const stage = $('#andrea-stars');
    const runtime = currentRuntime(8);
    if (!stage || !runtime) return;
    if (state.interactive.andrea) {
      setAndreaFormed();
      runtime.after(duration(260), startAndreaCopy);
      return;
    }
    if (stage.dataset.animating === 'true') return;
    stage.dataset.animating = 'true';
    stage.classList.add('is-forming');
    document.body.classList.add('andrea-is-forming');
    const rectangle = stage.getBoundingClientRect();
    const stars = $$('[data-andrea-star]', stage);

    if (state.reducedMotion || typeof Element.prototype.animate !== 'function') {
      finishAndrea();
      return;
    }
    stars.forEach((star, index) => {
      const targetX = number(star.dataset.targetX, 50);
      const targetY = number(star.dataset.targetY, 50);
      const offsetX = (number(star.dataset.fromX, 50) - targetX) * rectangle.width / 100;
      const offsetY = (number(star.dataset.fromY, 50) - targetY) * rectangle.height / 100;
      const traceX = offsetX * .48 + (seeded(index, 76) - .5) * 42;
      const traceY = offsetY * .44 + (seeded(index, 77) - .5) * 30;
      const animationMs = 2800 + seeded(index, 78) * 430;
      const delay = (index % 12) * 34 + Math.floor(index / 12) * 48;
      star.style.willChange = 'transform, opacity';
      runtime.track(star.animate([
        { opacity: .04, transform: 'translate3d(' + offsetX.toFixed(2) + 'px,' + offsetY.toFixed(2) + 'px,0) scale(.35)' },
        { opacity: .44, transform: 'translate3d(' + traceX.toFixed(2) + 'px,' + traceY.toFixed(2) + 'px,0) scale(.66)', offset: .52 },
        { opacity: number(star.dataset.targetOpacity, .9), transform: 'translate3d(0,0,0) scale(1)' }
      ], { duration: animationMs, delay, easing: 'cubic-bezier(.22,.72,.2,1)', fill: 'both' }));
    });
    runtime.after(3850, finishAndrea);
  }

  function resetAndreaIfIncomplete() {
    document.body.classList.remove('andrea-is-forming');
    if (state.interactive.andrea) return;
    const stage = $('#andrea-stars');
    if (!stage) return;
    stage.dataset.animating = '';
    stage.classList.remove('is-forming', 'is-formed', 'is-illuminated');
    $$('[data-andrea-star]', stage).forEach((star) => {
      star.style.opacity = '';
      star.style.transform = '';
      star.style.willChange = '';
    });
  }

  /* FINAL */
  function initFinal() {
    ensureSunflowerMemory();
  }

  /* SCENE CONTROLLER */
  const SceneController = {
    current: 0,
    total: CONFIG.sceneCount,
    scenes: [],
    transitioning: false,
    transitionTimer: 0,

    init() {
      this.scenes = $$('[data-scene-index]').sort((a, b) => number(a.dataset.sceneIndex) - number(b.dataset.sceneIndex));
      this.total = this.scenes.length;
      this.current = clamp(state.currentScene, 0, this.total - 1);
      state.currentScene = this.current;

      this.scenes.forEach((scene, index) => {
        const active = index === this.current;
        scene.hidden = !active;
        scene.inert = !active;
        scene.setAttribute('aria-hidden', active ? 'false' : 'true');
        scene.classList.toggle('is-active', active);
        scene.classList.toggle('scene-paused', !active);
      });

      $('#scene-previous')?.addEventListener('click', () => this.previous());
      $$('[data-scene-next]').forEach((button) => button.addEventListener('click', () => this.next()));
      $('#enter-button')?.addEventListener('click', () => this.enterExperience());
      this.updateChrome();
      this.enterScene(this.current, true);
      document.documentElement.classList.remove('is-returning');
      document.body.classList.add('app-ready');
    },

    activeScene() {
      return this.scenes[this.current] || null;
    },

    enterExperience() {
      const firstEntry = !state.started;
      if (!state.started) {
        state.started = true;
        Storage.set(STORAGE_KEYS.started, 'true');
      }
      state.interactive.sceneStatus[0] = 'complete';
      Storage.saveInteractive();
      Audio.updateControls();
      Ambient.scheduleShootingStar();
      if (firstEntry) Audio.playFromGesture();
      this.next();
    },

    next() {
      if (this.current >= this.total - 1) return;
      if (state.interactive.sceneStatus[this.current] !== 'complete') return;
      this.goTo(this.current + 1);
    },

    previous() {
      if (this.current <= 0) return;
      this.goTo(this.current - 1);
    },

    goTo(index, options = {}) {
      const targetIndex = clamp(Math.trunc(index), 0, this.total - 1);
      if (targetIndex === this.current || this.transitioning) return;
      const sourceIndex = this.current;
      const source = this.scenes[sourceIndex];
      const target = this.scenes[targetIndex];
      if (!source || !target) return;
      this.transitioning = true;
      closeDialogs();
      this.exitScene(sourceIndex);

      source.style.willChange = 'opacity, transform';
      target.style.willChange = 'opacity, transform';
      source.classList.remove('is-active');
      source.classList.add('is-exiting');
      source.inert = true;
      source.setAttribute('aria-hidden', 'true');

      target.hidden = false;
      target.inert = false;
      target.classList.remove('scene-paused', 'is-exiting');
      target.setAttribute('aria-hidden', 'false');
      void target.offsetWidth;
      target.classList.add('is-entering');

      this.current = targetIndex;
      state.currentScene = targetIndex;
      Storage.set(STORAGE_KEYS.scene, targetIndex);
      this.updateChrome();
      this.enterScene(targetIndex, Boolean(options.restoring));

      const transitionMs = state.reducedMotion ? 220 : state.lowPerformance ? CONFIG.transitionLowMs : CONFIG.transitionMs;
      window.clearTimeout(this.transitionTimer);
      this.transitionTimer = window.setTimeout(() => {
        source.hidden = true;
        source.classList.remove('is-exiting');
        source.classList.add('scene-paused');
        source.style.willChange = '';
        target.classList.remove('is-entering');
        target.classList.add('is-active');
        target.style.willChange = '';
        this.transitioning = false;
      }, transitionMs);
    },

    updateChrome() {
      document.body.dataset.currentScene = String(this.current);
      document.body.classList.toggle('experience-started', state.started);
      const back = $('#scene-previous');
      if (back) back.hidden = this.current === 0;
      const progress = $('#scene-progress');
      if (progress) {
        const value = this.total > 1 ? this.current / (this.total - 1) * 100 : 100;
        progress.style.width = value.toFixed(3) + '%';
        progress.setAttribute('aria-valuenow', String(Math.round(value)));
      }
      Audio.updateControls();
      const sceneName = this.scenes[this.current]?.dataset.sceneName;
      const live = $('#live-region');
      if (live && sceneName) live.textContent = sceneName;
    },

    initializeScene(index) {
      const scene = this.scenes[index];
      if (!scene || scene.dataset.initialized === 'true') return;
      if (index === 2) initInsight();
      if (index === 3) initProof();
      if (index === 4) initSunflower();
      if (index === 5) ensureSunflowerMemory();
      if (index === 7) initUniverse();
      if (index === 8) {
        ensureSunflowerMemory();
        initAndrea();
      }
      if (index === 9) initFinal();
      scene.dataset.initialized = 'true';
    },

    enterScene(index) {
      this.initializeScene(index);
      if (state.runtime) state.runtime.clear();
      state.runtime = new SceneRuntime(index);
      const status = state.interactive.sceneStatus[index];
      if (status === 'complete') {
        this.restoreCompletedScene(index);
        return;
      }
      state.interactive.sceneStatus[index] = 'playing';
      Storage.saveInteractive();
      this.playScene(index);
    },

    playScene(index) {
      const scene = this.scenes[index];
      if (!scene) return;
      if ([0, 1, 5, 6].includes(index)) {
        playTimeline($('[data-auto-timeline]', scene), () => completeScene(index));
      }
      if (index === 2) {
        playTimeline($('[data-timeline="main"]', scene));
        if (state.interactive.insight) {
          restoreInsight();
          scene.classList.add('copy-is-speaking');
          playTimeline($('[data-timeline="insight"]', scene), () => completeScene(2));
        }
      }
      if (index === 3) {
        playTimeline($('[data-timeline="main"]', scene));
        if (state.interactive.proof) {
          restoreProof();
          playTimeline($('[data-timeline="proof"]', scene), () => completeScene(3));
        }
      }
      if (index === 4) {
        restoreSunflower();
        if (state.interactive.sunflowerCenter) {
          playTimeline($('[data-timeline="sunflower"]', scene), () => completeScene(4));
        } else if (!state.interactive.sunflowerBloomed) {
          startSunflowerBloom();
        }
      }
      if (index === 7) {
        playTimeline($('[data-auto-timeline]', scene), () => {
          state.interactive.universeReady = true;
          Storage.saveInteractive();
          if (state.interactive.constellationVisited.length) completeScene(7);
        });
      }
      if (index === 8) formAndrea();
      if (index === 9) {
        playTimeline($('[data-timeline="final"]', scene), () => completeScene(9));
      }
    },

    restoreCompletedScene(index) {
      const scene = this.scenes[index];
      $$('[data-timeline]', scene).forEach(revealEntireTimeline);
      if (index === 2) {
        restoreInsight();
        scene.classList.add('copy-is-speaking');
      }
      if (index === 3) restoreProof();
      if (index === 4) restoreSunflower();
      if (index === 5) {
        scene.classList.add('love-is-visible');
        document.body.classList.add('love-is-visible');
      }
      if (index === 6) finishFuture();
      if (index === 7) {
        scene.classList.add('constellation-is-visible');
        updateConstellation();
      }
      if (index === 8) {
        setAndreaFormed();
        $('#andrea-stars')?.classList.add('is-illuminated');
        scene.classList.add('andrea-copy-is-visible');
        $('#andrea-after').hidden = false;
      }
      if (index === 9) {
        state.interactive.final = true;
        scene.classList.add('is-complete');
      } else {
        showSceneAction(scene);
      }
    },

    exitScene(index) {
      state.runtime?.clear();
      state.runtime = null;
      if (index === 4) $$('.is-pulsing', this.scenes[index]).forEach((node) => node.classList.remove('is-pulsing'));
      if (index === 6) resetFutureIfIncomplete();
      if (index === 8) resetAndreaIfIncomplete();
      document.body.classList.remove('love-is-visible');
    },

    suspend() {
      if (state.suspended) return;
      if (this.transitioning) this.reconcile();
      state.suspended = true;
      state.runtime?.pause();
      const scene = this.activeScene();
      scene?.classList.add('scene-paused');
      state.pausedAnimations = scene ? scene.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running') : [];
      state.pausedAnimations.forEach((animation) => {
        try { animation.pause(); } catch (_error) {}
      });
    },

    resume() {
      if (!state.suspended) return;
      state.suspended = false;
      const scene = this.activeScene();
      scene?.classList.remove('scene-paused');
      state.runtime?.resume();
      state.pausedAnimations.forEach((animation) => {
        try { if (animation.playState === 'paused') animation.play(); } catch (_error) {}
      });
      state.pausedAnimations = [];
    },

    reconcile() {
      window.clearTimeout(this.transitionTimer);
      this.transitionTimer = 0;
      this.scenes.forEach((scene, index) => {
        const active = index === this.current;
        scene.hidden = !active;
        scene.inert = !active;
        scene.setAttribute('aria-hidden', active ? 'false' : 'true');
        scene.classList.toggle('is-active', active);
        scene.classList.toggle('scene-paused', !active);
        scene.classList.remove('is-entering', 'is-exiting');
        scene.style.willChange = '';
      });
      this.transitioning = false;
      this.updateChrome();
    }
  };

  window.SceneController = SceneController;

  /* LIFECYCLE */
  function initLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        Storage.flush();
        Audio.suspend();
        Ambient.pause();
        SceneController.suspend();
        document.body.classList.add('is-suspended');
      } else {
        document.body.classList.remove('is-suspended');
        SceneController.resume();
        Ambient.resume();
        Audio.resume();
      }
    });

    window.addEventListener('pagehide', () => {
      Storage.flush();
      Audio.suspend();
      Ambient.pause();
      SceneController.suspend();
    });

    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      SceneController.reconcile();
      if (document.hidden) {
        document.body.classList.add('is-suspended');
        return;
      }
      document.body.classList.remove('is-suspended');
      SceneController.resume();
      Ambient.resume();
      Audio.resume();
    });

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      closeDialogs();
    });

    if (typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', (event) => {
        state.reducedMotion = Boolean(event.matches);
        if (state.reducedMotion) Ambient.pause();
        else if (!document.hidden) Ambient.resume();
      });
    }
  }

  function initialize() {
    loadState();
    document.body.classList.toggle('low-performance', state.lowPerformance);
    Audio.init();
    Ambient.init();
    initTapFeedback();
    initLifecycle();
    SceneController.init();
    if (state.started) Audio.offerResume();
    Storage.flush();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
