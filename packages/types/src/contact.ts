/**
 * Contact-target normalization shared by every layer (API, seed, frontends).
 * A single implementation prevents identity-splitting bugs.
 */

/** Normalizes Indian phone numbers to +<digits> form, stripping the 91 country code from 10-digit local numbers. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  const stripped = digits.replace(/^\+?91(?=\d{10}$)/, "");
  return stripped.startsWith("+") ? stripped : `+${stripped}`;
}

export function isEmail(t: string): boolean {
  return t.includes("@");
}

/** Normalizes a login target that may be a phone or an email. */
export function normalizeTarget(raw: string): string {
  return isEmail(raw) ? raw.trim().toLowerCase() : normalizePhone(raw);
}

export function maskTarget(t: string): string {
  if (isEmail(t)) {
    const [u = "", d = ""] = t.split("@");
    return `${u.slice(0, 2)}***@${d}`;
  }
  return `${t.slice(0, 3)}****${t.slice(-3)}`;
}
