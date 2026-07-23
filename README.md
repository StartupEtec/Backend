# Backend Service - Digital On-Demand Platform

Servicio Backend RESTful construido en Node.js, Express y TypeScript.

## 🚀 Requisitos Previos

- **Node.js**: v18 o superior
- **Docker** y **Docker Compose** (para PostgreSQL)
- **npm** o **yarn**

## 🔧 Configuración Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno:
   ```bash
   cp .env.example .env
   ```
   *Edita `.env` si es necesario.*

3. Levantar el entorno de base de datos (PostgreSQL/PostGIS):
   *(Configura y levanta tu contenedor de base de datos local)*

4. Compilar el proyecto en TypeScript:
   ```bash
   npm run build
   ```

## 🛠️ Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo utilizando `nodemon` y `ts-node` en caliente.
- `npm start`: Inicia el servidor en producción desde el directorio de distribución compilado (`dist`).
- `npm run build`: Compila los archivos TypeScript a JavaScript en la carpeta `dist`.
- `npm run format`: Formatea el código de manera automática utilizando `Prettier`.
- `npm run format:check`: Verifica si hay desviaciones en las reglas del formateador de código.
- `npm test`: Ejecuta la suite de pruebas unitarias usando `Jest`.

## 📂 Estructura del Directorio

```
├── config/             # Archivos de configuración general
├── docs/               # Documentación técnica y diagramas
├── src/
│   ├── controllers/    # Controladores de la API (HTTP endpoints)
│   ├── middlewares/    # Middlewares de Express (Auth, Rate Limiting, etc.)
│   ├── models/         # Modelos de base de datos y esquemas
│   ├── routes/         # Definición de rutas Express
│   ├── services/       # Lógica de negocio core
│   ├── utils/          # Utilidades y funciones helper
│   ├── app.ts          # Configuración de Express
│   └── server.ts       # Punto de entrada del servidor
├── tests/              # Pruebas unitarias y de integración
├── .env.example        # Plantilla de variables de entorno
└── tsconfig.json       # Configuración de TypeScript compiler
```