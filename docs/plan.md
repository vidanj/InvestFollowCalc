# Plan — InvestFollowCalc (PWA de seguimiento de rendimientos)

## Contexto

El usuario necesita saber **cuánto han generado sus inversiones**, separando lo que gana de lo que aporta. La app no le pregunta qué tipo de inversión es ni en qué banco está. Solo registra **montos**: el saldo actual de cada cuenta y las aportaciones o retiros que hace. Con eso calcula la ganancia en dinero, el porcentaje y el tiempo en que se generó, por periodo y en total, y lo muestra con gráficas y desglose. Puede seguir varias cuentas, en USD o MXN.

Restricciones fijas:

- Funciona en escritorio y smartphone.
- Los datos viven **solo en el dispositivo**. Nunca hay nube ni servidor de terceros.
- Los datos se pasan de un dispositivo a otro con **respaldo exportable e importable**.

El repo está recién creado: tiene README, LICENSE (MIT) y un `.gitignore` de Python. El remoto es `github.com/vidanj/InvestFollowCalc`. Hay Node v24.14 y npm 11.9; pnpm no está instalado.

### Decisiones confirmadas con el usuario

| Tema                   | Decisión                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Stack                  | PWA con React + TypeScript + Vite (en lugar de Python, por ser más ligera y nativa como PWA)      |
| Multimoneda            | Totales separados por moneda (USD / MXN), sin conversión                                          |
| Respaldo               | **Siempre cifrado** con contraseña (AES-GCM)                                                      |
| Idioma                 | Código, comentarios y commits en inglés. UI y docs en español (es-MX). Textos de UI centralizados |
| Retiros                | Se soportan aportaciones **y** retiros                                                            |
| Captura de movimientos | Monto, más un **saldo resultante opcional**                                                       |
| % principal            | El simple (ganancia / capital aportado) como dato principal y el TWR anualizado como secundario   |

Interpretación del ejemplo del usuario: "15001" se lee como **10501** y "1550" como **10550**. Así sale una ganancia de 49 en el segundo tramo y de 50 en total.

---

## 1. Stack técnico

| Capa         | Elección                                                                                | Motivo                                                              |
| ------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Lenguaje     | TypeScript (strict)                                                                     | Tipos para montos y eventos, para evitar errores de cálculo         |
| UI           | React 19 + Vite                                                                         | Ecosistema amplio y build rápido                                    |
| Estilos      | Tailwind CSS v4                                                                         | Mobile-first rápido; modo oscuro                                    |
| Rutas        | React Router con `HashRouter`                                                           | Funciona en GitHub Pages y offline sin configurar el servidor       |
| Persistencia | IndexedDB con **Dexie 4** + `dexie-react-hooks` (`useLiveQuery`)                        | Almacenamiento local robusto y reactivo, sin gestor de estado extra |
| Gráficas     | Recharts                                                                                | Componentes React y series de tiempo responsivas                    |
| Validación   | zod                                                                                     | Formularios e importación de respaldos                              |
| Fechas       | date-fns (locale `es`)                                                                  | Diferencias en días y formato                                       |
| Cripto       | WebCrypto nativo (PBKDF2-SHA256 → AES-256-GCM)                                          | Sin dependencias y auditado por el navegador                        |
| PWA          | vite-plugin-pwa (Workbox `generateSW`)                                                  | Manifest, service worker, offline y aviso de actualización          |
| Tests        | Vitest + fake-indexeddb + Testing Library + fast-check (invariantes) + Playwright (e2e) |                                                                     |
| Calidad      | ESLint (typescript-eslint) + Prettier                                                   |                                                                     |
| Hosting      | GitHub Pages vía GitHub Actions                                                         | Solo sirve archivos estáticos; jamás recibe datos                   |

Las versiones se fijan de forma **exacta** en `package.json`, con la última estable al momento del setup. Se usa npm.

**Escritorio y móvil "directo":** la PWA se instala desde Chrome o Edge (Windows/Mac), Chrome (Android) o Safari con "Agregar a inicio" (iOS), y queda como app independiente y offline. Empaquetar con Tauri (.exe) o Capacitor (.apk) queda para una fase futura opcional.

---

## 2. Modelo de datos

**Dinero:** siempre se guarda como **entero en unidades menores** (centavos). Nunca se usa float para montos. Solo en los porcentajes se usa float.

