# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con
[SemVer](https://semver.org/lang/es/).

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
