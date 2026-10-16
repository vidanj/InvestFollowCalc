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