```ts
type Currency = 'USD' | 'MXN';

interface Account {
  id: string; // crypto.randomUUID()
  name: string; // nombre libre ("Cuenta 1")
  currency: Currency;
  color: string; // para las gráficas
  archived: boolean;
  createdAt: string;
  updatedAt: string; // ISO datetime
}

type AccountEvent =
  | { type: 'balance'; balance: number } // "Actualizar saldo"
  | { type: 'deposit' | 'withdrawal'; amount: number; balanceAfter?: number };
// Campos comunes: id, accountId, date ('YYYY-MM-DD'), seq (orden dentro del mismo día), createdAt, updatedAt
```

- Al crear una cuenta se pide **saldo inicial + fecha**. Eso se guarda como el primer evento `balance` y no se puede borrar mientras haya otros eventos.
- No se aceptan eventos con fecha anterior al saldo inicial (error de validación con explicación).
- Si hay varios eventos el mismo día, se ordenan por `seq` (orden de captura). El usuario puede editar y borrar eventos, y todo se recalcula.

**Dexie DB `investfollowcalc` v1:** tablas `accounts`, `events` (índices `accountId`, `[accountId+date+seq]`) y `meta` (`schemaVersion`, `lastBackupAt`, `lastDataChangeAt`, ajustes). En la primera captura se llama a `navigator.storage.persist()`.

---

## 3. Motor de cálculo (`src/domain/engine.ts`, TS puro y sin React ni Dexie)

`computeAccount(events) → { periods[], summary }` siempre recalcula desde cero a partir de la lista ordenada. Los volúmenes son pequeños, así que es trivial.

**Normalización a una línea de tiempo:**

- `balance(B)` → punto de valuación `V(t, B)`.
- Movimiento con `balanceAfter` → `V(t, balanceAfter − F)`, luego el flujo `F`, luego `V(t, balanceAfter)`. Así la ganancia previa queda cerrada justo antes del movimiento.
- Movimiento sin `balanceAfter` → flujo pendiente `F`, que se absorbe en la siguiente valuación.
- `F` = +monto si es aportación y −monto si es retiro.

**Por periodo** (entre valuaciones consecutivas `a → b`; los periodos de 0 días con ganancia 0 se omiten en la vista):

- `ganancia = B_b − B_a − ΣF_pendientes`
- `% periodo` (Modified Dietz) `= ganancia / (B_a + Σ w_j·F_j)`, donde `w_j = (t_b − t_j)/(t_b − t_a)`. Si el denominador es ≤ 0, el resultado es "—".
- Se guardan también: días, fecha inicio/fin, saldo inicio/fin, flujos del periodo y ganancia acumulada.

**Resumen de la cuenta:**

- `capitalAportadoNeto = saldoInicial + Σaportaciones − Σretiros`
- `saldoActual = última valuación + flujos posteriores`. Si hay flujos sin valuación posterior, se marca "saldo estimado: actualiza tu saldo para calcular la ganancia".
- `gananciaTotal = Σ ganancias de periodo`. **Invariante:** `= saldoActual − capitalAportadoNeto`, siempre (también con flujos pendientes, porque ambos lados los incluyen).
- `% simple = gananciaTotal / capitalAportadoNeto` (dato principal; "—" si el capital es ≤ 0).
- `TWR = Π(1 + r_i) − 1` y `TWR anualizado = (1 + TWR)^(365/días) − 1`. Si hay menos de 30 días, se etiqueta como "estimado, periodo corto".
- Tiempo transcurrido (días / semanas / meses) y ganancia promedio por día y por mes.
- Mejor y peor periodo: se ordenan **por porcentaje** del periodo y se muestra también el monto (decidido el 2026-10-16; se implementa en la fase 3).
- Las cuentas **archivadas no cuentan** en los totales del portafolio (decidido el 2026-10-16).

**Portafolio (`portfolio.ts`):** agrega las cuentas **por moneda**. Nunca suma USD con MXN. Para el TWR del portafolio se encadenan los periodos combinando la línea de tiempo de las cuentas de esa moneda.

**Ejemplo del usuario (será un test):**

| Fecha      | Evento                               | Ganancia periodo            | Acumulado |
| ---------- | ------------------------------------ | --------------------------- | --------- |
| 2026-10-01 | Saldo inicial 10,000                 | —                           | 0         |
| 2026-10-12 | Saldo 10,001                         | **+1** en 11 días (0.01%)   | 1         |
| 2026-10-15 | Aportación 500, saldo después 10,501 | 0                           | 1         |
| 2026-11-02 | Saldo 10,550                         | **+49** en 18 días (0.467%) | **50**    |

