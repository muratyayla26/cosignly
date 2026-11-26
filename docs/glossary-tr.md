# Sözlük (TR)

Cosignly'de geçen Stellar kavramlarının kısa Türkçe açıklamaları. Yeni bir kavram ilk kullanıldığında buraya eklenir.

| Terim | Açıklama |
|---|---|
| **Vault (kasa)** | Multisig ile korunan, ekibin ortak Stellar hesabı (`G...` adresi). Para ağda durur; Cosignly sadece öneri, bildirim ve imza arayüzüdür. |
| **Signer (imzacı)** | Bir hesap adına işlem imzalayabilen anahtar. Her imzacının bir ağırlığı (0-255) vardır. |
| **Trustline** | Bir hesabın XLM dışındaki bir varlığı (ör. USDC) tutabilmesi için o varlığa açıkça "güveniyorum" demesi. `change_trust` işlemiyle açılır ve hesabın minimum bakiyesini 0.5 XLM artırır. |
| **SAC (Stellar Asset Contract)** | Klasik bir varlığın (ör. USDC) akıllı kontratlar tarafında `C...` adresiyle görünen karşılığı. Sprint 1'de kullanılmaz; ödemeler ve trustline'lar `G...` issuer adresiyle yapılır. |
| **Signer weight (imzacı ağırlığı)** | Her imzacının oyunun değeri (0-255). Bir işlemdeki imzaların ağırlıkları toplanır; toplam eşiğe ulaşınca işlem yetkilidir. Ağırlığı 0 olan anahtar hiç imza atamaz. |
| **Threshold (eşik)** | Bir işlem türünün geçmesi için gereken toplam ağırlık. Üç seviye var: **low** (ör. bump sequence), **medium** (ödeme, trustline), **high** (imzacı/eşik değişikliği). Cosignly'de "ödeme eşiği" medium, "yönetim eşiği" high'dır. |
| **Master key / master weight** | Hesabın kendi adresine (`G...`) ait anahtar ve ağırlığı. Cosignly kasalarında 0 yapılır; böylece hiçbir tek anahtar hesabı kontrol edemez. |
| **N-1 kuralı** | Herhangi bir imzacı anahtarını kaybetse bile kalanların yönetim eşiğine ulaşabilmesi. Sağlanmazsa kayıp anahtar değiştirilemez ve kasa kilitlenebilir; sihirbaz açık onay ister. |
| **Subentry / base reserve** | Hesaba bağlı her ek kayıt (imzacı, trustline) bir "subentry"dir ve hesabın tutması gereken minimum XLM bakiyesini bir base reserve (şu an 0.5 XLM) artırır. |
| **Secret key / public key (gizli anahtar / açık adres)** | Bir Ed25519 anahtar çifti. `S...` ile başlayan gizli anahtar imza atar ve asla paylaşılmaz; `G...` ile başlayan açık adres herkese verilebilir ve kasaya imzacı olarak bu eklenir. İmzacı anahtarının ağda fonlanmış bir hesap olması gerekmez. |
| **Keychain / Keystore** | iOS ve Android'in şifreli anahtar deposu. Cosignly gizli anahtarı burada biyometriye bağlı şifreler; Face ID veya parmak izi olmadan çözülemez. Android'de yeni bir parmak izi/yüz eklenirse sistem anahtarı kilitler (kurtarma diğer imzacılarla). |
| **Operation / transaction hash** | Bir Stellar işlemi (transaction) bir veya birden çok "operation" içerir (ör. ödeme, imzacı ekleme). Kasa geçmişindeki her satır bir operation; dokununca stellar.expert'te o işlemin hash'iyle (işlemin benzersiz kimliği) açılır. Kullanıcıya "operation" kelimesi gösterilmez. |
| **Ephemeral key (geçici kurulum anahtarı)** | Kasayı kurmak için cihazda bir kez üretilen rastgele anahtar. Hesabı açar, tek işlemle imzacıları ve eşikleri ekler, kendi ağırlığını 0 yapar ve bir daha imza atamaz. Hiçbir yere kaydedilmez; işlem bitince bellekten atılır. |
| **Friendbot** | Testnet'in ücretsiz XLM musluğu. Yeni bir testnet hesabına 10.000 test XLM gönderip hesabı ağda açar. Mainnet'te yoktur. |
| **Transaction fee (işlem ücreti)** | Her işlem, içindeki operation sayısı × base fee (şu an 100 stroop = 0.00001 XLM) öder. İşleme yazılan ücret bir üst sınırdır; ağ sadece gerekeni keser (kasa kurulumu: 5 operation → 0.00005 XLM). |
| **Time bounds (zaman sınırı)** | İşlemin geçerli olduğu zaman aralığı (`min_time`–`max_time`). Süresi geçen işlem ağa gönderilemez (`tx_too_late`). Kurulum işlemi 5 dakika, öneriler varsayılan 7 gün geçerli. |
| **Proposal (öneri)** | Kasadan yapılmak istenen bir ödemenin, öneren imzacının imzasıyla hazırlanmış ama henüz ağa gönderilmemiş hali. Diğer imzacılar imzaladıkça onay sayısı artar; eşik dolunca ağa gönderilir. 7 gün içinde yeterli onay gelmezse süresi dolar. |
| **Refractor** | Stellar ekosisteminin açık imza toplama servisi (refractor.space). Bir işlemi hash'iyle saklar, farklı kişilerden gelen imzaları birleştirir ve eşik dolunca işlemi ağa kendisi gönderir. Cosignly kullanmayan imzacılar da Refractor sayfasından kendi cüzdanlarıyla imzalayabilir. |
