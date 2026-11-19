export type PasswordStrength = {
  word: "Weak" | "OK" | "Strong";
  /** 1–3, for the meter. */
  score: 1 | 2 | 3;
  rules: { length: boolean; numberOrSymbol: boolean };
};

const COMMON = new Set([
  "password",
  "password1",
  "12345678",
  "123456789",
  "qwerty123",
  "iloveyou",
  "letmein1",
  "tensorlm1",
]);

/** Rules shown under the field: at least 8 characters, and a number or symbol. */
export function passwordStrength(password: string): PasswordStrength {
  const rules = {
    length: password.length >= 8,
    numberOrSymbol: /[\d\W_]/.test(password),
  };
  if (!rules.length || !rules.numberOrSymbol || COMMON.has(password.toLowerCase())) {
    return { word: "Weak", score: 1, rules };
  }
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[\W_]/].filter((r) => r.test(password)).length;
  if (password.length >= 12 && variety >= 3) return { word: "Strong", score: 3, rules };
  return { word: "OK", score: 2, rules };
}
