# Respaldos

InvestFollowCalc guarda tus datos **solo en el dispositivo**. Un respaldo es la única forma de
llevarlos a otro teléfono o computadora, o de recuperarlos si borras el navegador. El código está en
[src/backup/](../src/backup/).

## Cómo se usa

1. **Crear:** _Respaldo → Crear respaldo_. Escribes una contraseña (mínimo 8 caracteres) dos veces y la
   app genera el archivo `investfollowcalc-respaldo-AAAA-MM-DD.json`:
   - en computadoras con Chrome/Edge se abre el diálogo "Guardar como";
   - en teléfonos se abre el menú de compartir (Archivos, tu nube personal, correo a ti mismo…);
   - en otros navegadores se descarga.
2. **Importar:** _Respaldo → Importar respaldo_. Eliges el archivo, escribes su contraseña y la app
   muestra qué contiene (cuentas, movimientos, presupuesto, créditos y fecha). Sólo después de
   confirmar dos veces se **reemplazan todos los datos** del dispositivo. Si algo falla, no se
   modifica nada.
3. **Recordatorio:** el portafolio y el presupuesto avisan si nunca has respaldado, o si cambiaste
   datos y tu último respaldo tiene más de 30 días.

> Si olvidas la contraseña, **el respaldo no se puede recuperar**. Nadie (ni la app) puede abrirlo.

## Qué incluye

- Todas las cuentas (también las archivadas) y todos sus movimientos.
- El presupuesto: todos los ingresos y gastos, de todos los meses.
- Los créditos, con sus actualizaciones de saldo.
- Tus ajustes de la inversión sugerida (porcentaje y rendimiento elegido).
- No incluye preferencias del dispositivo, como el tema claro/oscuro.

## Seguridad

- La contraseña nunca se guarda ni sale del dispositivo.
- La llave se deriva con **PBKDF2-SHA256, 600,000 iteraciones** y una sal aleatoria de 16 bytes.
- Los datos se cifran con **AES-256-GCM** y un IV aleatorio de 12 bytes, nuevos en cada respaldo.
- GCM autentica el contenido: una contraseña equivocada y un archivo alterado fallan igual
  ("Contraseña incorrecta o archivo dañado").
- Al importar se valida todo el contenido (tipos, ids únicos, que cada movimiento pertenezca a una
  cuenta, que cada historial sea calculable y que cada concepto del presupuesto y cada crédito
  cumplan las mismas reglas que al capturarlos) antes de tocar los datos actuales. Campos
  desconocidos se descartan.

## Formato del archivo

Es JSON. Sólo los metadatos de cifrado son legibles; los datos van cifrados en `data`:

```json
{
  "format": "investfollowcalc-backup",
  "formatVersion": 1,
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "salt": "<base64>" },
  "cipher": { "name": "AES-GCM", "iv": "<base64>" },
  "data": "<base64: texto cifrado + etiqueta GCM>"
}
```

Al descifrar, `data` contiene:

```json
{
  "schemaVersion": 3,
  "appVersion": "1.1.0",
  "exportedAt": "2026-10-16T12:00:00.000Z",
  "accounts": [
    {
      "id": "…",
      "name": "…",
      "currency": "MXN",
      "color": "#2a78d6",
      "archived": false,
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "events": [
    {
      "id": "…",
      "accountId": "…",
      "date": "2026-10-01",
      "seq": 1,
      "type": "balance",
      "balance": 1000000,
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "budgetItems": [
    {
      "id": "…",
      "kind": "expense",
      "name": "Renta",
      "amount": 800000,
      "currency": "MXN",
      "category": "housing",
      "month": "2026-10",
      "repeat": "monthly",
      "endMonth": "2027-09",
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "credits": [
    {
      "id": "…",
      "name": "Préstamo",
      "currency": "MXN",
      "annualRateBps": 2750,
      "ivaOnInterest": true,
      "frequency": "semimonthly",
      "upfrontFees": 0,
      "plans": [{ "firstPaymentDate": "2026-11-02", "balance": 10000000, "payment": 154912 }],
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "settings": {
    "investPlan": { "percent": 20, "sources": { "MXN": { "kind": "portfolio" } } }
  }
}
```

Los montos están en **centavos**; la tasa, en puntos base (27.5% = 2750). Los ingresos no llevan
`category`. `repeat` es `none`, `weekly`, `monthly` o `yearly`; los semanales llevan además
`firstDate` (fecha del primer cargo); los gastos mensuales o semanales pueden llevar
`skippedMonths` (meses que no se pagaron, ordenados) y `endMonth` sólo aparece en conceptos que se repiten y tienen
mes final. En `settings.investPlan`, `sources` dice por moneda qué rendimiento se usa:
`portfolio`, `account` (con `accountId`) o `manual` (con `rateBps`); `settings` puede venir vacío. En `plans`, el
primero es el crédito como se registró y los siguientes son las actualizaciones de saldo.

## Versiones

- `formatVersion` cambia si cambian los parámetros de cifrado o la forma del sobre.
- `schemaVersion` sigue al esquema de la base de datos. Los respaldos de versiones anteriores se
  migran al importarlos (`MIGRATIONS` en [backup.ts](../src/backup/backup.ts)); los de una versión
  **más nueva** que la app se rechazan con un mensaje pidiendo actualizarla.

| `schemaVersion` | Contenido                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------- |
| 1               | Cuentas y movimientos (v1.0.0).                                                                     |
| 2               | Agrega `budgetItems` y `credits`. Un respaldo v1 se importa con ambos vacíos.                       |
| 3               | `recurring` (sí/no) pasa a `repeat` (`monthly`/`none`); agrega `firstDate` y `settings.investPlan`. |
