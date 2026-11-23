# dos-realidades

### Memoria, percepción y selección de la realidad

**Proyecto interactivo de visión artificial — DPPI 2026**

[**Ver experiencia interactiva**](https://marcezm.github.io/dos-realidades/)

## ¿De qué trata?
Es una experiencia interactiva que explora la relación entre memoria, percepción y selección de la realidad a través de una cámara.

El proyecto propone reflexionar sobre cómo observamos nuestro entorno y cómo decidimos qué momentos conservar. A través de dos tecnologías de visión artificial, MediaPipe y OpenCV, la cámara deja de ser un dispositivo que simplemente registra imágenes y se transforma en una herramienta para intervenir, seleccionar y reinterpretar lo que vemos.

La experiencia invita al usuario a utilizar sus propias manos para construir un visor, modificar el encuadre y capturar fragmentos de su entorno. Cada captura se convierte en parte de una colección visual que mezcla imágenes instantáneas con huellas del movimiento.

## ¿Cómo funciona?
El proyecto se divide en dos sistemas que trabajan simultáneamente utilizando la cámara del dispositivo.

### 01. Encuadrar - MediaPipe
Mediante MediaPipe se reconocen ambas manos y se realiza un seguimiento de los dedos índice y pulgar.

El usuario puede interactuar con la cámara mediante dos gestos:
- **Encuadrar:** al separar los dedos índice y pulgar, se modifica el tamaño del marco visual.
- **Disparar:** al juntar el índice y el pulgar de ambas manos simultáneamente, se activa la captura de una imagen.

De esta manera, las manos funcionan como una herramienta para seleccionar qué parte de la realidad queremos observar y conservar.

### 02. Conservar — OpenCV
OpenCV procesa los cambios de movimiento que ocurren en la imagen capturada por la cámara.

A través de un efecto de larga exposición, los movimientos se transforman en huellas visuales que permanecen durante un tiempo, creando estelas y rastros de lo que ocurrió frente a la cámara.

Este sistema permite observar el movimiento de una manera diferente: en lugar de registrar únicamente un instante, muestra parte de su recorrido en el tiempo.

### 03. Galería — Memoria visual
Cada captura realizada se incorpora a una galería de fragmentos, organizada como una hoja de contactos fotográfica.

El usuario puede seleccionar diferentes emulsiones visuales inspiradas en procesos fotográficos analógicos:
- Kodachrome 64
- Polaroid 600
- Tri-X 400
- Cinestill 800T
- Daguerrotipo

Las imágenes pueden conservarse y descargarse en formato PNG, construyendo una colección personal de momentos seleccionados.

## Reflexión semiótica y percepción
FRAGMENTOS parte de una pregunta: ¿vemos la realidad tal como es o solamente vemos aquello a lo que prestamos atención?

Aunque la cámara registra una misma escena, la experiencia demuestra que nuestra percepción puede transformarse dependiendo de cómo observamos y qué decidimos destacar.

Desde una mirada semiótica, la fotografía funciona como un signo que representa un momento, pero nunca logra contener la totalidad de lo que ocurrió. Una imagen es solamente un fragmento de la realidad: deja fuera los sonidos, las sensaciones, el contexto y todo aquello que sucedió antes o después de la captura.

La interacción con las manos representa esta selección. Al encuadrar, el usuario decide qué incluir y qué dejar fuera. Al disparar, transforma una experiencia continua en un instante que puede conservar.

Por otro lado, las huellas de larga exposición representan aquello que normalmente no permanece en una fotografía tradicional: el movimiento, el paso del tiempo y los rastros de una acción.

La propuesta también se relaciona con las ideas de Maurice Merleau-Ponty sobre la percepción corporal, entendiendo que nuestra manera de experimentar el mundo está directamente vinculada con nuestro cuerpo y sus posibilidades de acción.

Así, FRAGMENTOS plantea que recordar no significa conservar la realidad completa, sino construir una representación personal a partir de momentos que elegimos guardar.

**No todo lo que vemos permanece. Elegimos qué conservar.**

## Tecnologías utilizadas
- **HTML5:** estructura de la experiencia web.
- **CSS3:** diseño visual, composición y estilos de interfaz.
- **JavaScript:** lógica de interacción y funcionamiento de la experiencia.
- **MediaPipe:** reconocimiento y seguimiento de las manos.
- **OpenCV.js:** procesamiento de imagen y generación de efectos de movimiento.
- **Canvas:** representación visual de los resultados y las capturas.
- **GitHub Pages:** publicación de la experiencia en internet.

## ¿Cómo utilizarlo?
1. Ingresa a la [experiencia FRAGMENTOS](https://marcezm.github.io/dos-realidades/).
2. Presiona **Comenzar experiencia**.
3. Autoriza el acceso a la cámara del dispositivo.
4. Coloca ambas manos frente a la cámara.
5. Utiliza los dedos índice y pulgar para modificar el encuadre.
6. Junta ambos pares de dedos para capturar un fragmento.
7. Explora los diferentes efectos fotográficos.
8. Revisa tu galería y descarga tus capturas.

**Importante:** se recomienda utilizar un computador con cámara web y permitir el acceso a ella desde el navegador.

---

**FRAGMENTOS - Memoria, percepción y selección de la realidad.**
