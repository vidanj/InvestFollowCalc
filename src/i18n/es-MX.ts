import type { BackupErrorCode } from '../backup/backup';
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
    replaceWarning: (current: number) =>
      current === 0
        ? 'Este dispositivo no tiene datos: se cargarán los del respaldo.'
        : current === 1
          ? 'Se borrará la cuenta que hay ahora en este dispositivo y en su lugar quedarán las del respaldo.'
          : `Se borrarán las ${current} cuentas que hay ahora en este dispositivo y en su lugar quedarán las del respaldo.`,
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
      'Tus cuentas y movimientos se guardan solo en este dispositivo, dentro del navegador.',
      'La app no usa servidores, analíticas ni servicios de terceros: nada de lo que registras sale de aquí.',
      'Para pasar tus datos a otro dispositivo usa los respaldos cifrados.',
    ],
    dangerTitle: 'Borrar todos los datos',
    dangerBody:
      'Elimina todas las cuentas y movimientos de este dispositivo. No afecta a los respaldos que ya hayas guardado.',
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
    repository: (code: RepositoryErrorCode) => repositoryMessages[code],
    unexpected: 'Ocurrió un error inesperado. Tus datos no se modificaron.',
  },
  privacy: {
    localOnly: 'Tus datos se guardan solo en este dispositivo. Nunca se envían a ningún servidor.',
  },
} as const;