Resumen: capital aportado 10,500, ganancia 50, % simple 0.476%, TWR 0.477%, TWR anualizado ≈ 5.6%.

Las fórmulas se documentan en lenguaje llano en `docs/calculos.md`, y la UI muestra un tooltip "¿Cómo se calcula?".

---

## 4. Pantallas (mobile-first; barra inferior en móvil y lateral en escritorio)

1. **Portafolio (inicio):** un bloque por moneda con saldo total, capital aportado, ganancia total ($ y % simple) y TWR anualizado, más una gráfica de saldo contra capital aportado. Debajo, la lista de cuentas con mini gráfica y ganancia. Si toca respaldar, aparece el aviso de respaldo.
2. **Detalle de cuenta:**
   - KPIs.
   - Gráficas: saldo contra capital aportado (líneas o área), ganancia acumulada (línea), ganancia por periodo (barras +/−) y % por periodo.
   - Filtro de rango: 1M / 3M / 6M / 1A / Todo.
   - Tabla de **desglose por periodo** y lista de movimientos (editar / borrar).
3. **Registrar movimiento** (hoja o modal): se elige el tipo (Actualizar saldo / Aportación / Retiro), con fecha (hoy por defecto), monto o saldo y el saldo después (opcional). Antes de guardar hay una **vista previa**, por ejemplo "Generaste $1.00 en 11 días (1.6 semanas)". Esa misma frase aparece como confirmación al guardar.
4. **Cuentas:** crear, editar, archivar y eliminar (nombre, moneda, color, saldo y fecha iniciales).
5. **Respaldo:** exportar (contraseña dos veces y aviso de que no se puede recuperar) e importar (archivo, contraseña, vista previa del contenido y confirmación de "Reemplazar todos los datos"). Muestra la fecha del último respaldo.
6. **Ajustes:** tema (sistema / claro / oscuro), estado del almacenamiento persistente, "Borrar todos los datos" con doble confirmación, y Privacidad / Acerca de.

Los textos de UI van en `src/i18n/es-MX.ts`. El formato de montos usa `Intl.NumberFormat('es-MX', { style: 'currency', currency })`.

---

## 5. Respaldo cifrado (`src/backup/`)

- **Payload:** `{ schemaVersion, appVersion, exportedAt, accounts, events, settings }`, validado con zod.
- **Cifrado:** PBKDF2-SHA256 con 600,000 iteraciones y salt aleatorio de 16 B, que da una llave AES-256-GCM. El IV aleatorio es de 12 B.
- **Archivo** `investfollowcalc-respaldo-YYYY-MM-DD.json`, que es un sobre JSON: `{ format: "investfollowcalc-backup", formatVersion: 1, kdf: {…, salt}, cipher: {name, iv}, data: base64 }`. La extensión `.json` asegura que se pueda elegir en iOS y Android.
- **Guardar:** en escritorio se usa `showSaveFilePicker` si existe. En móvil se usa la Web Share API con archivos (enviar a Archivos o Drive del propio usuario). Si nada de eso existe, se descarga con `<a download>`.
- **Importar:** si la contraseña es incorrecta o el archivo fue alterado, falla la autenticación GCM y se muestra "Contraseña incorrecta o archivo dañado". Se migra `schemaVersion` si el respaldo es antiguo. El modo MVP es **reemplazar todo**, después de sugerir respaldar los datos actuales.
- La contraseña nunca se guarda ni se loggea. No hay exportación en texto plano.
- **Recordatorio:** aviso si nunca se ha respaldado, o si hubo cambios y pasaron más de 30 días desde el último respaldo.

## 6. Privacidad y PWA

- **CSP** con `<meta>` en `index.html`: `default-src 'self'; connect-src 'self'; script-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; worker-src 'self'`. Con esto el navegador bloquea cualquier llamada externa.
- No hay analytics, telemetría, CDNs ni fuentes externas (se usan fuentes del sistema o auto-hospedadas).
- **Manifest:** `lang: es-MX`, `display: standalone`, íconos 192/512/maskable, `start_url` y `scope` con el base path `/InvestFollowCalc/`.
- **Service worker:** precache completo para funcionar offline, y aviso "Nueva versión disponible, recargar" (`registerType: 'prompt'`).
- **Nota iOS:** dentro de Safari el almacenamiento puede borrarse tras 7 días sin uso; instalada en inicio no. La UI recomienda instalar la app y respaldar.

