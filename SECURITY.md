# Security policy

Cosignly helps people approve transactions from shared Stellar accounts, so security reports are taken seriously.

## Reporting a vulnerability

Please report vulnerabilities **privately** through GitHub's private vulnerability reporting:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the issue, the affected component (mobile app, API, shared package) and steps to reproduce.

Do not open a public issue, pull request or discussion for a security problem.

You can expect an acknowledgement within a few days. Please give reasonable time for a fix before any public disclosure.

## Scope and current status

- Cosignly currently runs on the Stellar **testnet** only and is not ready for real funds.
- Signing keys are generated and kept on the user's device. The Ed25519 signing key is encrypted and stored in the iOS Keychain / Android Keystore, protected by biometrics (Secure Enclave / hardware-backed keystore). It is decrypted on the device only after biometric confirmation to sign a transaction, and is never sent to the backend.
- The backend stores metadata only (public keys, push tokens, proposal index). It never holds secret keys or funds.

Reports about any of these guarantees being broken are especially welcome.
