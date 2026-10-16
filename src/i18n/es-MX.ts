// All user-facing text lives here. Components must not hardcode UI strings.
export const strings = {
  app: {
    name: 'InvestFollowCalc',
    tagline: 'Sigue cuánto generan tus inversiones, separado de lo que aportas.',
  },
  empty: {
    title: 'Aún no tienes cuentas',
    body: 'Pronto podrás agregar tu primera cuenta y registrar su saldo.',
  },
  privacy: {
    localOnly: 'Tus datos se guardan solo en este dispositivo. Nunca se envían a ningún servidor.',
  },
} as const;
