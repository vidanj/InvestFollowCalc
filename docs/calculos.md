# Cómo calcula InvestFollowCalc

Este documento explica, en lenguaje llano, cada número que muestra la app. El código está en
[src/domain/engine.ts](../src/domain/engine.ts) y [src/domain/portfolio.ts](../src/domain/portfolio.ts).
Cualquier cambio a una fórmula debe reflejarse aquí y tener una prueba.

## Lo que registra el usuario

Por cada cuenta hay una lista de movimientos, cada uno con fecha:

| Movimiento           | Qué significa                                   | Datos                                   |
| -------------------- | ----------------------------------------------- | --------------------------------------- |
| **Saldo inicial**    | Lo que había en la cuenta al empezar a seguirla | saldo                                   |
| **Actualizar saldo** | Lo que la cuenta marca hoy                      | saldo                                   |
| **Aportación**       | Dinero que el usuario agrega                    | monto, y opcionalmente el saldo después |
| **Retiro**           | Dinero que el usuario saca                      | monto, y opcionalmente el saldo después |

- Los montos se guardan en **centavos enteros**; nunca hay errores de redondeo en las sumas.
- Si hay varios movimientos el mismo día, cuentan en el orden en que se capturaron.
- Ningún movimiento puede tener fecha anterior al saldo inicial.

## Periodos

Un **periodo** es el tramo entre dos saldos conocidos consecutivos. Para cada uno:

```
ganancia del periodo = saldo final − saldo inicial − (aportaciones − retiros del periodo)
```

Así una aportación **nunca** cuenta como ganancia y un retiro **nunca** cuenta como pérdida.

**Si el usuario da el saldo después de una aportación o retiro**, ese momento cierra un periodo:
la ganancia hasta justo antes del movimiento queda en el periodo anterior, y el siguiente periodo
empieza desde el saldo nuevo. Es lo más preciso.

**Si no lo da**, el movimiento queda "pendiente" y se toma en cuenta en la siguiente actualización de
saldo. La ganancia sale igual de correcta; sólo se reparte en un periodo más largo.

Los tramos del mismo día en los que no se generó nada (por ejemplo, saldo inicial y una aportación
el mismo día) no se muestran como periodo.

### Ejemplo

| Fecha      | Movimiento                           | Ganancia del periodo        | Acumulado |
| ---------- | ------------------------------------ | --------------------------- | --------- |
| 2026-10-01 | Saldo inicial 10,000                 | —                           | 0         |
| 2026-10-12 | Saldo 10,001                         | **+1** en 11 días (0.01%)   | 1         |
| 2026-10-15 | Aportación 500, saldo después 10,501 | 0 en 3 días                 | 1         |
| 2026-11-02 | Saldo 10,550                         | **+49** en 18 días (0.467%) | **50**    |

Capital aportado: 10,500. Ganancia total: 50.

## Porcentaje de cada periodo (Modified Dietz)

```
% del periodo = ganancia / (saldo inicial + Σ peso × aportación)
peso = días que el dinero estuvo invertido dentro del periodo / días del periodo
```

Una aportación al inicio del periodo pesa 1 (estuvo todo el tiempo); una al final pesa 0. Un retiro
entra con signo negativo. En periodos de un solo día (0 días de diferencia) el peso es 0.5.

Si la base de ese cálculo es cero o negativa (por ejemplo, una cuenta en 0 que de pronto marca
saldo), el porcentaje del periodo no se puede calcular y se muestra "—". Si la ganancia es 0, el
porcentaje es 0%.

## Resumen de la cuenta

| Dato                      | Fórmula                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| **Capital aportado neto** | saldo inicial + aportaciones − retiros                                                    |
| **Saldo actual**          | último saldo conocido + aportaciones/retiros registrados después de él                    |
| **Ganancia total**        | suma de las ganancias de los periodos = saldo actual − capital aportado                   |
| **% simple** (principal)  | ganancia total / capital aportado neto                                                    |
| **TWR**                   | (1 + %₁) × (1 + %₂) × … − 1, encadenando los periodos                                     |
| **TWR anualizado**        | (1 + TWR) ^ (365 / días transcurridos) − 1                                                |
| **Días transcurridos**    | del saldo inicial al último saldo conocido                                                |
| **Ganancia promedio**     | ganancia total / días transcurridos (por día) y × 365/12 (por mes), redondeada al centavo |

