# SGS Land mobile — Store submission runbook

> Phiên bản: Sprint 7 (#57). Dùng cho buyer Phase 1 release: TestFlight +
> Google Play Internal Testing.

## 0. Chuẩn bị một lần
| Mục | Cách lấy |
|---|---|
| Apple Developer membership ($99/yr) | https://developer.apple.com/programs |
| App Store Connect app record (`vn.sgsland.buyer`) | App Store Connect → My Apps → "+" |
| `ascAppId` + `appleTeamId` | App Store Connect → App Info / Membership |
| Google Play Console account ($25 lifetime) | https://play.google.com/console |
| Play Console app record (`vn.sgsland.buyer`) | Create app → Closed testing → Internal |
| Service account JSON cho `eas submit -p android` | Play Console → Setup → API access |
| EAS account + project ID | `npx eas-cli login` → `npx eas-cli init` (dán vào `app.json` `extra.eas.projectId`) |
| Sentry project + DSN (optional) | sentry.io → Projects → Create → React Native → set `EXPO_PUBLIC_SENTRY_DSN` |

## 1. Cài thêm package native (chạy MỘT LẦN trước build production)
Các SDK bên dưới được code đã chuẩn bị dynamic-import an toàn (nếu thiếu
sẽ no-op). Trước khi build production phải cài thật để Sentry + ATT hoạt
động.

```bash
pnpm --filter @sgsland/mobile add @sentry/react-native expo-tracking-transparency
pnpm --filter @sgsland/mobile exec npx pod-install   # chỉ cần trên macOS dev
```

## 2. Build iOS → TestFlight
```bash
cd apps/mobile
npx eas-cli build -p ios --profile production --non-interactive
npx eas-cli submit -p ios --latest
```
- Build number tự tăng (`autoIncrement: true` trong `eas.json`).
- Sau khi Apple processing xong (~15-30'), vào TestFlight → External
  testing → invite team test nội bộ.

## 3. Build Android → Google Play Internal
```bash
npx eas-cli build -p android --profile production --non-interactive
npx eas-cli submit -p android --track internal --latest
```
- Build trả `.aab` sẵn sàng cho Play Console.
- Vào Play Console → Internal testing → review status.

## 4. Điền store listing
- Nội dung tiếng Việt: copy từ `apps/mobile/store-assets/listing-vi.md`.
- Screenshot: theo plan trong `apps/mobile/store-assets/README.md`.
- Privacy policy: https://sgsland.vn/privacy
- Support URL: https://sgsland.vn/support
- Data Safety form (Android): theo `docs/mobile-data-safety.md`.
- App Privacy questionnaire (iOS): map cùng dữ liệu với data-safety.md.
- Age rating: 4+ (iOS) / Everyone (Android), không UGC mở, không quảng
  cáo, không cờ bạc.

## 5. QA checklist trên thiết bị thật trước khi submit
- [ ] Đăng nhập OTP buyer (gọi hotline test 0971 132 378 nếu OTP không
      tới).
- [ ] Discover hiển thị featured projects + listings.
- [ ] Lưu tìm kiếm → push tới đúng deep-link `/bds/<slug>`.
- [ ] Tạo booking sandbox → nhập thẻ test VNPay (xem mục 6) → biên nhận
      hiện ra.
- [ ] Chat với chuyên viên thử → tin tới qua socket realtime.
- [ ] Đăng xuất → token bị xoá khỏi secure store (kiểm bằng cách re-open).
- [ ] Đổi ngôn ngữ hệ thống sang English → app vẫn hiển thị tiếng Việt
      (đúng hành vi — buyer Phase 1 chỉ VI).
- [ ] Force crash test (gọi `Sentry.nativeCrash()` từ menu dev) → event
      xuất hiện trong Sentry sau ~1 phút.

## 6. VNPay sandbox test cards (để kèm cho reviewer)
| Card | Số | OTP |
|---|---|---|
| VNPAYQR | 9704198526191432198 | OTP: 123456 |
| NCB ATM | 9704198526191432198 / 07/15 / NGUYEN VAN A | OTP: 123456 |
| VISA / Master quốc tế | 4242424242424242 / bất kỳ exp tương lai / CVV 123 | (không OTP) |

`VNPAY_ENV=sandbox` trong server `.env`. Sau khi reviewer xong, cutover:

```bash
# Server prod env
VNPAY_ENV=prod
VNPAY_TMN_CODE=<MID prod>
VNPAY_HASH_SECRET=<secret prod>
VNPAY_RETURN_URL=https://sgsland.vn/api/payments/vnpay/return
VNPAY_IPN_URL=https://sgsland.vn/api/payments/vnpay/ipn
```
Đối chiếu với VNPay merchant portal (URL được echo trong boot log
`[VNPay] env=… return=… ipn=…`).

## 7. Reviewer test account
- **Phone:** +84 999 000 999
- **OTP:** Apple/Google reviewer dùng OTP cố định `888888` trong tài
  khoản này (chỉ active khi `BUYER_OTP_REVIEWER_BYPASS=phone` set ở
  server `.env`). Tham khảo skill `app-store-review` để bật/tắt cờ.
- Tài khoản này không có lịch sử booking thật — reviewer dùng để chạy
  full flow sandbox.

## 8. Out of scope (không làm trong Sprint 7)
- Production launch public (chỉ submit Internal/TestFlight).
- Localization English / others.
- iPad-specific layout (vẫn `supportsTablet: true` để chạy iPad scaled).
- App Clip / Android Instant App.

## 9. Checklist trước khi nhấn Submit
- [ ] `app.json`: `version` + `ios.buildNumber` + `android.versionCode`
      đã bump (auto qua EAS).
- [ ] Đặt `extra.eas.projectId` trong `app.json` (rỗng trong repo cho
      ai chưa khởi tạo).
- [ ] `eas.json` `submit.production.ios.ascAppId` + `appleTeamId` đã
      thay từ placeholder `REPLACE_WITH_…`.
- [ ] `EXPO_PUBLIC_API_BASE_URL=https://sgsland.vn` (đã sẵn trong build
      production env).
- [ ] Sentry DSN đã set ở EAS secrets (`eas secret:create --scope project
      --name EXPO_PUBLIC_SENTRY_DSN --value <dsn>`).
- [ ] Privacy policy + Support URL public 200 OK.
- [ ] Data safety form đã submit (Android) / Privacy questionnaire (iOS).
- [ ] Reviewer test account verified.
