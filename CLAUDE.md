# Cosignly — Proje Hafızası (CLAUDE.md)

> Claude Code bu dosyayı her oturumda okur. Repo: https://github.com/muratyayla26/cosignly (public, MIT).
> Teknik bilgiler Kasım 2026 itibarıyladır. Bir API'yi kullanmadan önce güncel davranışını doğrula; değişmişse bu dosyayı güncelle.

---

## 1. Ben kimim, sen ne yapacaksın

- Geliştirici: Murat Yayla.
- Proje, Stellar Türkiye Ambassador Chapter üzerinden **SDF Instawards** programından **onaylanmış** 30 günlük bir sprint. Teslimatlar ve kanıtlar onaylı SOW'a bağlı (`docs/plan.md` bunun uygulama planı). Kapsam dışına çıkmak veya kanıtı eksik bırakmak ödül riskidir.
- Sen (Claude Code) kıdemli Stellar + React Native + Cloudflare mühendisi gibi davran: planla, kodla, test et, belgele, kanıt topla.
- **Benimle Türkçe konuş.** Kod, yorumlar, commit mesajları, PR açıklamaları ve repodaki dokümanlar **İngilizce** (kullanıcı rehberinin TR sürümü hariç). Repo public; yazdığın her şeyi dışarıdan biri okuyacakmış gibi yaz.
- Yeni bir Stellar kavramını (signer weight, threshold, sequence number, trustline, time bounds, XDR, base reserve vb.) ilk kullandığında bana 1-2 cümleyle Türkçe açıkla ve `docs/glossary-tr.md`'ye ekle.
- Bakımı tek başıma yapacağım: basit, az bağımlılıklı, okunur mimari. "Akıllıca" ama bakımı zor çözümlerden kaçın.

## 2. İsimlendirme (tutarlı kullan)

- Görünen ad her yerde **Cosignly** (baş harf büyük): uygulama adı, README başlığı, App Store / Google Play, X, dokümanlar, bildirim başlıkları.
- Teknik tanımlayıcılar küçük harf **cosignly**: repo, paket adları (`@cosignly/shared`), Worker adı (`cosignly-api`), deep link scheme (`cosignly://`), bundle id / package name (`com.muratyayla.cosignly`).
- Türkçe konuşmalarımızda geçen "kasa" kelimesi ürün adı değil; multisig ile korunan ortak Stellar hesabı demek. Kodda, arayüzde ve İngilizce dokümanlarda karşılığı **vault**.

## 3. Ürün

**Cosignly**: Stellar'ın yerleşik multisig'ini kullanan ekipler için mobil onay uygulaması (iOS + Android, Expo) ve Cloudflare Workers backend'i.

### Kullanıcı hikâyesi
Bir ekibin ortak kasası "3 imzacıdan 2'si onaylamadan para çıkmaz" kuralıyla korunuyor. Sam uygulamadan "Send 500 USDC to Alex" önerisi oluşturur. Jordan'ın telefonuna bildirim düşer; işlemi okunur halde görür ("Team Vault → Alex, 500 USDC, 1 of 2 approvals") ve Face ID ile onaylar. Eşik dolunca işlem ağa otomatik gönderilir, herkese "executed" bildirimi gider.

### Kasa nerede yaşar (önemli kavram)
- Kasa (vault), Stellar ağında yaşayan normal bir hesaptır (G... adresi). Cosignly parayı tutmaz; kasa kurmaya, öneri oluşturmaya, bildirim almaya ve imzalamaya yarayan arayüzdür.
- Her kullanıcının cihazında bir **imzacı anahtarı** (Ed25519) vardır. Bu anahtarın fonlanmış bir hesap olması gerekmez; sadece kasaların imzacısıdır.
- Kasaya para herhangi bir cüzdandan/borsadan adresine gönderilerek girer; sadece imzacıların onayladığı önerilerle çıkar.
- Cosignly kapanırsa bile kasalar erişilebilir kalır: imzacılar Refractor, Stellar Lab veya başka araçlarla imzalamaya devam edebilir. (Ürün mesajlarımızda bunu vurguluyoruz.)

