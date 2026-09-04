# Un universo para Andrea

Una experiencia web romántica, cinematográfica e interactiva construida como una carta digital para Andrea. Es un sitio completamente estático: no usa backend, no guarda respuestas y no envía información a ningún servicio.

## Tecnologías

- HTML5 semántico
- CSS3 mobile first
- JavaScript Vanilla
- Bootstrap 5 mediante CDN
- Google Fonts mediante CDN

No requiere Node.js, npm, compilación ni instalación de dependencias.

## Estructura

```text
.
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── assets/
│   ├── music.mp3          # opcional
│   ├── letter-texture.webp # opcional
│   └── favicon.png         # opcional
└── README.md
```

Los recursos de `assets/` son opcionales. Si no están presentes, la historia continúa funcionando; únicamente se omite el recurso correspondiente.

## Ver el proyecto localmente

Puedes abrir `index.html` directamente en un navegador moderno. Para reproducir el entorno de GitHub Pages con mayor fidelidad, también puedes servir la carpeta con cualquier servidor estático de tu preferencia.

La música nunca intenta reproducirse antes de una interacción: comienza únicamente después de pulsar **Entrar**, tal como exigen los navegadores móviles. Para añadirla, coloca un archivo MP3 con derechos de uso en:

```text
assets/music.mp3
```

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub y sube todos los archivos conservando la estructura de carpetas.
2. Abre **Settings → Pages** en el repositorio.
3. En **Build and deployment**, selecciona **Deploy from a branch**.
4. Elige la rama `main`, la carpeta `/ (root)` y pulsa **Save**.
5. Cuando finalice el despliegue, GitHub mostrará la URL pública del sitio.

Todas las rutas son relativas, por lo que el proyecto funciona tanto en un dominio de usuario como dentro de una ruta de repositorio (`usuario.github.io/repositorio/`).

> Nota de privacidad: antes de publicar, recuerda que un sitio de GitHub Pages puede ser público. Revisa el texto y los recursos para asegurarte de que no incluyan información que prefieras mantener privada.

## Personalización segura

- Cambia los textos directamente en `index.html`, manteniendo los IDs y atributos `data-*` usados por las interacciones.
- Ajusta la paleta, tipografías y tiempos visuales en `css/style.css`.
- Añade música propia o con licencia adecuada en `assets/music.mp3`.
- Puedes añadir `assets/favicon.png` y `assets/letter-texture.webp`; la experiencia no depende de ellos.

## Accesibilidad y compatibilidad

La experiencia incluye controles nativos de teclado, estados ARIA, alternativas textuales para los momentos visuales y soporte para `prefers-reduced-motion`. Está pensada primero para pantallas móviles —incluidos 320 px y 390 px de ancho— y usa unidades seguras para la altura visible en Safari iOS.

Se recomienda probar la versión publicada en:

- Safari en iPhone
- Chrome en Android
- Chrome, Firefox o Safari de escritorio
- Un dispositivo con reducción de movimiento activada
- Una sesión con `assets/music.mp3` y otra sin el archivo

## Flujo narrativo

La historia contiene catorce escenas, dos respuestas igualmente válidas y un desenlace final compartido. La opción elegida solo modifica el momento inmediato de la narración; no se almacena ni se transmite.

---

Hecho con intención, tiempo y un pequeño universo de estrellas.
