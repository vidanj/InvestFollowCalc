import type { BackupErrorCode } from '../backup/backup';
import type { RepositoryErrorCode } from '../db/repository';
import type { BudgetIssueCode, ExpenseCategory } from '../domain/budget';
import type { CreditIssueCode, PaymentFrequency } from '../domain/credit';
import type { YearMonth } from '../domain/months';
import type { RangeKey } from '../domain/series';
import type { Currency, IsoDate } from '../domain/types';
import { DAYS_PER_MONTH } from '../domain/types';
import type { ValidationIssueCode } from '../domain/validation';
import type { ThemePreference } from '../theme/theme';

// All user-facing text lives here. Components must not hardcode UI strings.

const LOCALE = 'es-MX';
const oneDecimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const dayMonth = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** "1 oct" (for chart axes). */
export function formatShortDate(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return dayMonth.format(new Date(Date.UTC(y, m - 1, d)));
}

const monthYear = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortMonthYear = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});
const monthName = new Intl.DateTimeFormat(LOCALE, { month: 'long', timeZone: 'UTC' });
const wholePercent = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0 });

function monthToDate(month: YearMonth): Date {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1));
}

/** "octubre de 2026". */
export function formatMonth(month: YearMonth): string {
  return monthYear.format(monthToDate(month));
}

/** "oct 26" (for chart axes). */
export function formatShortMonth(month: YearMonth): string {
  return shortMonthYear.format(monthToDate(month));
}

/** Month names for pickers: index 0 = "enero". */
export const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  monthName.format(new Date(Date.UTC(2026, i, 1))),
);

/** A ratio as a whole percentage: 0.725 → "73%". */
export function formatWholePercent(ratio: number): string {
  return wholePercent.format(ratio);
}

/** "1 oct 2026". */
export function formatDate(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return shortDate.format(new Date(Date.UTC(y, m - 1, d)));
}

/** "el mismo día", "1 día", "5 días", "11 días (1.6 semanas)", "90 días (3 meses)". */
export function formatDuration(days: number): string {
  if (days === 0) return 'el mismo día';
  if (days === 1) return '1 día';
  if (days < 7) return `${days} días`;
  if (days < 60) {
    const weeks = days / 7;
    return `${days} días (${oneDecimal.format(weeks)} ${weeks === 1 ? 'semana' : 'semanas'})`;
  }
  const months = days / DAYS_PER_MONTH;
  return `${days} días (${oneDecimal.format(months)} ${months === 1 ? 'mes' : 'meses'})`;
}