### Problem ve farkımız
- Refractor (ekosistemin imza toplayıcısı) sadece web'de, bildirim yok, işleme sadece hash ile erişiliyor → linkler Discord/Telegram'da kayboluyor.
- İmzacılar okuyamadıkları ham XDR'ı onaylıyor.
- Ağırlık/eşik ayarı hataya açık; yanlış kombinasyon hesabı kalıcı kilitler.
- **Farkımız:** mobil, push bildirim, okunur onay ekranı, kilitlenme korumalı kurulum sihirbazı, non-custodial.

### Mimari
```
[Cosignly app (Expo, iOS/Android)]
   ├─ Horizon (testnet): accounts, signers, thresholds, balances, history, ?signer= discovery
   ├─ Refractor API: upload tx / merge signatures (POST /tx), status (GET /tx/{hash})
   └─ Cosignly API (Cloudflare Worker + D1 + Cron Trigger) — cosignly-api.murat-yayla-26.workers.dev
          ├─ signer auth (signed challenge) + push token registry
          ├─ pending-proposal index per vault
          ├─ Refractor callback endpoint + scheduled polling fallback
          └─ Expo Push Service → APNs / FCM
```
- Monorepo: `apps/mobile` (Expo), `apps/api` (Worker), `packages/shared` (tipler, vault kuralları, XDR çözücü, Horizon yardımcıları; mobil ve Worker ortak kullanır).
- **Backend asla anahtar veya para tutmaz.** Sadece metadata tutar.
- Domain yok: Worker `*.workers.dev` üzerinde; bildirimden uygulamaya geçiş `cosignly://` scheme ile.

### Sprint 2 hazırlığı (bu sprintte YAPMA, ama mimariyi buna açık tut)
Onaylı yol haritası: Sprint 2'de smart-account kasalar (OpenZeppelin smart account + Smart Account Kit, aynı Ed25519 anahtarlar, threshold policy, relayer ile fee sponsorship), Sprint 3'te harcama limiti/ağırlıklı kurallar, passkey imzacılar, mainnet ve mağaza yayını.
- Bu yüzden imza toplama mantığını bir arayüzün arkasına koy: `SignatureCoordinator` (`propose`, `addSignature`, `getStatus`). Sprint 1'de tek implementasyon `RefractorCoordinator`. Sprint 2'de Soroban auth entry'leri için `BackendCoordinator` eklenecek (Refractor smart-account imzalarını birleştiremez).
- Kasa modeline bir `kind: "classic"` alanı koy; Sprint 2'de `"smart"` eklenecek.
- Bunlar için şimdiden fazladan kod yazma; sadece arayüz ve tip seviyesinde hazırlık.

### Tasarım dili (zorunlu kaynak: `docs/design.md`)
- Logo: **B · Quorum** (üç imzacı; onaylayan ikisi nane, bekleyen indigo halka). Aynı fikir arayüzde: onaylandı = nane, bekliyor = indigo halka (`QuorumProgress`).
- Açık + koyu tema; **varsayılan sistem teması**, Settings → Appearance'tan System / Light / Dark seçilebilir.
- Bileşenler renkleri sadece `useTheme()` üzerinden semantik token'larla kullanır; bileşenlerde ham hex yasak. Token'lar ve kontrast değerleri `docs/design.md`'de; değiştirme gerekirse önce bana sor.
- Font Inter, ikonlar Lucide, emoji yok, tutarlar tabular rakam, adresler ortadan kısaltılmış monospace.
- Marka dosyaları `assets/brand/` altında hazır (iOS ikon, Android adaptive + monochrome ikon, açık/koyu splash, SVG kaynakları).
- Kullanıcıya teknik jargon gösterme (XDR, sequence, operation); teknik detaylar "Details" altında.
- Demo verileri, ekran görüntüleri, mağaza metinleri ve testlerde global İngilizce isimler kullan (Alex, Sam, Jordan, Taylor; "Team Vault", "Grant Treasury").

## 4. Onaylı SOW kapsamı (30 gün) — sapma yok

