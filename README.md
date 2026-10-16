# InvestFollowCalc

Aplicación web progresiva (PWA) para saber **cuánto han generado tus inversiones**, separando la
ganancia de lo que tú aportas o retiras. Registras el saldo de cada cuenta de vez en cuando y la app
calcula la ganancia en dinero, el porcentaje y el tiempo en que se generó, con gráficas y desglose.

- Varias cuentas, en USD o MXN (los totales se muestran por moneda).
- Tus datos se guardan **solo en tu dispositivo**. No hay nube ni servidor.
- Respaldos cifrados con contraseña para pasar tus datos a otro teléfono o PC.

> Estado: en desarrollo (fase 5: PWA instalable y sin conexión). Ver [docs/plan.md](docs/plan.md),
> [docs/calculos.md](docs/calculos.md) y [docs/respaldo.md](docs/respaldo.md).

## Desarrollo

Requiere Node 22.12 o superior.

```sh
npm install
npm run dev          # servidor local en http://localhost:5173/InvestFollowCalc/
npm test             # pruebas unitarias
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run build        # build de producción en dist/
```

## Licencia

MIT
