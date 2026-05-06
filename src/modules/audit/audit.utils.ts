// Daftar field yang tidak boleh ditampilkan asli
const SENSITIVE_FIELDS = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'oldPassword',
  'newPassword',
  'confirmPassword',
  'nik',
]);

// Helper jika nilai berupa string, maka akan dimasking
function maskString(value: string) {
  if (value.length <= 8) {
    return '********';
  }
  return `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}`;
}

// Mengamankan data sensitif sebelum disimpan ke audit trail
export function maskSensitiveFields(input: unknown): unknown {
  // langsung dikembalikan jika inputbukan objek atau array
  if (input === null || input === undefined) {
    return input;
  }

  // Handling array
  if (Array.isArray(input)) {
    return input.map((item) => maskSensitiveFields(item));
  }

  // Handling objek
  if (typeof input === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      input as Record<string, unknown>,
    )) {
      // Jika field termasuk sensitif, maka nilai akan dimasking
      if (SENSITIVE_FIELDS.has(key)) {
        result[key] =
          typeof value === 'string' ? maskString(value) : '********';
      } else {
        result[key] = maskSensitiveFields(value);
      }
    }
    return result;
  }

  return input;
}

// Membandingkan data sebelum dan sesudah suatu perubahan, lalu hanya mengambil field yang benar-benar berubah
export function buildDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
) {
  // Inisialisasi hasil
  const oldValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};

  // Normalisasi data supaya tidak error di proses
  const beforeValue = before ?? {};
  const afterValue = after ?? {};

  // Ambil semua key unik dari kedua objek
  const keys = new Set([
    ...Object.keys(beforeValue),
    ...Object.keys(afterValue),
  ]);

  // Loop setiap key
  for (const key of keys) {
    // Ambil nilai lama & baru
    const prev = beforeValue[key];
    const next = afterValue[key];

    // Bandingkan nilai lama & baru, jika berbeda maka simpan ke hasil diff
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      oldValue[key] = prev ?? null;
      newValue[key] = next ?? null;
    }
  }

  return { oldValue, newValue };
}
