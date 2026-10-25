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

- Cada concepto dice **cada cuándo** se repite, desde su mes inicial y opcionalmente hasta un mes
  final:

  | Repetición       | Cuánto cuenta en cada mes                                                                |
  | ---------------- | ---------------------------------------------------------------------------------------- |
  | **Solo una vez** | el monto, sólo en su mes (un café, un regalo)                                            |
  | **Cada semana**  | monto × las veces que cae en el mes, cada 7 días desde la fecha del primer cargo (4 o 5) |
  | **Cada mes**     | el monto, todos los meses (sueldo, renta, suscripciones)                                 |
  | **Cada año**     | el monto completo, sólo en su mes, cada 12 meses (una suscripción anual)                 |

  Ejemplo semanal: gasolina de 500 cada viernes desde el 2 de octubre de 2026 → octubre cuenta 5
  cargos (2, 9, 16, 23 y 30): 2,500; noviembre 4 cargos: 2,000.

- Un gasto **mensual o semanal** se puede marcar como **"No lo pago este mes"** (por ejemplo, una
  suscripción que pausas un mes): ese mes cuenta 0 (en los semanales, ninguno de sus cargos del mes)
  y al mes siguiente vuelve a contar solo. Sigue apareciendo en la lista para poder desmarcarlo. No
  aplica a gastos anuales, de una sola vez ni a ingresos.
- Cambiar un concepto que se repite "desde este mes" no toca los meses anteriores: el concepto
  original termina el mes anterior y la versión nueva empieza en el mes que se está viendo (uno
  semanal conserva su día de la semana). Lo mismo al "dejar de repetir desde este mes".
- Categorías de gasto: vivienda, servicios, comida y súper, transporte, suscripciones, salud,
  entretenimiento, gastos hormiga, créditos y deudas, otros.

## Resumen de un mes

Por cada moneda (USD y MXN nunca se suman entre sí):

| Dato                  | Fórmula                                                                               |
| --------------------- | ------------------------------------------------------------------------------------- |
| **Ingresos**          | suma de los ingresos que cuentan ese mes                                              |
| **Gastos**            | suma de los gastos que cuentan ese mes + pagos de créditos de ese mes                 |
| **Te queda**          | ingresos − gastos (negativo: gastaste más de lo que ganaste)                          |
| **% de tus ingresos** | gastos / ingresos ("—" sin ingresos)                                                  |
| **Por categoría**     | gastos agrupados por categoría; los pagos de créditos van en "créditos"               |
| **Pagos a créditos**  | lo que se paga ese mes a todos los créditos, con IVA                                  |
| **Cargos fijos**      | gastos que se repiten (semanales, mensuales y anuales de ese mes) + pagos de créditos |

**Cargos fijos** es el recordatorio de cuánto dinero tener disponible en la cuenta para los cargos
automáticos del mes; no incluye los gastos de una sola vez ni los que marcaste como no pagados ese
mes. Un gasto omitido tampoco cuenta en los gastos, en lo que te queda ni en "Tu año".

Las pruebas verifican con cientos de presupuestos aleatorios que **te queda = ingresos − gastos**,
que **la suma de las categorías = gastos**, que **cargos fijos = gastos − gastos de una sola vez** y
que un concepto semanal cae **52 o 53 veces** en cualquier periodo de 12 meses.

## Tu año

Para el año del mes que se está viendo (enero a diciembre), por moneda:

```
ingresos del año = suma de los ingresos de sus 12 meses
gastos del año   = suma de los gastos de sus 12 meses (créditos incluidos)
te quedará       = ingresos del año − gastos del año
```

Se separa en lo **registrado** (enero hasta el mes actual) y la **proyección** de los meses que
faltan, que sólo cuenta lo que se repite y los pagos programados de los créditos. Las pruebas
verifican que registrado + proyección = el año.

La gráfica de evolución muestra hasta 12 meses, terminando en el mes que se está viendo. Los meses
futuros son una **proyección**: sólo incluyen los conceptos que se repiten y los pagos programados de
los créditos.

## Inversión sugerida

El código está en [src/domain/investPlan.ts](../src/domain/investPlan.ts).

```
meta     = ingresos del mes × porcentaje (20% por omisión), redondeado al centavo
sugerido = el menor entre la meta y lo que te queda; nunca menos de 0
```

Si los gastos dejan menos que la meta, se sugiere sólo lo que queda (y se avisa). Sin ingresos o sin
dinero que quede, no hay sugerencia.

### Cuánto generaría

Se proyecta invertir el monto sugerido **cada mes**, con el rendimiento anual que el usuario elige:

- **Su portafolio** en esa moneda (por omisión): el **TWR anualizado** que calcula el Portafolio
  con todas las cuentas activas de esa moneda (ver "Resumen de la cuenta" arriba).
- **Una de sus cuentas**: el TWR anualizado de esa cuenta.
- **Una tasa que escribe** (por ejemplo, la de CETES), cuando no hay historial o prefiere otra.

Si el rendimiento se midió en menos de 30 días se avisa que proyectarlo a años puede exagerar mucho.

```
tasa mensual   = (1 + tasa anual)^(1/12) − 1          (el mismo interés compuesto del TWR anualizado)
valor del mes  = redondear(valor anterior × (1 + tasa mensual)) + aportación
aportado       = aportación × meses
generaría      = valor − aportado                     (como la "ganancia" del portafolio)
```

Las aportaciones se hacen **al final de cada mes**. Se muestran 1, 3, 5 y 10 años. Ejemplo: 2,000 al
mes a 10% anual → en 1 año se aportan 24,000 y valdría 25,081.07; en 10 años, 240,000 y 399,727.74.
Las pruebas comparan el resultado con la fórmula cerrada de una anualidad
`aportación × ((1 + r)^n − 1) / r`: la diferencia sólo viene del redondeo mensual al centavo.

Es una estimación: supone que el rendimiento se mantiene; rendimientos pasados no garantizan los
futuros.

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