/** "1 cuenta", "3 cuentas". */
export function countOf(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const backupErrors: Record<BackupErrorCode, string> = {
  NOT_A_BACKUP: 'Este archivo no es un respaldo de InvestFollowCalc.',
  UNSUPPORTED_VERSION:
    'Este respaldo es de una versión más reciente de la app. Actualiza la app para importarlo.',
  WRONG_PASSWORD_OR_CORRUPT: 'Contraseña incorrecta o archivo dañado.',
  INVALID_CONTENT: 'El respaldo está dañado o incompleto. No se modificó nada.',
};

const issueMessages: Record<ValidationIssueCode, string> = {
  FIRST_EVENT_NOT_BALANCE: 'El primer movimiento de una cuenta debe ser su saldo inicial.',
  BEFORE_INITIAL_BALANCE: 'La fecha no puede ser anterior al saldo inicial de la cuenta.',
  INITIAL_MUST_BE_FIRST: 'El saldo inicial debe ser el movimiento más antiguo de la cuenta.',
  INITIAL_MUST_BE_BALANCE: 'El saldo inicial no puede convertirse en aportación o retiro.',
  INVALID_DATE: 'La fecha no es válida.',
  INVALID_SEQ: 'No se pudo ordenar el movimiento. Intenta de nuevo.',
  INVALID_BALANCE: 'El saldo debe ser un monto válido, de 0 o más.',
  INVALID_AMOUNT: 'El monto debe ser mayor a 0.',
  BALANCE_AFTER_TOO_LOW: 'El saldo después de una aportación no puede ser menor que la aportación.',
};

const repositoryMessages: Record<RepositoryErrorCode, string> = {
  ACCOUNT_NOT_FOUND: 'La cuenta ya no existe.',
  EVENT_NOT_FOUND: 'El movimiento ya no existe.',
  INVALID_ACCOUNT: 'Revisa los datos de la cuenta.',
  INVALID_EVENT: 'Revisa los datos del movimiento.',
  CANNOT_DELETE_INITIAL:
    'El saldo inicial no se puede eliminar. Si ya no quieres la cuenta, elimínala completa.',
  BUDGET_ITEM_NOT_FOUND: 'Este concepto ya no existe.',
  INVALID_BUDGET_ITEM: 'Revisa los datos del concepto.',
  CREDIT_NOT_FOUND: 'Este crédito ya no existe.',
  INVALID_CREDIT: 'Revisa los datos del crédito.',
  CANNOT_DELETE_FIRST_PLAN:
    'El saldo con el que registraste el crédito no se puede quitar; edita el crédito o elimínalo.',
};

const budgetIssueMessages: Record<BudgetIssueCode, string> = {
  INVALID_NAME: 'Escribe un concepto de 1 a 60 caracteres.',
  INVALID_AMOUNT: 'El monto debe ser mayor a 0.',
  INVALID_CURRENCY: 'Elige una moneda.',
  INVALID_MONTH: 'Elige un mes válido.',
  INVALID_CATEGORY: 'Elige una categoría.',
  END_BEFORE_START: 'El mes final no puede ser anterior al mes inicial.',
  END_WITHOUT_RECURRING: 'Solo un concepto que se repite puede tener mes final.',
};

const creditIssueMessages: Record<CreditIssueCode, string> = {
  INVALID_NAME: 'Escribe un nombre de 1 a 60 caracteres.',
  INVALID_CURRENCY: 'Elige una moneda.',
  INVALID_RATE: 'La tasa debe estar entre 0% y 999.99%.',
  INVALID_FREQUENCY: 'Elige cada cuándo pagas.',
  INVALID_FEES: 'Las comisiones no pueden ser negativas ni mayores al monto del crédito.',
  NO_PLANS: 'Falta el saldo del crédito.',
  INVALID_DATE: 'Escribe una fecha válida.',
  PLANS_OUT_OF_ORDER: 'Ya hay un cambio de saldo en esa fecha o después; elige otra fecha.',
  INVALID_BALANCE: 'El saldo debe ser un monto válido, de 0 o más.',
  INVALID_PAYMENT: 'El pago debe ser mayor a 0.',
  PAYMENT_TOO_LOW:
    'Con ese pago la deuda nunca bajaría: no alcanza a cubrir los intereses. Aumenta el pago.',
  TOO_MANY_PAYMENTS: 'Con ese pago tardarías más de 1,200 pagos en terminar. Aumenta el pago.',
};

const categoryLabels: Record<ExpenseCategory, string> = {
  housing: 'Vivienda',
  services: 'Servicios (luz, agua, internet)',
  food: 'Comida y súper',
  transport: 'Transporte',
  subscriptions: 'Suscripciones',
  health: 'Salud',
  leisure: 'Entretenimiento',
  small: 'Gastos hormiga',
  credit: 'Créditos y deudas',
  other: 'Otros',
};

/** Short names for chart axes. */
const categoryShortLabels: Record<ExpenseCategory, string> = {
  housing: 'Vivienda',
  services: 'Servicios',
  food: 'Comida',
  transport: 'Transporte',
  subscriptions: 'Suscripciones',
  health: 'Salud',
  leisure: 'Entretenimiento',
  small: 'Hormiga',
  credit: 'Créditos',
  other: 'Otros',
};

const frequencyLabels: Record<PaymentFrequency, string> = {
  monthly: 'Mensual',
  semimonthly: 'Quincenal',
  biweekly: 'Catorcenal',
  weekly: 'Semanal',
};

const perPeriod: Record<PaymentFrequency, string> = {
  monthly: 'al mes',
  semimonthly: 'por quincena',
  biweekly: 'por catorcena',
  weekly: 'por semana',
};

const rangeLabels: Record<RangeKey, string> = {
  '1M': '1 mes',
  '3M': '3 meses',
  '6M': '6 meses',
  '1Y': '1 año',
  ALL: 'Todo',
};

const themeLabels: Record<ThemePreference, string> = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Oscuro',
};

