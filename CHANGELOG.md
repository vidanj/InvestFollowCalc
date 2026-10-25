# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con
[SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Presupuesto mensual

- Nueva sección **Presupuesto**: ingresos y gastos por mes, de un solo mes o que se repiten cada mes
  (con mes final opcional); editar o dejar de repetir "desde este mes" conserva los meses anteriores.
- Por mes y por moneda: ingresos, gastos, cuánto te queda y qué parte de tus ingresos se va en gastos.
- Gráficas: gastos por categoría, ingresos contra gastos y lo que te queda en los últimos 12 meses
  (los meses futuros son proyección), cada una con su vista de tabla.

### Créditos

- Créditos con tasa anual fija, IVA opcional sobre los intereses y pagos mensuales, quincenales,
  catorcenales o semanales; se da el número de pagos o el pago fijo.
- Tabla de amortización (pago fijo, capital, intereses, IVA, pago total, saldo), fecha en que se
  termina de pagar, total a pagar, intereses + IVA, costo total con comisiones, pagado y pendiente.
- "Actualizar saldo" recalcula desde el próximo pago y muestra la diferencia con el plan.
- Sus pagos entran solos como gastos del mes en el presupuesto.

### Repeticiones, cargos fijos, año e inversión

- Los conceptos se repiten cada semana (cargos reales del mes), cada mes o cada año (completo en su
  mes), además de los de una sola vez.
- Recordatorio de **cargos fijos**: cuánto tener disponible en la cuenta para los cargos automáticos
  del mes.
- **"No lo pago este mes"**: un gasto mensual o semanal (por ejemplo, una suscripción) se puede
  omitir un mes; ese mes no cuenta y al siguiente vuelve solo.
- **Tu año**: ingresos, gastos y lo que quedará al cierre, registrado y proyectado.
- **Inversión sugerida** (porcentaje de los ingresos, sin pasar de lo que queda) con proyección a
  1, 3, 5 y 10 años usando el rendimiento real del portafolio, de una cuenta o una tasa escrita.

### Datos

- Esquema v3 (presupuesto, créditos, repeticiones); los respaldos de las versiones 1 y 2 se siguen
  importando.
- El recordatorio de respaldo y "Borrar todos los datos" consideran también el presupuesto.
- Los ajustes de la inversión sugerida viajan en los respaldos.

## [1.0.0] — 2026-10-16

Primera versión.

### Cuentas y movimientos

- Cuentas en USD o MXN con saldo inicial; crear, editar, archivar y eliminar.
- Movimientos: actualizar saldo, aportación y retiro (con saldo resultante opcional); editar y borrar.
- Vista previa antes de guardar: "Generaste $1.00 en 11 días (1.6 semanas)".
- Datos sólo en el dispositivo (IndexedDB), validados en cada escritura.

### Cálculos

- Ganancia por periodo y total, separando siempre aportaciones y retiros.
- % simple sobre capital aportado, % por periodo (Modified Dietz), TWR y TWR anualizado.
- Promedios diario/mensual, mejor y peor periodo (por porcentaje).
- Portafolio por moneda; las cuentas archivadas no cuentan en los totales.

### Visualización

- Portafolio con indicadores y gráfica de saldo contra capital aportado por moneda.
- Detalle de cuenta con 4 gráficas, filtro de rango (1M/3M/6M/1A/Todo), desglose por periodo,
  tooltips y vista de tabla de cada gráfica.
- Paleta validada para daltonismo; tema Sistema/Claro/Oscuro.

### Respaldos

- Respaldo cifrado (PBKDF2-SHA256 600k + AES-256-GCM) con contraseña.
- Importación con vista previa, validación completa y reemplazo todo-o-nada.
- Recordatorio de respaldo y "Borrar todos los datos" con confirmación escrita.

### PWA

- Instalable (manifest es-MX, íconos), funciona sin conexión, aviso de nueva versión.
- CSP estricta: sin scripts ni estilos en línea, sin `eval`, sin orígenes externos.
