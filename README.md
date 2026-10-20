# InvestFollowCalc

Aplicación web progresiva (PWA) para saber **cuánto han generado tus inversiones**, separando la
ganancia de lo que tú aportas o retiras. No importa qué tipo de inversión sea ni en qué banco esté:
la app sólo sigue montos.

- Registras el saldo de cada cuenta de vez en cuando; la app calcula **cuánto generó, en qué
  porcentaje y en cuánto tiempo**, por periodo y en total, con gráficas y desglose.
- Varias cuentas, en **USD o MXN** (los totales se muestran por moneda, sin convertir).
- Tus datos se guardan **solo en tu dispositivo**. No hay cuentas de usuario, nube ni servidor.
- **Respaldos cifrados** con contraseña para pasar tus datos a otro teléfono o computadora.
- Se instala como app en Android, iPhone, Windows y Mac, y **funciona sin conexión**.

**Abrir la app:** <https://vidanj.github.io/InvestFollowCalc/> _(disponible una vez publicada)_

## Cómo se usa

1. **Crea una cuenta** con su nombre, moneda y el saldo que marca hoy.
2. Cada cierto tiempo, **actualiza el saldo** con lo que marca la cuenta. La app te dice, por
   ejemplo: _"Generaste $1.00 en 11 días (1.6 semanas)"_.
3. Si **aportas o retiras** dinero, regístralo como aportación o retiro (y, si lo sabes, el saldo
   que quedó). Así ese dinero nunca se confunde con ganancia o pérdida.

Ejemplo: tienes 10,000; dos semanas después marca 10,001 (generó 1). Aportas 500 y queda en 10,501;
semanas después marca 10,550. La app muestra +49 en ese tramo y **+50 en total**, sobre 10,500
aportados.

Qué significa cada número (ganancia, % simple, rendimiento anualizado TWR, periodos):
[docs/calculos.md](docs/calculos.md).

## Instalar la app

| Dispositivo                  | Cómo                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| Android (Chrome)             | Abre la app → _Ajustes → Instalar_, o menú ⋮ → _Instalar app_.                         |
| iPhone / iPad (Safari)       | Abre la app → botón _Compartir_ → _Agregar a inicio_.                                  |
| Windows / Mac (Chrome, Edge) | Abre la app → _Ajustes → Instalar_, o el ícono de instalar en la barra de direcciones. |

Instalada, abre como una aplicación, funciona sin conexión y el navegador protege mejor tus datos.
En iPhone, si la usas desde Safari sin instalarla, Safari puede borrar los datos tras varios días sin
uso: instálala y haz respaldos.

Cuando hay una versión nueva, la app lo avisa y tú eliges cuándo actualizar.

## Respaldos y cambio de dispositivo

- _Respaldo → Crear respaldo_: elige una contraseña y guarda el archivo `.json` donde quieras (tu
  nube personal, una memoria, un correo a ti mismo).
- En el otro dispositivo: _Respaldo → Importar respaldo_, elige el archivo y escribe la contraseña.
- **Si olvidas la contraseña, el respaldo no se puede abrir.** Nadie puede recuperarlo.

Detalles del formato y del cifrado: [docs/respaldo.md](docs/respaldo.md).

## Privacidad

- Todo se guarda en el almacenamiento del navegador (IndexedDB) de tu dispositivo.
- La app no hace peticiones a ningún servidor de terceros: sin analíticas, sin publicidad, sin
  fuentes ni scripts externos. Una política de seguridad (CSP) estricta lo impide, y las pruebas
  automáticas lo verifican.
- GitHub Pages sólo entrega los archivos de la app; nunca recibe tus datos.

## Desarrollo

Requiere Node 22.12 o superior. El stack: React 19 + TypeScript + Vite, Dexie (IndexedDB), Recharts,
zod, vite-plugin-pwa, Vitest y Playwright.

```sh
npm install
npm run dev            # http://localhost:5173/InvestFollowCalc/
npm test               # pruebas unitarias e integración (Vitest)
npm run test:coverage  # con cobertura (mínimo 95% en src/domain)
npm run test:e2e       # Playwright sobre el build: escritorio, Pixel 7 e iPhone 14
npm run lint           # ESLint
npm run typecheck      # TypeScript
npm run build          # build de producción en dist/
npm run icons          # regenera los íconos PWA
```

Para los e2e hay que instalar los navegadores una vez: `npx playwright install chromium webkit`.

| Carpeta                          | Contenido                                          |
| -------------------------------- | -------------------------------------------------- |
| [src/domain](src/domain)         | Cálculos puros (ganancia, TWR, portafolio, series) |
| [src/db](src/db)                 | Base de datos local (Dexie) y repositorio          |
| [src/backup](src/backup)         | Cifrado, exportación e importación de respaldos    |
| [src/features](src/features)     | Pantallas                                          |
| [src/components](src/components) | UI y gráficas                                      |
| [src/i18n](src/i18n)             | Todos los textos de la interfaz (es-MX)            |
| [e2e](e2e)                       | Pruebas end-to-end                                 |
| [docs](docs)                     | Plan, cálculos, respaldos y proceso de release     |

Reglas del proyecto (para personas y para Claude): [CLAUDE.md](CLAUDE.md). Publicar una versión:
[docs/release.md](docs/release.md). Cambios: [CHANGELOG.md](CHANGELOG.md).

## Licencia

[MIT](LICENSE)