### Teslimatlar
1. **Mobil uygulama çekirdeği:** non-custodial imzacı anahtarı (cihazda üretim veya import; biyometrik korumalı), kasa keşfi (Horizon `?signer=`), kilitlenme korumalı kurulum sihirbazı (imzacı ekle, ağırlık/eşik, USDC trustline), kasa paneli (bakiye, imzacılar, eşikler, geçmiş).
2. **Öneri ve onay akışı:** XLM/USDC ödeme önerisi (time bounds ile) → Refractor'a yükleme → okunur onay ekranı → biyometrik onay → Refractor'da imza birleştirme → eşikte otomatik gönderim; durum takibi, sequence çakışması yönetimi, diğer cüzdanları kullanan imzacılar için paylaşım linki.
3. **Backend + push + pilot:** Cloudflare Workers + D1 (imzalı challenge ile auth, push token kaydı, öneri indeksi, Refractor callback + cron polling), iOS/Android push (deep link ile onay ekranına), TestFlight/APK ile testnet pilotu, TR + EN kullanıcı rehberi, demo.

Haftalık görev dökümü: `docs/plan.md`. **Bir haftaya başlamadan önce o haftanın bölümünü oku.**

### Kapsam DIŞI (yapma; aklına gelirse `docs/backlog.md`'ye yaz)
- Sprint 2: smart-account kasalar · Sprint 3: policy'ler, passkey, mainnet, mağaza yayını
- Ödeme ve imzacı/eşik yönetimi dışındaki işlemler (DEX, kontrat çağrısı)
- Uygulama içinden harici cüzdanla imza (WalletConnect, LOBSTR, Freighter Mobile) — bu imzacılar Refractor linkiyle imzalar
- Kasa başına aynı anda birden fazla bekleyen öneri (v1: tek)
- Anahtar yedekleme / bulut kurtarma (v1'de kurtarma multisig'in kendisiyle)
- Soroban kontratı yazmak, backend'de anahtar/para saklamak, audit, fiat ramp, web uygulaması

## 5. Doğrulanmış teknik bilgiler (sprint öncesi prototipte test edildi)

Sprint öncesinde uçtan uca bir testnet prototipi ile aşağıdakiler gerçek cihazlarda (iPhone 16, Galaxy A54) doğrulandı. Özet: `docs/decisions/0001-prior-technical-validation.md`. Prototip kodu bu repoda değil; gerekirse ben referans olarak paylaşırım.

| Konu | Sonuç |
|---|---|
| Kasa kurulumu (2-of-3, sahipsiz hesap) | Tek işlemle kuruldu; kurulum (ephemeral) anahtarı sonra yetkisiz kaldı |
| Kilitlenme kuralları | Hatalı yapılandırmaları yakaladı |
| Kasa keşfi | Horizon `GET /accounts?signer=<G...>` ile çalıştı |
| Biyometrik korumalı anahtar | iOS ve Android'de çalıştı |
| Cihazda öneri oluşturup imzalama | İki platformda çalıştı |
| İmza birleştirme + eşikte otomatik gönderim | Refractor ile ~13 sn'de zincirde |
| Çift ödeme olmaması / eski önerinin geçersizleşmesi | Gözlendi (sequence davranışı) |
| Backend'e anahtar gitmemesi | Akışın hiçbir adımında gitmedi |

### Stellar multisig kuralları
- Master key + en fazla 20 ek imzacı. Ağırlık 0-255. Eşikler: low, medium, high.
- `payment` ve `change_trust` → **medium**. `set_options` (imzacı/eşik değişikliği) → **high**.
- Her imzacı ve trustline minimum bakiyeyi 0.5 XLM artırır (subentry reserve). Sihirbaz bunu kullanıcıya göstermeli.
- Her işlem kaynak hesabın **sequence number**'ına bağlı. Aynı kasadan bekleyen iki işlemden biri gönderilirse diğeri `tx_bad_seq` ile geçersizleşir → v1'de kasa başına tek bekleyen öneri + "recreate" akışı.
- Önerilere **time bounds** koy (varsayılan 7 gün).

