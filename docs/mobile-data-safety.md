# Google Play Data Safety form — SGS Land (vn.sgsland.buyer)

> Phiên bản tài liệu: Sprint 7 (#57). Dùng làm script điền vào Play Console
> → **Policy → App content → Data safety**. Nguồn truth của các quyền là
> `apps/mobile/app.json` (block `android.permissions` + `ios.infoPlist`).

## Tóm tắt
| Mục | Kết quả |
|---|---|
| App có thu thập dữ liệu người dùng? | **Có** |
| Dữ liệu có chia sẻ với bên thứ ba? | **Có** (chỉ chuyên viên đại lý mà người dùng chủ động liên hệ + nhà cung cấp hạ tầng) |
| Dữ liệu có mã hoá khi truyền? | **Có** — toàn bộ traffic qua HTTPS / WSS |
| Người dùng có thể yêu cầu xoá dữ liệu? | **Có** — qua hotline 0971 132 378 hoặc email privacy@sgsland.vn |
| App tuân thủ Play Families Policy? | Không áp dụng (target 18+) |

## Loại dữ liệu thu thập

### Personal info
| Trường | Bắt buộc? | Mục đích | Chia sẻ? |
|---|---|---|---|
| Tên hiển thị | Tuỳ chọn | Hiển thị trong chat / profile | Có (với chuyên viên người dùng liên hệ) |
| Số điện thoại | Bắt buộc cho buyer login | Đăng nhập OTP, callback từ chuyên viên | Có (với chuyên viên người dùng liên hệ) |
| Email | Tuỳ chọn (chỉ khi đặt cọc) | Gửi biên nhận VNPay | Không (Brevo SMTP, transactional only) |

### Financial info
| Trường | Bắt buộc? | Mục đích |
|---|---|---|
| Số tiền đặt cọc | Bắt buộc khi tạo booking | Khởi tạo giao dịch VNPay |
| Mã giao dịch VNPay | Tự sinh | Đối soát thanh toán |

> **Số thẻ / số tài khoản ngân hàng:** KHÔNG thu thập trong app — toàn bộ
> nhập trên trang VNPay (PCI-DSS) qua `expo-web-browser`. App chỉ thấy mã
> giao dịch + trạng thái.

### Messages
| Trường | Mục đích |
|---|---|
| Nội dung tin nhắn user ↔ chuyên viên | Hiển thị lại cho hai bên qua Socket.IO |

### App activity
| Trường | Mục đích |
|---|---|
| Tin đăng đã xem / đã lưu | Cá nhân hoá Discover, "Lưu tìm kiếm" |
| Sự kiện crash + performance | Sentry — chỉ khi user **không** từ chối ATT |

### Device / other IDs
| Trường | Mục đích |
|---|---|
| Expo push token | Gửi thông báo đẩy về sản phẩm mới + tin nhắn mới |
| IDFA (iOS) / Advertising ID (Android) | **Chỉ** khi user chấp nhận ATT — dùng đo lường ẩn danh |

### Location
| Trường | Mục đích |
|---|---|
| Vị trí coarse / fine | Sắp xếp BĐS theo khoảng cách. **Không** chạy nền — chỉ khi user mở màn `Map`. |

## Bên thứ ba được chia sẻ
| Bên | Dữ liệu | Mục đích |
|---|---|---|
| VNPay | Mã giao dịch + amount | Xử lý thanh toán đặt cọc |
| Brevo (Sendinblue) | Email + tên | Gửi biên nhận giao dịch |
| Expo Push Service / FCM / APNs | Push token | Phân phối thông báo |
| Sentry | Crash log (stack, OS, version) | Sửa lỗi |
| Chuyên viên SGS Land | Phone + nội dung chat | Tư vấn khi user chủ động liên hệ |

## Quyền truy cập (justify cho reviewer)
| Quyền | Khai báo | Lý do |
|---|---|---|
| INTERNET / ACCESS_NETWORK_STATE | required | Gọi API + WebSocket |
| CAMERA | optional, runtime prompt | Đính kèm ảnh BĐS / giấy tờ trong chat |
| READ_MEDIA_IMAGES | optional, runtime prompt | Chọn ảnh từ thư viện để gửi |
| ACCESS_*_LOCATION | optional, runtime prompt | Sắp xếp BĐS theo khoảng cách |
| POST_NOTIFICATIONS | optional, runtime prompt | Báo BĐS mới + tin nhắn |
| VIBRATE | trivial | Haptic feedback |

## Endpoint xoá dữ liệu (Play Data Deletion URL)
- URL công khai: https://sgsland.vn/account/delete
- Hành động: xác minh OTP → xoá row `buyer_users`, ẩn lịch sử chat, huỷ
  push token. Bookings PAID giữ lại (nghĩa vụ kế toán) nhưng ẩn PII.
