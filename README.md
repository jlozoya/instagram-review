# Instagram Export Checker para Windows

Aplicación de escritorio para analizar el ZIP exportado por Instagram y revisar quién no te sigue de vuelta.

## Icono incluido

El proyecto ya contiene el icono de la aplicación en todos los formatos necesarios:

```text
build/icon.svg        Fuente editable del icono
build/icon.png        Icono de la ventana de Electron
build/icon.ico        Icono del ejecutable, instalador y barra de tareas de Windows
public/assets/icon.png Icono utilizado dentro de la interfaz
```

El icono está configurado en `package.json` para el build de Windows y en `electron/main.mjs` para el modo de desarrollo.

## Ejecutables de Windows

La aplicación está configurada para generar:

```text
dist/Instagram-Export-Checker-2.1.1-x64.exe
dist/Instagram-Export-Checker-Setup-2.1.1-x64.exe
```

El primer archivo es portable y abre directamente sin instalación. El segundo es el instalador de Windows.

## Funciones

- Selección del ZIP con diálogo de Windows o drag-and-drop.
- Procesamiento local del ZIP; no usa servidor web ni sube tus datos.
- Conteos de seguidores, seguidos, no-follow-back y seguimiento mutuo.
- Búsqueda y paginación de resultados.
- Verificación de usernames específicos.
- Descarga individual de CSV/JSON o guardado de todos los resultados en una carpeta.

## Generar el `.exe` en Windows

Extrae el proyecto y haz doble clic en:

```text
generar-ejecutable-windows.bat
```

El archivo utiliza `pnpm` si está instalado. También puedes ejecutar manualmente:

```powershell
pnpm install
pnpm run dist:win:all
```

Los `.exe` con icono quedan en la carpeta `dist`.

## Ejecutar la aplicación en desarrollo

```powershell
pnpm install
pnpm start
```

## Generarlo desde GitHub Actions

El proyecto incluye:

```text
.github/workflows/build-windows.yml
```

1. Sube el proyecto a un repositorio de GitHub.
2. Abre la pestaña **Actions**.
3. Selecciona **Build Windows executable**.
4. Presiona **Run workflow**.
5. Descarga el artifact `instagram-export-checker-windows`.

Ese artifact contiene el ejecutable portable y el instalador con el icono aplicado.

## Comando CLI opcional

```powershell
pnpm run cli -- "C:\Users\TU_USUARIO\Downloads\instagram-export.zip"
pnpm run cli -- "C:\Users\TU_USUARIO\Downloads\instagram-export.zip" ".\resultado-instagram" "_criminals666_"
```

## Exportación requerida de Instagram

Descarga la información de **Seguidores y seguidos** en formato **JSON**. El ZIP debe contener archivos equivalentes a:

```text
followers_1.json
following.json
```

Los resultados representan el contenido del ZIP. Si la aplicación de Instagram muestra una relación diferente, descarga una exportación actualizada.

## Seguridad y privacidad

- La aplicación procesa el ZIP en tu computadora.
- La ventana no tiene acceso directo a Node.js.
- Solo se exponen operaciones controladas para abrir el ZIP, ejecutar el análisis y guardar resultados.
- La aplicación no navega a páginas externas dentro de la ventana; los perfiles se abren en el navegador predeterminado.

## Estructura

```text
instagram-review/
├── .github/
│   └── workflows/
│       └── build-windows.yml
├── build/
│   ├── icon.ico
│   ├── icon.png
│   └── icon.svg
├── electron/
│   ├── main.mjs
│   └── preload.cjs
├── public/
│   ├── assets/
│   │   └── icon.png
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   └── instagram-analyzer.mjs
├── .gitignore
├── generar-ejecutable-windows.bat
├── instagram-export-checker.mjs
├── package.json
└── README.md
```