### Kasa oluşturma
- Ephemeral anahtarla yeni hesap aç (testnet'te Friendbot). Tek işlemde: USDC `change_trust`, imzacıları ekle, eşikleri ayarla, **master weight = 0**. Ephemeral anahtar sonra atılır.
- **Kilitlenme kuralları** (`packages/shared`, saf fonksiyon, %100 test):
  1. Toplam imzacı ağırlığı ≥ high (yoksa reddet).
  2. **N-1 kuralı:** herhangi bir imzacı kaybolsa da kalan ağırlık ≥ high olmalı; değilse güçlü uyarı + açık onay.
  3. low ≤ medium ≤ high.
  4. Master weight 0 yapılmadan diğer imzacılar aynı işlemde eklenmiş olmalı.
  5. Sade özet: "Payments need 2 of 3. Changing signers needs 2 of 3."
- Kullanıcı istediği N-of-M'yi kurabilir (şablonlar: 2/2, 2/3, 3/5 + gelişmiş/ağırlıklı); ödeme (medium) ve yönetim (high) eşikleri ayrı gösterilir.

### Refractor API (refractor.space/api-docs)
- `POST /tx`: `network` (`"public"`|`"testnet"`), `xdr`, `submit` (eşik dolunca gönder), `callbackUrl`, `expires`. Aynı hash'e tekrar POST → imzalar birleşir.
- `GET /tx/{hash}` → `xdr`, `signatures[]`, `status`, `submitted`, `minTime`, `maxTime`…
- Sorgu sadece hash ile → indeksi biz tutuyoruz. FeeBump desteklenmiyor (406). Callback payload'ı, `status` değerleri ve rate limit belgelenmemiş → ilk kullandığında gerçek davranışı gözlemle ve buraya yaz.

### İmzacı anahtarı (mobil) — doğru ifade
- Ed25519 anahtarı cihazda üretilir (`react-native-get-random-values` şart) veya `S...` import edilir.
- **The Ed25519 signing key is encrypted and stored in the iOS Keychain / Android Keystore, protected by biometrics (Secure Enclave / hardware-backed keystore). It is decrypted on the device only after biometric confirmation to sign a transaction, and is never sent to the backend.** Dokümanlarda bu ifadeyi kullan; "anahtar Secure Enclave'in içinde" deme (Secure Enclave sadece P-256 tutar).
- `expo-secure-store` (`requireAuthentication`). Android'de biyometrik değişirse anahtar geçersizleşebilir → kullanıcıyı uyar; kurtarma diğer imzacılarla.
- Polyfill: SDF'nin Freighter Mobile reçetesi (`buffer`, `react-native-get-random-values`, gerekirse `react-native-quick-crypto`). Minimum gerekeni kullan.
- Anahtar asla loglanmaz, backend'e gönderilmez, analytics'e girmez.

### Backend (Cloudflare Workers + D1 + Cron Triggers)
- Auth: Worker nonce üretir → uygulama imzalar → Worker Ed25519 imzasını doğrular (Workers WebCrypto Ed25519 veya `@stellar/stellar-base`; Workers'ta sorunsuz olanı doğrula) → kısa ömürlü token.
- Öneri kaydında XDR'ın kaynak hesabı bir kasa mı, öneren o kasanın imzacısı mı → Horizon ile doğrula.
- D1 şeması (öneri): `signers(pubkey PK, created_at)`, `devices(id, signer_pubkey, expo_push_token, platform, updated_at)`, `vaults(account_id PK, kind, signers_json, thresholds_json, synced_at)`, `proposals(tx_hash PK, vault_id, proposer, xdr, summary_json, status, expires_at, created_at, updated_at)`.
- Push: Expo Push API (`https://exp.host/--/api/v2/push/send`) + receipt kontrolü + geçersiz token temizliği. Payload'da hassas veri minimum.
- Secret'lar sadece `wrangler secret`. Free plan limitlerine dikkat; aşılırsa bana söyle.

### Push altyapısı
- `expo-notifications` + EAS. iOS: APNs key → `eas credentials`. Android: Firebase projesi + FCM V1 service account JSON → EAS; `google-services.json` app config'e (repo'ya girip girmeyeceğini güvenlik açısından değerlendir).
- Bildirime dokununca `cosignly://proposal/<txHash>`.

### Testnet USDC
- Circle testnet USDC issuer'ını Raven/docs'tan doğrula ve tek bir sabitte tut. Alıcının USDC trustline'ını öneri oluştururken kontrol et.
- **Doğrulandı (2026-11-18):** testnet USDC = `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` (home_domain `centre.io`; kaynak: developers.stellar.org x402 "Testnet USDC" + Anchor Platform docs; Horizon testnet'te hesap ve asset kaydı mevcut). Testnet SAC (`C...`) adresi `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` — Sprint 1'de kullanılmaz (classic trustline/payment `G...` issuer ile yapılır), karıştırma. Testnet USDC faucet: faucet.circle.com (captcha, elle).
- **Doğrulandı (2026-11-18):** Horizon `GET /accounts?signer=<G...>` dört filtreden biri (`signer`, `asset`, `liquidity_pool`, `sponsor`; aynı anda yalnızca biri). Testnet'te canlı sorgu çalışıyor. Sonuç sayfalı (`limit`, `cursor`).
- **Doğrulandı (2026-11-18, W1.2):** `?signer=` yanıtında `_links.next` **her zaman** var (son sayfada bile) → sayfalama `records.length < limit` ile durur. Ağırlığı 0 olan imzacı `?signer=` sonucunda **dönmez** (master weight 0 olan kasa kendi adresiyle bulunmaz). Ama `GET /accounts/{id}` yanıtının `signers` listesinde master key `weight: 0` ile **görünür** → kodda filtrelenir. Geçersiz adres → 400, `extras.invalid_field`.
- **Doğrulandı (2026-11-18):** Ağırlığı 0 olan anahtar, eşik 0 olsa bile imza atamaz. Eşik dolduktan sonra fazladan imza varsa işlem `TX_BAD_AUTH_EXTRA` ile başarısız olur (developers.stellar.org "Signatures and multisig") → W2.5'te eşik dolunca yeni imza ekleme.
- **SDK (2026-11-18):** `@stellar/stellar-base` npm'de deprecated ("rolled into @stellar/stellar-sdk"). `@stellar/stellar-sdk@17.4.0` kullan; base API'leri (StrKey, Keypair, TransactionBuilder, Networks, xdr) `@stellar/stellar-sdk/base` alt yolundan gelir (axios içermez). Horizon için SDK'nın `Horizon.Server`'ı yerine `packages/shared`'daki fetch tabanlı istemci (ADR 0002).
- **Polyfill (2026-11-18, W1.3):** `@stellar/stellar-sdk@17` Buffer kullanmıyor (Uint8Array; `Buffer` yalnızca `.map` dosyalarında). Mobilde gereken tek polyfill `react-native-get-random-values` (`@noble/ed25519` → `crypto.getRandomValues`), `apps/mobile/index.ts`'te Expo Router'dan önce yüklenir. Uygulama açılışta `cryptoSelfCheck()` ile rastgelelik + Ed25519'u doğrular. `buffer` / `react-native-quick-crypto` eklenmedi.
- **Expo + pnpm (2026-11-18, W1.3):** SDK 58 pnpm isolated kurulumu destekliyor (SDK 54+), Metro monorepo'yu otomatik ayarlıyor → `nodeLinker: hoisted` ve özel `metro.config.js` yok. pnpm 12: 24 saatten yeni paketler `minimumReleaseAge` ile reddedilir (istisna ekleme, bir önceki sürüme sabitle); install script'leri `allowBuilds` ile tek tek onaylanır.
- **Test araçları (2026-11-18):** TypeScript 6'da `types` varsayılanı boş → `@types/jest` gibi paketleri tsconfig `types`'a açıkça ekle. RNTL 14'te `render` / `fireEvent` / `unmount` async. Jest, SDK'nın ESM bağımlılıkları (`@noble`, `@exodus`, `uint8array-extras`) için `transformIgnorePatterns` genişletmesi istiyor; `lucide-react-native` mock'lanıyor.
- **İmzacı anahtarı / `expo-secure-store` 58.0.3 (2026-11-19, W1.4):** `requireAuthentication: true` → iOS'ta prompt **yalnızca okuma/güncellemede** çıkar (yeni kayıtta çıkmaz), Android'de her işlemde (yazarken de) çıkar → iOS'ta kayıttan hemen sonra bir kez geri okuyup doğruluyoruz. Biyometri değişince/geçersizleşince `getItemAsync` **`null` döner** (hata değil). Prompt iptali hata fırlatır (`"User canceled the operation."` iOS / `"User canceled the authentication"` Android). Kimlik doğrulamalı öğe ayrı bir `keychainService` ister. `canUseBiometricAuthentication()` senkron. Android'de `BIOMETRIC_STRONG` şart (zayıf yüz tanıma sayılmaz). Gizli anahtar `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY` (iCloud/yedek yok). iOS Keychain öğeleri uygulama silinse de kalabilir → yeniden kurulumda anahtar bulunur. Face ID metni `expo-secure-store` config plugin'inin `faceIDPermission` alanında.
- **Kasa geçmişi / rezerv (2026-11-19, W1.5):** `GET /accounts/{id}/operations?order=desc&limit=N` varsayılan olarak **başarısız işlemleri içermez** (`include_failed=false`). Kayıtlarda türe özgü alanlar düz gelir: `payment` → `from`/`to`/`amount`/`asset_*`; `create_account` → `funder`/`account`/`starting_balance`; `change_trust` → `limit` (`"0.0000000"` = trustline kaldırıldı); `set_options` → `signer_key`/`signer_weight` veya `*_threshold`/`master_key_weight`. Testnet `base_reserve_in_stroops` = 5000000 (0.5 XLM, `/ledgers` ile doğrulandı) → minimum bakiye = (2 + subentry + num_sponsoring − num_sponsored) × 0.5 XLM; 2-of-3 + USDC kasası = 3 XLM. Fixture: `packages/shared/src/horizon/__fixtures__/vault-operations.json` (gerçek: CLI ile Jordan → kasa 25 XLM, tx `b42d973f…84b7`).
- **CNG + yerel build (2026-11-19, W1.4):** `apps/mobile/ios` / `android` klasörleri bir kez üretildikten sonra `expo run:ios|android` `app.json` değişikliklerini (plugin ayarları, izin metinleri) **uygulamaz**. Config/plugin değişen her PR'dan sonra önce `npx expo prebuild --clean`. Örnek: W1.4'te `NSFaceIDUsageDescription` eksik kaldı → SecureStore `requireAuthentication` kaydı reddetti. Dev build'de hata kartı native nedeni "Details (dev only)" satırında gösterir.
- **Expo Router (2026-11-19):** `src/app/` altındaki her dosya route sayılır → testler `src/app` içine konmaz. Typed route tipleri (`.expo/types/router.d.ts`) `expo start` ile yeniden üretilir; CI'da bu dosya yok (gitignore), href'ler orada gevşek tiplenir.
- **Eşik seviyeleri / sihirbaz (2026-11-22, W2.1):** developers.stellar.org "List of operations": **low** → `bump_sequence`, `claim_claimable_balance`, `allow_trust`, `set_trustline_flags`, `extend_footprint_ttl`, `restore_footprint`; `set_options` imzacı/eşik/master weight değişikliğinde **high**, diğer alanlarda (home domain, flag) **medium**; `account_merge` **high**. Sihirbaz `low = medium` kurar (ADR 0003): aksi halde tek imzacı `bump_sequence` ile bekleyen öneriyi `tx_bad_seq` ile düşürebilir. Kullanıcıya low gösterilmez. QR taraması `expo-camera` `CameraView` (yalnızca `qr`); imzacı QR'ı düz `G...`, `stellar:G...` veya `web+stellar:pay?destination=G...` olabilir; `S...` reddedilir.
- **Klavye (2026-11-22, W2.1, iPhone 16 + Galaxy A54'te doğrulandı):** SDK 58 / Android 15+ edge-to-edge → Android'de pencere klavyeye göre küçülmez; `behavior` verilmemiş `KeyboardAvoidingView` hiçbir şey yapmaz. RN `KeyboardAvoidingView` `autoFocus`'ta (klavye ekran geçişi sırasında açılınca) yanlış hesaplar ve düzeltmez. Kullan: `components/KeyboardAvoidingScreen` (klavye olaylarında + layout'ta `measureInWindow` ile ölçer, animasyonsuz; iOS'ta `keyboardWill*` — `keyboardDidShow` animasyon bittikten sonra geldiği için geç hissettiriyor; Android'de yalnızca `keyboardDid*`). İki mod: `avoid` (footer klavyenin üstüne çıkar; `useKeyboardOpen()` ile footer alt safe-area inset'ini bırakır) ve `avoid={false}` (footer klavyenin altında kalır, sadece içerik kayar: iOS'ta ScrollView `automaticallyAdjustKeyboardInsets` inset ekleyip odaktaki input'a kendisi kaydırır; Android'de ScrollView `useKeyboardOverlap()` kadar küçültülür, Android odaktaki alanı kendisi görünür tutar). Sihirbaz: isim adımı `above`, imzacı adımı `behind`. iOS'ta `LayoutAnimation` ile kaydırma tuhaf görünüyor → kullanma. Jest'te `useSafeAreaInsets` için `SafeAreaProvider initialMetrics` gerekir.
- **Tema (2026-11-18):** `Appearance.setColorScheme('light' | 'dark' | 'auto')` (RN 0.88; `null`/`'unspecified'` değil). Native splash uygulamanın tema seçimini değil, **sistem** temasını izler (işletim sistemi kısıtı).

## 6. Araçlar

### Kurulum (ilk oturumda kontrol et)
```bash
claude mcp add --transport http stellar-raven "https://raven.stellar.org/mcp"
# Claude Code içinde: /mcp → stellar-raven → Authenticate
# Not: claude.ai hesabında "Stellar Raven" connector'ı bağlıysa bu adım gereksiz (aynı sunucu).
```
```text
/plugin marketplace add stellar/stellar-dev-skill
/plugin install stellar-dev@stellar-dev
```

### Kurallar
- **Stellar API'si hakkında tahmin yürütme.** Doğrulama sırası: `node_modules` tipleri → Raven MCP (`stellarDocs.*`, `skills.*`) → stellar-dev skill'leri (`dapp`, `data`, `assets`) → resmi docs/kaynak kod.
- Diğer kaynaklar: Expo docs (dev build, `expo-notifications`, `expo-secure-store`, `expo-router`, EAS), Cloudflare docs (Workers, D1, Cron, Wrangler), Refractor API docs, Expo Push API docs.
- Test araçları: Stellar CLI (`stellar keys generate <ad> --network testnet --fund`, 3. imzacı simülasyonu), Stellar Lab (XDR çözme), stellar.expert (testnet kanıt linkleri), `wrangler tail`.

## 7. Git ve public repo kuralları

- **Her görev = 1 branch = 1 PR.** Görev kimlikleri `docs/plan.md`'deki gibi (`W1.3` vb.). Branch adı: `w1.3-signer-key` gibi.
- Conventional Commits (`feat(mobile): …`, `fix(api): …`, `docs: …`, `chore: …`, `test(shared): …`). Küçük, anlamlı commit'ler; "WIP" commit'i main'e girmez.
- PR'ı `gh pr create` ile aç (`.github/pull_request_template.md` formatında; **How to test** bölümü zorunlu ve benim izleyebileceğim adımlarla yazılır). PR'ı ben test edip merge ederim; **main'e doğrudan push etme.**
- Her hafta bir GitHub Milestone (`Week 1`…`Week 4`), her görev bir issue. Bunları oluşturmadan önce bana listeyi göster.
- Hafta sonunda main'de tag: `week-1`, `week-2`, `week-3`, sprint sonunda `v0.1.0`.
- **Secret yok:** `.env*` gitignore'da, `.env.example` var. Secret key (`S...`), API token, service account JSON, keystore asla commit'lenmez. Commit öncesi kontrol et.
- Dış katkı kabul etmiyoruz: README ve `CONTRIBUTING.md`'de "This project is not accepting external contributions at this time." `SECURITY.md`: güvenlik açıklarının nasıl bildirileceği (benim e-postamı sormadan yazma; GitHub private vulnerability reporting öner).

## 8. Mühendislik kuralları

- pnpm workspaces (Expo için gerekli ayarlarla), TypeScript strict, ESLint + Prettier.
- Test: shared → Vitest; Worker → Vitest + `@cloudflare/vitest-pool-workers` (veya Miniflare); mobil → Jest (`jest-expo`) + React Native Testing Library. Biyometrik, push ve zincir akışları gerçek cihazda manuel test listesiyle.
- CI (GitHub Actions): typecheck, lint, test. Kırmızı CI ile PR açma.
- Kritik paket sürümlerini sabitle, `docs/decisions/versions.md`'de tut. Mimari kararlar kısa ADR olarak `docs/decisions/`.
- Varsayılan ağ testnet; mainnet kod yolu kapalı.
- **Önce sor:** Worker deploy, uzak D1 migration, EAS credentials/build/submit, GitHub milestone/issue oluşturma, yeni büyük bağımlılık, kapsamı değiştiren her şey.

## 9. Test protokolü — her PR'da ve her hafta sonunda

Her PR açıklamasının **How to test** bölümü ve her hafta sonu checkpoint'i şu formatta:

```
Ön koşullar: (cihazlar, hesaplar, env, çalışan servisler)
Komutlar: (hangi dizinde ne çalıştıracağım)
Cihazda adımlar: 1) … 2) …
CLI / Lab adımları: (2. ve 3. imzacı simülasyonu)
Beklenen sonuç: (ekran, log, D1)
Zincirde doğrulama: (stellar.expert testnet linki / Horizon URL / Refractor linki)
BAŞARILI sayılır eğer: (net kriterler)
BAŞARISIZ olursa: (hangi loglar: Metro, Xcode console, `adb logcat`, `wrangler tail`)
Kanıt: (docs/evidence.md'ye ne eklenecek)
```
Test ortamı: 1 iPhone + 1 Android (biyometrik kayıtlı) + CLI ile 3. imzacı. Testnet periyodik resetlenir; hesaplar silinirse bug değildir.

## 10. Kanıt ve raporlama (Instawards için kritik)

- `docs/evidence.md`: tarih, görev, ne kanıtlandı, link (PR, commit, stellar.expert, Refractor, video, Worker health URL). Teknik olmayan biri tıklayarak doğrulayabilmeli.
- `docs/weekly/week-N.md`: hafta sonu Chapter Lead'e gönderilecek rapor (`docs/weekly/TEMPLATE.md` formatı).
- Hafta 4: `docs/sprint-report.md` (SOW'da planlanan vs. teslim edilen), demo video çekim senaryoları.
- Her hafta sonunda bana X'te paylaşabileceğim 2-3 cümlelik bir "build in public" özeti ve paylaşılabilecek bir ekran görüntüsü/kayıt önerisi ver (teknik detay az, görsel ilerleme çok).

## 11. Benden gerekenler (ilk oturumda sor, cevapları buraya işle)

- [x] Bundle id / package name: `com.muratyayla.cosignly` · Apple Team ID: `LB743V5W75`
- [x] Expo (EAS) hesabı: `muratyayla26` · proje: henüz yok (W1.3'te `eas init` ile oluşturulacak — önce sor)
- [x] Cloudflare hesabı var · workers.dev subdomain: `murat-yayla-26` → API: `cosignly-api.murat-yayla-26.workers.dev` (spike'tan kalan `cosignly-callback-logger` Worker'ı bu projenin parçası değil)
- [ ] Firebase projesi (Hafta 3'ten önce): `__________`
- [x] Test cihazları: iPhone 16 (iOS 26.7.1), Galaxy A54 (Android 16)
- [x] `gh` CLI authenticate: evet (`muratyayla26`, scopes: repo, workflow)