---

## 7. Estructura del proyecto

```
CLAUDE.md                  README.md (es)             LICENSE
docs/plan.md               docs/calculos.md           docs/respaldo.md
index.html  package.json  vite.config.ts  tsconfig*.json  eslint.config.js
public/                    # íconos PWA
src/
  domain/                  # types, money, dates, engine, portfolio (puro) + __tests__
  db/                      # Dexie schema, migraciones, repositorios + __tests__
  backup/                  # crypto, schema zod, export, import + __tests__
  features/                # portfolio/, account/, movements/, accounts/, backup/, settings/
  components/              # UI base, charts/
  i18n/es-MX.ts
  App.tsx  main.tsx  routes.tsx
e2e/                       # Playwright (desktop + Pixel + iPhone)
.github/workflows/         # ci.yml (lint, typecheck, test, build) y deploy.yml (Pages)
```

`.gitignore`: se **agregan** las entradas de Node (`node_modules/`, `dist/`, `coverage/`, `playwright-report/`, `test-results/`, `dev-dist/`) y se conservan las existentes.

---

## 8. Fases de implementación

Cada fase termina con lint, typecheck y tests en verde y con un resumen de los cambios para revisión del usuario. **Nunca se hace commit ni push sin una orden explícita.**

| Fase                          | Entregable                                                                                                                                                                                                                     | Criterio de aceptación                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **0. Base**                   | `CLAUDE.md`, `docs/plan.md`, scaffold de Vite + React + TS, Tailwind, ESLint, Prettier, Vitest, Playwright, scripts npm, ajustes a `.gitignore`, `ci.yml`                                                                      | `npm run dev` muestra un shell vacío; `npm run lint && npm run typecheck && npm test` pasan |
| **1. Motor de cálculo**       | `domain/*` con tests (TDD): ejemplo del usuario, pérdidas, retiros, varios eventos el mismo día, flujos sin saldo, flujos pendientes, denominadores ≤ 0, edición y borrado, y la invariante con fast-check; `docs/calculos.md` | Cobertura ≥ 95% en `domain/`                                                                |
| **2. Persistencia y captura** | Dexie y repositorios (tests con fake-indexeddb); CRUD de cuentas; formulario de movimiento con vista previa; lista y edición de movimientos                                                                                    | Registrar el ejemplo completo desde la UI y ver los números correctos                       |
| **3. Visualización**          | Portafolio por moneda, detalle de cuenta, KPIs, 4 gráficas, filtro de rango, tabla de desglose, modo oscuro                                                                                                                    | Revisión visual a 360 px y en escritorio                                                    |
| **4. Respaldo**               | Exportar e importar cifrado, migración de esquema y recordatorio                                                                                                                                                               | Ida y vuelta idéntica; contraseña incorrecta o archivo alterado fallan limpio               |
| **5. PWA**                    | Manifest, íconos, SW offline, aviso de actualización, `storage.persist`, CSP                                                                                                                                                   | Instalable; funciona en modo avión; cero requests externos                                  |
| **6. Release**                | `deploy.yml` (GitHub Pages), e2e en 3 viewports, README de uso e instalación                                                                                                                                                   | El deploy se ejecuta **solo con orden explícita**. Versión v1.0.0                           |
| **Futuro** (fuera del MVP)    | Combinar al importar, vista consolidada con tipo de cambio manual, exportación CSV, XIRR, metas y proyecciones, UI en inglés, Tauri / Capacitor                                                                                | —                                                                                           |

**Prerrequisito de git (resuelto el 2026-10-16):** git fallaba con "dubious ownership" porque la carpeta pertenece a `BUILTIN/Administradores`. El usuario agregó la carpeta a `safe.directory` en su configuración global de git.

**Flujo de ramas (decidido el 2026-10-16):** una rama por fase; se integra a `main` sólo con orden explícita.

### Decisiones tomadas durante la implementación

Se reportaron al usuario al cerrar cada fase; cualquiera puede revertirse si no convence.