Notas:

- La igualdad **ganancia total = saldo actual − capital aportado** se cumple siempre; las pruebas
  la verifican con cientos de historiales aleatorios.
- Si hay movimientos después del último saldo conocido, el saldo actual se marca como **estimado**:
  hace falta actualizar el saldo para saber cuánto se generó desde entonces.
- **% simple** responde "¿cuánto he ganado sobre lo que he puesto?". Es fácil de leer, pero se
  distorsiona cuando hay aportaciones a mitad del camino.
- **TWR** (rendimiento ponderado por tiempo) mide qué tan bien rindió la cuenta sin importar cuándo
  ni cuánto se aportó; sirve para comparar cuentas y periodos.
- Con menos de 30 días de historial, el anualizado se marca como **estimado (periodo corto)**,
  porque extrapolar pocos días a un año exagera mucho.
- Sin ningún periodo medido todavía, los porcentajes se muestran como "—". Si la cuenta llegó a
  0, el anualizado no se calcula.

## Portafolio (varias cuentas)

Los totales se calculan **por moneda**: USD y MXN nunca se suman entre sí.

Para cada moneda, las cuentas se combinan en una sola línea de tiempo:

- El portafolio empieza con la suma de los saldos iniciales de las cuentas que empiezan primero.
- Una cuenta que empieza después entra como **aportación** de su saldo inicial (no es ganancia).
- En cada fecha en que alguna cuenta actualiza su saldo, el valor del portafolio es la suma del
  último saldo conocido de cada cuenta (más sus movimientos registrados desde entonces).

Con esto, la ganancia del portafolio es exactamente la suma de las ganancias de sus cuentas. La
ganancia de una cuenta aparece en el portafolio en la fecha en que esa cuenta se actualiza.

---

# Presupuesto mensual

El código está en [src/domain/budget.ts](../src/domain/budget.ts).

## Lo que registra el usuario

| Concepto    | Datos                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| **Ingreso** | concepto, monto, moneda, mes                                            |
| **Gasto**   | concepto, monto, moneda, mes y **categoría** (lista fija, ver abajo)    |
| **Crédito** | sus pagos entran solos como gastos del mes en que caen (ver "Créditos") |

- Un concepto puede ser **de un solo mes** (un café, un regalo) o **repetirse cada mes** desde su
  mes inicial (sueldo, renta, suscripciones), opcionalmente hasta un mes final.
- Cambiar un concepto que se repite "desde este mes" no toca los meses anteriores: el concepto
  original termina el mes anterior y la versión nueva empieza en el mes que se está viendo. Lo mismo
  al "dejar de repetir desde este mes".
- Categorías de gasto: vivienda, servicios, comida y súper, transporte, suscripciones, salud,
  entretenimiento, gastos hormiga, créditos y deudas, otros.

## Resumen de un mes

Por cada moneda (USD y MXN nunca se suman entre sí):

| Dato                  | Fórmula                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| **Ingresos**          | suma de los ingresos que cuentan ese mes                                |
| **Gastos**            | suma de los gastos que cuentan ese mes + pagos de créditos de ese mes   |
| **Te queda**          | ingresos − gastos (negativo: gastaste más de lo que ganaste)            |
| **% de tus ingresos** | gastos / ingresos ("—" sin ingresos)                                    |
| **Por categoría**     | gastos agrupados por categoría; los pagos de créditos van en "créditos" |
| **Pagos a créditos**  | lo que se paga ese mes a todos los créditos, con IVA                    |

Las pruebas verifican con cientos de presupuestos aleatorios que **te queda = ingresos − gastos** y
que **la suma de las categorías = gastos**.

La gráfica de evolución muestra hasta 12 meses, terminando en el mes que se está viendo. Los meses
futuros son una **proyección**: sólo incluyen los conceptos que se repiten y los pagos programados de
los créditos.

# Créditos

El código está en [src/domain/credit.ts](../src/domain/credit.ts).

## Lo que registra el usuario

- **Monto del crédito:** lo que se debe antes del primer pago. Si el crédito ya lleva tiempo, puede
  registrarse lo que se debe hoy y la fecha del próximo pago.
