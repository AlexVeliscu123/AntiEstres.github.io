# Calma · juegos antiestrés

Pequeños juegos para desconectar un rato. Sin dependencias, sin build: solo HTML, CSS y JavaScript.

Al abrir la web verás un menú para elegir a qué quieres jugar (también puedes cambiar desde las pestañas).

- **🐛 Ciempiés**: grande y detallado, con 56 patas amarillas articuladas que dan pasos de verdad (cinemática inversa), cuerpo segmentado que ondula, forcípulas, ocelos, antenas y patas traseras con inercia. Sigue tu cursor o tu dedo; un click o toque lo hace salir disparado.
- **🕷️ Tarántula**: peluda, con 8 patas de dos articulaciones que andan en marcha alternada, abdomen que se balancea al girar, ocho ojos, quelíceros con colmillos y palpos que se mueven solos.
- **🌀 Spinner**: fidget spinner con inercia y panel de personalización:
  - 9 modelos: Clásico, Cuádruple, Penta, Doble, Shuriken, Engranaje, Flor, Hélice y Estrella.
  - Color principal y secundario (paleta o selector libre).
  - Acabados: Liso, Metálico, Neón, Cristal y Arcoíris (cambia de color al girar).
  - Pesos: Acero, Color, Gema o Hueco.
  - Rozamiento, fondo (Noche, Aurora, Atardecer, Océano), resplandor, botón aleatorio y restablecer.
  - Se guarda tu configuración en el navegador. Cuenta RPM, vueltas y récord.
- **⌨️ Teclado (modo gaming)**: teclas con luces RGB (Arcoíris, Cian, Rojo, Verde o apagadas), contador de **combo** que sube mientras no paras de pulsar, teclas por segundo, récord guardado, rangos (Calentando → Dios del teclado) y sacudida de pantalla cada 25 combos. Incluye 14 sonidos: Mecánico, Burbuja, Madera, Máquina de escribir, Piano, Marimba, Campanas, Guitarra, 8-bit, Láser, Batería, Gotas, Bolígrafo y 🎲 Sorpresa. Letras que flotan y soporte para el teclado físico.
- **🚗 Coches**: conduce siempre recto y esquiva el tráfico. Arrastra (o mueve el ratón, o usa ← → / A D) para cambiar de sitio. Si pasas muy cerca de un coche sin chocar, ¡bonus de **rozando**! La velocidad sube poco a poco. Guarda tu récord de metros.
- **🐥 Flappy**: toca (o Espacio) para aletear entre las tuberías. Elige entre 8 animales: Pollito, Cerdito, Rana, Mono, Gato, Panda, Zorro y Conejo (cada uno con su cielo). Se guarda tu animal favorito y tu récord.

- **🐍 Serpiente**: la clásica. Come frutas (🍎🍌🍇…), crece y va más rápida. Desliza el dedo, usa las flechas o WASD.
- **🟡 Laberinto**: estilo comecocos pero con **laberinto aleatorio nuevo en cada nivel**, túnel lateral, 4 píldoras de poder y 4 fantasmas con comportamientos distintos (uno persigue, otro embosca, otro te acorrala y otro es tímido). 3 vidas y los fantasmas se aceleran por nivel.
- **🧊 Bloque**: estilo Bloxorz. Rueda el bloque de 1×2 hasta el hueco dorado sin caerte. Los **niveles son aleatorios** y siempre tienen solución; cada uno muestra el "par" (mínimo de movimientos) y te da estrellas. Botones de nivel nuevo y reiniciar (también `N` y `R`).

- **🧩 Rubik**: cubo 3×3 en 3D real (CSS 3D, sin librerías). Arrastra sobre una cara para girar esa fila o columna en la dirección del dedo, y arrastra el fondo para rotar el cubo. Botón de **Mezclar**, contador de movimientos, cronómetro y récord de tiempo. Teclas `U D L R F B` (con Mayús, giro inverso).
- **😝 Chicle**: una cara (15 animales o 14 personas) hecha con una malla elástica con física: agárrala, estírala como un chicle y suéltala para que rebote. Personalizable: cara, tono de piel (personas), fondo, elasticidad (de chicle blando a rebote loco) y botón aleatorio. Se guarda tu elección.

Funciona en PC, móvil y tablet (ratón y pantalla táctil, con multitáctil en el teclado).

## Probarlo en local

Abre `index.html` en el navegador, o levanta un servidor sencillo:

```bash
python3 -m http.server 8000
# y entra en http://localhost:8000
```

## Publicarlo en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `calma`).
2. Sube los archivos a la raíz del repositorio: `index.html`, `style.css`, `script.js` y este `README.md`.
   ```bash
   git init
   git add .
   git commit -m "Calma: juegos antiestrés"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/calma.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`, y **Save**.
4. En uno o dos minutos tu web estará en `https://TU_USUARIO.github.io/calma/`.

## Personalizar

- Colores y tipografía: variables al principio de `style.css`.
- Tamaño de las criaturas: parámetros `div`, `smin` y `smax` al crear `Centi` y `Taran` en `script.js`.
- Número de segmentos del ciempiés: constante `N` en `makeCentipede`.
- Modelos de spinner: objeto `MODELS` en la sección *Fidget spinner*.
- Sonidos del teclado: objeto `THEMES` en la sección *Sonido*.
- Teclas del teclado: array `ROWS` en la sección *Teclado gaming*; colores RGB: `RGBS` y las variables `--rgb` en `style.css`.
- Animales de Flappy: array `ANIMALS` en la sección *Flappy animal* (emoji, nombre y colores del cielo).
- Laberinto: tamaño de celda `c0`, velocidades (`6.4` Pac, `gs` fantasmas) y vidas en la sección *Laberinto*. Bloque: pasos del nivel en `gen()` (`8 + level * 2`).
- Rubik: tamaño del cubo en `layout()`, velocidad de giro `dur` y nº de movimientos en `shuffle()`. Chicle: listas `ANIMALS` y `PEOPLE`, colores `BGS` y dureza en `PARAMS` (sección *Cara de chicle*).
- Dificultad: en *Coches*, velocidad `320 + t * 8` y `SLOW`; en *Flappy*, `gap` (hueco entre tuberías) y la gravedad `1500`.

## Licencia

Añade la licencia que prefieras (por ejemplo MIT) antes de publicarlo.