- **Fase 1:** porcentajes en "—" hasta tener un periodo medido; peso 0.5 para aportaciones en periodos de 0 días; promedio mensual = diario × 365/12; en el portafolio, una cuenta sin actualizar conserva su último saldo; fechas con utilidades propias (sin date-fns por ahora).
- **Fase 2:**
  - No se aceptan fechas futuras (validación en los formularios).
  - La moneda de una cuenta se puede cambiar después de crearla; los montos no se convierten.
  - El saldo inicial no se puede borrar (sólo eliminando la cuenta), no puede volverse aportación/retiro y debe seguir siendo el movimiento más antiguo.
  - Una cuenta archivada se oculta de la lista principal en una sección "Archivadas"; sigue abriéndose y editándose.
  - Rutas en inglés (`#/accounts/:id`); son identificadores, no texto de UI.
  - zod se pospone a la fase 4 (respaldos): los formularios validan con las funciones del dominio.
- **Fase 3:**
  - Colores de cuenta = los 8 colores categóricos de la paleta validada (dataviz), con su variante para modo oscuro. Validados contra las superficies reales de la app (blanco / slate-900). En modo claro, 3 colores quedan bajo 3:1, así que el color siempre va junto al nombre de la cuenta y cada gráfica tiene vista de tabla.
  - Ganancias y pérdidas en las barras usan la pareja divergente azul ↔ rojo. Ninguna gráfica tiene doble eje.
  - "% por periodo" es su propia gráfica, separada de "Ganancia por periodo" (mismo eje no es posible). En total, 4 gráficas en el detalle.
  - El filtro de rango (1M/3M/6M/1A/Todo) va arriba de la sección "Evolución" y aplica a sus 4 gráficas y al desglose. Los indicadores de arriba siempre son totales.
  - El portafolio es la pantalla de inicio: un bloque por moneda con indicadores, gráfica de saldo contra capital y sus cuentas activas.
  - El tema (Sistema/Claro/Oscuro) se guarda en `localStorage` de este dispositivo; no viaja en los respaldos.
  - Ajustes en esta fase: tema, estado del almacenamiento, privacidad y versión. "Borrar todos los datos" pasa a la fase 4, junto con los respaldos.
  - Las gráficas se cargan aparte (lazy): la carga inicial pasó de 242 a 129 KB comprimidos.
- **Fase 4:**
  - Contraseña de respaldo: mínimo 8 caracteres, escrita dos veces; sin reglas extra de complejidad.
  - El respaldo incluye cuentas archivadas; no incluye el tema.
  - Guardar: diálogo "Guardar como" en escritorio (Chromium), menú de compartir en teléfonos, descarga en el resto. Si el usuario cancela, no cuenta como respaldo.
  - Importar = reemplazar todo, con vista previa y doble confirmación; al importar, los datos cuentan como respaldados (no aparece el recordatorio).
  - Recordatorio: si nunca se ha respaldado (y hay datos) o si hubo cambios y el último respaldo tiene más de 30 días.
  - "Borrar todos los datos" (en Ajustes) pide escribir BORRAR y sugiere respaldar antes.
  - Nueva sección "Respaldo" en la navegación (Portafolio · Respaldo · Ajustes).
  - Formato documentado en `docs/respaldo.md`.
- **Fase 5:**
  - CSP más estricta que la planeada: `style-src 'self'` (sin `'unsafe-inline'`); se aplica sólo al build de producción (el servidor de desarrollo necesita scripts en línea).
  - zod en modo `jitless`: su detección de `eval` violaba la CSP (encontrado por las pruebas e2e).
  - El aviso de "nueva versión" / "funciona sin conexión" va dentro de la página, no flotando: flotando tapaba el botón "Crear cuenta" (encontrado por las pruebas e2e).
  - Actualización con aviso (`registerType: 'prompt'`): una versión nueva nunca recarga sola.
  - Tarjeta "Instalar la app" en Ajustes: botón donde el navegador lo ofrece, instrucciones en iPhone/iPad y en el resto.
  - Íconos generados con `npm run icons` (Chromium de Playwright, sin dependencias nuevas).
  - La pantalla de Respaldo se carga aparte: la carga inicial sigue en ~131 KB comprimidos.
- **Fase 6:**
  - Deploy a GitHub Pages **sólo manual** (`workflow_dispatch`), y sólo desde `main` (decidido por el usuario el 2026-10-16). Un push a `main` no publica.
  - CI agrega un job de e2e en Chromium y WebKit; los e2e locales cubren escritorio, Pixel 7 e iPhone 14.
  - Versión 1.0.0 en `package.json` y `CHANGELOG.md`; el tag `v1.0.0` queda para cuando el usuario lo ordene.
  - Proceso de release y verificación manual en dispositivos en `docs/release.md`.

