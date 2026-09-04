(() => {
  'use strict';

  /*
   * This file is intentionally idempotent. Safari can restore this document
   * from its back-forward cache, and some hosts can evaluate a script twice.
   * A second evaluation must not add listeners, timers, stars or audio.
   */
  if (window.__andreaUniverseInitialized) return;
  window.__andreaUniverseInitialized = true;

  const STORAGE_KEYS = Object.freeze({
    started: 'experienceStarted',
    scroll: 'lastScrollPosition',
    scene: 'lastScene',
    music: 'musicCurrentTime',
    ending: 'endingState'
  });

  const AUDIO_SOURCE = './cancion/algo-que-se-quede.mp3';
  const AUDIO_VOLUME = 0.22;
  const AUDIO_FADE_MS = 3000;
  const SCROLL_SAVE_DELAY = 240;

  const SUNFLOWER_WORDS = Object.freeze([
    'Escucharte.',
    'Buscarte.',
    'Proponer.',
    'Estar.',
    'Aprender.',
    'Cuidar.',
    'Sorprender.',
    'Demostrar.'
  ]);

  const CONSTELLATION_POSITIONS = Object.freeze([
    [13, 61],
    [29, 27],
    [47, 44],
    [65, 19],
    [84, 48],
    [64, 79]
  ]);

  const ANDREA_LAYOUT = Object.freeze([
    { letter: 'A', points: [[0, 6], [.7, 3.9], [1.35, 1.8], [2, 0], [2.65, 1.8], [3.3, 3.9], [4, 6], [1, 3.55], [3, 3.55]] },
    { letter: 'N', points: [[0, 6], [0, 3], [0, 0], [1, 1.5], [2, 3], [3, 4.5], [4, 6], [4, 3], [4, 0]] },
    { letter: 'D', points: [[0, 0], [0, 2], [0, 4], [0, 6], [1.25, 0], [3.35, .75], [4, 3], [3.35, 5.25], [1.25, 6]] },
    { letter: 'R', points: [[0, 6], [0, 4], [0, 2], [0, 0], [1.35, 0], [3.55, .8], [3.45, 2.35], [1.35, 3], [2.6, 3.55], [4, 6]] },
    { letter: 'E', points: [[0, 0], [0, 2], [0, 4], [0, 6], [2, 0], [4, 0], [3.6, 3], [4, 6]] },
    { letter: 'A', points: [[0, 6], [.7, 3.9], [1.35, 1.8], [2, 0], [2.65, 1.8], [3.3, 3.9], [4, 6], [1, 3.55], [3, 3.55]] }
  ]);

  const motionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  const state = {
    initialized: false,
    reducedMotion: Boolean(motionQuery.matches),
    startedBefore: false,
    entered: false,
    restoring: false,
    restorationCancelled: false,
    restoredScroll: false,
    savedScroll: 0,
    savedScene: '0',
    currentScene: '0',
    interactive: {
      insight: false,
      proof: false,
      sunflowerPetals: [],
      sunflowerCenter: false,
      constellationVisited: [],
      secret: false,
      finale: false,
      andrea: false,
      future: false,
      haptic: false
    },
    timers: new Set(),
    observers: [],
    sceneRatios: new Map(),
    scrollSaveTimer: 0,
    scrollFrame: 0,
    resizeTimer: 0,
    shootingTimer: 0,
    shootingActive: false,
    sunflowerUnlockTimer: 0,
    audio: null,
    audioToggle: null,
    audioResume: null,
    audioAvailable: true,
    audioHasPlayed: false,
    audioPlaying: false,
    audioMuted: false,
    audioFadeFrame: 0,
    audioSaveAt: 0,
    savedAudioTime: 0
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function first(selectors, root = document) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of list) {
      const node = $(selector, root);
      if (node) return node;
    }
    return null;
  }

  function unique(selectors, root = document) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    return Array.from(new Set(list.flatMap((selector) => $$(selector, root))));
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function number(value, fallback = 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function sceneRank(value) {
    if (value === 'closing') return 14;
    if (value === 'finale') return 15;
    return number(value, 0);
  }

  function seeded(index, salt = 0) {
    const raw = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return raw - Math.floor(raw);
  }

  function storageRead(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function storageWrite(key, value) {
    try {
      window.sessionStorage.setItem(key, String(value));
    } catch (_error) {
      // The experience remains complete when storage is unavailable.
    }
  }

  function parseInteractiveState(value) {
    let parsed = {};
    try {
      parsed = value ? JSON.parse(value) : {};
    } catch (_error) {
      parsed = {};
    }

    return {
      insight: parsed.insight === true,
      proof: parsed.proof === true,
      sunflowerPetals: Array.isArray(parsed.sunflowerPetals)
        ? Array.from(new Set(parsed.sunflowerPetals.map((item) => number(item, -1)).filter((item) => item >= 0 && item < 8)))
        : [],
      sunflowerCenter: parsed.sunflowerCenter === true,
      constellationVisited: Array.isArray(parsed.constellationVisited)
        ? Array.from(new Set(parsed.constellationVisited.map((item) => number(item, -1)).filter((item) => item >= 0)))
        : [],
      secret: parsed.secret === true,
      finale: parsed.finale === true,
      andrea: parsed.andrea === true,
      future: parsed.future === true,
      haptic: parsed.haptic === true
    };
  }

  function setTimer(callback, delay = 0) {
    const timer = window.setTimeout(() => {
      state.timers.delete(timer);
      callback();
    }, Math.max(0, delay));
    state.timers.add(timer);
    return timer;
  }

  function clearTimer(timer) {
    if (!timer) return;
    window.clearTimeout(timer);
    state.timers.delete(timer);
  }

  function duration(normal, reduced = 0) {
    return state.reducedMotion ? reduced : normal;
  }

  function show(node) {
    if (!node) return;
    node.hidden = false;
    node.removeAttribute('aria-hidden');
  }

  function revealImmediately(node) {
    if (!node) return;
    show(node);
    node.style.setProperty('--reveal-delay', '0ms');
    node.classList.add('is-visible', 'revealed');
    node.dataset.revealed = 'true';
    delete node.dataset.revealScheduled;
  }

  function revealNode(node, delay = 0) {
    if (!node || node.dataset.revealed === 'true' || node.dataset.revealScheduled === 'true') return;
    show(node);
    node.dataset.revealScheduled = 'true';
    node.style.setProperty('--reveal-delay', '0ms');

    setTimer(() => {
      node.classList.add('is-visible', 'revealed');
      node.dataset.revealed = 'true';
      maybeVibrateForLove(node);
      node.dispatchEvent(new CustomEvent('andrea:revealed', { bubbles: true }));
    }, duration(clamp(number(delay, 0), 0, 9000), 0));
  }

  function revealSequence(nodes, step = 220, initialDelay = 0) {
    const items = Array.from(new Set(nodes.filter(Boolean)));
    // Reserve the complete layout immediately; only opacity/transform changes.
    items.forEach(show);
    items.forEach((node, index) => revealNode(node, initialDelay + index * step));
    return initialDelay + Math.max(0, items.length - 1) * step;
  }

  function revealChildren(container, step = 220, initialDelay = 0) {
    if (!container) return 0;
    const items = unique([
      '[data-reveal]',
      '[data-final-line]',
      '[data-sequence-item]',
      '[data-insight-word]',
      'p'
    ], container);
    return revealSequence(items, duration(step, 0), duration(initialDelay, 0));
  }

  function maybeVibrateForLove(node) {
    if (state.interactive.haptic || !state.entered || typeof navigator.vibrate !== 'function') return;
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');
    if (text !== 'te quiero.' && text !== 'te quiero') return;
    state.interactive.haptic = true;
    saveInteractiveState();
    try {
      navigator.vibrate(18);
    } catch (_error) {
      // Vibration is optional and never affects the story.
    }
  }

  function setMotionPreference(event) {
    state.reducedMotion = Boolean(event ? event.matches : motionQuery.matches);
    document.documentElement.classList.toggle('reduced-motion', state.reducedMotion);
  }

  function loadExperienceState() {
    state.startedBefore = storageRead(STORAGE_KEYS.started) === 'true';
    state.entered = state.startedBefore;
    state.restoring = state.startedBefore;
    state.savedScroll = Math.max(0, number(storageRead(STORAGE_KEYS.scroll), 0));
    state.savedScene = storageRead(STORAGE_KEYS.scene) || '0';
    state.currentScene = state.savedScene;
    state.savedAudioTime = Math.max(0, number(storageRead(STORAGE_KEYS.music), 0));
    state.interactive = parseInteractiveState(storageRead(STORAGE_KEYS.ending));
  }

  function saveInteractiveState() {
    storageWrite(STORAGE_KEYS.ending, JSON.stringify(state.interactive));
  }

  function saveExperienceState() {
    if (!state.entered) return;

    storageWrite(STORAGE_KEYS.started, 'true');
    storageWrite(
      STORAGE_KEYS.scroll,
      String(Math.round(state.restoring ? state.savedScroll : Math.max(0, window.scrollY)))
    );
    storageWrite(STORAGE_KEYS.scene, state.restoring ? state.savedScene : state.currentScene);

    const currentAudioTime = state.audio && Number.isFinite(state.audio.currentTime)
      ? state.audio.currentTime
      : state.savedAudioTime;
    storageWrite(STORAGE_KEYS.music, Math.max(0, currentAudioTime).toFixed(2));
    saveInteractiveState();
  }

  function queueExperienceSave() {
    if (!state.entered || state.restoring || state.scrollSaveTimer) return;
    state.scrollSaveTimer = setTimer(() => {
      state.scrollSaveTimer = 0;
      saveExperienceState();
    }, SCROLL_SAVE_DELAY);
  }

  function setAllButtonTypes() {
    $$('button').forEach((button) => {
      if (!button.hasAttribute('type')) button.type = 'button';
    });
  }

  function waitForExperience(callback) {
    if (state.entered) {
      callback();
      return;
    }
    document.addEventListener('andrea:experience-started', callback, { once: true });
  }

  function observeOnce(target, callback, options = {}) {
    if (!target || typeof callback !== 'function') return;

    waitForExperience(() => {
      if (state.reducedMotion || !('IntersectionObserver' in window)) {
        callback(target);
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          callback(entry.target, entry);
        });
      }, {
        threshold: options.threshold === undefined ? 0.22 : options.threshold,
        rootMargin: options.rootMargin || '0px 0px -10% 0px'
      });

      observer.observe(target);
      state.observers.push(observer);
    });
  }

  function ensureResumeAudioButton() {
    let button = first(['#resume-audio', '[data-resume-audio]']);
    if (button) return button;

    button = document.createElement('button');
    button.id = 'resume-audio';
    button.type = 'button';
    button.className = 'resume-audio';
    button.dataset.resumeAudio = '';
    button.textContent = 'Continuar con música ✦';
    button.hidden = true;
    document.body.appendChild(button);
    return button;
  }

  function updateAudioControls() {
    const toggle = state.audioToggle;
    const resume = state.audioResume;

    if (resume) {
      const shouldOfferResume = state.entered
        && state.audioAvailable
        && (!state.audioHasPlayed || !state.audioPlaying);
      resume.hidden = !shouldOfferResume;
      resume.classList.toggle('is-visible', shouldOfferResume);
    }

    if (!toggle) return;
    const availableToToggle = state.entered
      && state.audioAvailable
      && state.audioHasPlayed
      && state.audioPlaying;
    toggle.hidden = !availableToToggle;
    toggle.classList.toggle('is-visible', availableToToggle);

    const muted = state.audioMuted || Boolean(state.audio && state.audio.muted);
    const icon = muted ? '🔇' : '🔊';
    const label = muted ? 'Activar música' : 'Silenciar música';
    toggle.setAttribute('aria-pressed', String(muted));
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.dataset.audioState = muted ? 'muted' : state.audioPlaying ? 'playing' : 'paused';

    const iconNode = $('[data-audio-icon]', toggle);
    const labelNode = $('[data-audio-label]', toggle);
    if (iconNode) iconNode.textContent = icon;
    if (labelNode) labelNode.textContent = muted ? 'Música silenciada' : 'Música activada';
  }

  function markAudioUnavailable() {
    state.audioAvailable = false;
    state.audioPlaying = false;
    state.audioHasPlayed = false;
    if (state.audioFadeFrame) {
      cancelAnimationFrame(state.audioFadeFrame);
      state.audioFadeFrame = 0;
    }
    document.body.classList.add('audio-unavailable');
    if (state.audioToggle) state.audioToggle.hidden = true;
    if (state.audioResume) state.audioResume.hidden = true;
  }

  function ensureAudioSource() {
    const audio = state.audio;
    if (!audio || !state.audioAvailable) return false;

    const source = audio.dataset.src || AUDIO_SOURCE;
    if (audio.getAttribute('src') !== source) {
      audio.setAttribute('src', source);
      try {
        audio.load();
      } catch (_error) {
        return false;
      }
    }
    return true;
  }

  function restoreAudioPosition() {
    const audio = state.audio;
    if (!audio || state.savedAudioTime <= 0) return;

    const applyPosition = () => {
      let target = state.savedAudioTime;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        target %= audio.duration;
      }
      try {
        audio.currentTime = Math.max(0, target);
      } catch (_error) {
        // Some engines only allow seeking after metadata has settled.
      }
    };

    if (audio.readyState >= 1) applyPosition();
    else audio.addEventListener('loadedmetadata', applyPosition, { once: true });
  }

  function fadeAudio(target = AUDIO_VOLUME, fadeDuration = AUDIO_FADE_MS) {
    const audio = state.audio;
    if (!audio || !state.audioAvailable) return;
    if (state.audioFadeFrame) cancelAnimationFrame(state.audioFadeFrame);

    if (state.reducedMotion) {
      audio.volume = clamp(target, 0, 1);
      state.audioFadeFrame = 0;
      return;
    }

    const from = clamp(audio.volume, 0, 1);
    const to = clamp(target, 0, 1);
    const began = performance.now();

    const tick = (now) => {
      const progress = clamp((now - began) / Math.max(1, fadeDuration), 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      audio.volume = from + (to - from) * eased;
      if (progress < 1 && !audio.paused) {
        state.audioFadeFrame = requestAnimationFrame(tick);
      } else {
        state.audioFadeFrame = 0;
      }
    };

    state.audioFadeFrame = requestAnimationFrame(tick);
  }

  function startAudio() {
    const audio = state.audio;
    if (!audio || !state.audioAvailable || !ensureAudioSource()) {
      updateAudioControls();
      return;
    }

    restoreAudioPosition();
    audio.muted = false;
    state.audioMuted = false;
    audio.volume = 0;

    let playback;
    try {
      // Kept synchronous with the Enter/resume gesture for mobile policies.
      playback = audio.play();
    } catch (_error) {
      state.audioPlaying = false;
      updateAudioControls();
      return;
    }

    const onPlaying = () => {
      state.audioHasPlayed = true;
      state.audioPlaying = true;
      document.body.classList.add('audio-playing');
      document.body.classList.remove('audio-needs-gesture');
      updateAudioControls();
      fadeAudio(AUDIO_VOLUME, AUDIO_FADE_MS);
    };

    if (playback && typeof playback.then === 'function') {
      playback.then(onPlaying).catch(() => {
        state.audioPlaying = false;
        document.body.classList.add('audio-needs-gesture');
        updateAudioControls();
      });
    } else {
      onPlaying();
    }
  }

  function restoreAudio() {
    state.savedAudioTime = Math.max(0, number(storageRead(STORAGE_KEYS.music), state.savedAudioTime));
    // Deliberately do not attach src or call play here. A restored page only
    // offers one quiet gesture-based control.
    state.audioHasPlayed = false;
    state.audioPlaying = false;
    updateAudioControls();
  }

  function initAudio() {
    const audio = document.querySelector('#background-music');
    if (!audio) return;

    // Remove any legacy nested source so only the declared data-src is used.
    $$('source', audio).forEach((source) => source.remove());
    audio.removeAttribute('src');
    audio.dataset.src = AUDIO_SOURCE;
    audio.preload = 'metadata';
    audio.loop = true;
    audio.setAttribute('playsinline', '');
    audio.volume = 0;

    state.audio = audio;
    state.audioToggle = first(['#audio-toggle', '[data-audio-toggle]', '.audio-toggle']);
    state.audioResume = ensureResumeAudioButton();

    audio.addEventListener('error', markAudioUnavailable);
    audio.addEventListener('playing', () => {
      state.audioPlaying = true;
      state.audioHasPlayed = true;
      updateAudioControls();
    });
    audio.addEventListener('pause', () => {
      state.audioPlaying = false;
      if (state.entered && !document.hidden && state.audioHasPlayed) {
        document.body.classList.add('audio-needs-gesture');
      }
      updateAudioControls();
    });
    audio.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - state.audioSaveAt < 3000 || !Number.isFinite(audio.currentTime)) return;
      state.audioSaveAt = now;
      state.savedAudioTime = audio.currentTime;
      storageWrite(STORAGE_KEYS.music, audio.currentTime.toFixed(2));
    });

    if (state.audioToggle) {
      state.audioToggle.type = 'button';
      state.audioToggle.addEventListener('click', () => {
        if (!state.audioAvailable) return;
        if (!state.audioHasPlayed || audio.paused) {
          startAudio();
          return;
        }
        state.audioMuted = !state.audioMuted;
        audio.muted = state.audioMuted;
        updateAudioControls();
      });
    }

    state.audioResume.type = 'button';
    state.audioResume.addEventListener('click', startAudio);
    restoreAudio();
  }

  function targetStarCount() {
    if (Math.min(window.innerWidth, window.innerHeight) <= 480) return 48;
    if (window.innerWidth <= 900) return 60;
    return 72;
  }

  function createBackgroundStar(index) {
    const star = document.createElement('span');
    const depthIndex = index % 3;
    const size = depthIndex === 0
      ? .55 + seeded(index, 2) * .65
      : depthIndex === 1
        ? .9 + seeded(index, 3) * 1.05
        : 1.35 + seeded(index, 4) * 1.5;
    const opacity = .2 + seeded(index, 5) * (depthIndex === 2 ? .68 : .48);

    star.className = 'star star--' + ['far', 'middle', 'near'][depthIndex];
    star.dataset.generatedStar = 'true';
    star.dataset.depth = String(depthIndex + 1);
    star.setAttribute('aria-hidden', 'true');
    star.style.left = (seeded(index, 6) * 100).toFixed(3) + '%';
    star.style.top = (seeded(index, 7) * 100).toFixed(3) + '%';
    star.style.setProperty('--size', size.toFixed(2) + 'px');
    star.style.setProperty('--opacity', opacity.toFixed(2));
    star.style.setProperty('--twinkle-duration', (5 + seeded(index, 8) * 8).toFixed(2) + 's');
    star.style.setProperty('--twinkle-delay', (-seeded(index, 9) * 9).toFixed(2) + 's');
    star.style.setProperty('--drift', (1 + seeded(index, 10) * 7).toFixed(2) + 'px');
    return star;
  }

  function syncBackgroundStars(container) {
    if (!container) return;
    const expected = targetStarCount();
    const current = $$('[data-generated-star]', container);

    if (current.length > expected) {
      current.slice(expected).forEach((star) => star.remove());
      return;
    }

    if (current.length < expected) {
      const fragment = document.createDocumentFragment();
      for (let index = current.length; index < expected; index += 1) {
        fragment.appendChild(createBackgroundStar(index));
      }
      container.appendChild(fragment);
    }
  }

  function launchShootingStar(container) {
    if (!container || state.reducedMotion || document.hidden || !state.entered) return;
    if ($('[data-generated-shooting-star]', container)) return;

    const star = document.createElement('span');
    const distanceX = Math.max(window.innerWidth * .82, 330);
    const distanceY = 115 + seeded(Date.now() % 103, 4) * 150;
    const time = 1400 + seeded(Date.now() % 89, 7) * 650;

    star.className = 'shooting-star';
    star.dataset.generatedShootingStar = 'true';
    star.setAttribute('aria-hidden', 'true');
    star.style.left = (-8 + seeded(Date.now() % 71, 2) * 38).toFixed(2) + '%';
    star.style.top = (5 + seeded(Date.now() % 67, 5) * 37).toFixed(2) + '%';
    container.appendChild(star);

    if (!state.reducedMotion && typeof star.animate === 'function') {
      const animation = star.animate([
        { opacity: 0, transform: 'translate3d(0,0,0) rotate(-18deg) scaleX(.35)' },
        { opacity: .82, offset: .15 },
        { opacity: 0, transform: 'translate3d(' + distanceX.toFixed(0) + 'px,' + distanceY.toFixed(0) + 'px,0) rotate(-18deg) scaleX(1)' }
      ], {
        duration: time,
        easing: 'cubic-bezier(.2,.65,.3,1)',
        fill: 'forwards'
      });
      animation.finished.catch(() => {}).finally(() => star.remove());
    } else {
      setTimer(() => star.remove(), time);
    }
  }

  function scheduleShootingStars(container, soon = false) {
    clearTimer(state.shootingTimer);
    state.shootingTimer = 0;
    if (!container || !state.entered || document.hidden || state.reducedMotion) return;

    state.shootingActive = true;
    state.shootingTimer = setTimer(() => {
      state.shootingTimer = 0;
      launchShootingStar(container);
      scheduleShootingStars(container, false);
    }, soon ? 5200 : 10000 + Math.random() * 8000);
  }

  function createStars() {
    const container = first(['#star-field', '[data-star-field]', '.starfield']);
    if (!container) return;
    syncBackgroundStars(container);

    window.addEventListener('resize', () => {
      clearTimer(state.resizeTimer);
      state.resizeTimer = setTimer(() => {
        state.resizeTimer = 0;
        syncBackgroundStars(container);
      }, 180);
    }, { passive: true });

    waitForExperience(() => scheduleShootingStars(container, true));
  }

  function initScrollAnimations() {
    const revealNodes = unique(['[data-reveal]', '.reveal-text', '.star-reveal']);

    waitForExperience(() => {
      const candidates = revealNodes.filter((node) => !node.closest('[hidden]'));
      if (state.reducedMotion || !('IntersectionObserver' in window)) {
        candidates.forEach(revealImmediately);
      } else {
        const revealObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            revealObserver.unobserve(entry.target);
            revealNode(entry.target, number(entry.target.dataset.delay, 0));
          });
        }, {
          threshold: .14,
          rootMargin: '0px 0px -8% 0px'
        });

        candidates.forEach((node) => revealObserver.observe(node));
        state.observers.push(revealObserver);
      }

      const scenes = unique(['[data-scene]', '.scene']);
      if (!scenes.length || !('IntersectionObserver' in window)) return;

      const sceneObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          state.sceneRatios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
          entry.target.classList.toggle('is-current', entry.isIntersecting && entry.intersectionRatio >= .12);
        });

        let bestScene = null;
        let bestRatio = 0;
        state.sceneRatios.forEach((ratio, scene) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestScene = scene;
          }
        });

        if (bestScene && bestRatio > 0) {
          state.currentScene = bestScene.dataset.scene || bestScene.id || state.currentScene;
          document.body.classList.toggle('andrea-is-current', bestScene.id === 'scene-10');
          queueExperienceSave();
        }
      }, { threshold: [0, .12, .25, .5, .75] });

      scenes.forEach((scene) => sceneObserver.observe(scene));
      state.observers.push(sceneObserver);
    });
  }

  function applyExpandedPanel(button, panel, className) {
    if (button) {
      button.setAttribute('aria-expanded', 'true');
      button.classList.add('is-complete');
      button.disabled = true;
    }
    if (!panel) return;
    show(panel);
    panel.classList.add('is-active');
    if (className) panel.classList.add(className);
    unique(['[data-reveal]', '[data-insight-word]', 'p'], panel).forEach(revealImmediately);
  }

  function initInitiativeMoment() {
    const button = document.querySelector('#insight-star');
    const panel = document.querySelector('#insight-reveal');
    if (!button || !panel) return;

    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');

    if (state.interactive.insight) {
      applyExpandedPanel(button, panel, 'is-understood');
      return;
    }

    button.addEventListener('click', () => {
      if (state.interactive.insight) return;
      state.interactive.insight = true;
      button.setAttribute('aria-expanded', 'true');
      button.classList.add('is-lit', 'is-complete');
      button.disabled = true;
      show(panel);
      panel.classList.add('is-active', 'is-understood');

      const words = unique(['[data-insight-word]'], panel);
      const copy = unique(['[data-reveal]', 'p'], panel).filter((node) => !words.includes(node));
      revealSequence(words, duration(145, 0), duration(220, 0));
      revealSequence(copy, duration(260, 0), duration(900, 0));
      saveInteractiveState();
    });
  }

  function initProofMoment() {
    const button = first(['#proof-button', '[data-proof-button]']);
    const panel = first(['#proof-reveal', '[data-proof-reveal]']);
    if (!button || !panel) return;

    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');

    if (state.interactive.proof) {
      applyExpandedPanel(button, panel, 'is-proven');
      return;
    }

    button.addEventListener('click', () => {
      if (state.interactive.proof) return;
      state.interactive.proof = true;
      button.disabled = true;
      button.setAttribute('aria-expanded', 'true');
      button.classList.add('is-complete');
      show(panel);
      panel.classList.add('is-active', 'is-proven');
      revealChildren(panel, 420, 120);
      saveInteractiveState();
    });
  }

  function svgElement(name, attributes = {}) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function sunflowerPoint(centerX, centerY, angle, radial, tangent = 0) {
    const radians = angle * Math.PI / 180;
    const radialX = Math.cos(radians);
    const radialY = Math.sin(radians);
    const tangentX = -radialY;
    const tangentY = radialX;
    return [
      centerX + radialX * radial + tangentX * tangent,
      centerY + radialY * radial + tangentY * tangent
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
    svg.classList.add('cosmic-sunflower__svg', 'sunflower-svg');
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
      petal.style.setProperty('--petal-delay', (620 + index * 82) + 'ms');
      petal.style.setProperty('--petal-scale', (.94 + seeded(index, 36) * .1).toFixed(3));
      petal.style.transformBox = 'fill-box';
      petal.style.transformOrigin = 'center bottom';
      petals.appendChild(petal);
    }
    svg.appendChild(petals);

    const origin = svgElement('circle', {
      cx: 160,
      cy: 151,
      r: 5,
      class: 'sunflower-origin',
      fill: '#e7b64c',
      'aria-hidden': 'true'
    });
    svg.appendChild(origin);

    const center = svgElement('g', { class: 'sunflower-center-art', 'aria-hidden': 'true' });
    center.style.transformBox = 'fill-box';
    center.style.transformOrigin = 'center';
    center.appendChild(svgElement('circle', {
      cx: 160,
      cy: 151,
      r: 35,
      fill: '#3d281d',
      stroke: '#a86f28',
      'stroke-width': 2.2
    }));
    center.appendChild(svgElement('circle', {
      cx: 160,
      cy: 151,
      r: 29,
      fill: '#55331e',
      opacity: .96
    }));

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

  function animateSunflowerBloom(wrapper, svg) {
    if (!wrapper || !svg || wrapper.dataset.bloomed === 'true') return;
    wrapper.dataset.bloomed = 'true';
    wrapper.classList.add('is-blooming');

    const origin = $('.sunflower-origin', svg);
    const center = $('.sunflower-center-art', svg);
    const petals = $$('.sunflower-petal--visual', svg);

    if (state.reducedMotion || typeof svg.animate !== 'function') {
      [origin, center].concat(petals).filter(Boolean).forEach((node) => {
        node.style.opacity = '1';
        node.style.transform = 'none';
      });
      wrapper.classList.add('is-bloomed');
      enableSunflowerPetals(wrapper);
      enableSunflowerCenter(wrapper);
      return;
    }

    if (origin) {
      origin.animate([
        { opacity: 0, transform: 'scale(.15)' },
        { opacity: 1, transform: 'scale(1)' }
      ], { duration: 900, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'both' });
    }

    if (center) {
      center.animate([
        { opacity: 0, transform: 'scale(.08)' },
        { opacity: 1, transform: 'scale(1)' }
      ], { duration: 1450, delay: 420, easing: 'cubic-bezier(.16,.72,.24,1)', fill: 'both' });
    }

    petals.forEach((petal, index) => {
      petal.animate([
        { opacity: 0, transform: 'scale(.08) rotate(' + ((index % 2 ? 1 : -1) * 3) + 'deg)' },
        { opacity: number(petal.getAttribute('opacity'), .9), transform: 'scale(1) rotate(0deg)' }
      ], {
        duration: 980 + seeded(index, 41) * 320,
        delay: 760 + index * 86,
        easing: 'cubic-bezier(.17,.68,.2,1)',
        fill: 'both'
      });
    });

    setTimer(() => {
      wrapper.classList.add('is-bloomed');
      enableSunflowerPetals(wrapper);
    }, 1700);

    clearTimer(state.sunflowerUnlockTimer);
    state.sunflowerUnlockTimer = setTimer(() => {
      state.sunflowerUnlockTimer = 0;
      enableSunflowerCenter(wrapper);
    }, 4800);
  }

  function enableSunflowerPetals(wrapper) {
    if (!wrapper) return;
    $$('[data-sunflower-petal]', wrapper).forEach((button) => {
      button.disabled = false;
      button.removeAttribute('aria-hidden');
    });
    wrapper.classList.add('petals-are-ready');
  }

  function enableSunflowerCenter(wrapper) {
    const centerButton = first(['#sunflower-center', '[data-sunflower-center]'], wrapper || document);
    const instruction = first(['#sunflower-instruction', '[data-sunflower-instruction]'], wrapper || document);
    if (!centerButton || state.interactive.sunflowerCenter) return;

    show(centerButton);
    centerButton.disabled = false;
    centerButton.setAttribute('aria-expanded', 'false');
    centerButton.classList.add('is-ready');
    if (instruction) {
      show(instruction);
      instruction.classList.add('is-visible');
    }
    if (wrapper) wrapper.classList.add('center-is-ready');
  }

  function revealSunflowerWord(wrapper, button, wordNode, announce, index) {
    if (!wrapper || !button || !wordNode) return;
    if (!state.interactive.sunflowerPetals.includes(index)) {
      state.interactive.sunflowerPetals.push(index);
      state.interactive.sunflowerPetals.sort((a, b) => a - b);
    }
    button.classList.add('is-chosen');
    button.setAttribute('aria-pressed', 'true');
    show(wordNode);
    wordNode.classList.add('is-visible', 'revealed');
    if (announce) announce.textContent = SUNFLOWER_WORDS[index];
    wrapper.classList.add('has-explored-petals');
    saveInteractiveState();
  }

  function initSunflowerPetals(wrapper, mount) {
    if (!wrapper || !mount) return;
    let hitLayer = first(['[data-sunflower-petal-hits]', '.sunflower-petal-hits'], wrapper);
    if (!hitLayer) {
      hitLayer = document.createElement('div');
      hitLayer.className = 'sunflower-petal-hits';
      hitLayer.dataset.sunflowerPetalHits = '';
      mount.after(hitLayer);
    }
    const wordsLayer = first(['[data-sunflower-words]', '.sunflower-words'], wrapper) || wrapper;
    let buttons = $$('[data-sunflower-petal]', hitLayer);
    let words = $$('[data-sunflower-word]', wordsLayer);
    const announce = first(['#sunflower-word-live', '[data-sunflower-word-live]'], wrapper);

    if (!buttons.length) {
      const selectedPetals = [0, 3, 6, 9, 12, 15, 18, 21];
      selectedPetals.forEach((petalIndex, index) => {
        const angle = -90 + petalIndex * 15;
        const radians = angle * Math.PI / 180;
        const button = document.createElement('button');
        const spark = document.createElement('span');
        const x = 50 + Math.cos(radians) * 31;
        const y = 47.2 + Math.sin(radians) * 31;

        button.type = 'button';
        button.className = 'sunflower-petal-hit';
        button.dataset.sunflowerPetal = '';
        button.dataset.index = String(index);
        button.dataset.word = SUNFLOWER_WORDS[index];
        button.setAttribute('aria-label', 'Revelar: ' + SUNFLOWER_WORDS[index]);
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-hidden', 'true');
        button.disabled = true;
        button.style.left = x.toFixed(2) + '%';
        button.style.top = y.toFixed(2) + '%';
        button.style.setProperty('--petal-angle', angle + 'deg');
        button.style.setProperty('--petal-x', x.toFixed(2) + '%');
        button.style.setProperty('--petal-y', y.toFixed(2) + '%');
        spark.className = 'sunflower-petal-hit__spark';
        spark.setAttribute('aria-hidden', 'true');
        button.appendChild(spark);
        hitLayer.appendChild(button);

        const word = document.createElement('span');
        const wordRadius = index % 2 ? 41 : 39;
        const wordX = 50 + Math.cos(radians) * wordRadius;
        const wordY = 47.2 + Math.sin(radians) * wordRadius;
        word.className = 'sunflower-word';
        word.dataset.sunflowerWord = '';
        word.dataset.index = String(index);
        word.textContent = SUNFLOWER_WORDS[index];
        word.hidden = true;
        word.style.left = wordX.toFixed(2) + '%';
        word.style.top = wordY.toFixed(2) + '%';
        word.style.setProperty('--word-x', wordX.toFixed(2) + '%');
        word.style.setProperty('--word-y', wordY.toFixed(2) + '%');
        wordsLayer.appendChild(word);
      });

      buttons = $$('[data-sunflower-petal]', hitLayer);
      words = $$('[data-sunflower-word]', wordsLayer);
    }

    buttons.forEach((button, index) => {
      button.type = 'button';
      const resolvedIndex = number(button.dataset.index, index);
      const wordNode = words.find((word) => number(word.dataset.index, -1) === resolvedIndex) || words[index];

      if (state.interactive.sunflowerPetals.includes(resolvedIndex)) {
        button.classList.add('is-chosen');
        button.setAttribute('aria-pressed', 'true');
        if (wordNode) revealImmediately(wordNode);
      }

      button.addEventListener('click', () => {
        revealSunflowerWord(wrapper, button, wordNode, announce, resolvedIndex);
      });
    });
  }

  function openSunflowerCenter(wrapper, centerButton, revelation, instruction, restoring = false) {
    if (!wrapper || !centerButton || !revelation) return;
    state.interactive.sunflowerCenter = true;
    clearTimer(state.sunflowerUnlockTimer);
    state.sunflowerUnlockTimer = 0;
    centerButton.disabled = true;
    centerButton.setAttribute('aria-expanded', 'true');
    centerButton.classList.add('is-open');
    wrapper.classList.add('is-zoomed', 'has-open-center');
    if (instruction) instruction.hidden = true;
    show(revelation);
    revelation.classList.add('is-active');

    const lines = unique(['[data-reveal]', '[data-sunflower-line]', 'p'], revelation);
    if (restoring) {
      lines.forEach(revealImmediately);
    } else {
      revealSequence(lines, duration(720, 0), duration(350, 0));
      const svg = $('.sunflower-svg', wrapper);
      if (svg && !state.reducedMotion && typeof svg.animate === 'function') {
        svg.animate([
          { transform: 'scale(1)' },
          { transform: 'scale(1.075)' }
        ], {
          duration: 1800,
          easing: 'cubic-bezier(.2,.7,.2,1)',
          fill: 'forwards'
        });
      }
    }
    saveInteractiveState();
  }

  function initCosmicSunflower() {
    const wrapper = first(['#cosmic-sunflower', '[data-cosmic-sunflower]', '.cosmic-sunflower']);
    if (!wrapper) return;
    const mount = first(['[data-sunflower-mount]', '.sunflower-mount'], wrapper) || wrapper;
    let svg = $('.sunflower-svg:not(.sunflower-svg--miniature)', mount);
    if (!svg) {
      svg = createSunflowerSvg(false);
      mount.insertBefore(svg, mount.firstChild);
    }

    let centerButton = first(['#sunflower-center', '[data-sunflower-center]'], wrapper);
    if (!centerButton) {
      centerButton = document.createElement('button');
      centerButton.id = 'sunflower-center';
      centerButton.type = 'button';
      centerButton.className = 'sunflower-center-button';
      centerButton.dataset.sunflowerCenter = '';
      centerButton.setAttribute('aria-label', 'Abrir el corazón del girasol');
      wrapper.appendChild(centerButton);
    }
    centerButton.type = 'button';

    const revelation = first(['#sunflower-revelation', '[data-sunflower-revelation]']);
    const instruction = first(['#sunflower-instruction', '[data-sunflower-instruction]'], wrapper);
    initSunflowerPetals(wrapper, mount);

    if (state.interactive.sunflowerCenter && revelation) {
      show(centerButton);
      enableSunflowerPetals(wrapper);
      wrapper.dataset.bloomed = 'true';
      wrapper.classList.add('is-blooming', 'is-bloomed');
      openSunflowerCenter(wrapper, centerButton, revelation, instruction, true);
    } else {
      centerButton.disabled = true;
      centerButton.hidden = true;
      if (instruction) instruction.hidden = true;
      observeOnce(wrapper, () => {
        animateSunflowerBloom(wrapper, svg);
        if (state.startedBefore && sceneRank(state.savedScene) > 4) {
          enableSunflowerPetals(wrapper);
          enableSunflowerCenter(wrapper);
        }
      }, { threshold: .2, rootMargin: '0px 0px -8% 0px' });
    }

    centerButton.addEventListener('click', () => {
      if (centerButton.disabled || state.interactive.sunflowerCenter || !revelation) return;
      openSunflowerCenter(wrapper, centerButton, revelation, instruction, false);
    });
  }

  function createConstellationLines(container, count) {
    if (!container || count < 2) return;
    let svg = $('.constellation-lines', container);
    if (svg) {
      svg.replaceChildren();
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
    } else {
      svg = svgElement('svg', {
        viewBox: '0 0 100 100',
        preserveAspectRatio: 'none',
        class: 'constellation-lines',
        'aria-hidden': 'true'
      });
    }
    const links = [[0, 1], [1, 2], [2, 3], [2, 5], [3, 4], [4, 5]];
    links.filter((pair) => pair[0] < count && pair[1] < count).forEach((pair) => {
      const from = CONSTELLATION_POSITIONS[pair[0]] || [20, 50];
      const to = CONSTELLATION_POSITIONS[pair[1]] || [80, 50];
      const line = svgElement('line', {
        x1: from[0],
        y1: from[1],
        x2: to[0],
        y2: to[1],
        class: 'constellation-line',
        'data-from': pair[0],
        'data-to': pair[1]
      });
      svg.appendChild(line);
    });
    if (!svg.parentElement) container.insertBefore(svg, container.firstChild);
  }

  function updateConstellationState(container, stars) {
    const visited = new Set(state.interactive.constellationVisited);
    stars.forEach((star, index) => {
      const resolvedIndex = number(star.dataset.index, index);
      star.classList.toggle('is-visited', visited.has(resolvedIndex));
    });
    $$('.constellation-line', container).forEach((line, index) => {
      const hasEndpoints = line.dataset.from !== undefined && line.dataset.to !== undefined;
      const from = number(line.dataset.from, -1);
      const to = number(line.dataset.to, -1);
      const shouldLight = hasEndpoints
        ? visited.has(from) && visited.has(to)
        : visited.size > index;
      line.classList.toggle('is-lit', shouldLight);
    });
    container.classList.toggle('is-complete', visited.size >= stars.length && stars.length > 0);
  }

  function initConstellation() {
    const container = first(['#constellation', '[data-constellation]', '.constellation']);
    if (!container) return;
    const stars = unique(['[data-constellation-star]', '.constellation-star'], container);
    const panel = first(['#constellation-panel', '[data-constellation-panel]', '.constellation-modal']);
    const title = panel ? first(['#constellation-title', '[data-constellation-title]'], panel) : null;
    const message = panel ? first(['#constellation-message', '[data-constellation-message]'], panel) : null;
    const close = panel ? first(['#constellation-close', '[data-constellation-close]', '.constellation-close'], panel) : null;

    stars.forEach((star, index) => {
      const position = CONSTELLATION_POSITIONS[index];
      const resolvedIndex = number(star.dataset.index, index);
      star.type = 'button';
      star.dataset.index = String(resolvedIndex);
      star.setAttribute('aria-expanded', 'false');
      if (panel && panel.id) star.setAttribute('aria-controls', panel.id);
      if (position) {
        star.style.setProperty('--star-x', position[0] + '%');
        star.style.setProperty('--star-y', position[1] + '%');
      }
    });

    createConstellationLines(container, stars.length);
    updateConstellationState(container, stars);

    let activeStar = null;

    const closePanel = () => {
      if (!panel || panel.hidden) return;
      panel.classList.remove('is-open', 'is-visible');
      panel.setAttribute('aria-hidden', 'true');
      panel.hidden = true;
      document.body.classList.remove('constellation-dialog-open');
      stars.forEach((star) => {
        star.classList.remove('is-active');
        star.setAttribute('aria-expanded', 'false');
      });
      activeStar = null;
    };

    stars.forEach((star, index) => {
      star.addEventListener('click', () => {
        const resolvedIndex = number(star.dataset.index, index);
        if (!state.interactive.constellationVisited.includes(resolvedIndex)) {
          state.interactive.constellationVisited.push(resolvedIndex);
          state.interactive.constellationVisited.sort((a, b) => a - b);
        }
        activeStar = star;
        stars.forEach((item) => {
          const active = item === star;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-expanded', String(active));
        });
        updateConstellationState(container, stars);
        saveInteractiveState();

        if (!panel) return;
        if (title) title.textContent = star.dataset.title || star.getAttribute('aria-label') || 'Una estrella';
        if (message) message.textContent = star.dataset.message || '';
        show(panel);
        panel.classList.add('is-open', 'is-visible');
        panel.setAttribute('aria-hidden', 'false');
        document.body.classList.add('constellation-dialog-open');
      });
    });

    if (close) {
      close.type = 'button';
      close.addEventListener('click', closePanel);
    }
    panel?.addEventListener('click', (event) => {
      if (event.target === panel) closePanel();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && activeStar) {
        event.preventDefault();
        closePanel();
      }
    });
  }

  function flattenAndreaLayout() {
    const points = [];
    const advance = 6;
    ANDREA_LAYOUT.forEach((glyph, letterIndex) => {
      glyph.points.forEach((point, pointIndex) => {
        points.push({
          letter: glyph.letter,
          letterIndex,
          pointIndex,
          x: letterIndex * advance + point[0],
          y: point[1]
        });
      });
    });
    return points;
  }

  function revealAndreaCaption(restoring = false) {
    const nodes = unique(['[data-andrea-after]', '.andrea-after']);
    const lines = [];
    nodes.forEach((node) => {
      show(node);
      if (node.matches('p, h2, h3, [data-reveal]')) lines.push(node);
      else lines.push(...unique(['[data-reveal]', 'p'], node));
    });
    if (restoring) lines.forEach(revealImmediately);
    else revealSequence(lines, duration(460, 0), duration(1150, 0));
  }

  function finishAndrea(stage, stars, restoring = false) {
    stars.forEach((star) => {
      star.style.transform = 'translate3d(0,0,0) scale(1)';
      star.style.opacity = star.dataset.targetOpacity || '1';
      star.classList.add('is-formed');
    });
    stage.classList.remove('is-forming');
    stage.classList.add('is-formed');
    document.body.classList.remove('andrea-is-forming');
    state.interactive.andrea = true;
    revealAndreaCaption(restoring);
    saveInteractiveState();
  }

  function formAndreaName(stage, stars) {
    if (!stage || stage.dataset.formed === 'true') return;
    stage.dataset.formed = 'true';
    stage.classList.add('is-forming');
    document.body.classList.add('andrea-is-forming');

    if (state.reducedMotion || typeof Element.prototype.animate !== 'function') {
      finishAndrea(stage, stars, false);
      return;
    }

    const rectangle = stage.getBoundingClientRect();
    const width = Math.max(rectangle.width, 280);
    const height = Math.max(rectangle.height, 170);
    let longest = 0;

    stars.forEach((star, index) => {
      const targetX = number(star.dataset.targetX, 50);
      const targetY = number(star.dataset.targetY, 50);
      const fromX = number(star.dataset.fromX, 50);
      const fromY = number(star.dataset.fromY, 50);
      const offsetX = (fromX - targetX) * width / 100;
      const offsetY = (fromY - targetY) * height / 100;
      const traceX = offsetX * .55 + (seeded(index, 51) - .5) * 58;
      const traceY = offsetY * .5 + (seeded(index, 52) - .5) * 42;
      const traceTwoX = offsetX * .22 + (seeded(index, 53) - .5) * 32;
      const traceTwoY = offsetY * .2 + (seeded(index, 54) - .5) * 28;
      const animationDuration = 2400 + seeded(index, 55) * 1050;
      const delay = (index % 13) * 34 + Math.floor(index / 13) * 65;
      longest = Math.max(longest, animationDuration + delay);

      const animation = star.animate([
        { opacity: .06, transform: 'translate3d(' + offsetX.toFixed(2) + 'px,' + offsetY.toFixed(2) + 'px,0) scale(.35)' },
        { opacity: .42, transform: 'translate3d(' + traceX.toFixed(2) + 'px,' + traceY.toFixed(2) + 'px,0) scale(.65)', offset: .42 },
        { opacity: .72, transform: 'translate3d(' + traceTwoX.toFixed(2) + 'px,' + traceTwoY.toFixed(2) + 'px,0) scale(.82)', offset: .72 },
        { opacity: number(star.dataset.targetOpacity, .9), transform: 'translate3d(0,0,0) scale(1)' }
      ], {
        duration: animationDuration,
        delay,
        easing: 'cubic-bezier(.22,.72,.2,1)',
        fill: 'forwards'
      });
      animation.finished.then(() => {
        star.style.opacity = star.dataset.targetOpacity || '1';
        star.style.transform = 'translate3d(0,0,0) scale(1)';
        animation.cancel();
      }).catch(() => {});
    });

    setTimer(() => finishAndrea(stage, stars, false), longest + 80);
  }

  function initAndreaStars() {
    const stage = first(['#andrea-stars', '[data-andrea-stars]', '.andrea-stage']);
    if (!stage) return;
    const mount = first(['[data-andrea-mount]', '.andrea-mount'], stage) || stage;
    let stars = $$('[data-andrea-generated]', mount);

    if (!stars.length) {
      const points = flattenAndreaLayout();
      const fragment = document.createDocumentFragment();
      const totalWidth = (ANDREA_LAYOUT.length - 1) * 6 + 4;

      points.forEach((point, index) => {
        const star = document.createElement('span');
        const targetX = 5 + point.x / totalWidth * 90;
        const targetY = 17 + point.y / 6 * 66;
        const size = 1.8 + seeded(index, 47) * 2.6;

        star.className = 'andrea-star';
        star.dataset.andreaGenerated = 'true';
        star.dataset.letter = point.letter;
        star.dataset.letterIndex = String(point.letterIndex);
        star.dataset.fromX = (3 + seeded(index, 43) * 94).toFixed(3);
        star.dataset.fromY = (3 + seeded(index, 44) * 94).toFixed(3);
        star.dataset.targetX = targetX.toFixed(3);
        star.dataset.targetY = targetY.toFixed(3);
        star.dataset.targetOpacity = (.78 + seeded(index, 45) * .22).toFixed(2);
        star.setAttribute('aria-hidden', 'true');
        star.style.left = star.dataset.targetX + '%';
        star.style.top = star.dataset.targetY + '%';
        star.style.opacity = '0';
        star.style.setProperty('--size', size.toFixed(2) + 'px');
        star.style.setProperty('--andrea-star-size', size.toFixed(2) + 'px');
        star.style.setProperty('--twinkle-duration', (4.2 + seeded(index, 48) * 3.4).toFixed(2) + 's');
        star.style.setProperty('--twinkle-delay', (-seeded(index, 49) * 4.8).toFixed(2) + 's');
        fragment.appendChild(star);
      });
      mount.appendChild(fragment);
      stars = $$('[data-andrea-generated]', mount);
    }

    mount.classList.add('is-enhanced');
    stage.setAttribute('role', 'img');
    stage.setAttribute('aria-label', 'Las estrellas forman lentamente el nombre ANDREA');

    const shouldRestore = state.interactive.andrea || sceneRank(state.savedScene) > 10;
    if (shouldRestore) {
      stage.dataset.formed = 'true';
      finishAndrea(stage, stars, true);
    } else {
      observeOnce(stage, () => formAndreaName(stage, stars), {
        threshold: .24,
        rootMargin: '0px 0px -7% 0px'
      });
    }
  }

  function ensureFutureRoutes(stage) {
    if (!stage || $('.future-routes', stage)) return;
    const existingSvg = first(['svg.future-path__trail', 'svg'], stage);
    if (existingSvg) {
      existingSvg.classList.remove('future-path__trail');
      existingSvg.classList.add('future-routes');
      const existingPaths = $$('path', existingSvg).slice(0, 2);
      existingPaths.forEach((path, index) => {
        path.classList.add('future-route', index === 0 ? 'future-route--first' : 'future-route--second');
        path.setAttribute('pathLength', '1');
      });
      return;
    }
    const svg = svgElement('svg', {
      viewBox: '0 0 100 100',
      preserveAspectRatio: 'none',
      class: 'future-routes',
      'aria-hidden': 'true'
    });
    svg.appendChild(svgElement('path', {
      d: 'M 16 39 C 38 35, 58 27, 84 19',
      class: 'future-route future-route--first',
      pathLength: 1
    }));
    svg.appendChild(svgElement('path', {
      d: 'M 16 66 C 38 62, 58 54, 84 46',
      class: 'future-route future-route--second',
      pathLength: 1
    }));
    stage.insertBefore(svg, stage.firstChild);
  }

  function revealFutureCopy(restoring = false) {
    const copy = unique(['[data-future-after]', '.future-after']);
    if (restoring) copy.forEach(revealImmediately);
    else revealSequence(copy, duration(380, 0), duration(620, 0));
  }

  function finishFuture(stage, stars, distanceX, distanceY, restoring = false) {
    stars.slice(0, 2).forEach((star) => {
      star.style.transform = 'translate3d(' + distanceX.toFixed(2) + 'px,' + distanceY.toFixed(2) + 'px,0)';
    });
    stage.classList.remove('is-travelling');
    stage.classList.add('is-aligned');
    state.interactive.future = true;
    revealFutureCopy(restoring);
    saveInteractiveState();
  }

  function animateFutureStars(stage, stars) {
    if (stage.dataset.animated === 'true') return;
    stage.dataset.animated = 'true';
    stage.classList.add('is-travelling');
    const rectangle = stage.getBoundingClientRect();
    const distanceX = Math.max(120, rectangle.width * .52);
    const distanceY = -Math.max(24, rectangle.height * .17);
    const travelTime = duration(4400, 0);

    if (!travelTime || typeof Element.prototype.animate !== 'function') {
      finishFuture(stage, stars, distanceX, distanceY, false);
      return;
    }

    stars.slice(0, 2).forEach((star, index) => {
      const offset = index === 0 ? -4 : 4;
      const animation = star.animate([
        { opacity: .65, transform: 'translate3d(0,0,0)' },
        { opacity: 1, transform: 'translate3d(' + (distanceX * .48).toFixed(2) + 'px,' + (distanceY * .48 + offset).toFixed(2) + 'px,0)', offset: .5 },
        { opacity: 1, transform: 'translate3d(' + distanceX.toFixed(2) + 'px,' + distanceY.toFixed(2) + 'px,0)' }
      ], {
        duration: travelTime,
        delay: index * 90,
        easing: 'cubic-bezier(.38,0,.2,1)',
        fill: 'forwards'
      });
      animation.finished.catch(() => {});
    });

    $$('.future-route', stage).forEach((route, index) => {
      if (typeof route.animate !== 'function') return;
      route.animate([
        { strokeDasharray: '1', strokeDashoffset: '1', opacity: 0 },
        { opacity: .38, offset: .24 },
        { strokeDasharray: '1', strokeDashoffset: '0', opacity: .18 }
      ], {
        duration: travelTime,
        delay: index * 90,
        easing: 'ease-in-out',
        fill: 'forwards'
      });
    });

    setTimer(() => finishFuture(stage, stars, distanceX, distanceY, false), travelTime + 140);
  }

  function initFutureStars() {
    const stage = first(['#future-path', '[data-future-path]', '.future-path']);
    if (!stage) return;
    let stars = unique(['[data-future-star]', '.future-star'], stage);
    while (stars.length < 2) {
      const star = document.createElement('span');
      star.className = 'future-star future-star--' + (stars.length ? 'second' : 'first');
      star.dataset.futureStar = stars.length ? 'second' : 'first';
      star.setAttribute('aria-hidden', 'true');
      stage.appendChild(star);
      stars.push(star);
    }

    stars[0].style.left = '16%';
    stars[0].style.top = '39%';
    stars[1].style.left = '16%';
    stars[1].style.top = '66%';
    ensureFutureRoutes(stage);
    stage.setAttribute('aria-label', 'Dos estrellas separadas avanzan en la misma dirección');

    const rectangle = stage.getBoundingClientRect();
    const distanceX = Math.max(120, rectangle.width * .52);
    const distanceY = -Math.max(24, rectangle.height * .17);
    const shouldRestore = state.interactive.future || sceneRank(state.savedScene) > 8;
    if (shouldRestore) {
      stage.dataset.animated = 'true';
      finishFuture(stage, stars, distanceX, distanceY, true);
    } else {
      observeOnce(stage, () => animateFutureStars(stage, stars), { threshold: .27 });
    }
  }

  function initSecretStar() {
    const secretStar = first(['#secret-star', '[data-secret-star]', '.secret-star']);
    const message = first(['#secret-message', '[data-secret-message]', '.secret-message']);
    if (!secretStar || !message) return;
    const close = first(['#secret-close', '[data-secret-close]', '.secret-message__close'], message);

    secretStar.type = 'button';
    secretStar.setAttribute('aria-expanded', 'false');
    if (state.interactive.secret) secretStar.classList.add('was-found');

    const closeMessage = () => {
      message.classList.remove('is-open', 'is-visible');
      message.hidden = true;
      secretStar.setAttribute('aria-expanded', 'false');
    };

    secretStar.addEventListener('click', () => {
      state.interactive.secret = true;
      secretStar.classList.add('is-found', 'was-found');
      secretStar.setAttribute('aria-expanded', 'true');
      show(message);
      message.classList.add('is-open', 'is-visible');
      revealChildren(message, 190, 80);
      saveInteractiveState();
    });

    if (close) {
      close.type = 'button';
      close.addEventListener('click', closeMessage);
    }
  }

  function initFinalSunflower() {
    const mount = first(['[data-final-sunflower-mount]', '.final-sunflower-mount']);
    if (!mount || $('.sunflower-svg--miniature', mount)) return;
    mount.appendChild(createSunflowerSvg(true));
  }

  function showFinale(finale, trigger, restoring = false) {
    if (!finale) return;
    state.interactive.finale = true;
    stopAmbientTimers();
    $$('[data-generated-shooting-star]').forEach((star) => star.remove());
    if (trigger) {
      trigger.type = 'button';
      trigger.disabled = true;
      trigger.setAttribute('aria-expanded', 'true');
      trigger.classList.add('is-complete');
    }
    show(finale);
    finale.classList.add('is-active');
    document.body.classList.add('finale-active', 'finale-open');
    initFinalSunflower();

    const lines = unique(['[data-final-line]', '[data-reveal]', 'p'], finale);
    const finalStar = first(['[data-final-star]', '.final-star'], finale);
    const finalSunflower = first(['[data-final-sunflower-mount]', '.final-sunflower-mount'], finale);
    const shootingStar = first(['[data-shooting-star]', '.final-shooting-star'], finale);

    if (restoring) {
      revealImmediately(finalStar);
      lines.forEach(revealImmediately);
      if (finalSunflower) finalSunflower.classList.add('is-visible');
      if (shootingStar) shootingStar.classList.add('has-passed');
      finale.classList.add('is-complete');
    } else {
      revealImmediately(finalStar);
      show(finalSunflower);
      show(shootingStar);
      const timeline = [0, 1200, 2000, 2800, 4500, 5500, 7000, 8200, 10000, 14500, 17500];
      // Reserve every line now, then reveal on an authored emotional timeline.
      lines.forEach(show);
      lines.forEach((line, index) => {
        revealNode(line, duration(timeline[index] === undefined ? 17500 + (index - 10) * 1200 : timeline[index], 0));
      });
      const total = duration(timeline[Math.min(lines.length - 1, timeline.length - 1)] || 0, 0);
      setTimer(() => {
        if (finalSunflower) finalSunflower.classList.add('is-visible');
      }, duration(total + 2200, 0));
      setTimer(() => {
        if (shootingStar) shootingStar.classList.add('is-active');
        finale.classList.add('is-complete');
      }, duration(total + 3400, 0));
    }
    saveInteractiveState();
  }

  function initFinale() {
    const trigger = document.querySelector('#last-star-trigger');
    const finale = document.querySelector('#finale');
    if (!finale) return;
    initFinalSunflower();

    if (state.interactive.finale) {
      showFinale(finale, trigger, true);
      return;
    }

    if (!trigger) return;
    trigger.type = 'button';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', () => {
      if (state.interactive.finale) return;
      showFinale(finale, trigger, false);
    });
  }

  function createLightRipple(target, event) {
    if (!target || state.reducedMotion) return;
    const rectangle = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'light-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.left = (event.clientX - rectangle.left) + 'px';
    ripple.style.top = (event.clientY - rectangle.top) + 'px';
    target.appendChild(ripple);

    if (typeof ripple.animate === 'function') {
      const animation = ripple.animate([
        { opacity: .5, transform: 'translate(-50%,-50%) scale(.1)' },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(4)' }
      ], { duration: 850, easing: 'cubic-bezier(.16,.72,.25,1)' });
      animation.finished.catch(() => {}).finally(() => ripple.remove());
    } else {
      setTimer(() => ripple.remove(), 900);
    }
  }

  function initLightRipples() {
    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest('.cosmic-btn, [data-ripple], [data-constellation-star], [data-sunflower-petal], [data-secret-star]');
      if (target) createLightRipple(target, event);
    });
  }

  function initSunflowerEcho() {
    const echo = first(['[data-sunflower-echo]', '.sunflower-echo']);
    if (!echo || $('.sunflower-svg--miniature', echo)) return;
    echo.appendChild(createSunflowerSvg(true));
    observeOnce(echo, () => echo.classList.add('is-visible'), { threshold: .15 });
  }

  function initGalaxyDepth() {
    const galaxy = first(['#galaxy', '[data-galaxy]', '.galaxy']);
    if (!galaxy) return;
    observeOnce(galaxy, () => galaxy.classList.add('is-illuminated'), {
      threshold: .16,
      rootMargin: '0px 0px -5% 0px'
    });
  }

  function updateScrollProgress() {
    state.scrollFrame = 0;
    const root = document.documentElement;
    const maximum = Math.max(1, root.scrollHeight - window.innerHeight);
    const amount = clamp(window.scrollY / maximum, 0, 1);
    const progress = first(['#scroll-progress', '[data-scroll-progress]', '.progress-bar']);

    root.style.setProperty('--scroll-progress', amount.toFixed(4));
    root.style.setProperty('--scroll-parallax', (amount * 28).toFixed(2) + 'px');
    document.body.classList.toggle('near-the-end', amount > .93);

    if (progress) {
      progress.style.transform = 'scaleX(' + amount.toFixed(4) + ')';
      progress.setAttribute('aria-valuemin', '0');
      progress.setAttribute('aria-valuemax', '100');
      progress.setAttribute('aria-valuenow', String(Math.round(amount * 100)));
    }
  }

  function requestProgressUpdate() {
    if (!state.scrollFrame) state.scrollFrame = requestAnimationFrame(updateScrollProgress);
  }

  function initScrollProgress() {
    window.addEventListener('scroll', () => {
      requestProgressUpdate();
      queueExperienceSave();
    }, { passive: true });
    window.addEventListener('resize', requestProgressUpdate, { passive: true });
    requestProgressUpdate();
  }

  function applyEnteredShell(restore = false) {
    const door = first(['#scene-0', '[data-scene="0"]', '.door', '.intro-screen']);
    const experience = first(['#experience', '[data-experience]', 'main.experience']);

    state.entered = true;
    document.body.classList.add('experience-started', 'is-entered');
    document.body.classList.remove('is-locked', 'experience-locked', 'no-scroll');
    if (experience) {
      experience.removeAttribute('aria-hidden');
      experience.inert = false;
    }

    const starField = first(['#star-field', '[data-star-field]', '.starfield']);
    if (starField) starField.classList.add('is-visible');

    if (door) {
      door.classList.add(restore ? 'is-restored-away' : 'is-leaving');
      door.setAttribute('aria-hidden', 'true');
      if (restore) door.hidden = true;
    }
  }

  function restoreSavedScrollPosition() {
    if (!state.startedBefore || state.restoredScroll) {
      state.restoring = false;
      document.documentElement.classList.remove('is-returning');
      return;
    }

    state.restoredScroll = true;
    const savedY = state.savedScroll;
    let settled = false;
    const cancellationEvents = ['pointerdown', 'touchstart', 'wheel', 'keydown'];

    const cancelRestoration = () => {
      state.restorationCancelled = true;
    };
    const removeCancellationListeners = () => {
      cancellationEvents.forEach((name) => {
        window.removeEventListener(name, cancelRestoration);
      });
    };
    cancellationEvents.forEach((name) => {
      window.addEventListener(name, cancelRestoration, { passive: true });
    });

    const complete = () => {
      if (settled) return;
      settled = true;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!state.restorationCancelled && savedY > 0) {
            const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            const restoredY = clamp(savedY, 0, maximum);
            window.scrollTo({ top: restoredY, left: 0, behavior: 'auto' });
          }
          state.restoring = false;
          state.currentScene = state.savedScene;
          document.documentElement.classList.remove('is-returning');
          removeCancellationListeners();
          requestProgressUpdate();
        });
      });
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(complete).catch(complete);
      setTimer(complete, 900);
    } else {
      complete();
    }
  }

  function restoreExperience() {
    if (!state.startedBefore) return false;
    if ('scrollRestoration' in window.history) {
      try {
        window.history.scrollRestoration = 'manual';
      } catch (_error) {
        // Older embedded browsers can expose a read-only implementation.
      }
    }

    applyEnteredShell(true);
    restoreAudio();
    document.body.classList.add('has-started-before');
    document.dispatchEvent(new CustomEvent('andrea:experience-started'));
    restoreSavedScrollPosition();
    return true;
  }

  function revealDoor(door, enterButton) {
    if (!door) return;
    door.classList.add('is-ready');
    const lines = unique(['[data-intro-line]', '[data-door-line]', '.intro-line'], door);
    let lastDelay = 0;

    lines.forEach((line, index) => {
      const authored = number(line.dataset.delay, 900 + index * 1800);
      lastDelay = Math.max(lastDelay, authored);
      revealNode(line, authored);
    });

    if (!enterButton) return;
    enterButton.hidden = true;
    enterButton.disabled = true;
    setTimer(() => {
      show(enterButton);
      enterButton.disabled = false;
      enterButton.classList.add('is-visible', 'revealed');
    }, duration(lastDelay + 900, 0));
  }

  function enterExperience(door, experience, enterButton) {
    if (state.entered) return;

    // This is the only audio start before the click handler yields.
    startAudio();
    state.entered = true;
    state.startedBefore = true;
    state.currentScene = '1';
    state.savedScene = '1';
    state.savedScroll = Math.max(0, window.scrollY);

    if (enterButton) {
      enterButton.disabled = true;
      enterButton.setAttribute('aria-expanded', 'true');
    }
    applyEnteredShell(false);
    updateAudioControls();
    if (experience) {
      experience.removeAttribute('aria-hidden');
      experience.inert = false;
    }

    saveExperienceState();
    document.documentElement.classList.remove('is-returning');
    document.dispatchEvent(new CustomEvent('andrea:experience-started'));

    setTimer(() => {
      if (!door) return;
      door.hidden = true;
      door.classList.add('is-hidden');
    }, duration(1350, 0));
  }

  function initEntrance() {
    const door = first(['#scene-0', '[data-scene="0"]', '.door', '.intro-screen']);
    const experience = first(['#experience', '[data-experience]', 'main.experience']);
    const enterButton = first(['#enter-button', '[data-enter]']);

    if (restoreExperience()) return;

    document.documentElement.classList.remove('is-returning');
    document.body.classList.add('is-locked', 'experience-locked');
    document.body.classList.remove('has-started-before');
    if (experience) {
      experience.setAttribute('aria-hidden', 'true');
      experience.inert = true;
    }

    if (!enterButton) {
      state.entered = true;
      state.startedBefore = true;
      applyEnteredShell(false);
      updateAudioControls();
      saveExperienceState();
      document.dispatchEvent(new CustomEvent('andrea:experience-started'));
      return;
    }

    enterButton.type = 'button';
    enterButton.setAttribute('aria-expanded', 'false');
    revealDoor(door, enterButton);
    enterButton.addEventListener('click', () => {
      enterExperience(door, experience, enterButton);
    }, { once: true });
  }

  function stopAmbientTimers() {
    clearTimer(state.shootingTimer);
    state.shootingTimer = 0;
    state.shootingActive = false;
  }

  function resumeAmbientTimers() {
    const starField = first(['#star-field', '[data-star-field]', '.starfield']);
    if (state.entered && !state.interactive.finale && starField && !state.reducedMotion) {
      scheduleShootingStars(starField, false);
    }
  }

  function initLifecycle() {
    window.addEventListener('pagehide', () => {
      saveExperienceState();
      stopAmbientTimers();
    });

    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      // BFCache kept this exact DOM and these exact listeners. Only resume
      // lightweight state; never initialize or reconstruct anything here.
      if (state.entered) {
        applyEnteredShell(true);
        if (state.audio && state.audio.paused && state.audioAvailable) {
          state.audioPlaying = false;
          updateAudioControls();
        }
        resumeAmbientTimers();
        requestProgressUpdate();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        saveExperienceState();
        stopAmbientTimers();
        return;
      }
      if (state.audio && state.audio.paused && state.audioHasPlayed) {
        state.audioPlaying = false;
        updateAudioControls();
      }
      resumeAmbientTimers();
      requestProgressUpdate();
    });
  }

  function initExperience() {
    if (state.initialized) return;
    state.initialized = true;
    document.documentElement.classList.add('js');
    loadExperienceState();
    setMotionPreference();
    setAllButtonTypes();

    if (typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', setMotionPreference);
    } else if (typeof motionQuery.addListener === 'function') {
      motionQuery.addListener(setMotionPreference);
    }

    const initializers = [
      initAudio,
      createStars,
      initInitiativeMoment,
      initProofMoment,
      initCosmicSunflower,
      initSunflowerEcho,
      initConstellation,
      initFutureStars,
      initGalaxyDepth,
      initSecretStar,
      initAndreaStars,
      initFinale,
      initScrollAnimations,
      initScrollProgress,
      initLightRipples,
      initLifecycle
    ];

    initializers.forEach((initialize) => {
      try {
        initialize();
      } catch (_error) {
        document.body.dataset.enhancementFallback = 'true';
      }
    });

    initEntrance();
    setAllButtonTypes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExperience, { once: true });
  } else {
    initExperience();
  }
})();
