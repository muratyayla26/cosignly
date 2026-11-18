# Sözlük (TR)

Cosignly'de geçen Stellar kavramlarının kısa Türkçe açıklamaları. Yeni bir kavram ilk kullanıldığında buraya eklenir.

| Terim | Açıklama |
|---|---|
| **Vault (kasa)** | Multisig ile korunan, ekibin ortak Stellar hesabı (`G...` adresi). Para ağda durur; Cosignly sadece öneri, bildirim ve imza arayüzüdür. |
| **Signer (imzacı)** | Bir hesap adına işlem imzalayabilen anahtar. Her imzacının bir ağırlığı (0-255) vardır. |
| **Trustline** | Bir hesabın XLM dışındaki bir varlığı (ör. USDC) tutabilmesi için o varlığa açıkça "güveniyorum" demesi. `change_trust` işlemiyle açılır ve hesabın minimum bakiyesini 0.5 XLM artırır. |
| **SAC (Stellar Asset Contract)** | Klasik bir varlığın (ör. USDC) akıllı kontratlar tarafında `C...` adresiyle görünen karşılığı. Sprint 1'de kullanılmaz; ödemeler ve trustline'lar `G...` issuer adresiyle yapılır. |