const currencyNames: Record<Currency, string> = {
  USD: 'Dólares (USD)',
  MXN: 'Pesos mexicanos (MXN)',
};

export const strings = {
  app: {
    name: 'InvestFollowCalc',
    tagline: 'Sigue cuánto generan tus inversiones, separado de lo que aportas.',
  },
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    edit: 'Editar',
    delete: 'Eliminar',
    confirmDelete: 'Sí, eliminar',
    back: 'Volver',
    loading: 'Cargando…',
    optional: 'opcional',
  },
  currencyNames,
  nav: {
    label: 'Navegación principal',
    portfolio: 'Portafolio',
    budget: 'Presupuesto',
    backup: 'Respaldo',
    settings: 'Ajustes',
  },
  backup: {
    title: 'Respaldo',
    intro:
      'Tus datos viven solo en este dispositivo. Un respaldo es un archivo cifrado con tu contraseña que puedes guardar donde quieras e importar en otro teléfono o computadora.',
    lastBackup: (date: string) => `Último respaldo en este dispositivo: ${date}.`,
    neverBackedUp: 'Aún no has creado ningún respaldo en este dispositivo.',
    exportTitle: 'Crear respaldo',
    password: 'Contraseña para este respaldo',
    passwordHelp: (min: number) => `Mínimo ${min} caracteres. La necesitarás para importarlo.`,
    confirmPassword: 'Repite la contraseña',
    passwordWarning:
      'Si olvidas la contraseña no hay forma de recuperar el respaldo. Guárdala en un lugar seguro.',
    passwordTooShort: (min: number) => `La contraseña debe tener al menos ${min} caracteres.`,
    passwordMismatch: 'Las contraseñas no coinciden.',
    createButton: 'Crear y guardar respaldo',
    encrypting: 'Cifrando…',
    fileDescription: 'Respaldo de InvestFollowCalc',
    saved: (fileName: string) => `Respaldo guardado: ${fileName}.`,
    shared: (fileName: string) => `Respaldo listo para guardar: ${fileName}.`,
    downloaded: (fileName: string) =>
      `Respaldo descargado: ${fileName}. Muévelo a un lugar seguro (por ejemplo, tu nube personal o una memoria).`,
    cancelled: 'No se guardó el respaldo.',
    importTitle: 'Importar respaldo',
    importIntro: 'Reemplaza los datos de este dispositivo con los de un respaldo.',
    file: 'Archivo de respaldo (.json)',
    fileRequired: 'Elige un archivo de respaldo.',
    importPassword: 'Contraseña del respaldo a importar',
    readButton: 'Leer respaldo',
    reading: 'Descifrando…',
    previewTitle: 'Contenido del respaldo',
    previewSummary: (accounts: number, events: number, date: string) =>
      `${countOf(accounts, 'cuenta', 'cuentas')} y ${countOf(events, 'movimiento', 'movimientos')}, creado el ${date}.`,
    previewBudget: (items: number, credits: number) =>
      `Presupuesto: ${countOf(items, 'concepto', 'conceptos')} y ${countOf(credits, 'crédito', 'créditos')}.`,
    replaceWarning: (hasData: boolean) =>
      hasData
        ? 'Se borrarán todos los datos que hay ahora en este dispositivo (cuentas, presupuesto y créditos) y en su lugar quedarán los del respaldo.'
        : 'Este dispositivo no tiene datos: se cargarán los del respaldo.',
    backupFirstHint: 'Si quieres conservar los datos actuales, crea primero un respaldo de ellos.',
    replaceButton: 'Reemplazar mis datos con este respaldo',
    replaceConfirmWarning: 'Los datos actuales de este dispositivo se perderán. ¿Continuar?',
    imported: (accounts: number) =>
      `Listo: se importaron ${countOf(accounts, 'cuenta', 'cuentas')}.`,
    error: (code: BackupErrorCode) => backupErrors[code],
    reminderNever:
      'Aún no tienes un respaldo. Si pierdes o cambias este dispositivo, perderías tus datos.',
    reminderStale: (days: number) =>
      `Tu último respaldo tiene más de ${days} días y hubo cambios desde entonces.`,
    reminderAction: 'Crear respaldo',
  },
  budget: {
    title: 'Presupuesto',
    intro: 'Lo que ganas y lo que pagas cada mes: cuánto gastas, en qué y cuánto te queda.',
    monthLabel: 'Mes',
    previousMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    currentMonth: 'Ir al mes actual',
    projection:
      'Mes futuro: se muestran tus conceptos que se repiten y los pagos programados de tus créditos.',
    addIncome: 'Agregar ingreso',
    addExpense: 'Agregar gasto',
    emptyTitle: 'Nada registrado en este mes',
    emptyBody:
      'Empieza con lo que ganas al mes y luego agrega lo que pagas: suscripciones, servicios, gastos hormiga, créditos…',
    income: 'Ingresos',
    expenses: 'Gastos',
    left: 'Te queda',
    overspent: 'Gastaste de más',
    spentOfIncome: (percent: string) => `${percent} de tus ingresos`,
    noIncome: 'Sin ingresos este mes',
    creditPayments: 'Pagos a créditos',
    meterLabel: 'Parte de tus ingresos que ya se va en gastos',
    meterValue: (percent: string) => `Gastas el ${percent} de lo que ganas`,
    meterOver: (percent: string) => `Gastas el ${percent} de lo que ganas: más de lo que entra`,
    incomeTitle: 'Ingresos',
    expensesTitle: 'Gastos',
    creditsTitle: 'Pagos de créditos',
    nothingYet: 'Nada todavía.',
    everyMonth: 'Cada mes',
    until: (month: string) => `hasta ${month}`,
    oneOff: 'Solo este mes',
    paymentNumbers: (numbers: number[], total: number) =>
      numbers.length === 1
        ? `Pago ${numbers[0]} de ${total}`
        : `Pagos ${numbers.slice(0, -1).join(', ')} y ${numbers.at(-1)} de ${total}`,
    evolutionTitle: 'Evolución',
    categoryTitle: '¿En qué se va tu dinero?',
    categorySubtitle: 'Gastos del mes por categoría.',
    categoryShare: 'Del gasto',
    cashflowTitle: 'Ingresos y gastos por mes',
    cashflowSubtitle: 'Hasta 12 meses, terminando en el mes que estás viendo.',
    leftTitle: 'Lo que te queda cada mes',
    leftSubtitle: 'Ingresos menos gastos. Abajo de cero gastaste más de lo que ganaste.',
    category: 'Categoría',
    amount: 'Monto',
    month: 'Mes',
    projected: '(proyección)',
    categories: categoryLabels,
    categoryShort: categoryShortLabels,
  },
  budgetItem: {
    newIncomeTitle: 'Nuevo ingreso',
    newExpenseTitle: 'Nuevo gasto',
    editIncomeTitle: 'Editar ingreso',
    editExpenseTitle: 'Editar gasto',
    kindLabel: 'Tipo',
    kinds: { income: 'Ingreso', expense: 'Gasto' },
    name: 'Concepto',
    incomePlaceholder: 'Ej. Sueldo, Honorarios',
    expensePlaceholder: 'Ej. Renta, Netflix, Café',
    amount: 'Monto',
    currency: 'Moneda',
    category: 'Categoría',
    recurring: 'Se repite cada mes',
    recurringHelp: 'Por ejemplo tu sueldo, la renta o una suscripción.',
    month: 'Mes',
    startMonth: 'Desde',
    hasEnd: 'Termina en un mes',
    endMonth: 'Hasta',
    year: 'Año',
    scopeLabel: '¿A qué meses aplica el cambio?',
    scopeFrom: (month: string) => `Desde ${month}`,
    scopeAll: 'A todos los meses',
    scopeHelp: (month: string) => `"Desde ${month}" deja los meses anteriores como estaban.`,
    delete: 'Eliminar',
    deleteWarning: 'Se quitará de todos los meses.',
    deleteOneWarning: 'Se eliminará este concepto.',
    stopFrom: (month: string) => `Dejar de repetir desde ${month}`,
    stopWarning: (month: string) => `Los meses anteriores a ${month} no cambian.`,
    confirmStop: 'Sí, dejar de repetir',
    deleteEverywhere: 'Eliminar de todos los meses',
    notFound: 'Este concepto ya no existe.',
    creditHint:
      'Para un crédito con intereses, mejor regístralo como crédito: así se calcula cada pago.',
  },
  credit: {
    sectionTitle: 'Créditos',
    new: 'Nuevo crédito',
    empty:
      'Registra un crédito o préstamo para saber cuánto pagarás en total y cuándo lo terminas de pagar.',
    paidOffTitle: 'Liquidados',
    newTitle: 'Nuevo crédito',
    editTitle: 'Editar crédito',
    name: 'Nombre',
    namePlaceholder: 'Ej. Préstamo personal, Auto, Tarjeta',
    currency: 'Moneda',
    balance: 'Monto del crédito',
    balanceHelp:
      'Lo que debes antes del primer pago. Si el crédito ya lleva tiempo, puedes poner lo que debes hoy y la fecha de tu próximo pago.',
    rate: 'Tasa de interés anual (%)',
    rateHelp: 'La tasa ordinaria fija, por ejemplo 27.5. Para meses sin intereses escribe 0.',
    iva: 'Me cobran IVA sobre los intereses (16%)',
    ivaHelp: 'El IVA se suma a cada pago, aparte del pago fijo.',
    frequency: 'Periodicidad de pago',
    frequencies: frequencyLabels,
    perPeriod,
    firstPaymentDate: 'Fecha del primer pago',
    firstPaymentHelp:
      'En pagos quincenales, el otro día de pago es 15 días después (por ejemplo, los días 2 y 17).',
    modeLabel: '¿Qué dato tienes?',
    modes: { term: 'Cuántos pagos son', payment: 'Cuánto pago cada vez' },
    count: 'Número de pagos',
    countHelp: 'Por ejemplo, 120 pagos quincenales son 60 meses.',
    payment: (withIva: boolean) =>
      withIva ? 'Pago fijo (capital + intereses, sin IVA)' : 'Pago por periodo',
    paymentHelp: 'El que aparece en tu tabla de amortización.',
    fees: 'Comisiones y seguros cobrados al inicio',
    feesHelp:
      'Lo que te descontaron al entregarte el dinero (comisión por disposición, seguros). Sirve para saber el costo real.',
    invalidCount: 'Escribe un número entero de pagos, de 1 a 1,200.',
    previewTitle: 'Así queda tu crédito',
    previewPayment: (money: string, frequency: PaymentFrequency) =>
      `Pago fijo: ${money} ${perPeriod[frequency]}.`,
    previewFirstTotal: (money: string) => `Tu primer pago con IVA: ${money}.`,
    previewEnds: (date: string, count: number) =>
      `Lo terminas de pagar el ${date} (${countOf(count, 'pago', 'pagos')}).`,
    previewTotal: (total: string, interest: string) =>
      `Pagarás en total ${total}, de los cuales ${interest} son intereses e IVA.`,
    previewMinimum: (money: string) =>
      `El pago fijo debe ser mayor a ${money} para que la deuda baje.`,
    rateLine: (rate: string, frequency: PaymentFrequency, withIva: boolean) =>
      `${rate} anual · ${frequencyLabels[frequency]}${withIva ? ' · más IVA' : ''}`,
    currentBalance: 'Saldo pendiente',
    currentBalanceDetail: (date: string) => `Capital, antes del pago del ${date}`,
    nextPayment: 'Próximo pago',
    nextPaymentDetail: (date: string, number: number, total: number) =>
      `${date} · pago ${number} de ${total}`,
    paymentOf: (number: number, total: number) => `Pago ${number} de ${total}`,
    payoff: 'Lo terminas de pagar',
    payoffDetail: (left: number) => `Faltan ${countOf(left, 'pago', 'pagos')}`,
    paidOff: 'Liquidado',
    totalPaid: 'Total a pagar',
    totalPaidDetail: 'Todos los pagos, con IVA',
    interestCost: 'Intereses + IVA',
    interestCostDetail: (percent: string) => `${percent} sobre el monto del crédito`,
    totalCost: 'Costo total del crédito',
    totalCostDetail: (received: string) => `Intereses, IVA y comisiones · recibiste ${received}`,
    paidSoFar: 'Pagado hasta hoy',
    paidSoFarDetail: (made: number, total: number) => `${made} de ${total} pagos`,
    remaining: 'Te falta pagar',
    progress: (percent: string) => `Llevas pagado el ${percent} del total`,
    progressLabel: 'Avance del crédito',
    updateBalance: 'Actualizar saldo',
    endsOn: (date: string) => `Termina el ${date}`,
    paidOffOn: (date: string) => `Liquidado el ${date}`,
    paidOffNotice: (date: string) => `¡Crédito liquidado! El último pago fue el ${date}.`,
    nothingOwed: 'No hay saldo pendiente.',
    splitTitle: '¿A dónde se va lo que pagas?',
    splitSubtitle: 'Todo lo que pagarás, más lo que te descontaron al inicio.',
    principal: 'Capital',
    interest: 'Intereses',
    ivaLabel: 'IVA',
    feesLabel: 'Comisiones y seguros',
    balanceChartTitle: 'Saldo pendiente',
    balanceChartSubtitle: 'Lo que debes después de cada pago.',
    today: 'Hoy',
    scheduleTitle: 'Tabla de pagos',
    scheduleNote: 'Los pagos con fecha de hoy o anterior se cuentan como hechos.',
    columns: {
      number: 'No.',
      date: 'Fecha',
      payment: 'Pago fijo',
      principal: 'Capital',
      interest: 'Intereses',
      iva: 'IVA',
      total: 'Pago total',
      balance: 'Saldo',
    },
    paid: 'Pagado',
    plansTitle: 'Cambios de saldo',
    planOriginal: 'Crédito registrado',
    planUpdate: 'Saldo actualizado',
    planLine: (balance: string, payment: string) => `Saldo ${balance} · pago fijo ${payment}`,
    differenceLess: (money: string) => `${money} menos de lo que marcaba el plan`,
    differenceMore: (money: string) => `${money} más de lo que marcaba el plan`,
    differenceNone: 'Igual a lo que marcaba el plan',
    deletePlan: 'Quitar este cambio',
    deletePlanWarning: 'Se recalculará el crédito sin este cambio de saldo.',
    deleteCredit: 'Eliminar crédito',
    deleteWarning:
      'Se borrará el crédito y sus pagos dejarán de aparecer en tu presupuesto. No se puede deshacer.',
    notFound: 'No encontramos este crédito.',
    corrupted: 'Los datos de este crédito tienen un problema y no se pueden calcular.',
    updateTitle: 'Actualizar saldo',
    updateIntro:
      'Si hiciste un pago extra, te cobraron algo más o tu banco muestra otro saldo, regístralo aquí. Todo se recalcula a partir de tu próximo pago.',
    owed: 'Saldo que debes',
    owedHelp: 'El capital pendiente que muestra tu banco, antes de tu próximo pago.',
    nextPaymentDate: 'Fecha de tu próximo pago',
    updateAfterFirst: (date: string) =>
      `Debe ser después del primer pago del crédito (${date}). Para cambiar ese, edita el crédito.`,
    expectedOwed: (money: string, date: string) =>
      `Según el plan, antes del pago del ${date} deberías ${money}.`,
    extraPaymentHint:
      'Si debes menos porque hiciste un pago extra, regístralo también como gasto del mes para que cuente en tu presupuesto.',
  },
  portfolio: {
    title: 'Portafolio',
    totalBalance: 'Saldo total',
    accountsTitle: 'Cuentas',
    allArchived: 'Todas tus cuentas están archivadas. Desarchiva una para verla en los totales.',
    archivedNote: 'Las cuentas archivadas no cuentan en los totales del portafolio.',
  },
  charts: {
    evolutionTitle: 'Evolución',
    rangeLabel: 'Rango de fechas',
    ranges: rangeLabels,
    rangesShort: { '1M': '1M', '3M': '3M', '6M': '6M', '1Y': '1A', ALL: 'Todo' } satisfies Record<
      RangeKey,
      string
    >,
    thousandsSuffix: ' k',
    millionsSuffix: ' M',
    rangeHint: 'El rango aplica a las gráficas y al desglose de abajo.',
    notEnoughData: 'Aún no hay suficientes datos en este rango para graficar.',
    balanceTitle: 'Saldo y capital aportado',
    balanceSubtitle: 'La distancia entre las dos líneas es lo que ha generado.',
    balance: 'Saldo',
    capital: 'Capital aportado',
    gainTitle: 'Ganancia acumulada',
    gainSubtitle: 'Lo generado desde el saldo inicial, sin contar aportaciones ni retiros.',
    gain: 'Ganancia',
    periodGainTitle: 'Ganancia por periodo',
    periodRateTitle: 'Rendimiento por periodo',
    periodRate: 'Rendimiento',
    periodsTableNote: 'Los valores de cada periodo están en el desglose de abajo.',
    showData: 'Ver datos en tabla',
    date: 'Fecha',
    estimated: '(estimado)',
    periodLabel: (from: string, to: string, duration: string) => `${from} → ${to} · ${duration}`,
  },
  pwa: {
    updateAvailable: 'Hay una nueva versión de la app.',
    reload: 'Actualizar ahora',
    later: 'Después',
    offlineReady: 'La app ya funciona sin conexión.',
    dismiss: 'Entendido',
  },
  settings: {
    title: 'Ajustes',
    installTitle: 'Instalar la app',
    installWhy:
      'Instalada, abre como una aplicación, funciona sin conexión y el navegador protege mejor tus datos.',
    installButton: 'Instalar',
    installed: 'Ya estás usando la app instalada.',
    installIos: 'En iPhone o iPad: toca Compartir y luego "Agregar a inicio".',
    installOther:
      'Usa el menú del navegador y elige "Instalar app" o "Agregar a la pantalla de inicio".',
    theme: 'Tema',
    themes: themeLabels,
    storageTitle: 'Almacenamiento',
    storagePersisted: 'Persistente: el navegador no borrará tus datos para liberar espacio.',
    storageNotPersisted:
      'No persistente: el navegador podría borrar tus datos si le falta espacio. Instala la app y haz respaldos.',
    storageUnknown: 'Este navegador no informa si el almacenamiento es persistente.',
    requestPersist: 'Pedir almacenamiento persistente',
    privacyTitle: 'Privacidad',
    privacyBody: [
      'Tus cuentas, movimientos, presupuesto y créditos se guardan solo en este dispositivo, dentro del navegador.',
      'La app no usa servidores, analíticas ni servicios de terceros: nada de lo que registras sale de aquí.',
      'Para pasar tus datos a otro dispositivo usa los respaldos cifrados.',
    ],
    dangerTitle: 'Borrar todos los datos',
    dangerBody:
      'Elimina todas las cuentas, movimientos, presupuesto y créditos de este dispositivo. No afecta a los respaldos que ya hayas guardado.',
    dangerBackupHint: 'Antes de borrar, crea un respaldo si quieres conservar tus datos.',
    deleteAll: 'Borrar todos los datos',
    confirmWord: 'BORRAR',
    confirmPrompt: 'Escribe BORRAR para confirmar',
    confirmDeleteAll: 'Borrar definitivamente',
    deleted: 'Se borraron todos los datos de este dispositivo.',
    aboutTitle: 'Acerca de',
    version: (version: string) => `Versión ${version}`,
  },
  accounts: {
    title: 'Tus cuentas',
    new: 'Nueva cuenta',
    emptyTitle: 'Aún no tienes cuentas',
    emptyBody: 'Agrega tu primera cuenta con su saldo actual para empezar a medir cuánto genera.',
    archivedTitle: 'Archivadas',
    gain: 'Ganancia',
  },
  accountForm: {
    newTitle: 'Nueva cuenta',
    editTitle: 'Editar cuenta',
    name: 'Nombre',
    namePlaceholder: 'Ej. Ahorro, Inversión 1',
    nameHelp: 'Solo para que tú la identifiques.',
    currency: 'Moneda',
    color: 'Color',
    colorOption: (n: number) => `Color ${n}`,
    initialBalance: 'Saldo actual',
    initialBalanceHelp: 'Lo que marca tu cuenta. A partir de aquí se mide lo que genera.',
    initialDate: 'Fecha de ese saldo',
    initialEditHint: 'El saldo inicial y su fecha se editan desde la lista de movimientos.',
    create: 'Crear cuenta',
    archive: 'Archivar cuenta',
    unarchive: 'Desarchivar cuenta',
    archiveHelp: 'Una cuenta archivada se oculta de la lista principal. Sus datos se conservan.',
    deleteAccount: 'Eliminar cuenta',
    deleteWarning: 'Se borrarán la cuenta y todos sus movimientos. No se puede deshacer.',
  },
  account: {
    registerMovement: 'Registrar movimiento',
    archivedBadge: 'Archivada',
    currentBalance: 'Saldo actual',
    netContributed: 'Capital aportado',
    totalGain: 'Ganancia total',
    annualized: 'Rendimiento anualizado (TWR)',
    elapsed: 'Tiempo medido',
    avgMonthly: 'Promedio mensual',
    bestPeriod: 'Mejor periodo',
    worstPeriod: 'Peor periodo',
    periodDetail: (money: string, from: string, to: string) => `${money} · ${from} → ${to}`,
    estimatedBalance:
      'Saldo estimado: registraste movimientos después de tu último saldo. Actualiza el saldo para calcular su ganancia.',
    shortPeriod: 'Estimado: periodo corto (menos de 30 días).',
    periodsTitle: 'Desglose por periodo',
    noPeriods: 'Registra una actualización de saldo para ver cuánto ha generado la cuenta.',
    movementsTitle: 'Movimientos',
    notFound: 'No encontramos esta cuenta.',
    corrupted: 'Los datos de esta cuenta tienen un problema y no se pueden calcular.',
  },
  periods: {
    range: (from: string, to: string) => `${from} → ${to}`,
    days: (days: number) => formatDuration(days),
    netFlow: (money: string) => `Movimientos: ${money}`,
  },
  movement: {
    types: {
      balance: 'Actualizar saldo',
      deposit: 'Aportación',
      withdrawal: 'Retiro',
    },
    typeLabel: 'Tipo de movimiento',
    initial: 'Saldo inicial',
    newTitle: 'Registrar movimiento',
    editTitle: 'Editar movimiento',
    editInitialTitle: 'Editar saldo inicial',
    date: 'Fecha',
    balance: 'Saldo de la cuenta',
    balanceHelp: 'Lo que marca tu cuenta en esa fecha.',
    amount: 'Monto',
    balanceAfter: 'Saldo después del movimiento',
    balanceAfterHelp: 'Si lo conoces, la ganancia se asigna con más precisión.',
    balanceAfterShort: (money: string) => `saldo después: ${money}`,
    previewTitle: 'Al guardar',
    deleteMovement: 'Eliminar movimiento',
    deleteWarning: 'Se recalcularán las ganancias de la cuenta.',
  },
  preview: {
    generated: (money: string, duration: string) => `Generaste ${money} en ${duration}.`,
    lost: (money: string, duration: string) => `Perdiste ${money} en ${duration}.`,
    unchanged: (duration: string) => `Sin cambios en ${duration}.`,
    beforeMovement: (sentence: string) => `Antes de este movimiento: ${sentence}`,
    periodReturn: (percent: string) => `Rendimiento del periodo: ${percent}`,
    depositsExcluded: (money: string) => `Ya se descontaron ${money} de aportaciones.`,
    withdrawalsExcluded: (money: string) => `Ya se sumaron ${money} de retiros.`,
    pending: 'La ganancia se calculará en tu próxima actualización de saldo.',
    netContributed: (money: string) => `Capital aportado: ${money}.`,
    totalGain: (money: string) => `Ganancia total: ${money}.`,
  },
  errors: {
    required: 'Este dato es obligatorio.',
    invalidAmount: 'Escribe un monto válido, por ejemplo 10,000.50.',
    invalidDate: 'Escribe una fecha válida.',
    futureDate: 'La fecha no puede ser futura.',
    nameLength: (max: number) => `Escribe un nombre de 1 a ${max} caracteres.`,
    issue: (code: ValidationIssueCode) => issueMessages[code],
    budgetIssue: (code: BudgetIssueCode) => budgetIssueMessages[code],
    creditIssue: (code: CreditIssueCode) => creditIssueMessages[code],
    repository: (code: RepositoryErrorCode) => repositoryMessages[code],
    unexpected: 'Ocurrió un error inesperado. Tus datos no se modificaron.',
  },
  privacy: {
    localOnly: 'Tus datos se guardan solo en este dispositivo. Nunca se envían a ningún servidor.',
  },
} as const;
