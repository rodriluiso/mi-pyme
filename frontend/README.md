# PYME Frontend

Aplicación frontend moderna construida con React, Vite y TypeScript para el ecosistema PYME.

## Prerrequisitos

- Node.js 18 o superior
- npm, pnpm o yarn (recomendado npm)

## Scripts disponibles

- `npm install` para instalar dependencias.
- `npm run dev` inicia el servidor de desarrollo con HMR.
- `npm run build` genera la compilación lista para producción.
- `npm run preview` sirve la compilación de producción.
- `npm run lint` ejecuta ESLint con las reglas definidas.
- `npm run format` formatea el código con Prettier.
- `npm run test` corre Vitest en modo watch.
- `npm run test:coverage` genera el reporte de cobertura.

## Estructura destacada

- `src/routes` enrutamiento centralizado con React Router.
- `src/layouts` layouts reutilizables.
- `src/lib/api` cliente Axios con manejo de errores.
- `src/hooks` hooks reutilizables como `useApi`.
- `src/pages` vistas de alto nivel.

## Alias de imports

Los imports absolutos usan el prefijo `@/`, configurado en `tsconfig` y soportado por Vite, Vitest y ESLint.

## Estilos

TailwindCSS configurado mediante `tailwind.config.ts` con PostCSS. Utilizá las utilidades directamente en los componentes.

## Testing

Vitest configurado con React Testing Library (`vitest.config.ts`) y setup global en `vitest.setup.ts`.
