(() => {
  'use strict';

  const STORAGE_KEYS = Object.freeze({
    started: 'andrea-universe:started',
    haptic: 'andrea-universe:first-te-quiero-haptic',
    secret: 'andrea-universe:secret-star'
  });

  const CONSTELLATION_STORIES = Object.freeze([
    {
      title: 'Lo que extraño',
      message: 'Esas conversaciones que empezaban hablando de cualquier bobada y terminaban convirtiéndose en parte de mi día favorito.'
    },
    {
      title: 'Lo que aprendí',
      message: 'Que una relación no puede vivir solamente de lo que uno siente. También hay que demostrarlo.'
    },
    {
      title: 'Lo que quiero recuperar',
      message: 'Las ganas de sorprendernos, inventarnos planes y seguir construyendo recuerdos.'
    },
    {
      title: 'Lo que quiero cambiar',
      message: 'Dejar de esperar. Tener iniciativa. Buscarte simplemente porque quiero verte.'
    },
    {
      title: 'El futuro',
      message: 'No sé exactamente cómo será. Pero cuando imagino uno bonito, me gustaría que estuvieras ahí.'
    },
    {
      title: 'Una estrella vacía',
      message: 'Esta todavía no tiene historia. Tal vez podamos llenarla algún día con algo que todavía no ha pasado.'
    }
  ]);

  const CONSTELLATION_POSITIONS = Object.freeze([
    [12, 62],
    [27, 25],
    [47, 43],
    [64, 17],
    [83, 47],
    [63, 78]
  ]);

  // Each pair is a point in a 4 x 6 glyph. Keeping this data explicit makes
  // the final word stable and legible at every responsive size.
  const ANDREA_LAYOUT = Object.freeze([
    {
      letter: 'A',
      points: [[0, 6], [0.45, 4.6], [0.9, 3.2], [1.35, 1.8], [2, 0], [2.65, 1.8], [3.1, 3.2], [3.55, 4.6], [4, 6], [1, 3.55], [2, 3.55], [3, 3.55]]
    },
    {
      letter: 'N',
      points: [[0, 6], [0, 4.5], [0, 3], [0, 1.5], [0, 0], [0.8, 1.2], [1.6, 2.4], [2.4, 3.6], [3.2, 4.8], [4, 6], [4, 4.5], [4, 3], [4, 1.5], [4, 0]]
    },
    {
      letter: 'D',
      points: [[0, 0], [0, 1.5], [0, 3], [0, 4.5], [0, 6], [1.2, 0], [2.6, 0.2], [3.6, 1.2], [4, 3], [3.6, 4.8], [2.6, 5.8], [1.2, 6]]
    },
    {
      letter: 'R',
      points: [[0, 6], [0, 4.5], [0, 3], [0, 1.5], [0, 0], [1.3, 0], [2.7, 0.2], [3.8, 1.2], [3.7, 2.3], [2.7, 3], [1.3, 3], [2.3, 3.3], [3, 4.2], [3.5, 5.1], [4, 6]]
    },
    {
      letter: 'E',
      points: [[0, 0], [0, 1.5], [0, 3], [0, 4.5], [0, 6], [1.3, 0], [2.7, 0], [4, 0], [1.3, 3], [2.6, 3], [3.7, 3], [1.3, 6], [2.7, 6], [4, 6]]
    },
    {
      letter: 'A',
      points: [[0, 6], [0.45, 4.6], [0.9, 3.2], [1.35, 1.8], [2, 0], [2.65, 1.8], [3.1, 3.2], [3.55, 4.6], [4, 6], [1, 3.55], [2, 3.55], [3, 3.55]]
    }
  ]);

  const state = {
    reducedMotion: false,
    entered: false,
    startedBefore: false,
    audio: null,
    audioToggle: null,
    audioAvailable: true,
    audioStarted: false,
    audioMuted: false,
    audioFadeFrame: 0,
    shootingTimer: 0,
    shootingStarted: false,
    hapticDone: false,
    endingChoice: null,
    commonEndingShown: false,
    timers: new Set(),
    observers: []
  };

  const motionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const first = (...selectors) => {
    for (const selector of selectors) {
      const node = $(selector);
      if (node) return node;
    }
    return null;
  };

  function readSession(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function writeSession(key, value = 'true') {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (_error) {
      // Private browsing and locked-down webviews may deny storage.
    }
  }

  function later(callback, delay = 0) {
    const timer = window.setTimeout(() => {
      state.timers.delete(timer);
      callback();
    }, Math.max(0, delay));
    state.timers.add(timer);
    return timer;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function numeric(value, fallback = 0) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function seeded(index, salt = 0) {
    const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function motionDuration(duration, reducedValue = 0) {
    return state.reducedMotion ? reducedValue : duration;
  }

  function showNode(node) {
    if (!node) return;
    node.hidden = false;
    node.removeAttribute('aria-hidden');
  }

  function hideNode(node) {
    if (!node) return;
    node.hidden = true;
    node.setAttribute('aria-hidden', 'true');
    node.classList.remove('is-visible', 'revealed', 'is-open', 'is-active');
  }

  function focusWithoutJump(node) {
    if (!node || typeof node.focus !== 'function') return;
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
    try {
      node.focus({ preventScroll: true });
    } catch (_error) {
      node.focus();
    }
  }

  function scrollToNode(node, block = 'center') {
    if (!node || typeof node.scrollIntoView !== 'function') return;
    const nodeHeight = node.getBoundingClientRect().height;
    const resolvedBlock = block === 'center' && nodeHeight > window.innerHeight * 0.82
      ? 'start'
      : block;
    node.scrollIntoView({
      behavior: state.reducedMotion ? 'auto' : 'smooth',
      block: resolvedBlock,
      inline: 'nearest'
    });
  }

  function isFirstLoveLine(node) {
    if (!node) return false;
    if (node.matches('[data-first-te-quiero]')) return true;
    const phrase = (node.textContent || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');
    return phrase === 'te quiero.' || phrase === 'te quiero';
  }

  function maybeTriggerHaptic(node) {
    if (state.hapticDone || !state.entered || !isFirstLoveLine(node)) return;

    state.hapticDone = true;
    writeSession(STORAGE_KEYS.haptic);

    if (typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(20);
      } catch (_error) {
        // Vibration is an enhancement; unsupported devices simply ignore it.
      }
    }
  }

  function revealNode(node, delay = 0) {
    if (!node || node.dataset.revealScheduled === 'true' || node.classList.contains('is-visible')) return;

    const wait = motionDuration(clamp(numeric(delay, 0), 0, 6000));
    node.dataset.revealScheduled = 'true';
    // Delay the class in JavaScript and let CSS own only the transition. This
    // avoids applying data-delay twice when the stylesheet also reads the var.
    node.style.setProperty('--reveal-delay', '0ms');

    later(() => {
      showNode(node);
      node.classList.add('is-visible', 'revealed');
      node.dataset.revealed = 'true';
      maybeTriggerHaptic(node);
      node.dispatchEvent(new CustomEvent('andrea:revealed', { bubbles: true }));
    }, wait);
  }

  function revealSequence(nodes, step = 180, initialDelay = 0) {
    const uniqueNodes = Array.from(new Set(nodes.filter(Boolean)));
    uniqueNodes.forEach((node, index) => revealNode(node, initialDelay + (index * step)));
    return initialDelay + Math.max(0, uniqueNodes.length - 1) * step;
  }

  function getRevealChildren(container) {
    if (!container) return [];
    const explicit = $$('[data-reveal], [data-ending-line], [data-sequence-item]', container)
      .filter((node) => !node.closest('[hidden]') || node.closest('[hidden]') === container);
    if (explicit.length) return explicit;

    return $$('h2, h3, p, .cosmic-btn, button', container)
      .filter((node) => node !== container && !node.closest('[hidden]'));
  }

  function revealPanel(panel, options = {}) {
    if (!panel) return 0;
    const { step = 220, initialDelay = 80, scroll = true } = options;
    showNode(panel);
    panel.classList.add('is-active');
    panel.setAttribute('aria-live', panel.getAttribute('aria-live') || 'polite');
    const totalDelay = revealSequence(getRevealChildren(panel), step, initialDelay);

    if (scroll) {
      later(() => {
        scrollToNode(panel);
        focusWithoutJump(panel);
      }, motionDuration(140, 0));
    }
    return totalDelay;
  }

  function observeOnce(target, callback, options = {}) {
    if (!target || typeof callback !== 'function') return null;

    const run = () => {
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
        threshold: options.threshold ?? 0.22,
        rootMargin: options.rootMargin || '0px 0px -12% 0px'
      });

      observer.observe(target);
      state.observers.push(observer);
    };

    if (state.entered) run();
    else document.addEventListener('andrea:experience-started', run, { once: true });
    return run;
  }

  function setMotionPreference(event) {
    state.reducedMotion = Boolean(event ? event.matches : motionQuery.matches);
    document.documentElement.classList.toggle('reduced-motion', state.reducedMotion);
  }

  function updateAudioControl() {
    const button = state.audioToggle;
    if (!button) return;

    let icon = '🔊';
    let label = 'Silenciar música';
    let status = 'playing';

    if (!state.audioAvailable) {
      icon = '♪';
      label = 'Música no disponible';
      status = 'unavailable';
    } else if (!state.audioStarted) {
      icon = '🔊';
      label = 'Reproducir música';
      status = 'ready';
    } else if (state.audioMuted || state.audio?.muted) {
      icon = '🔇';
      label = 'Activar música';
      status = 'muted';
    }

    button.dataset.audioState = status;
    button.classList.toggle('is-muted', status === 'muted');
    button.classList.toggle('is-visible', state.entered && status !== 'unavailable');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', status === 'muted' ? 'true' : 'false');

    const iconNode = $('[data-audio-icon]', button);
    const labelNode = $('[data-audio-label]', button);
    if (iconNode) iconNode.textContent = icon;
    else if (!button.children.length) button.textContent = icon;
    if (labelNode) labelNode.textContent = label;
  }

  function markAudioUnavailable() {
    if (!state.audioAvailable) return;
    state.audioAvailable = false;
    state.audioStarted = false;
    if (state.audioFadeFrame) cancelAnimationFrame(state.audioFadeFrame);
    updateAudioControl();
    if (state.audioToggle) state.audioToggle.hidden = true;
    document.body.classList.add('audio-unavailable');
    document.dispatchEvent(new CustomEvent('andrea:audio-unavailable'));
  }

  function fadeAudioTo(targetVolume = 0.35, duration = 3200) {
    const audio = state.audio;
    if (!audio || !state.audioAvailable) return;

    if (state.audioFadeFrame) cancelAnimationFrame(state.audioFadeFrame);
    if (state.reducedMotion) {
      audio.volume = clamp(targetVolume, 0, 1);
      return;
    }

    const from = clamp(audio.volume, 0, 1);
    const to = clamp(targetVolume, 0, 1);
    const startedAt = performance.now();

    const tick = (now) => {
      const progress = clamp((now - startedAt) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      audio.volume = from + ((to - from) * eased);
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
    if (!audio || !state.audioAvailable) return;

    if (state.audioToggle) {
      state.audioToggle.hidden = false;
      state.audioToggle.classList.add('is-visible');
    }
    audio.muted = false;
    audio.volume = 0;

    let playResult;
    try {
      // This call remains synchronous with the user's Enter gesture so it is
      // accepted by mobile autoplay policies.
      playResult = audio.play();
    } catch (_error) {
      markAudioUnavailable();
      return;
    }

    const onStarted = () => {
      state.audioStarted = true;
      state.audioMuted = false;
      document.body.classList.add('audio-playing');
      updateAudioControl();
      fadeAudioTo(0.35);
    };

    if (playResult && typeof playResult.then === 'function') {
      playResult.then(onStarted).catch(markAudioUnavailable);
    } else {
      onStarted();
    }
  }

  function initAudio() {
    state.audioToggle = first('#audio-toggle', '[data-audio-toggle]', '.audio-toggle');
    let audio = first('#background-music', '[data-background-audio]', 'audio[data-music]');

    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'background-music';
      audio.src = 'assets/music.mp3';
      audio.preload = 'none';
      audio.hidden = true;
      document.body.appendChild(audio);
    }

    state.audio = audio;
    audio.loop = true;
    audio.preload = audio.preload || 'metadata';
    audio.setAttribute('playsinline', '');
    audio.volume = 0;
    audio.addEventListener('error', markAudioUnavailable, { once: true });
    audio.addEventListener('ended', () => {
      if (!audio.loop) state.audioStarted = false;
      updateAudioControl();
    });

    if (state.audioToggle) {
      state.audioToggle.hidden = true;
      state.audioToggle.addEventListener('click', () => {
        if (!state.audioAvailable) return;
        if (!state.audioStarted || audio.paused) {
          startAudio();
          return;
        }

        state.audioMuted = !state.audioMuted;
        audio.muted = state.audioMuted;
        updateAudioControl();
      });
      updateAudioControl();
    }
  }

  function targetStarCount() {
    if (window.innerWidth <= 420) return state.reducedMotion ? 40 : 48;
    if (window.innerWidth <= 900) return state.reducedMotion ? 46 : 60;
    return state.reducedMotion ? 52 : 74;
  }

  function makeBackgroundStar(index) {
    const star = document.createElement('span');
    const size = 0.7 + (seeded(index, 3) * 2.1);
    const opacity = 0.22 + (seeded(index, 4) * 0.62);
    const x = seeded(index, 1) * 100;
    const y = seeded(index, 2) * 100;
    const duration = 3.8 + (seeded(index, 5) * 7.5);
    const delay = seeded(index, 6) * -8;
    const depth = 0.25 + (seeded(index, 7) * 0.75);

    star.className = `star star--${size > 2.2 ? 'bright' : size > 1.3 ? 'medium' : 'small'}`;
    star.dataset.generatedStar = 'true';
    star.dataset.depth = depth.toFixed(2);
    star.setAttribute('aria-hidden', 'true');
    star.style.left = `${x.toFixed(3)}%`;
    star.style.top = `${y.toFixed(3)}%`;
    star.style.setProperty('--x', `${x.toFixed(3)}%`);
    star.style.setProperty('--y', `${y.toFixed(3)}%`);
    star.style.setProperty('--size', `${size.toFixed(2)}px`);
    star.style.setProperty('--opacity', opacity.toFixed(2));
    star.style.setProperty('--twinkle-duration', `${duration.toFixed(2)}s`);
    star.style.setProperty('--twinkle-delay', `${delay.toFixed(2)}s`);
    star.style.setProperty('--drift', `${(2 + seeded(index, 8) * 7).toFixed(2)}px`);
    return star;
  }

  function syncBackgroundStars(container) {
    if (!container) return;
    const desired = targetStarCount();
    const stars = $$('[data-generated-star]', container);

    if (stars.length > desired) {
      stars.slice(desired).forEach((star) => star.remove());
      return;
    }

    if (stars.length < desired) {
      const fragment = document.createDocumentFragment();
      for (let index = stars.length; index < desired; index += 1) {
        fragment.appendChild(makeBackgroundStar(index));
      }
      container.appendChild(fragment);
    }
  }

  function launchShootingStar(container) {
    if (!container || state.reducedMotion || document.hidden || !state.entered) return;
    if ($('.shooting-star', container)) return;

    const shootingStar = document.createElement('span');
    const startX = -12 + (Math.random() * 42);
    const startY = 5 + (Math.random() * 40);
    const travelX = Math.max(window.innerWidth * 0.85, 340);
    const travelY = 130 + (Math.random() * 170);
    const duration = 1250 + (Math.random() * 750);

    shootingStar.className = 'shooting-star';
    shootingStar.setAttribute('aria-hidden', 'true');
    shootingStar.style.left = `${startX}%`;
    shootingStar.style.top = `${startY}%`;
    shootingStar.style.setProperty('--shoot-duration', `${duration}ms`);
    container.appendChild(shootingStar);

    if (typeof shootingStar.animate === 'function') {
      const animation = shootingStar.animate([
        { opacity: 0, transform: 'translate3d(0, 0, 0) rotate(-18deg) scaleX(.35)' },
        { opacity: 0.85, offset: 0.14 },
        { opacity: 0, transform: `translate3d(${travelX}px, ${travelY}px, 0) rotate(-18deg) scaleX(1)` }
      ], {
        duration,
        easing: 'cubic-bezier(.2,.65,.3,1)',
        fill: 'forwards'
      });
      animation.finished.catch(() => {}).finally(() => shootingStar.remove());
    } else {
      shootingStar.classList.add('is-shooting');
      later(() => shootingStar.remove(), duration + 100);
    }
  }

  function scheduleShootingStar(container, firstLaunch = false) {
    if (!container || state.reducedMotion) return;
    window.clearTimeout(state.shootingTimer);
    const delay = firstLaunch ? 4500 : 8500 + (Math.random() * 7500);
    state.shootingTimer = window.setTimeout(() => {
      launchShootingStar(container);
      scheduleShootingStar(container);
    }, delay);
  }

  function createStars() {
    const container = first('#star-field', '[data-star-field]', '.starfield');
    if (!container) return;

    syncBackgroundStars(container);
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => syncBackgroundStars(container), 180);
    }, { passive: true });

    const begin = () => {
      if (state.shootingStarted) return;
      state.shootingStarted = true;
      scheduleShootingStar(container, true);
    };
    if (state.entered) begin();
    else document.addEventListener('andrea:experience-started', begin, { once: true });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.entered && !state.reducedMotion) scheduleShootingStar(container);
    });
  }

  function prepareRevealDelays(nodes) {
    const sceneCounters = new WeakMap();
    nodes.forEach((node) => {
      const scene = node.closest('.scene, [data-scene]') || document.body;
      const order = sceneCounters.get(scene) || 0;
      sceneCounters.set(scene, order + 1);
      node.style.setProperty('--reveal-order', String(order));

      if (!node.hasAttribute('data-delay')) {
        const parentStagger = numeric(node.parentElement?.dataset.stagger, 0);
        if (parentStagger > 0) node.dataset.delay = String(Math.min(order * parentStagger, 1800));
      }
    });
  }

  function initScrollAnimations() {
    const selector = [
      '[data-reveal]',
      '.fade-in',
      '.fade-up',
      '.blur-in',
      '.reveal-text',
      '.star-reveal',
      '.scale-soft'
    ].join(',');

    const nodes = $$(selector).filter((node) => {
      if (node.closest('.door, .intro-screen, [data-door]')) return false;
      if (node.closest('[hidden]')) return false;
      return true;
    });

    prepareRevealDelays(nodes);

    const startObserving = () => {
      if (!('IntersectionObserver' in window)) {
        nodes.forEach((node) => revealNode(node, numeric(node.dataset.delay, 0)));
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const node = entry.target;
          observer.unobserve(node);
          revealNode(node, numeric(node.dataset.delay, 0));
        });
      }, {
        threshold: state.reducedMotion ? 0.02 : 0.16,
        rootMargin: '0px 0px -8% 0px'
      });

      nodes.forEach((node) => observer.observe(node));
      state.observers.push(observer);

      const scenes = $$('.scene, [data-scene]');
      const sceneObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('is-current', entry.isIntersecting && entry.intersectionRatio > 0.12);
        });
      }, { threshold: [0.12, 0.45, 0.75] });
      scenes.forEach((scene) => sceneObserver.observe(scene));
      state.observers.push(sceneObserver);
    };

    if (state.entered) startObserving();
    else document.addEventListener('andrea:experience-started', startObserving, { once: true });
  }

  function initInitiativeMoment() {
    const button = first('#understood-button', '[data-understood]');
    const orbit = first('#initiative-orbit', '[data-initiative-orbit]');
    if (!orbit) return;

    const activate = () => {
      if (orbit.dataset.activated === 'true') return;
      orbit.dataset.activated = 'true';
      showNode(orbit);
      orbit.classList.add('is-active');

      const centerStar = first('#initiative-star', '[data-initiative-star]');
      if (centerStar) revealNode(centerStar, 80);
      const words = $$('[data-initiative-word], .initiative-word, .orbit-word', orbit);
      revealSequence(words, motionDuration(190, 0), motionDuration(280, 0));

      if (button) {
        button.setAttribute('aria-expanded', 'true');
        button.disabled = true;
      }
      later(() => scrollToNode(orbit), motionDuration(180, 0));
    };

    if (button) {
      button.setAttribute('aria-controls', button.getAttribute('aria-controls') || orbit.id || 'initiative-orbit');
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', activate);
    } else if (!orbit.hidden) {
      observeOnce(orbit, activate);
    }
  }

  function animateRewindItems(field, duration) {
    if (!field || state.reducedMotion || typeof Element.prototype.animate !== 'function') return;

    const items = $$('[data-rewind-item], [data-initiative-word], .initiative-word, .orbit-word, .star', field)
      .slice(0, 64)
      .reverse();

    items.forEach((item, index) => {
      const isWord = item.matches('[data-initiative-word], .initiative-word, .orbit-word');
      const computedOpacity = numeric(getComputedStyle(item).opacity, 1);
      const angle = (index / Math.max(items.length, 1)) * Math.PI * 2;
      const distance = 18 + ((index % 6) * 5);

      item.animate([
        { opacity: computedOpacity, filter: 'blur(0)', transform: 'translate3d(0,0,0) scale(1)' },
        {
          opacity: isWord ? 0.12 : 0.65,
          filter: isWord ? 'blur(4px)' : 'blur(0)',
          transform: `translate3d(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px, 0) scale(.72)`,
          offset: 0.62
        },
        { opacity: isWord ? 0 : 0.2, filter: 'blur(7px)', transform: 'translate3d(0,0,0) scale(.35)' }
      ], {
        duration: Math.max(350, duration - Math.min(index * 12, 450)),
        delay: Math.min(index * 8, 260),
        easing: 'cubic-bezier(.55,.05,.35,1)',
        fill: 'forwards'
      });
    });
  }

  function initRewindEffect() {
    const button = first('#rewind-button', '[data-rewind]');
    if (!button) return;

    const field = first('#rewind-field', '[data-rewind-field]', '#initiative-orbit', '[data-initiative-orbit]');
    const result = first('#rewind-result', '[data-rewind-result]');

    button.addEventListener('click', () => {
      if (button.dataset.complete === 'true') return;
      button.dataset.complete = 'true';
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      document.body.classList.add('is-rewinding');
      field?.classList.add('is-rewinding');

      const duration = motionDuration(2000, 80);
      animateRewindItems(field, duration);

      later(() => {
        document.body.classList.remove('is-rewinding');
        field?.classList.remove('is-rewinding');
        field?.classList.add('is-rewound');
        button.removeAttribute('aria-busy');
        button.setAttribute('aria-expanded', 'true');

        if (result) {
          showNode(result);
          result.classList.add('is-active');
          revealSequence(getRevealChildren(result), motionDuration(280, 0), motionDuration(100, 0));
          later(() => scrollToNode(result), motionDuration(180, 0));
        }
      }, duration);
    });
  }

  function ensureConstellationStars(container) {
    let stars = $$('[data-constellation-star], .constellation-star', container);
    if (stars.length >= CONSTELLATION_STORIES.length) return stars.slice(0, CONSTELLATION_STORIES.length);

    const fragment = document.createDocumentFragment();
    for (let index = stars.length; index < CONSTELLATION_STORIES.length; index += 1) {
      const button = document.createElement('button');
      const glow = document.createElement('span');
      button.type = 'button';
      button.className = 'constellation-star';
      button.dataset.constellationStar = '';
      button.dataset.index = String(index);
      button.setAttribute('aria-label', `Abrir estrella: ${CONSTELLATION_STORIES[index].title}`);
      glow.className = 'constellation-star__glow';
      glow.setAttribute('aria-hidden', 'true');
      button.appendChild(glow);
      fragment.appendChild(button);
    }
    container.appendChild(fragment);
    stars = $$('[data-constellation-star], .constellation-star', container);
    return stars.slice(0, CONSTELLATION_STORIES.length);
  }

  function makeConstellationLines(container, stars) {
    if ($('.constellation-lines', container) || stars.length < 2) return;
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    const connections = [[0, 1], [1, 2], [2, 3], [2, 5], [3, 4], [4, 5]];

    svg.classList.add('constellation-lines');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');

    connections.forEach(([from, to]) => {
      const line = document.createElementNS(namespace, 'line');
      line.classList.add('constellation-line');
      line.dataset.from = String(from);
      line.dataset.to = String(to);
      line.setAttribute('x1', String(CONSTELLATION_POSITIONS[from][0]));
      line.setAttribute('y1', String(CONSTELLATION_POSITIONS[from][1]));
      line.setAttribute('x2', String(CONSTELLATION_POSITIONS[to][0]));
      line.setAttribute('y2', String(CONSTELLATION_POSITIONS[to][1]));
      svg.appendChild(line);
    });

    container.insertBefore(svg, container.firstChild);
  }

  function initConstellation() {
    const container = first('#constellation', '[data-constellation]', '.constellation');
    if (!container) return;

    const stars = ensureConstellationStars(container);
    const panel = first('#constellation-panel', '[data-constellation-panel]', '.constellation-modal');
    const title = panel ? first('#constellation-title', '[data-constellation-title]') || $('[data-title]', panel) : null;
    const message = panel ? first('#constellation-message', '[data-constellation-message]') || $('[data-message]', panel) : null;
    const close = panel ? $('#constellation-close, [data-constellation-close], .constellation-close', panel) : null;
    const visited = new Set();

    stars.forEach((star, index) => {
      const position = CONSTELLATION_POSITIONS[index];
      const story = CONSTELLATION_STORIES[index];
      star.dataset.index = String(index);
      star.style.left = `${position[0]}%`;
      star.style.top = `${position[1]}%`;
      star.style.setProperty('--star-x', `${position[0]}%`);
      star.style.setProperty('--star-y', `${position[1]}%`);
      star.setAttribute('aria-label', star.getAttribute('aria-label') || `Abrir estrella: ${story.title}`);
      star.setAttribute('aria-expanded', 'false');
      if (panel?.id) star.setAttribute('aria-controls', panel.id);
      if (index === 5) star.classList.add('is-special');

      star.addEventListener('click', () => {
        const selectedStory = {
          title: star.dataset.title || story.title,
          message: star.dataset.message || story.message
        };
        visited.add(index);
        stars.forEach((item) => {
          const active = item === star;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-expanded', String(active));
        });
        star.classList.add('is-visited');
        container.classList.toggle('is-complete', visited.size === stars.length);
        $$('.constellation-line', container).forEach((line) => {
          const from = Number(line.dataset.from);
          const to = Number(line.dataset.to);
          line.classList.toggle('is-lit', visited.has(from) && visited.has(to));
        });

        if (!panel) return;
        if (title) title.textContent = selectedStory.title;
        if (message) message.textContent = selectedStory.message;
        showNode(panel);
        panel.classList.add('is-open', 'is-visible');
        panel.setAttribute('aria-hidden', 'false');
        panel.setAttribute('aria-live', 'polite');
        if (typeof HTMLDialogElement !== 'undefined' && panel instanceof HTMLDialogElement && !panel.open) {
          try {
            panel.showModal();
          } catch (_error) {
            panel.setAttribute('open', '');
          }
        }
        later(() => focusWithoutJump(title || panel), motionDuration(80, 0));
      });
    });

    makeConstellationLines(container, stars);

    const closePanel = () => {
      if (!panel) return;
      panel.classList.remove('is-open', 'is-visible');
      panel.setAttribute('aria-hidden', 'true');
      stars.forEach((star) => {
        star.classList.remove('is-active');
        star.setAttribute('aria-expanded', 'false');
      });
      if (typeof HTMLDialogElement !== 'undefined' && panel instanceof HTMLDialogElement && panel.open) panel.close();
      else later(() => { panel.hidden = true; }, motionDuration(360, 0));
    };

    close?.addEventListener('click', closePanel);
    panel?.addEventListener('cancel', (event) => {
      event.preventDefault();
      closePanel();
    });
  }

  function flattenAndreaLayout() {
    const points = [];
    const letterAdvance = 6;
    ANDREA_LAYOUT.forEach((glyph, letterIndex) => {
      glyph.points.forEach(([x, y], pointIndex) => {
        points.push({
          letter: glyph.letter,
          letterIndex,
          pointIndex,
          x: (letterIndex * letterAdvance) + x,
          y
        });
      });
    });
    return points;
  }

  function revealAndreaMessage() {
    const marked = $$('[data-andrea-after], .andrea-after');
    const lines = [];
    marked.forEach((node) => {
      showNode(node);
      node.classList.add('is-active');
      if (node.matches('p, h2, h3, [data-sequence-item]')) lines.push(node);
      else lines.push(...getRevealChildren(node));
    });
    revealSequence(lines, motionDuration(330, 0), motionDuration(1500, 0));
  }

  function formAndreaName(stage, stars) {
    if (!stage || stage.dataset.formed === 'true') return;
    stage.dataset.formed = 'true';
    stage.classList.add('is-forming');

    if (state.reducedMotion || typeof Element.prototype.animate !== 'function') {
      stars.forEach((star) => {
        star.style.left = star.dataset.targetX;
        star.style.top = star.dataset.targetY;
        star.style.opacity = star.dataset.targetOpacity || '1';
        star.classList.add('is-formed');
      });
      stage.classList.remove('is-forming');
      stage.classList.add('is-formed');
      revealAndreaMessage();
      return;
    }

    let longestAnimation = 0;
    stars.forEach((star, index) => {
      const duration = 1800 + (seeded(index, 24) * 1050);
      const delay = (index % 12) * 28 + (Math.floor(index / 12) * 42);
      const middleX = `${numeric(star.dataset.fromX) + ((numeric(star.dataset.targetX) - numeric(star.dataset.fromX)) * 0.58) + ((seeded(index, 25) - 0.5) * 9)}%`;
      const middleY = `${numeric(star.dataset.fromY) + ((numeric(star.dataset.targetY) - numeric(star.dataset.fromY)) * 0.58) + ((seeded(index, 26) - 0.5) * 12)}%`;
      longestAnimation = Math.max(longestAnimation, duration + delay);

      const animation = star.animate([
        { left: star.dataset.fromX, top: star.dataset.fromY, opacity: 0.16, filter: 'blur(1.5px)', transform: 'scale(.45)' },
        { left: middleX, top: middleY, opacity: 0.72, filter: 'blur(.35px)', transform: 'scale(.78)', offset: 0.64 },
        { left: star.dataset.targetX, top: star.dataset.targetY, opacity: star.dataset.targetOpacity, filter: 'blur(0)', transform: 'scale(1)' }
      ], {
        duration,
        delay,
        easing: 'cubic-bezier(.22,.75,.2,1)',
        fill: 'forwards'
      });

      animation.finished.then(() => {
        star.style.left = star.dataset.targetX;
        star.style.top = star.dataset.targetY;
        star.style.opacity = star.dataset.targetOpacity;
        star.classList.add('is-formed');
        animation.cancel();
      }).catch(() => {});
    });

    later(() => {
      stage.classList.remove('is-forming');
      stage.classList.add('is-formed');
      revealAndreaMessage();
    }, longestAnimation);
  }

  function initAndreaStars() {
    const stage = first('#andrea-stars', '[data-andrea-stars]', '.andrea-stage');
    if (!stage) return;

    $$('[data-andrea-generated]', stage).forEach((node) => node.remove());
    const points = flattenAndreaLayout();
    const fragment = document.createDocumentFragment();
    const totalWidth = ((ANDREA_LAYOUT.length - 1) * 6) + 4;

    points.forEach((point, index) => {
      const star = document.createElement('span');
      const targetX = 5 + ((point.x / totalWidth) * 90);
      const targetY = 18 + ((point.y / 6) * 64);
      const fromX = 4 + (seeded(index, 20) * 92);
      const fromY = 5 + (seeded(index, 21) * 90);
      const size = 1.4 + (seeded(index, 22) * 2.2);
      const opacity = 0.7 + (seeded(index, 23) * 0.3);

      star.className = 'andrea-star';
      star.dataset.andreaGenerated = 'true';
      star.dataset.letter = point.letter;
      star.dataset.letterIndex = String(point.letterIndex);
      star.dataset.fromX = `${fromX.toFixed(3)}%`;
      star.dataset.fromY = `${fromY.toFixed(3)}%`;
      star.dataset.targetX = `${targetX.toFixed(3)}%`;
      star.dataset.targetY = `${targetY.toFixed(3)}%`;
      star.dataset.targetOpacity = opacity.toFixed(2);
      star.setAttribute('aria-hidden', 'true');
      star.style.left = star.dataset.fromX;
      star.style.top = star.dataset.fromY;
      star.style.opacity = '0.16';
      star.style.setProperty('--andrea-star-size', `${size.toFixed(2)}px`);
      star.style.setProperty('--size', `${size.toFixed(2)}px`);
      star.style.setProperty('--target-x', star.dataset.targetX);
      star.style.setProperty('--target-y', star.dataset.targetY);
      fragment.appendChild(star);
    });

    stage.appendChild(fragment);
    stage.setAttribute('role', 'img');
    stage.setAttribute('aria-label', 'Las estrellas forman el nombre ANDREA');
    const stars = $$('[data-andrea-generated]', stage);
    observeOnce(stage, () => formAndreaName(stage, stars), { threshold: 0.26, rootMargin: '0px 0px -8% 0px' });
  }

  function ensureFutureRoute(stage) {
    if ($('.future-trajectory', stage)) return;
    const existingSvg = $('svg', stage);
    if (existingSvg) {
      existingSvg.classList.add('future-trajectory');
      const existingPath = $('path', existingSvg);
      if (existingPath) {
        existingPath.classList.add('future-route');
        existingPath.setAttribute('pathLength', '1');
      }
      return;
    }
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    const path = document.createElementNS(namespace, 'path');
    svg.classList.add('future-trajectory');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    path.classList.add('future-route');
    path.setAttribute('pathLength', '1');
    path.setAttribute('d', 'M 8 72 C 29 63, 38 46, 50 45 C 62 44, 68 34, 80 29');
    svg.appendChild(path);
    stage.insertBefore(svg, stage.firstChild);
  }

  function animateFuture(stage, stars) {
    if (stage.dataset.animated === 'true') return;
    stage.dataset.animated = 'true';
    stage.classList.add('is-travelling');

    const paths = [
      [
        { left: '8%', top: '72%', opacity: 0.55 },
        { left: '47%', top: '45%', opacity: 1, offset: 0.58 },
        { left: '78%', top: '28%', opacity: 1 }
      ],
      [
        { left: '92%', top: '18%', opacity: 0.55 },
        { left: '53%', top: '46%', opacity: 1, offset: 0.58 },
        { left: '81%', top: '31%', opacity: 1 }
      ]
    ];

    const duration = motionDuration(4700, 0);
    stars.slice(0, 2).forEach((star, index) => {
      const keyframes = paths[index];
      star.style.left = keyframes[0].left;
      star.style.top = keyframes[0].top;
      star.classList.add(`future-star--${index + 1}`);

      if (!duration || typeof star.animate !== 'function') {
        star.style.left = keyframes[2].left;
        star.style.top = keyframes[2].top;
        return;
      }

      const animation = star.animate(keyframes, {
        duration,
        delay: index * 90,
        easing: 'cubic-bezier(.42,0,.2,1)',
        fill: 'forwards'
      });
      animation.finished.then(() => {
        star.style.left = keyframes[2].left;
        star.style.top = keyframes[2].top;
        animation.cancel();
      }).catch(() => {});
    });

    const route = $('.future-route', stage);
    if (route && duration && typeof route.animate === 'function') {
      route.animate([
        { strokeDasharray: '1', strokeDashoffset: '1', opacity: 0 },
        { opacity: 0.48, offset: 0.18 },
        { strokeDasharray: '1', strokeDashoffset: '0', opacity: 0.16 }
      ], { duration, easing: 'ease-in-out', fill: 'forwards' });
    }

    later(() => {
      stage.classList.remove('is-travelling');
      stage.classList.add('is-joined');
      const after = $$('[data-future-after], .future-after');
      revealSequence(after, motionDuration(250, 0), motionDuration(280, 0));
    }, duration);
  }

  function initFutureAnimation() {
    const stage = first('#future-path', '[data-future-path]', '.future-path');
    if (!stage) return;

    let stars = $$('[data-future-star], .future-star', stage);
    while (stars.length < 2) {
      const star = document.createElement('span');
      star.className = 'future-star';
      star.dataset.futureStar = '';
      star.setAttribute('aria-hidden', 'true');
      stage.appendChild(star);
      stars.push(star);
    }
    ensureFutureRoute(stage);
    observeOnce(stage, () => animateFuture(stage, stars), { threshold: 0.28 });
  }

  function initUniverseIllumination() {
    const universe = first('#universe-scene', '[data-universe]', '.galaxy');
    if (!universe) return;

    const illuminate = () => {
      universe.classList.add('is-illuminated');
      const galaxy = $('.galaxy', universe) || (universe.matches('.galaxy') ? universe : null);
      galaxy?.classList.add('is-illuminated');
      later(() => {
        universe.classList.add('is-radiant');
        galaxy?.classList.add('is-radiant');
      }, motionDuration(1800, 0));
    };

    const activator = first('#activate-universe', '[data-universe-activate]');
    if (activator) {
      activator.addEventListener('click', () => {
        illuminate();
        activator.disabled = true;
        activator.setAttribute('aria-pressed', 'true');
      });
    } else {
      observeOnce(universe, illuminate, { threshold: 0.32 });
    }
  }

  function createLightRipple(target, event) {
    if (!target || state.reducedMotion) return;
    const ripple = document.createElement('span');
    const rect = target.getBoundingClientRect();
    const x = Number.isFinite(event.clientX) && event.clientX !== 0 ? event.clientX : rect.left + (rect.width / 2);
    const y = Number.isFinite(event.clientY) && event.clientY !== 0 ? event.clientY : rect.top + (rect.height / 2);
    ripple.className = 'light-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.setProperty('--ripple-x', `${x}px`);
    ripple.style.setProperty('--ripple-y', `${y}px`);
    document.body.appendChild(ripple);

    if (typeof ripple.animate === 'function') {
      const animation = ripple.animate([
        { opacity: 0.58, transform: 'translate(-50%, -50%) scale(.1)' },
        { opacity: 0, transform: 'translate(-50%, -50%) scale(4.4)' }
      ], { duration: 900, easing: 'cubic-bezier(.16,.72,.25,1)' });
      animation.finished.catch(() => {}).finally(() => ripple.remove());
    } else {
      ripple.classList.add('is-expanding');
      later(() => ripple.remove(), 950);
    }
  }

  function initLightRipples() {
    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest('[data-ripple], .constellation-star, [data-secret-star], .secret-star, .cosmic-btn');
      if (!target) return;
      createLightRipple(target, event);
    });
  }

  function createSecretMessageFallback(secretStar) {
    const panel = document.createElement('aside');
    const close = document.createElement('button');
    const lines = [
      'Encontraste una estrella escondida.',
      'Supongo que siempre he sido mejor escondiendo sentimientos que estrellas.',
      'Estoy intentando mejorar en ambas cosas.',
      'Pero por si acaso esta sí quedó demasiado fácil.'
    ];

    panel.id = 'secret-message';
    panel.className = 'secret-message';
    panel.dataset.secretMessage = '';
    panel.hidden = true;
    panel.setAttribute('aria-live', 'polite');
    lines.forEach((text) => {
      const paragraph = document.createElement('p');
      paragraph.dataset.sequenceItem = '';
      paragraph.textContent = text;
      panel.appendChild(paragraph);
    });
    close.type = 'button';
    close.className = 'secret-message__close';
    close.dataset.secretClose = '';
    close.setAttribute('aria-label', 'Cerrar mensaje secreto');
    close.textContent = '×';
    panel.appendChild(close);
    (secretStar.closest('.scene, [data-scene]') || document.body).appendChild(panel);
    return panel;
  }

  function initSecretStar() {
    let secretStar = first('#secret-star', '[data-secret-star]', '.secret-star');
    if (!secretStar) {
      const host = first('#universe-scene', '[data-universe]', '#experience', 'main');
      if (!host) return;
      secretStar = document.createElement('button');
      secretStar.id = 'secret-star';
      secretStar.type = 'button';
      secretStar.className = 'secret-star';
      secretStar.dataset.secretStar = '';
      secretStar.setAttribute('aria-label', 'Una estrella casi escondida');
      secretStar.innerHTML = '<span aria-hidden="true">✦</span>';
      host.appendChild(secretStar);
    }

    let message = first('#secret-message', '[data-secret-message]');
    if (!message) message = createSecretMessageFallback(secretStar);
    let close = first('#secret-close', '[data-secret-close]') || $('[data-secret-close]', message);
    if (!close) {
      close = document.createElement('button');
      close.type = 'button';
      close.className = 'secret-message__close';
      close.dataset.secretClose = '';
      close.setAttribute('aria-label', 'Cerrar mensaje secreto');
      close.textContent = '×';
      message.appendChild(close);
    }

    if (readSession(STORAGE_KEYS.secret)) secretStar.classList.add('was-found');
    secretStar.addEventListener('click', () => {
      secretStar.classList.add('is-found', 'was-found');
      secretStar.setAttribute('aria-expanded', 'true');
      writeSession(STORAGE_KEYS.secret);
      showNode(message);
      message.classList.add('is-open', 'is-visible');
      revealSequence(getRevealChildren(message), motionDuration(310, 0), motionDuration(80, 0));
      later(() => focusWithoutJump(message), motionDuration(120, 0));
    });

    close?.addEventListener('click', () => {
      message.classList.remove('is-open', 'is-visible');
      secretStar.setAttribute('aria-expanded', 'false');
      later(() => { message.hidden = true; }, motionDuration(350, 0));
      secretStar.focus();
    });
  }

  function showCommonEnding() {
    if (state.commonEndingShown) return;
    const common = first('#common-ending', '[data-common-ending]');
    if (!common) return;

    state.commonEndingShown = true;
    const total = revealPanel(common, {
      step: motionDuration(360, 0),
      initialDelay: motionDuration(180, 0),
      scroll: true
    });
    common.classList.add('is-ready');

    const lastStarButton = first('#last-star-button', '[data-last-star]');
    if (lastStarButton) {
      lastStarButton.disabled = true;
      later(() => { lastStarButton.disabled = false; }, motionDuration(total + 420, 0));
    }
  }

  function handleTryAgainEnding() {
    const panel = first('#ending-try', '[data-ending="try"]');
    const continueButton = first('#continue-ending', '[data-continue-ending]');
    const total = revealPanel(panel, {
      step: motionDuration(320, 0),
      initialDelay: motionDuration(100, 0),
      scroll: true
    });

    if (continueButton) {
      continueButton.disabled = true;
      later(() => { continueButton.disabled = false; }, motionDuration(total + 450, 0));
    } else {
      later(showCommonEnding, motionDuration(Math.max(total + 1800, 5200), 0));
    }
  }

  function handleNeedTimeEnding() {
    const panel = first('#ending-time', '[data-ending="time"]');
    const total = revealPanel(panel, {
      step: motionDuration(390, 0),
      initialDelay: motionDuration(120, 0),
      scroll: true
    });
    later(showCommonEnding, motionDuration(Math.max(total + 1900, 6200), 0));
  }

  function initEndingChoices() {
    const showQuestion = first('#show-question', '[data-show-question]');
    const question = first('#question-content', '[data-question-content]');
    const tryButton = first('#choice-try', '[data-choice="try"]');
    const timeButton = first('#choice-time', '[data-choice="time"]');
    const continueButton = first('#continue-ending', '[data-continue-ending]');
    const lastStarButton = first('#last-star-button', '[data-last-star]');
    const postscript = first('#postscript', '[data-postscript]');

    showQuestion?.addEventListener('click', () => {
      if (!question) return;
      showQuestion.disabled = true;
      showQuestion.setAttribute('aria-expanded', 'true');
      revealPanel(question, {
        step: motionDuration(270, 0),
        initialDelay: motionDuration(120, 0),
        scroll: true
      });
    });

    const choose = (choice) => {
      if (state.endingChoice) return;
      state.endingChoice = choice;
      [tryButton, timeButton].forEach((button) => {
        if (!button) return;
        button.disabled = true;
        button.setAttribute('aria-pressed', String(button.dataset.choice === choice || button === (choice === 'try' ? tryButton : timeButton)));
      });
      question?.classList.add('has-answer', `answer-${choice}`);
      document.body.dataset.ending = choice;
      if (choice === 'try') handleTryAgainEnding();
      else handleNeedTimeEnding();
    };

    tryButton?.addEventListener('click', () => choose('try'));
    timeButton?.addEventListener('click', () => choose('time'));
    continueButton?.addEventListener('click', () => {
      if (state.endingChoice !== 'try' || continueButton.disabled) return;
      continueButton.disabled = true;
      showCommonEnding();
    });

    lastStarButton?.addEventListener('click', () => {
      if (!postscript || lastStarButton.dataset.opened === 'true') return;
      lastStarButton.dataset.opened = 'true';
      lastStarButton.disabled = true;
      lastStarButton.setAttribute('aria-expanded', 'true');
      showNode(postscript);
      postscript.classList.add('is-active');
      revealSequence(getRevealChildren(postscript), motionDuration(430, 0), motionDuration(180, 0));
      later(() => {
        scrollToNode(postscript);
        focusWithoutJump(postscript);
      }, motionDuration(160, 0));
    });
  }

  function initScrollProgress() {
    const progress = first('#scroll-progress', '[data-scroll-progress]', '.progress-bar');
    let frame = 0;

    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const maximum = Math.max(1, root.scrollHeight - window.innerHeight);
      const amount = clamp(window.scrollY / maximum, 0, 1);
      root.style.setProperty('--scroll-progress', amount.toFixed(4));
      document.body.classList.toggle('near-the-end', amount > 0.92);
      if (progress) {
        progress.style.width = '100%';
        progress.style.setProperty('--progress', '100%');
        progress.style.transform = `scaleX(${amount})`;
        progress.setAttribute('aria-valuemin', '0');
        progress.setAttribute('aria-valuemax', '100');
        progress.setAttribute('aria-valuenow', String(Math.round(amount * 100)));
      }
    };

    const requestUpdate = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    update();
  }

  function initParallaxLight() {
    const root = document.documentElement;
    const layers = $$('[data-parallax]');
    let pointerFrame = 0;
    let scrollFrame = 0;

    let light = first('#ambient-light', '[data-ambient-light]', '.ambient-light');
    if (!light) {
      light = document.createElement('div');
      light.className = 'ambient-light';
      light.dataset.ambientLight = '';
      light.setAttribute('aria-hidden', 'true');
      document.body.appendChild(light);
    }

    const updatePointer = (clientX, clientY) => {
      if (state.reducedMotion) return;
      const x = clamp(clientX / Math.max(window.innerWidth, 1), 0, 1);
      const y = clamp(clientY / Math.max(window.innerHeight, 1), 0, 1);
      root.style.setProperty('--pointer-x', (x - 0.5).toFixed(3));
      root.style.setProperty('--pointer-y', (y - 0.5).toFixed(3));
      root.style.setProperty('--light-x', `${(x * 100).toFixed(2)}%`);
      root.style.setProperty('--light-y', `${(y * 100).toFixed(2)}%`);
    };

    window.addEventListener('pointermove', (event) => {
      if (state.reducedMotion || event.pointerType === 'touch') return;
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        updatePointer(event.clientX, event.clientY);
      });
    }, { passive: true });

    const updateScrollParallax = () => {
      scrollFrame = 0;
      if (state.reducedMotion) return;
      const normalizedScroll = window.scrollY / Math.max(document.documentElement.scrollHeight, 1);
      root.style.setProperty('--scroll-parallax', `${(normalizedScroll * 34).toFixed(2)}px`);
      layers.forEach((layer) => {
        const rect = layer.getBoundingClientRect();
        const depth = clamp(numeric(layer.dataset.parallax, 0.25), -1, 1);
        const offset = clamp((rect.top - (window.innerHeight / 2)) * depth * -0.025, -18, 18);
        layer.style.setProperty('--parallax-offset', `${offset.toFixed(2)}px`);
      });
    };

    window.addEventListener('scroll', () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollParallax);
    }, { passive: true });
    updatePointer(window.innerWidth / 2, window.innerHeight * 0.42);
    updateScrollParallax();
  }

  function revealDoor(door, enterButton) {
    if (!door) return;
    door.classList.add('is-ready');
    const lines = $$('[data-door-line], [data-intro-line], .door-line', door)
      .filter((node) => node !== enterButton && !node.contains(enterButton));
    const returning = state.startedBefore;
    const baseDelay = returning || state.reducedMotion ? 0 : 900;
    const step = returning || state.reducedMotion ? 0 : 1180;

    if (enterButton) {
      enterButton.disabled = true;
      enterButton.hidden = true;
    }
    let lastLineDelay = 0;
    lines.forEach((line, index) => {
      const authoredDelay = Number.parseFloat(line.dataset.delay);
      const lineDelay = returning || state.reducedMotion
        ? 0
        : Number.isFinite(authoredDelay) ? authoredDelay : baseDelay + (index * step);
      lastLineDelay = Math.max(lastLineDelay, lineDelay);
      revealNode(line, lineDelay);
    });
    const buttonDelay = returning || state.reducedMotion ? 0 : lastLineDelay + 900;
    later(() => {
      if (!enterButton) return;
      showNode(enterButton);
      enterButton.classList.add('is-visible', 'revealed');
      enterButton.disabled = false;
      enterButton.focus({ preventScroll: true });
    }, motionDuration(buttonDelay, 0));
  }

  function enterExperience(door, experience, enterButton) {
    if (state.entered) return;
    state.entered = true;
    writeSession(STORAGE_KEYS.started);
    document.body.classList.add('experience-started', 'is-entered');
    document.body.classList.remove('experience-locked', 'is-locked', 'no-scroll');
    enterButton?.setAttribute('aria-expanded', 'true');
    if (enterButton) enterButton.disabled = true;

    if (experience) {
      experience.removeAttribute('aria-hidden');
      experience.inert = false;
    }

    // Audio must be requested before this click handler yields.
    startAudio();
    window.scrollTo({ top: 0, behavior: 'auto' });
    door?.classList.add('is-leaving');
    document.dispatchEvent(new CustomEvent('andrea:experience-started'));

    later(() => {
      if (door) {
        door.classList.add('is-hidden');
        door.setAttribute('aria-hidden', 'true');
        door.hidden = true;
      }
      if (experience) focusWithoutJump(experience);
    }, motionDuration(1250, 0));
  }

  function initEntrance() {
    const door = first('#door', '[data-door]', '.door', '.intro-screen');
    const experience = first('#experience', '[data-experience]', 'main.experience');
    const enterButton = first('#enter-button', '[data-enter]');

    state.startedBefore = Boolean(readSession(STORAGE_KEYS.started));
    document.body.classList.toggle('has-started-before', state.startedBefore);
    document.body.classList.toggle('experience-locked', Boolean(door && enterButton));
    document.body.classList.toggle('is-locked', Boolean(door && enterButton));

    if (experience && door && enterButton) {
      experience.setAttribute('aria-hidden', 'true');
      experience.inert = true;
    }

    if (!enterButton) {
      state.entered = true;
      document.body.classList.add('experience-started', 'is-entered');
      document.body.classList.remove('experience-locked', 'is-locked', 'no-scroll');
      experience?.removeAttribute('aria-hidden');
      if (experience) experience.inert = false;
      queueMicrotask(() => document.dispatchEvent(new CustomEvent('andrea:experience-started')));
      return;
    }

    revealDoor(door, enterButton);
    enterButton.addEventListener('click', () => enterExperience(door, experience, enterButton), { once: true });
  }

  function initExperience() {
    document.documentElement.classList.add('js');
    setMotionPreference();
    state.hapticDone = Boolean(readSession(STORAGE_KEYS.haptic));

    if (typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', setMotionPreference);
    } else if (typeof motionQuery.addListener === 'function') {
      motionQuery.addListener(setMotionPreference);
    }

    // Features initialize independently so an optional/missing element never
    // prevents the rest of the story from working.
    const initializers = [
      initAudio,
      createStars,
      initScrollAnimations,
      initInitiativeMoment,
      initRewindEffect,
      initConstellation,
      initAndreaStars,
      initFutureAnimation,
      initUniverseIllumination,
      initSecretStar,
      initEndingChoices,
      initScrollProgress,
      initParallaxLight,
      initLightRipples
    ];

    initializers.forEach((initialize) => {
      try {
        initialize();
      } catch (_error) {
        document.body.dataset.enhancementFallback = 'true';
      }
    });

    initEntrance();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExperience, { once: true });
  } else {
    initExperience();
  }
})();
