import type { RepositoryErrorCode } from '../db/repository';
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
    settings: 'Ajustes',
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
  settings: {
    title: 'Ajustes',
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
      'Tus cuentas y movimientos se guardan solo en este dispositivo, dentro del navegador.',
      'La app no usa servidores, analíticas ni servicios de terceros: nada de lo que registras sale de aquí.',
      'Para pasar tus datos a otro dispositivo usa los respaldos cifrados.',
    ],
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
    repository: (code: RepositoryErrorCode) => repositoryMessages[code],
    unexpected: 'Ocurrió un error inesperado. Tus datos no se modificaron.',
  },
  privacy: {
    localOnly: 'Tus datos se guardan solo en este dispositivo. Nunca se envían a ningún servidor.',
  },
} as const;
