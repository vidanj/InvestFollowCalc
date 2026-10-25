# CLAUDE.md — InvestFollowCalc

PWA (React + TypeScript + Vite) para seguir cuánto generan las inversiones del usuario, separando
ganancias de aportaciones/retiros, y un presupuesto mensual (ingresos, gastos y créditos con su tabla
de amortización). Multi-cuenta, monedas USD y MXN. Datos 100% locales (IndexedDB).
Plan completo y fases: [docs/plan.md](docs/plan.md).

## Reglas principales (obligatorias)

1. **Ambigüedad → preguntar.** Si una decisión no está clara (cálculos, modelo de datos, flujos de UX,
   textos, dependencias, alcance), NO asumir: preguntar o presentar opciones con una recomendada.
   Esto aplica con más razón a cualquier fórmula financiera.
2. **Git sólo con orden explícita.** Nunca `commit`, `push`, `merge`, `rebase`, `tag`, `reset --hard`,
   force-push, crear PRs ni disparar deploys sin una instrucción explícita del usuario para ESA acción.
   Una autorización previa no se extiende a la siguiente. Al terminar una tarea: mostrar resumen de
   cambios y proponer mensaje de commit, y esperar.
   **Ramas:** una rama por fase (`chore/phase-0-scaffold`, `feat/phase-1-engine`, …). Nunca commitear
   directo en `main`; integrar a `main` (merge o PR) sólo cuando el usuario lo ordene.
   **Deploy:** el workflow `deploy.yml` es sólo manual (`workflow_dispatch`, sólo desde `main`). Lanzarlo,
   habilitar Pages o crear tags requiere orden explícita. Proceso completo: `docs/release.md`.
3. **Privacidad absoluta.** Ningún dato del usuario sale del dispositivo. Prohibido: llamadas de red a
   terceros, analytics, telemetría, CDNs, fuentes externas, logs con montos. No relajar la CSP
   (`vite.config.ts`): nada de scripts o `<style>` en línea ni `eval`/`new Function` (zod va en
   `jitless`). `e2e/pwa.spec.ts` verifica cero violaciones de CSP y cero peticiones a otros orígenes.
4. **Dependencias nuevas requieren aprobación** del usuario (explicar para qué y su peso). Versiones
   exactas (`npm install --save-exact`).

## Reglas de dominio

- Montos SIEMPRE como enteros en unidades menores (centavos). Nunca float para dinero.
- Nunca sumar montos de monedas distintas. Toda cantidad lleva su `Currency`.
- `src/domain/` es puro (sin React, Dexie ni APIs del navegador). Todo cambio de fórmula:
  test primero + actualizar `docs/calculos.md`.
- Invariante: `gananciaTotal = saldoActual − capitalAportadoNeto` (siempre, también con flujos
  pendientes). Verificada con fast-check en `src/domain/__tests__/invariants.test.ts`.
- Cobertura mínima de `src/domain/`: 95% (umbral en `vite.config.ts`; `npm run test:coverage`).
- Aportaciones/retiros nunca cuentan como ganancia/pérdida.
- Un retiro sin `balanceAfter` no puede exceder el saldo conocido (`overdrawnWithdrawals`): se valida
  sólo al escribir (`validateCandidate`/`validateRemoval`), nunca en `validateTimeline`, para que los
  datos y respaldos anteriores se sigan leyendo.
- Presupuesto: `te queda = ingresos − gastos` y categorías = gastos; créditos: cada pago = capital +
  interés + IVA, saldo final 0, `total = capital − ajustes de saldo + intereses + IVA`. Verificadas
  con fast-check en `src/domain/__tests__/budgetInvariants.test.ts`.
- Interés de créditos: tasa anual / 360 × (365 / pagos por año, a 4 decimales), redondeado al
  centavo por periodo; IVA 16% aparte del pago fijo. Detalle en `docs/calculos.md`.
- Repeticiones: semanal = cargos reales del mes cada 7 días desde `firstDate`; anual = completo en su
  mes; `skippedMonths` (sólo gastos mensuales/semanales) hace que ese mes cuente 0. Cargos fijos =
  gastos que se repiten (no omitidos) + créditos. Inversión sugerida = % de ingresos topado en
  lo que queda; proyección con TWR anualizado real, compuesto mensual, aportando a fin de mes
  (`src/domain/investPlan.ts`).