- **Fase 7 — Presupuesto mensual y créditos** (rama de la sesión `claude/inspiring-dirac-kxkf0i`,
  decidido con el usuario el 2026-10-25):
  - Funcionalidad aparte de las inversiones: nueva sección **Presupuesto** en la navegación (Portafolio
    · Presupuesto · Respaldo · Ajustes); las pantallas de créditos cuelgan de ella.
  - Meses con ingresos y gastos; un concepto es de un solo mes o **se repite cada mes** (con mes final
    opcional). Editar o dejar de repetir "desde este mes" conserva los meses anteriores.
  - Categorías fijas de gasto (vivienda, servicios, comida, transporte, suscripciones, salud,
    entretenimiento, gastos hormiga, créditos y deudas, otros).
  - Cada concepto y cada crédito lleva su moneda; los totales del mes se separan por moneda.
  - Créditos con **tasa anual fija e IVA opcional (16%) sobre los intereses**, pagos mensuales,
    quincenales, catorcenales o semanales. El usuario da el número de pagos o el pago fijo.
  - Regla de interés ajustada a una tabla de amortización real que dio el usuario: año de 360 días,
    días del periodo = 365 / pagos por año a 4 decimales, interés redondeado al centavo por periodo,
    **IVA aparte del pago fijo**. Reproduce esa tabla con diferencias de a lo más un centavo por
    renglón; el último pago se ajusta para terminar en 0 (el banco deja −0.79). Los datos del
    crédito del usuario no se guardan en el repositorio; las pruebas usan un ejemplo sintético.
  - **Se sigue el plan**: cada pago se da por hecho en su fecha. Si algo cambia (pago extra, cargos),
    el usuario **actualiza el saldo** y desde su próximo pago se recalcula; se muestra la diferencia
    con lo que esperaba el plan. Los pagos extra no se agregan solos al presupuesto.
  - Comisiones y seguros cobrados al inicio (opcional): sólo para el "costo total del crédito" y lo
    "recibido"; no se calcula el CAT.
  - Esquema de Dexie v2 (tablas `budgetItems` y `credits`), `SCHEMA_VERSION = 2`; los respaldos v1 se
    migran con presupuesto y créditos vacíos. Sin dependencias nuevas.

- **Fase 8 — Repeticiones, cargos fijos, año e inversión sugerida** (misma rama, decidido con el
  usuario el 2026-10-25):
  - Un concepto se repite **solo una vez, cada semana, cada mes o cada año** (ingresos y gastos).
    Anual: el monto completo en su mes, cada 12 meses. Semanal: se cuentan los cargos reales del mes
    (4 o 5) cada 7 días desde la fecha del primer cargo.
  - **Cargos fijos del mes**: recordatorio de cuánto tener disponible en la cuenta = gastos que se
    repiten + pagos de créditos (sin los de una sola vez).
  - **Tu año**: ingresos, gastos y lo que quedará al cierre (enero a diciembre), separando lo
    registrado de la proyección de los meses que faltan.
  - **Inversión sugerida**: 20% de los ingresos del mes por omisión (ajustable), nunca más de lo que
    queda. Se proyecta aportándola cada mes con el **TWR anualizado real** del portafolio de esa
    moneda (o de una cuenta, o una tasa escrita), interés compuesto mensual, a 1, 3, 5 y 10 años.
    Sólo sugiere y proyecta: no registra movimientos en las cuentas.
  - Esquema v3 (`repeat` en lugar de `recurring`, `firstDate`), con migración de Dexie y de
    respaldos; los ajustes de la inversión van en `meta` y en `settings` del respaldo.

---

## 9. Contenido de `CLAUDE.md` (se crea en la fase 0)