- **Tasa de interés anual** fija (ordinaria), y si se cobra **IVA (16%) sobre los intereses**.
- **Periodicidad:** mensual, quincenal (2 pagos al mes, 15 días aparte: por ejemplo los días 2 y
  17), catorcenal (cada 14 días) o semanal.
- **Fecha del primer pago.**
- **Número de pagos** _o_ **pago fijo**: con uno se calcula el otro.
- Opcional: **comisiones y seguros** cobrados al entregar el dinero.

## Cómo se calcula cada pago

Es una amortización de pago fijo (sistema francés), como la tabla que entrega el banco:

```
días del periodo  = 365 / pagos por año, a 4 decimales (quincenal: 15.2083; mensual: 30.4167)
interés           = saldo × tasa anual / 360 × días del periodo, redondeado al centavo
IVA               = 16% del interés, redondeado al centavo (sólo si el crédito cobra IVA)
amortización      = pago fijo − interés
saldo nuevo       = saldo − amortización
pago total        = pago fijo + IVA
```

- El **pago fijo** cubre capital + intereses; el **IVA se suma aparte**, así que el pago total
  baja un poco en cada pago (porque el interés baja).
- El **último pago** sólo cubre lo que queda (saldo + interés), para que el saldo termine en
  exactamente 0.
- Si se da el **número de pagos**, el pago fijo sale de la fórmula de anualidad
  `P = saldo × r / (1 − (1 + r)^−n)`, con `r` la tasa del periodo, redondeado al centavo (si el
  redondeo dejara un pago extra de centavos, se sube un centavo).
- El pago fijo debe ser **mayor que el interés del primer periodo**; si no, la deuda nunca bajaría
  y la app lo rechaza indicando el mínimo. Tampoco acepta planes de más de 1,200 pagos.

Ejemplo: 100,000.00 a 27.5% anual, quincenal, 120 pagos, con IVA → pago fijo **1,549.12**; primer
interés 1,161.75 + IVA 185.88 = primer pago **1,735.00**; último pago el 17 oct 2031 si el primero
es el 2 nov 2026. Total a pagar: 199,636.08.

Esta regla se comparó con la tabla de amortización de un crédito bancario real (quincenal, 27.5%,
120 pagos, IVA aparte): el pago fijo y el primer pago coinciden al centavo y cada renglón queda a lo
más a un centavo de la tabla del banco (el banco guarda más decimales internamente). En su último
renglón el banco no ajusta y deja un saldo de −0.79; la app ajusta ese último pago para terminar en
exactamente 0.

## Resumen del crédito

| Dato                        | Fórmula                                                                     |
| --------------------------- | --------------------------------------------------------------------------- |
| **Total a pagar**           | suma de todos los pagos totales (capital + intereses + IVA)                 |
| **Intereses + IVA**         | suma de intereses + suma de IVA                                             |
| **Recibiste**               | monto del crédito − comisiones y seguros cobrados al inicio                 |
| **Costo total del crédito** | intereses + IVA + comisiones y seguros                                      |
| **Pagado hasta hoy**        | pagos con fecha de hoy o anterior (se asume que cada pago se hace a tiempo) |
| **Te falta pagar**          | total a pagar − pagado hasta hoy                                            |
| **Saldo pendiente**         | capital que se debe antes del próximo pago (0 si ya se liquidó)             |
| **Lo terminas de pagar**    | fecha del último pago                                                       |

## Actualizar el saldo

Si el usuario hizo un pago extra, le cobraron algo más o el banco muestra otro saldo, registra
**cuánto debe y la fecha de su próximo pago** (y, si cambió, el pago fijo). Desde ese pago el plan
se recalcula con el saldo nuevo; los pagos anteriores no cambian. La app muestra la diferencia con
lo que el plan esperaba (positiva: se debe menos de lo planeado).

Las pruebas verifican con cientos de créditos aleatorios que:

- cada pago = capital + interés + IVA, y el saldo nunca es negativo y termina en 0;
- **capital pagado = monto inicial − diferencias de las actualizaciones de saldo**;
- **total a pagar = capital pagado + intereses + IVA = pagado hasta hoy + te falta pagar**.

## En el presupuesto

Cada pago de un crédito cuenta como gasto (pago total, con IVA) del mes de su fecha, en la
categoría "créditos y deudas". Un crédito quincenal normalmente aparece con dos pagos en el mes.