## Datos, migraciones y respaldos

- Cambiar el esquema de Dexie ⇒ nueva `version()` con migración + test + subir `schemaVersion`.
- Los respaldos antiguos siempre deben poder importarse: al subir `SCHEMA_VERSION`, agregar el paso en
  `MIGRATIONS` de `src/backup/backup.ts` y una prueba con un respaldo de la versión anterior.
- Respaldo siempre cifrado (PBKDF2-SHA256 600k → AES-256-GCM). Cambiar parámetros ⇒ nuevo `formatVersion`.
- Nunca guardar ni loggear la contraseña del respaldo. No existe exportación en texto plano.
- Importar valida todo antes de escribir y reemplaza en una sola transacción. Formato: `docs/respaldo.md`.

## Idioma y estilo

- Identificadores, comentarios y mensajes de commit: inglés (Conventional Commits).
- UI, README y `docs/`: español (es-MX). Textos de UI sólo desde `src/i18n/es-MX.ts`, nunca hardcodeados.
- TypeScript strict, sin `any`. Componentes pequeños; lógica en `domain/` o hooks, no en JSX.
- Mobile-first: verificar a 360 px y en escritorio. Accesibilidad básica (labels, contraste, foco).

## Gráficas

- Seguir la skill `dataviz`: colores sólo desde los tokens de `src/styles/index.css` (`--series-*`,
  `--account-1..8`, `--chart-*`), con valores separados para claro y oscuro. Si cambia la paleta, correr el
  validador de la skill contra las superficies de la app antes de usarla.
- Nunca doble eje; leyenda con 2+ series; tooltip en todas; cada gráfica con su vista de tabla.
- Ejes Y con `niceTicks` + `moneyTickFormatter`/`percentTickFormatter` (`src/components/charts/chartFormat.ts`).
- Las gráficas se importan desde `LazyCharts.tsx` (Recharts va en un chunk aparte).
- Revisar visualmente (captura a 360 px y escritorio, claro y oscuro) cualquier cambio de gráfica.
- Formato con Prettier (`npm run format`); no discutir estilo que Prettier ya resuelve.

## Comandos

- `npm run dev` · `npm run build` · `npm run preview`
- `npm run lint` · `npm run typecheck` · `npm run format` · `npm run format:check`
- `npm test` (Vitest) · `npm run test:coverage` · `npm run test:e2e` (Playwright, usa el build de producción)
- `npm run icons` regenera los íconos PWA de `public/icons/` (cambiar el diseño en `scripts/generate-icons.mjs`).

## PWA

- Service worker con precarga completa (funciona sin conexión) y actualización con aviso al usuario.
- El módulo `virtual:pwa-register/react` sólo existe en el build; en Vitest apunta a `src/test/pwaRegisterStub.ts`.
- Avisos y banners van en el flujo de la página, nunca flotando sobre botones o formularios.

## Definición de "terminado"

`lint`, `format:check`, `typecheck` y `test` en verde (reportar con honestidad cualquier fallo u
omisión), docs actualizadas si cambió comportamiento, y resumen al usuario. Sin commit hasta que lo ordene.

## Estructura

`src/domain` cálculo puro (inversiones, `budget.ts`, `credit.ts`, `investPlan.ts`, `months.ts`) · `src/db` Dexie · `src/backup` cifrado/export/import ·
`src/features` pantallas · `src/components` UI y gráficas · `src/i18n` textos · `src/theme` tema ·
`src/test` setup y helpers de Vitest · `e2e/` Playwright · `docs/` plan y explicación de cálculos.

## Versiones fijadas a propósito

- `typescript@6.0.3`: `typescript-eslint` aún no soporta TS 7 (`<6.1.0`). Subir sólo cuando lo soporte.
- `jsdom@29.1.1`: jsdom 30 exige Node ≥ 24.15; el entorno actual usa Node 24.14.
- La app se sirve bajo el base path `/InvestFollowCalc/` (GitHub Pages), también en `dev` y `preview`.