```markdown
# CLAUDE.md — InvestFollowCalc

PWA (React + TypeScript + Vite) para seguir cuánto generan las inversiones del usuario, separando
ganancias de aportaciones/retiros. Multi-cuenta, monedas USD y MXN. Datos 100% locales (IndexedDB).

## Reglas principales (obligatorias)

1. **Ambigüedad → preguntar.** Si una decisión no está clara (cálculos, modelo de datos, flujos de UX,
   textos, dependencias, alcance), NO asumir: preguntar o presentar opciones con una recomendada.
   Esto aplica con más razón a cualquier fórmula financiera.
2. **Git sólo con orden explícita.** Nunca `commit`, `push`, `merge`, `rebase`, `tag`, `reset --hard`,
   force-push, crear PRs ni disparar deploys sin una instrucción explícita del usuario para ESA acción.
   Una autorización previa no se extiende a la siguiente. Al terminar una tarea: mostrar resumen de
   cambios y proponer mensaje de commit, y esperar.
3. **Privacidad absoluta.** Ningún dato del usuario sale del dispositivo. Prohibido: llamadas de red a
   terceros, analytics, telemetría, CDNs, fuentes externas, logs con montos. No relajar la CSP.
4. **Dependencias nuevas requieren aprobación** del usuario (explicar para qué y su peso). Versiones exactas.

## Reglas de dominio

- Montos SIEMPRE como enteros en unidades menores (centavos). Nunca float para dinero.
- Nunca sumar montos de monedas distintas. Toda cantidad lleva su `Currency`.
- `src/domain/` es puro (sin React, Dexie ni APIs del navegador). Todo cambio de fórmula:
  test primero + actualizar `docs/calculos.md`.
- Invariante: `gananciaTotal = saldoActual − capitalAportadoNeto` (siempre). Debe tener test.
- Aportaciones/retiros nunca cuentan como ganancia/pérdida.

## Datos, migraciones y respaldos

- Cambiar el esquema de Dexie ⇒ nueva `version()` con migración + test + subir `schemaVersion`.
- Los respaldos antiguos siempre deben poder importarse (migrar al importar).
- Respaldo siempre cifrado (PBKDF2-SHA256 600k → AES-256-GCM). Cambiar parámetros ⇒ nuevo `formatVersion`.
- Nunca guardar ni loggear la contraseña del respaldo.

## Idioma y estilo

- Identificadores, comentarios y mensajes de commit: inglés (Conventional Commits).
- UI, README y `docs/`: español (es-MX). Textos de UI sólo desde `src/i18n/es-MX.ts`, nunca hardcodeados.
- TypeScript strict, sin `any`. Componentes pequeños; lógica en `domain/` o hooks, no en JSX.
- Mobile-first: verificar a 360 px y en escritorio. Accesibilidad básica (labels, contraste, foco).

## Comandos

- `npm run dev` · `npm run build` · `npm run preview`
- `npm run lint` · `npm run typecheck` · `npm run format`
- `npm test` (Vitest) · `npm run test:e2e` (Playwright)

## Definición de "terminado"

`lint`, `typecheck` y `test` en verde (reportar con honestidad cualquier fallo u omisión), docs
actualizadas si cambió comportamiento, y resumen al usuario. Sin commit hasta que lo ordene.

## Estructura

`src/domain` cálculo puro · `src/db` Dexie · `src/backup` cifrado/export/import ·
`src/features` pantallas · `src/components` UI y gráficas · `src/i18n` textos · `e2e/` Playwright · `docs/`
```

---

## 10. Verificación

- **Unitarias (Vitest):** el ejemplo del usuario debe dar exactamente +1, +49 y un total de 50 sobre un capital de 10,500. Además, los casos borde de la fase 1 y la invariante con fast-check sobre secuencias aleatorias de eventos.
- **Repositorios:** CRUD y migraciones sobre fake-indexeddb.
- **Respaldo:** exportar, importar y obtener datos idénticos. Una contraseña incorrecta, un byte alterado o un JSON inválido dan un error claro sin tocar los datos actuales.
- **E2E (Playwright, desktop + Pixel 7 + iPhone 14):** crear la cuenta con 10,000, actualizar a 10,001, aportar 500 con saldo 10,501 y actualizar a 10,550. Se valida en pantalla: ganancia total $50.00, último periodo $49.00 y capital $10,500.00. Después se exporta, se borran los datos, se importa y se valida lo mismo.
- **Offline:** con `npm run build && npm run preview`, cargar, poner el navegador offline y recargar; la app debe funcionar completa.
- **Privacidad:** en la pestaña Network durante el flujo completo no debe haber ningún request a otro origen.
- **Manual:** instalar en Windows (Edge/Chrome), Android (Chrome) e iOS (Safari, agregar a inicio). Exportar en un dispositivo e importar en otro.
