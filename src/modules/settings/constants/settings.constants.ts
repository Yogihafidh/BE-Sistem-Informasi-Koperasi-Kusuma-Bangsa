export const SETTING_VALUE_TYPE = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  JSON: 'JSON',
} as const;

export type SettingValueType =
  (typeof SETTING_VALUE_TYPE)[keyof typeof SETTING_VALUE_TYPE];

export const SETTING_KEYS = {
  LOAN_MAX_TENOR_MONTHS: 'loan.maxTenorMonths',
  LOAN_MIN_TENOR_MONTHS: 'loan.minTenorMonths',
  LOAN_MAX_LOAN_AMOUNT: 'loan.maxLoanAmount',
  LOAN_DEFAULT_INTEREST_PERCENT: 'loan.defaultInterestPercent',
  LOAN_AUTO_APPROVAL_LIMIT: 'loan.autoApprovalLimit',
  SAVINGS_MIN_INITIAL_DEPOSIT: 'savings.minInitialDeposit',
  SAVINGS_MIN_MONTHLY_DEPOSIT: 'savings.minMonthlyDeposit',
  SAVINGS_ALLOW_WITHDRAWAL_IF_LOAN_ACTIVE:
    'savings.allowWithdrawalIfLoanActive',
  TRANSACTION_MAX_DAILY_NOMINAL: 'transaction.maxDailyNominal',
  DASHBOARD_TREND_MONTHS: 'dashboard.trendMonths',
} as const;

export const DEFAULT_SETTINGS: Array<{
  key: string;
  value: string;
  valueType: SettingValueType;
  description: string;
}> = [
  {
    key: SETTING_KEYS.LOAN_MAX_TENOR_MONTHS,
    value: '24',
    valueType: SETTING_VALUE_TYPE.NUMBER,
    description: 'Batas maksimum tenor pinjaman (bulan)',
  },
  {
    key: SETTING_KEYS.LOAN_MIN_TENOR_MONTHS,
    value: '3',
    valueType: SETTING_VALUE_TYPE.NUMBER,
    description: 'Batas minimum tenor pinjaman (bulan)',
  },
  {
    key: SETTING_KEYS.LOAN_MAX_LOAN_AMOUNT,
    value: '50000000',
    valueType: SETTING_VALUE_TYPE.NUMBER,
    description: 'Batas maksimum nominal pinjaman per pengajuan',
  },
  {
    key: SETTING_KEYS.LOAN_DEFAULT_INTEREST_PERCENT,
    value: '2.5',
    valueType: SETTING_VALUE_TYPE.NUMBER,
    description: 'Bunga pinjaman default dalam persen',
  },
  {
    key: SETTING_KEYS.LOAN_AUTO_APPROVAL_LIMIT,
    value: '3000000',
    valueType: SETTING_VALUE_TYPE.NUMBER,
    description: 'Batas nominal pinjaman untuk auto approval',
  },
  {
    key: SETTING_KEYS.SAVINGS_MIN_INITIAL_DEPOSIT,
    value: '50000',
    valueType: SETTING_VALUE_TYPE.NUMBER,
    description: 'Nominal tetap simpanan pokok (dibayar 1x di awal)',
  },
  {
    key: SETTING_KEYS.SAVINGS_MIN_MONTHLY_DEPOSIT,
    value: '25000',
    valueType: SETTING_VALUE_TYPE.NUMBER,
    description: 'Nominal tetap simpanan wajib per bulan',
  },
  {
    key: SETTING_KEYS.SAVINGS_ALLOW_WITHDRAWAL_IF_LOAN_ACTIVE,
    value: 'false',
    valueType: SETTING_VALUE_TYPE.BOOLEAN,
    description: 'Izin tarik simpanan saat pinjaman masih aktif',
  },
  {
    key: SETTING_KEYS.TRANSACTION_MAX_DAILY_NOMINAL,
    value: '100000000',
    valueType: SETTING_VALUE_TYPE.NUMBER,
    description: 'Batas total nominal transaksi harian per anggota',
  },
  {
    key: SETTING_KEYS.DASHBOARD_TREND_MONTHS,
    value: '6',
    valueType: SETTING_VALUE_TYPE.NUMBER,
    description: 'Jumlah bulan yang ditampilkan pada tren dashboard',
  },
];
