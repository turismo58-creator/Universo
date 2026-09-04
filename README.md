# Universo para Andrea

Experiencia web romántica, cinematográfica e interactiva construida como una sola aplicación estática. La historia avanza por diez momentos de pantalla completa: los textos conservan su propio ritmo, pero cada cambio de capítulo ocurre únicamente cuando la persona decide continuar.

## Estructura

```text
.
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
└── cancion/
    ├── .gitkeep
    └── algo-que-se-quede.mp3
```

No utiliza React, npm, backend ni JavaScript de Bootstrap. Bootstrap se conserva únicamente como CSS; el girasol, las estrellas y todas las interacciones están programados con HTML, CSS, SVG y JavaScript Vanilla.

## Música

La experiencia utiliza exactamente esta ruta relativa:

```text
./cancion/algo-que-se-quede.mp3
```

El audio usa `preload="metadata"`, empieza solo después de un gesto, hace un fade de tres segundos hasta un volumen de `0.22` y no se reinicia al cambiar de escena. El código no genera ni descarga el MP3.

## Arquitectura de escenas

Las diez secciones usan `data-scene-index="0"` hasta `data-scene-index="9"`. `SceneController` mantiene una sola escena activa y ofrece:

- `goTo(index)`;
- `next()`;
- `previous()`;
- entrada y salida cinematográficas;
- inicialización diferida de componentes costosos;
- pausa y reanudación del runtime activo.

Cada escena tiene un `SceneRuntime` propio. Sus timers y animaciones se pausan al ocultar la pestaña y se cancelan al abandonar el momento, evitando que una escena inactiva siga revelando contenido. La clase `.scene-paused` detiene también las animaciones CSS internas.

El motor narrativo central lee los tiempos de cada bloque, muestra como máximo el presente y una frase anterior atenuada, y habilita `Continuar ✦` al terminar. Nunca cambia de escena automáticamente.

## Persistencia

Durante la pestaña actual se guardan solamente las claves activas de la experiencia:

```text
experienceStarted
currentScene
musicCurrentTime
musicMuted
interactiveState
```

Una recarga restaura el capítulo, las líneas ya reveladas y las interacciones terminadas. Si el navegador bloquea la reanudación automática del audio, aparece `Continuar con música ✦` sin reiniciar la historia. También existe una migración única desde el estado de la versión anterior basada en scroll.

## Rendimiento y adaptación

- El documento y el escenario están fijados a `100vh`, `100svh` y `100dvh`, sin navegación por scroll.
- La mayor parte del cielo es un conjunto de gradientes estáticos.
- Se crean 22 estrellas DOM en equipos pequeños o limitados, 30 en teléfonos normales y un máximo de 40 en escritorio.
- El girasol, las líneas de constelación, el polvo galáctico y las estrellas de ANDREA se construyen solo al entrar por primera vez en su escena.
- Las escenas inactivas quedan ocultas, inertes y pausadas.
- El modo de rendimiento limitado elimina blur y animaciones decorativas costosas.
- `prefers-reduced-motion` acorta los tiempos, elimina parallax y desactiva estrellas fugaces.
- Las áreas seguras de iOS y los teléfonos de poca altura tienen ajustes específicos.

## Ejecutar localmente

Desde la raíz del proyecto:

```bash
python -m http.server 8000
```

Después abre `http://localhost:8000/`.

También puede publicarse directamente con GitHub Pages porque todas las rutas del proyecto son relativas.

## Controles

- `Entrar ✦`: inicia la experiencia y solicita la reproducción de música.
- `Continuar ✦`: avanza cuando el momento ya terminó de revelarse.
- `‹`: vuelve al momento anterior sin reiniciar música ni interacciones.
- `♪`: activa o silencia la canción.
- `Escape`: cierra la constelación o el mensaje secreto si están abiertos.

Todos los controles son botones nativos, admiten teclado, tienen foco visible y objetivos táctiles de al menos 48 px; los pétalos mantienen un área útil mínima de 44 px mientras son interactivos.
