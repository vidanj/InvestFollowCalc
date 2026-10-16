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
   muestra qué contiene (cuentas, movimientos y fecha). Sólo después de confirmar dos veces se
   **reemplazan todos los datos** del dispositivo. Si algo falla, no se modifica nada.
3. **Recordatorio:** el portafolio avisa si nunca has respaldado, o si cambiaste datos y tu último
   respaldo tiene más de 30 días.

> Si olvidas la contraseña, **el respaldo no se puede recuperar**. Nadie (ni la app) puede abrirlo.

## Qué incluye

- Todas las cuentas (también las archivadas) y todos sus movimientos.
- No incluye preferencias del dispositivo, como el tema claro/oscuro.

## Seguridad

- La contraseña nunca se guarda ni sale del dispositivo.
- La llave se deriva con **PBKDF2-SHA256, 600,000 iteraciones** y una sal aleatoria de 16 bytes.
- Los datos se cifran con **AES-256-GCM** y un IV aleatorio de 12 bytes, nuevos en cada respaldo.
- GCM autentica el contenido: una contraseña equivocada y un archivo alterado fallan igual
  ("Contraseña incorrecta o archivo dañado").
- Al importar se valida todo el contenido (tipos, ids únicos, que cada movimiento pertenezca a una
  cuenta y que cada historial sea calculable) antes de tocar los datos actuales. Campos desconocidos
  se descartan.

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
  "schemaVersion": 1,
  "appVersion": "0.1.0",
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
  "settings": {}
}
```

Los montos están en **centavos**.

## Versiones

- `formatVersion` cambia si cambian los parámetros de cifrado o la forma del sobre.
- `schemaVersion` sigue al esquema de la base de datos. Los respaldos de versiones anteriores se
  migran al importarlos (`MIGRATIONS` en [backup.ts](../src/backup/backup.ts)); los de una versión
  **más nueva** que la app se rechazan con un mensaje pidiendo actualizarla.
