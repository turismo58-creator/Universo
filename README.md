# Un universo para Andrea

Una experiencia web romántica, cinematográfica e interactiva construida como una carta digital. La historia reconoce un error, evita excusas y cambia las promesas por hechos. Su recorrido es completamente lineal: no pide una respuesta ni presenta opciones de «sí» o «no».

Es un sitio estático compatible con GitHub Pages. No usa backend, no transmite información y no requiere proceso de compilación.

## Tecnologías

- HTML5 semántico
- CSS3 mobile first
- JavaScript Vanilla
- Bootstrap 5 mediante CDN
- Cormorant Garamond e Inter mediante Google Fonts
- SVG generado con JavaScript para el girasol cósmico

No requiere React, Node.js, npm ni dependencias instaladas localmente.

## Estructura

```text
.
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── cancion/
│   └── .gitkeep
├── assets/
│   └── .gitkeep
└── README.md
```

La carpeta `cancion/` se conserva en Git mediante `.gitkeep`. El código no genera ni descarga el MP3: ese archivo se suministra manualmente en la ruta indicada.

## Añadir la música

Para añadir la canción coloca:

```text
cancion/algo-que-se-quede.mp3
```

El nombre debe permanecer en minúsculas, sin espacios ni tildes. La ruta usada por la página es `./cancion/algo-que-se-quede.mp3`.

El navegador no solicita ni reproduce el MP3 antes de una interacción humana. Al pulsar **Entrar ✦**, el volumen sube gradualmente desde `0` hasta `0.22` durante aproximadamente tres segundos. El botón flotante permite silenciar o reanudar la música. Si el archivo no existe o el navegador bloquea la reproducción, la historia continúa normalmente; al restaurar una sesión puede aparecer el control **Continuar con música ✦**.

Usa únicamente música propia o con una licencia que permita su publicación.

## Ver el proyecto localmente

Puedes abrir `index.html` directamente en un navegador moderno. Para reproducir con mayor fidelidad el comportamiento de GitHub Pages, sirve la carpeta mediante cualquier servidor HTTP estático y abre su URL local.

## Recorrido

La experiencia contiene catorce escenas numeradas del 0 al 13, seguidas por un cierre sin elección y una última estrella:

- una puerta inicial que habilita música y estrellas;
- una confesión directa, el aprendizaje y el momento «Con hechos»;
- un girasol cósmico programado, con ocho pétalos explorables y un centro interactivo;
- una constelación opcional integrada en la escena de iniciativa;
- dos estrellas individuales que avanzan juntas sin fusionarse;
- el universo profundo, una estrella secreta y la formación de `ANDREA`;
- un cierre lineal que no exige respuesta;
- una escena final que deja solamente estrellas, música y un pequeño girasol.

Las interacciones son exploratorias. No es obligatorio tocar todos los pétalos ni abrir todas las estrellas para continuar.

## Persistencia durante la sesión

Para resistir una recarga accidental, el descarte de una pestaña móvil o el regreso desde el historial, la experiencia guarda temporalmente en `sessionStorage`:

- `experienceStarted`: indica que la puerta ya fue atravesada;
- `lastScrollPosition`: conserva una posición vertical aproximada;
- `lastScene`: identifica la escena alcanzada;
- `musicCurrentTime`: conserva el instante aproximado de la canción;
- `endingState`: registra el avance del cierre lineal, nunca una respuesta.

La posición se guarda con limitación de frecuencia y también durante `pagehide`. La restauración reconstruye primero el estado visual y después recupera el desplazamiento cuando el layout está listo. Los eventos `pageshow`, `pagehide` y `visibilitychange` contemplan el BFCache de Safari y los cambios de pestaña. Una protección global evita duplicar listeners, estrellas o audio.

Estos datos viven únicamente en la pestaña y se descartan al terminar la sesión del navegador. No se envían a ningún servicio.

## Organización de JavaScript

`js/app.js` separa las responsabilidades principales en funciones dedicadas:

- `initExperience()` y `restoreExperience()`;
- `saveExperienceState()`;
- `initAudio()` y `restoreAudio()`;
- `createStars()`;
- `initScrollAnimations()` e `initScrollProgress()`;
- `initInitiativeMoment()`;
- `initCosmicSunflower()` e `initSunflowerPetals()`;
- `initConstellation()`;
- `initAndreaStars()` e `initFutureStars()`;
- `initSecretStar()`.

La inicialización se protege con `window.__andreaUniverseInitialized`. El flujo normal no fuerza desplazamientos ni focos durante los revelados y no devuelve la página al inicio después de entrar.

## Accesibilidad, móvil y rendimiento

- Controles nativos de teclado y botones con objetivos táctiles de al menos 44 × 44 px.
- Estados ARIA, regiones de estado y alternativas textuales para momentos visuales.
- Soporte para `prefers-reduced-motion`.
- Alturas seguras con `svh` y `dvh`, pensadas especialmente para Safari en iPhone.
- Diseño prioritario para 390 × 844 px, compatible también con 320, 375, 414 y 430 px de ancho.
- Animaciones basadas principalmente en `transform` y `opacity`.
- Estrellas DOM/CSS limitadas en móvil, sin Three.js, canvas pesado ni librerías de partículas.

## Publicar en GitHub Pages

1. Sube todos los archivos al repositorio conservando exactamente la estructura de carpetas.
2. Abre **Settings → Pages**.
3. En **Build and deployment**, selecciona **Deploy from a branch**.
4. Elige la rama `main`, la carpeta `/ (root)` y pulsa **Save**.
5. Espera a que GitHub muestre la URL publicada.

Todas las rutas del proyecto son relativas, por lo que funcionan dentro de una ruta de repositorio como `usuario.github.io/Universo/`.

## Comprobaciones recomendadas

- Recorrer la historia completa en Safari para iPhone y Chrome para Android.
- Bloquear y desbloquear el teléfono a mitad del recorrido.
- Cambiar de pestaña, volver y probar una recarga accidental.
- Rotar el dispositivo y regresar a vertical.
- Abrir y cerrar la constelación.
- Probar pétalos y centro del girasol.
- Verificar el recorrido con el MP3 y también sin él.
- Probar teclado y reducción de movimiento.

> Antes de publicar, revisa el texto y los recursos. Un sitio de GitHub Pages puede ser público.
