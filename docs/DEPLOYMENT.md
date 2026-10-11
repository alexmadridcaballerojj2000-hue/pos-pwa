# Guía de Despliegue y Vistas Previas HTTPS

POS PWA es una aplicación web estática (SPA + PWA) que requiere HTTPS obligatorio para el funcionamiento de Service Workers, Web App Manifest y capacidades offline.

## Opciones de Despliegue Recomendadas

### Opción 1: Cloudflare Pages (Recomendada)

1. Conecta tu repositorio de GitHub en el panel de Cloudflare Pages.
2. Configuración de compilación:
   - **Framework preset**: `Vite`
   - **Build command**: `pnpm build`
   - **Build output directory**: `dist`
   - **Variables de entorno**: `NODE_VERSION: 22`
3. En cada commit o pull request, Cloudflare generará automáticamente una URL de vista previa con HTTPS.

### Opción 2: Vercel

1. Importa el repositorio desde GitHub en Vercel.
2. Detecta automáticamente Vite:
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install`

### Opción 3: Netlify

1. Conecta el repositorio de GitHub en Netlify.
2. Configuración:
   - **Base directory**: `/`
   - **Build command**: `pnpm build`
   - **Publish directory**: `dist`
