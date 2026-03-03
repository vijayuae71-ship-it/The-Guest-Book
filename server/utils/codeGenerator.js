const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/**
 * Generate a random room code using unambiguous characters.
 * Excludes I, L, O, 0, 1 to avoid confusion.
 * @returns {string} A 6-character uppercase room code
 */
export function generateRoomCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length);
    code += CHARSET[randomIndex];
  }
  return code;
}
