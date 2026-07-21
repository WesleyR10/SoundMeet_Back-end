/**
 * Porta de criptografia simétrica para segredos que precisam ser lidos de
 * volta em texto claro (ex.: tokens OAuth de terceiros persistidos no banco).
 *
 * Não usar para senhas — senha é hash one-way (bcrypt). Esta porta existe
 * para o caso oposto: o valor PRECISA ser decifrável em runtime.
 *
 * Implementações ficam em `shared/infra/crypto/`:
 * - `AesGcmEncryptionService` (real, AES-256-GCM)
 * - `FakeEncryptionService` (testes, round-trip reversível sem criptografia)
 */
export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

export interface IEncryptionService {
  encrypt(plaintext: string): EncryptedPayload;
  decrypt(payload: EncryptedPayload): string;
}
