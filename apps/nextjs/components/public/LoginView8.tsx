// @ts-nocheck
"use client";
import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { AreaChart, Area, YAxis, ResponsiveContainer } from 'recharts';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLang } from '@/components/shared/useLang';

// ---- Next.js adapters (ported from Vite root pages/Login.tsx) ----
const ROUTES = { LANDING: '', LOGIN: 'login', DASHBOARD: 'dashboard', CHECKOUT: 'checkout' };

const Logo = ({ className, strokeWidth }: any) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth || 2} strokeLinejoin="round">
    <path d="M12 2 3 7l9 5 9-5-9-5Z" />
    <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
  </svg>
);

const DICT: Record<string, string> = {
        "auth.btn_login": "Đăng Nhập",
        "auth.login_subtitle": "Truy cập không gian làm việc số dành cho chuyên gia.",
        "auth.welcome": "Chào mừng trở lại",
        "auth.register_title": "Đăng Ký Đối Tác",
        "auth.register_subtitle": "Tham gia mạng lưới phân phối BĐS công nghệ cao.",
        "auth.reset_title": "Khôi Phục Mật Khẩu",
        "auth.reset_subtitle": "Nhập email công việc để nhận hướng dẫn.",
        "auth.set_new_pass": "Thiết Lập Mật Khẩu Mới",
        "auth.label_email": "Email công việc",
        "auth.label_password": "Mật khẩu",
        "auth.placeholder_email": "ten@doanhnghiep.vn",
        "auth.placeholder_password": "Nhập mật khẩu...",
        "auth.forgot_password": "Quên mật khẩu?",
        "auth.btn_register": "Đăng Ký Ngay",
        "auth.btn_reset": "Gửi Yêu Cầu",
        "auth.btn_change_pass": "Đổi Mật Khẩu",
        "auth.or": "HOẶC",
        "auth.sso_login": "Đăng nhập với SSO",
        "auth.password_login": "Đăng nhập truyền thống",
        "auth.google_login": "Tiếp tục với Google Workspace",
        "auth.has_account": "Đã có tài khoản?",
        "auth.no_account": "Chưa có tài khoản?",
        "auth.login_link": "Đăng nhập",
        "auth.register_link": "Đăng ký",
        "auth.back_to_login": "Quay lại đăng nhập",
        "auth.terms_agreement": "Việc đăng ký đồng nghĩa với việc chấp thuận Điều khoản dịch vụ & Chính sách bảo mật.",
        "auth.copyright": "© 2026 SGS Land Corp. All rights reserved.",
        "auth.privacy": "Chính Sách Bảo Mật",
        "auth.terms": "Điều Khoản Sử Dụng",
        "auth.secure_badge": "Bảo mật SSL 256-bit Enterprise",
        "auth.label_name": "Họ và Tên",
        "auth.placeholder_name": "Nguyễn Văn A",
        "auth.label_company": "Tên Doanh Nghiệp / Đội Nhóm",
        "auth.optional": "(Tùy chọn)",
        "auth.placeholder_company": "SGS Corp...",
        "auth.placeholder_company_optional": "SGS Corp... (để trống nếu cá nhân)",
        "auth.remember_me": "Ghi nhớ thiết bị này",
        "auth.b2b_nudge": "Khuyên dùng email doanh nghiệp cho tài khoản B2B.",
        "auth.otp_sent_msg": "Chúng tôi đã gửi link đặt lại mật khẩu tới:",
        "auth.otp_instruction": "Mở email và nhấn nút 'Đặt lại mật khẩu'. Nếu cần, sao chép token từ URL vào ô bên dưới.",
        "auth.security_token": "Token xác thực (từ link email)",
        "auth.placeholder_otp": "Dán token từ link email...",
        "auth.error_company_required": "Vui lòng nhập tên doanh nghiệp",
        "auth.google_coming_soon": "Đăng nhập Google Workspace đang được tích hợp. Vui lòng dùng email & mật khẩu.",
        "auth.error_email_exists": "Email này đã được đăng ký. Vui lòng đăng nhập.",
        "auth.error_invalid_creds": "Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.",
        "auth.error_sso_disabled": "SSO chưa được kích hoạt cho tổ chức này. Liên hệ quản trị viên.",
        "auth.error_token_expired": "Token đã hết hạn hoặc không hợp lệ. Vui lòng gửi lại yêu cầu.",
        "auth.dev_token_notice": "[DEV] Email không được gửi (SMTP chưa cấu hình). Token:",
        "auth.market_velocity": "Tốc độ thị trường",
        "auth.live": "Trực tiếp",
        "auth.trusted_by": "Đối tác tin cậy:",
        "auth.connecting_google": "Đang kết nối Google...",
        "auth.processing": "Đang xử lý...",
        "auth.error_email_required": "Vui lòng nhập email",
        "auth.error_email_invalid": "Định dạng email không hợp lệ",
        "auth.error_password_required": "Vui lòng nhập mật khẩu",
        "auth.vendor_onboard_hint": "Bạn sẽ trở thành Quản trị viên của một workspace SGS Land riêng — bao gồm CRM, kho BĐS và phân quyền nhân viên. Dùng thử miễn phí 14 ngày, không cần thẻ. Tài khoản được xét duyệt bởi quản trị viên.",
        "auth.sales_onboard_hint": "Bạn sẽ tham gia với vai trò Nhân viên trong hệ thống SGS Land — truy cập CRM, lead, kho hàng và công cụ tư vấn. Không cần xét duyệt, đăng nhập ngay sau khi xác thực email.",
        "auth.role_vendor_badge": "→ Vendor / Doanh nghiệp",
        "auth.role_sales_badge": "→ Nhân viên kinh doanh",
        "auth.register_tab_sales": "Nhân viên",
        "auth.register_tab_vendor": "Công ty",
        "auth.label_company_team": "Doanh nghiệp / Đội nhóm",
        "auth.placeholder_company_team": "Tên doanh nghiệp hoặc đội nhóm",
        "auth.error_password_weak": "Mật khẩu cần mạnh hơn (8+ ký tự, số, chữ hoa)",
        "auth.error_name_required": "Vui lòng nhập họ tên",
        "auth.error_token_required": "Mã xác thực không hợp lệ",
        "auth.pass_changed_success": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
        "auth.success_reset": "Email hướng dẫn đã được gửi.",
        "auth.verify_email_title": "Kiểm tra hộp thư của bạn",
        "auth.verify_email_subtitle": "Chúng tôi đã gửi mã OTP 6 số đến email đăng ký.",
        "auth.pending_approval_title": "Đang chờ phê duyệt",
        "auth.pending_approval_subtitle": "Workspace của bạn đang chờ SGS Land xem xét.",
        "auth.pending_approval_heading": "Đang Chờ Phê Duyệt",
        "auth.pending_approval_email_verified": "Email đã xác minh thành công.",
        "auth.pending_approval_desc": "Workspace của bạn đang chờ SGS Land xem xét và phê duyệt. Bạn sẽ nhận được email thông báo khi được chấp thuận.",
        "auth.pending_approval_process": "Quá trình xét duyệt:",
        "auth.pending_approval_step1": "Đội ngũ SGS Land sẽ xem xét thông tin đăng ký",
        "auth.pending_approval_step2": "Thời gian xét duyệt thường trong vòng 1–2 ngày làm việc",
        "auth.pending_approval_step3": "Bạn sẽ nhận email thông báo kết quả",
        "auth.btn_back_login": "Quay lại đăng nhập",
        "auth.rejected_title": "Đăng ký không được chấp thuận",
        "auth.rejected_subtitle": "Yêu cầu mở workspace của bạn chưa được duyệt.",
        "auth.rejected_heading": "Đăng Ký Không Được Chấp Thuận",
        "auth.rejected_account_label": "Tài khoản:",
        "auth.rejected_desc_before": "Workspace của bạn chưa được chấp thuận. Vui lòng kiểm tra email để biết lý do và liên hệ",
        "auth.rejected_desc_after": "để được hỗ trợ thêm.",
        "auth.verify_email_sent_to": "Mã xác minh đã được gửi tới:",
        "auth.verify_email_instruction": "Nhập mã 6 số trong email. Mã có hiệu lực trong 5 phút.",
        "auth.verify_email_code_label": "Số mã",
        "auth.verify_email_expires": "Mã hết hạn sau",
        "auth.verify_email_confirm": "Xác nhận mã",
        "auth.verify_email_verifying": "Đang xác minh...",
        "auth.verify_email_resend": "Gửi lại mã OTP",
        "auth.verify_email_resending": "Đang gửi...",
        "auth.verify_email_resent": "Đã gửi lại! Kiểm tra hộp thư của bạn.",
        "auth.verify_email_back_login": "Quay lại đăng nhập",
        "auth.verify_email_not_verified": "Email chưa được xác minh. Vui lòng kiểm tra hộp thư và nhấn link xác minh.",
        "auth.verify_email_resend_error": "Không thể gửi lại email. Vui lòng thử lại sau.",
        "auth.verify_email_success": "Email đã được xác minh! Đang đăng nhập...",
        "auth.verify_email_invalid": "Mã OTP không đúng. Vui lòng kiểm tra lại.",
        "auth.verify_email_expired": "Mã OTP đã hết hạn. Vui lòng gửi mã mới.",
        "auth.verify_email_rate_limited": "Bạn đã yêu cầu quá nhiều mã. Vui lòng thử lại sau.",
        "auth.mock_dev_msg": "[DEV MODE] Email: {email}, Token: {token}",
        "auth.error_rate_limit": "Quá nhiều lần thử. Vui lòng chờ vài phút và thử lại.",
        "auth.error_generic": "Đã có lỗi xảy ra. Vui lòng thử lại sau.",
        "auth.marketing_login_title": "Hệ Điều Hành Bất Động Sản Số 1",
        "auth.marketing_login_desc": "Tích hợp AI Định giá, Quản lý giao dịch và CRM đa kênh trên một nền tảng duy nhất.",
        "auth.marketing_register_title": "Chuyển Đổi Số Toàn Diện",
        "auth.marketing_register_desc": "Gia nhập cộng đồng 15,000+ môi giới công nghệ và tiếp cận nguồn hàng độc quyền.",
        "auth.marketing_reset_title": "Bảo Mật Tiêu Chuẩn Cao",
        "auth.marketing_reset_desc": "Hệ thống bảo vệ dữ liệu khách hàng với xác thực đa lớp và mã hóa đầu cuối.",
        "auth.mock_revenue": "Doanh thu tháng",
        "auth.mock_revenue_trend": "Tăng trưởng 12%",
        "auth.mock_deals": "Giao dịch thành công",
        "auth.mock_deals_trend": "24 deal mới",
        "auth.weak": "Yếu",
        "auth.medium": "Trung bình",
        "auth.strong": "Mạnh",
        "auth.new_pass_label": "Mật khẩu mới",
        "auth.new_pass_subtitle": "Đặt mật khẩu mới cho tài khoản của bạn.",
        "auth.show_password": "Hiện mật khẩu",
        "auth.hide_password": "Ẩn mật khẩu",
        "auth.password_strength": "Độ mạnh mật khẩu",
        "auth.check_email_subtitle": "Chúng tôi đã gửi link khôi phục tới hộp thư của bạn.",
        "auth.check_email_title": "Kiểm tra hộp thư",
        "auth.check_email_body": "Chúng tôi đã gửi link đặt lại mật khẩu đến",
        "auth.check_email_instruction": "Nhấn vào link trong email để tiếp tục.",
        "auth.check_email_spam": "Không thấy email? Hãy kiểm tra thư mục Spam.",
        "auth.resend_reset_email": "Gửi lại email",
        "auth.resend_reset_sending": "Đang gửi...",
        "auth.resend_reset_sent": "Đã gửi lại! Kiểm tra hộp thư của bạn.",
        "auth.paste_token_prompt": "Đã có link đặt lại mật khẩu? Dán vào đây",
        "auth.paste_token_label": "Dán link hoặc mã token từ email:",
        "auth.paste_token_confirm": "Xác nhận & Đặt mật khẩu mới",
        "auth.valid_reset_link": "Liên kết hợp lệ. Vui lòng nhập mật khẩu mới bên dưới.",
        "nav.logo_label": "SGS LAND",
        "nav.brand_subtitle": "ENTERPRISE",
        "nav.public_market": "Sàn Giao Dịch",
        "nav.go_to_dashboard": "Vào Dashboard",
        "nav.toggle_sidebar": "Ẩn/Hiện thanh bên",
        "nav.mode_switch": "Giao diện",
        "nav.mode_dark": "Chế độ tối",
        "nav.mode_light": "Chế độ sáng",
        "nav.lang_switch": "Ngôn ngữ",
        "nav.notifications": "Thông báo",
        "nav.mark_all_read": "Đánh dấu tất cả đã đọc",
        "nav.no_notifications": "Không có thông báo nào",
        "format.billion": "Tỷ",
        "format.million": "Triệu",
        "legal.PinkBook": "Sổ Hồng",
        "legal.Contract": "HĐMB",
        "legal.Waiting": "Đang chờ sổ/Vi bằng",
        "legal.back_home": "Về Trang Chủ",
        "legal.last_updated": "Cập nhật lần cuối",
        "legal.privacy_title": "Chính Sách Bảo Mật",
        "legal.terms_title": "Điều Khoản Dịch Vụ",
        "legal.cookies_title": "Cài Đặt Cookies",
        "legal.cookie_desc": "Tùy chỉnh cách chúng tôi sử dụng cookies trên trình duyệt của bạn.",
        "legal.cookie_essential": "Thiết Yếu",
        "legal.cookie_essential_desc": "Bắt buộc để trang web hoạt động (Đăng nhập, Bảo mật).",
        "legal.cookie_analytics": "Phân Tích",
        "legal.cookie_analytics_desc": "Giúp chúng tôi cải thiện trải nghiệm người dùng.",
        "legal.cookie_marketing": "Tiếp Thị",
        "legal.cookie_marketing_desc": "Sử dụng để hiển thị quảng cáo phù hợp.",
        "legal.save_pref": "Lưu Tùy Chọn",
        "legal.saved_changes": "Đã Lưu Thay Đổi",
        "legal.cookie_about_title": "Về Cookies & Dữ Liệu",
        "legal.cookie_about_desc": "Cookies là các tệp dữ liệu nhỏ được lưu trữ trên thiết bị của bạn. SGS Land sử dụng chúng để cá nhân hóa trải nghiệm, phân tích lưu lượng truy cập và đảm bảo an toàn cho phiên đăng nhập của bạn. Chúng tôi tuân thủ nghiêm ngặt các quy định về bảo mật dữ liệu.",
        "legal.header": "SGS PHÁP LÝ",
};
const EN_DICT: Record<string, string> = {
        "auth.btn_login": "Login",
        "auth.login_subtitle": "Access the digital workspace for professionals.",
        "auth.welcome": "Welcome Back",
        "auth.register_title": "Partner Registration",
        "auth.register_subtitle": "Join the high-tech real estate distribution network.",
        "auth.reset_title": "Reset Password",
        "auth.reset_subtitle": "Enter your work email to receive instructions.",
        "auth.set_new_pass": "Set New Password",
        "auth.label_email": "Work Email",
        "auth.label_password": "Password",
        "auth.placeholder_email": "name@company.com",
        "auth.placeholder_password": "Enter password...",
        "auth.forgot_password": "Forgot password?",
        "auth.btn_register": "Register Now",
        "auth.btn_reset": "Send Request",
        "auth.btn_change_pass": "Change Password",
        "auth.or": "OR",
        "auth.sso_login": "Login with SSO",
        "auth.password_login": "Traditional Login",
        "auth.google_login": "Continue with Google Workspace",
        "auth.has_account": "Already have an account?",
        "auth.no_account": "No account yet?",
        "auth.login_link": "Login",
        "auth.register_link": "Register",
        "auth.back_to_login": "Back to Login",
        "auth.terms_agreement": "Registration implies acceptance of Terms of Service & Privacy Policy.",
        "auth.copyright": "© 2026 SGS Land Corp. All rights reserved.",
        "auth.privacy": "Privacy Policy",
        "auth.terms": "Terms of Use",
        "auth.secure_badge": "256-bit Enterprise SSL Security",
        "auth.label_name": "Full Name",
        "auth.placeholder_name": "John Doe",
        "auth.label_company": "Company / Team Name",
        "auth.optional": "(Optional)",
        "auth.placeholder_company": "SGS Corp...",
        "auth.placeholder_company_optional": "SGS Corp... (leave blank for individual)",
        "auth.remember_me": "Remember this device",
        "auth.b2b_nudge": "Business email recommended for B2B accounts.",
        "auth.otp_sent_msg": "We have sent a password reset link to:",
        "auth.otp_instruction": "Open your email and click 'Reset Password'. If needed, paste the token from the URL below.",
        "auth.security_token": "Verification Token (from email link)",
        "auth.placeholder_otp": "Paste token from email link...",
        "auth.error_company_required": "Please enter company name",
        "auth.google_coming_soon": "Google Workspace login is being integrated. Please use email & password.",
        "auth.error_email_exists": "This email is already registered. Please login instead.",
        "auth.error_invalid_creds": "Incorrect email or password. Please check again.",
        "auth.error_sso_disabled": "SSO is not enabled for this organisation. Please contact your administrator.",
        "auth.error_token_expired": "Token has expired or is invalid. Please submit a new request.",
        "auth.dev_token_notice": "[DEV] Email not sent (SMTP not configured). Token:",
        "auth.market_velocity": "Market Velocity",
        "auth.live": "Live",
        "auth.trusted_by": "Trusted By:",
        "auth.connecting_google": "Connecting to Google...",
        "auth.processing": "Processing...",
        "auth.error_email_required": "Please enter email",
        "auth.error_email_invalid": "Invalid email format",
        "auth.error_password_required": "Please enter password",
        "auth.vendor_onboard_hint": "You'll become the Admin of your own SGS Land workspace — CRM, listing inventory and team permissions included. 14-day free trial, no card required. Account is subject to approval by an administrator.",
        "auth.sales_onboard_hint": "You'll join as an Employee in the SGS Land system — with access to CRM, leads, inventory, and advisory tools. No approval required — log in right after verifying your email.",
        "auth.role_vendor_badge": "→ Vendor / Business",
        "auth.role_sales_badge": "→ Sales Agent",
        "auth.register_tab_sales": "Employee",
        "auth.register_tab_vendor": "Company",
        "auth.label_company_team": "Business / Team",
        "auth.placeholder_company_team": "Business or team name",
        "auth.error_password_weak": "Password needs to be stronger (8+ chars, number, uppercase)",
        "auth.error_name_required": "Please enter full name",
        "auth.error_token_required": "Invalid verification code",
        "auth.pass_changed_success": "Password changed successfully. Please login again.",
        "auth.success_reset": "Instruction email has been sent.",
        "auth.verify_email_title": "Check your inbox",
        "auth.verify_email_subtitle": "We sent a 6-digit verification code to your registration email.",
        "auth.pending_approval_title": "Pending Approval",
        "auth.pending_approval_subtitle": "Your workspace is under review by SGS Land.",
        "auth.pending_approval_heading": "Pending Approval",
        "auth.pending_approval_email_verified": "Email successfully verified.",
        "auth.pending_approval_desc": "Your workspace is awaiting review and approval by SGS Land. You will receive an email notification once approved.",
        "auth.pending_approval_process": "Review process:",
        "auth.pending_approval_step1": "The SGS Land team will review your registration details",
        "auth.pending_approval_step2": "Review typically takes 1–2 business days",
        "auth.pending_approval_step3": "You will receive an email with the outcome",
        "auth.btn_back_login": "Back to login",
        "auth.rejected_title": "Registration Not Approved",
        "auth.rejected_subtitle": "Your workspace request was not approved.",
        "auth.rejected_heading": "Registration Not Approved",
        "auth.rejected_account_label": "Account:",
        "auth.rejected_desc_before": "Your workspace has not been approved. Please check your email for the reason and contact",
        "auth.rejected_desc_after": "for further assistance.",
        "auth.verify_email_sent_to": "Verification code sent to:",
        "auth.verify_email_instruction": "Enter the 6-digit code from the email. It expires in 5 minutes.",
        "auth.verify_email_code_label": "Code digit",
        "auth.verify_email_expires": "Code expires in",
        "auth.verify_email_confirm": "Verify code",
        "auth.verify_email_verifying": "Verifying...",
        "auth.verify_email_resend": "Resend OTP",
        "auth.verify_email_resending": "Sending...",
        "auth.verify_email_resent": "Sent! Check your inbox.",
        "auth.verify_email_back_login": "Back to login",
        "auth.verify_email_not_verified": "Email not verified. Please check your inbox and click the verification link.",
        "auth.verify_email_resend_error": "Unable to resend email. Please try again later.",
        "auth.verify_email_success": "Email verified! Logging in...",
        "auth.verify_email_invalid": "The OTP is incorrect. Please check and try again.",
        "auth.verify_email_expired": "The OTP has expired. Please request a new code.",
        "auth.verify_email_rate_limited": "Too many code requests. Please try again later.",
        "auth.mock_dev_msg": "[DEV MODE] Email: {email}, Token: {token}",
        "auth.error_rate_limit": "Too many attempts. Please wait a few minutes and try again.",
        "auth.error_generic": "An error occurred. Please try again later.",
        "auth.marketing_login_title": "#1 Digital Real Estate OS",
        "auth.marketing_login_desc": "Integrating AI Valuation, Transaction Management and Omnichannel CRM on a single platform.",
        "auth.marketing_register_title": "Comprehensive Digital Transformation",
        "auth.marketing_register_desc": "Join a community of 15,000+ tech agents and access exclusive inventory.",
        "auth.marketing_reset_title": "High Standard Security",
        "auth.marketing_reset_desc": "System protecting customer data with multi-layer authentication and end-to-end encryption.",
        "auth.mock_revenue": "Monthly Revenue",
        "auth.mock_revenue_trend": "Growth 12%",
        "auth.mock_deals": "Successful Deals",
        "auth.mock_deals_trend": "24 new deals",
        "auth.weak": "Weak",
        "auth.medium": "Medium",
        "auth.strong": "Strong",
        "auth.new_pass_label": "New Password",
        "auth.show_password": "Show password",
        "auth.hide_password": "Hide password",
        "auth.password_strength": "Password strength",
        "auth.new_pass_subtitle": "Set a new password for your account.",
        "auth.check_email_subtitle": "We have sent a recovery link to your inbox.",
        "auth.check_email_title": "Check your inbox",
        "auth.check_email_body": "We have sent a password reset link to",
        "auth.check_email_instruction": "Click the link in the email to continue.",
        "auth.check_email_spam": "Can't find the email? Check your Spam folder.",
        "auth.resend_reset_email": "Resend email",
        "auth.resend_reset_sending": "Sending...",
        "auth.resend_reset_sent": "Sent! Check your inbox.",
        "auth.paste_token_prompt": "Already have a reset link? Paste it here",
        "auth.paste_token_label": "Paste the link or token from your email:",
        "auth.paste_token_confirm": "Confirm & Set New Password",
        "auth.valid_reset_link": "Link is valid. Please enter your new password below.",
        "nav.logo_label": "SGS LAND",
        "nav.brand_subtitle": "ENTERPRISE",
        "nav.public_market": "Marketplace",
        "nav.go_to_dashboard": "Go to Dashboard",
        "nav.toggle_sidebar": "Toggle Sidebar",
        "nav.mode_switch": "Theme",
        "nav.mode_dark": "Dark Mode",
        "nav.mode_light": "Light Mode",
        "nav.lang_switch": "Language",
        "nav.notifications": "Notifications",
        "nav.mark_all_read": "Mark all as read",
        "nav.no_notifications": "No notifications yet",
        "format.billion": "Billion",
        "format.million": "Million",
        "legal.PinkBook": "Pink Book",
        "legal.Contract": "Sales Contract",
        "legal.Waiting": "Waiting for Title",
        "legal.back_home": "Back to Home",
        "legal.last_updated": "Last updated",
        "legal.privacy_title": "Privacy Policy",
        "legal.terms_title": "Terms of Service",
        "legal.cookies_title": "Cookie Settings",
        "legal.cookie_desc": "Customize how we use cookies on your browser.",
        "legal.cookie_essential": "Essential",
        "legal.cookie_essential_desc": "Required for site to work (Login, Security).",
        "legal.cookie_analytics": "Analytics",
        "legal.cookie_analytics_desc": "Help us improve user experience.",
        "legal.cookie_marketing": "Marketing",
        "legal.cookie_marketing_desc": "Used to show relevant ads.",
        "legal.save_pref": "Save Preferences",
        "legal.saved_changes": "Changes Saved",
        "legal.cookie_about_title": "About Cookies & Data",
        "legal.cookie_about_desc": "Cookies are small data files stored on your device. SGS Land uses them to personalize your experience, analyze traffic, and secure your login session. We strictly comply with data privacy regulations.",
        "legal.header": "SGS LEGAL",
};


function useTranslation() {
  const _urlLang = useLang();
  const [language, setLanguage] = React.useState(_urlLang === 'en' ? 'en' : 'vn');
  React.useEffect(() => { setLanguage(_urlLang === 'en' ? 'en' : 'vn'); }, [_urlLang]);
  const t = (key: string, params?: Record<string, any>) => {
    const _src = language === 'en' ? EN_DICT : DICT; let s = _src[key] !== undefined ? _src[key] : (DICT[key] !== undefined ? DICT[key] : key);
    if (params) s = s.replace(/{(\w+)}/g, (_: string, k: string) => (params[k] !== undefined ? String(params[k]) : '{' + k + '}'));
    return s;
  };
  const formatCurrency = (a: number) => (!a ? '0 ₫' : Math.round(a).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₫');
  return { t, formatCurrency, language, setLanguage, lang: language };
}

// Relative /api/* is proxied to Express by next.config rewrites(). Add CSRF header on writes.
function _csrf(): string | null { if (typeof document === 'undefined') return null; const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/); return m ? decodeURIComponent(m[1]) : null; }
async function _api(url: string, opts: any) {
  opts = opts || {};
  const headers: any = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  const method = (opts.method || 'GET').toUpperCase();
  if (method !== 'GET') { let t = _csrf(); if (!t) { try { await fetch('/api/auth/me', { credentials: 'include' }); } catch (e) {} t = _csrf(); } if (t) headers['X-CSRF-Token'] = t; }
  return fetch(url, Object.assign({ credentials: 'include' }, opts, { headers }));
}
const db: any = {
  async authenticate(email: string, password: string) {
    const res = await _api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      const e: any = new Error(err.error || 'Login failed');
      if (err.error === 'TWO_FACTOR_REQUIRED' || err.code === 'TWO_FACTOR_REQUIRED') e.code = 'TWO_FACTOR_REQUIRED';
      else if (err.error === 'EMAIL_NOT_VERIFIED') { e.code = 'EMAIL_NOT_VERIFIED'; e.email = err.email || email; }
      else if (err.error === 'TENANT_PENDING_APPROVAL') { e.code = 'TENANT_PENDING_APPROVAL'; e.email = err.email || email; }
      else if (err.error === 'TENANT_REJECTED') { e.code = 'TENANT_REJECTED'; e.email = err.email || email; }
      throw e;
    }
    const data = await res.json(); try { window.dispatchEvent(new CustomEvent('auth:login')); } catch (e) {} return data.user;
  },
  async authenticateWithTotp(email: string, password: string, totpToken: string) {
    const res = await _api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password, totpToken }) });
    if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Login failed' })); throw new Error(err.error || 'Invalid code'); }
    const data = await res.json(); try { window.dispatchEvent(new CustomEvent('auth:login')); } catch (e) {} return data.user;
  },
  async authenticateViaSSO(email: string) {
    const res = await _api('/api/auth/sso', { method: 'POST', body: JSON.stringify({ email }) });
    if (!res.ok) { const err = await res.json().catch(() => ({ error: 'SSO login failed' })); throw new Error(err.error || 'SSO login failed'); }
    const data = await res.json(); return data.user;
  },
  async register(name: string, email: string, password: string, company?: string) {
    const res = await _api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, company }) });
    if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Registration failed' })); throw new Error(err.error || 'Registration failed'); }
    return res.json();
  },
  async onboardVendor(company: string | undefined, name: string, email: string, password: string, phone?: string) {
    const res = await _api('/api/auth/onboard-vendor', { method: 'POST', body: JSON.stringify({ company: company || undefined, name, email, password, phone }) });
    if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Onboarding failed' })); throw new Error(err.error || 'Onboarding failed'); }
    return res.json();
  },
  async requestEmailOtp(email: string, locale?: string) {
    const res = await _api('/api/auth/request-otp', { method: 'POST', body: JSON.stringify({ email, locale }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e: any = new Error(data.error || 'Failed to request code'); e.code = data.error; throw e; }
    return data;
  },
  async verifyEmailOtp(email: string, code: string) {
    const res = await _api('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, code }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e: any = new Error(data.error || 'Verification failed'); e.code = data.error; throw e; }
    if (data.user) try { window.dispatchEvent(new CustomEvent('auth:login')); } catch (e) {}
    return data;
  },
  async requestPasswordReset(email: string) {
    const res = await _api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Failed to request password reset'); }
    return res.json();
  },
  async resetPassword(token: string, newPassword: string) {
    const res = await _api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { throw new Error(data.error || 'Failed to reset password'); }
    return data;
  },
};

interface LoginProps {
  onLoginSuccess: () => void;
}
// -----------------------------------------------------------------------------
//  CONSTANTS & CONFIG
// -----------------------------------------------------------------------------
const AUTH_CONFIG = {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    // Check for free email providers to encourage business email usage in B2B
    FREE_EMAIL_DOMAINS: ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'],
    BG_IMAGE: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop",
    PASSWORD_MIN_LENGTH: 8
};
// Mock Data for the Marketing Chart (Simulating Market Trends)
const CHART_DATA = [
    { value: 4000 }, { value: 3000 }, { value: 2000 }, { value: 2780 },
    { value: 1890 }, { value: 2390 }, { value: 3490 }, { value: 4200 },
    { value: 3800 }, { value: 5000 }, { value: 4600 }, { value: 5500 },
    { value: 6000 }
];
// -----------------------------------------------------------------------------
//  UTILITIES
// -----------------------------------------------------------------------------
const calculatePasswordStrength = (password: string): number => {
    let score = 0;
    if (!password) return 0;
    if (password.length > 5) score++;
    if (password.length >= AUTH_CONFIG.PASSWORD_MIN_LENGTH) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    return score;
};
// -----------------------------------------------------------------------------
//  SUB-COMPONENT: MARKETING COLUMN (ENHANCED)
// -----------------------------------------------------------------------------
const MarketingColumn = memo(({ view, t }: { view: string, t: any }) => {    
    const content = useMemo(() => {
        const prefix = view === 'REGISTER' ? 'register' : view.startsWith('FORGOT') ? 'reset' : 'login';
        return {
            title: t(`auth.marketing_${prefix}_title`),
            desc: t(`auth.marketing_${prefix}_desc`)
        };
    }, [view, t]);
    return (
        <div className="flex-1 hidden lg:flex relative items-center justify-center overflow-hidden bg-neutral-950" aria-hidden="true">
            {/* Background with Overlay */}
            <div className="absolute inset-0 z-0">
                <img 
                    src={AUTH_CONFIG.BG_IMAGE} 
                    alt="" 
                    className="w-full h-full object-cover grayscale opacity-20 mix-blend-luminosity scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-transparent to-transparent"></div>
            </div>

            <div className="relative z-10 w-[550px] flex flex-col gap-8">                
                {/* 1. GLASS BENTO CARD - LIVE ANALYTICS */}
                <div className="bg-[var(--bg-surface)]/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative group">
                    {/* Primary orb — top-right */}
                    <div className="absolute -top-10 -right-10 w-48 h-48 bg-[var(--sgs-primary)]/100/25 rounded-full blur-3xl pointer-events-none"></div>
                    {/* Secondary accent orb — bottom-left */}
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-[var(--sgs-primary)]/100/15 rounded-full blur-2xl pointer-events-none"></div>                    
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('auth.market_velocity')}</div>
                            <div className="text-2xl font-bold text-white flex items-center gap-2">
                                +24.5%
                                <span className="text-xs2 bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">{t('auth.live')}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                            <div className="w-2 h-2 rounded-full bg-sgs-accent"></div>
                            <div className="w-2 h-2 rounded-full bg-sgs-verified"></div>
                        </div>
                    </div>
                    <div className="h-48 w-full relative">
                        <ResponsiveContainer width="100%" height={192} minHeight={150} minWidth={150}>
                            <AreaChart data={CHART_DATA}>
                                <defs>
                                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#1B3A5C" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#1B3A5C" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <YAxis hide domain={['dataMin', 'dataMax']} />
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#1B3A5C" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorVal)" 
                                    isAnimationActive={true}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                {/* 2. TEXT CONTENT */}
                <div className="pl-4 border-l-2 border-sgs-primary animate-enter" key={view}>
                    <h2 className="text-3xl font-bold text-white mb-3 tracking-tight leading-tight">{content.title}</h2>
                    <p className="text-gray-400 text-sm leading-relaxed max-w-md">{content.desc}</p>
                </div>
                {/* 3. TRUST SIGNALS */}
                <div className="flex items-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-500 pt-4">
                    <span className="text-xs font-bold text-sgs-text-muted uppercase tracking-widest">{t('auth.trusted_by')}</span>
                    {['Vinhomes', 'Masterise', 'Keppel', 'Gamuda'].map((brand, i) => (
                        <span key={i} className="text-sm font-bold text-white/80 font-display">{brand}</span>
                    ))}
                </div>
            </div>
        </div>
    );
});
// -----------------------------------------------------------------------------
//  MAIN COMPONENT
// -----------------------------------------------------------------------------
export function LoginPage() {
  const _router = useRouter();
  const _sp = useSearchParams();
  const _redirect = (_sp && _sp.get('redirect')) || '/dashboard';
  const onLoginSuccess = React.useCallback(() => { window.location.href = _redirect; }, [_redirect]);
  const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_REQUEST' | 'FORGOT_VERIFY' | 'VERIFY_EMAIL' | 'PENDING_APPROVAL' | 'TENANT_REJECTED' | 'TWO_FACTOR'>('LOGIN');  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [registerMode, setRegisterMode] = useState<'SALES' | 'VENDOR'>('SALES');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);  
  // UX State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSsoMode, setIsSsoMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);
  const [isPersonalEmail, setIsPersonalEmail] = useState(false);
  const [tokenFromUrl, setTokenFromUrl] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(300);
  const [devResetInfo, setDevResetInfo] = useState<{token: string; url: string} | null>(null);
  const [resending, setResending] = useState(false);
  const [resentSuccess, setResentSuccess] = useState('');
  const [resendingReset, setResendingReset] = useState(false);
  const [resentResetMsg, setResentResetMsg] = useState('');
  const [showManualToken, setShowManualToken] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState('');
  const pendingCredentials = React.useRef<{ email: string; password: string } | null>(null);
  const { t, language, setLanguage } = useTranslation();
  const localizeServerError = (msg: string): string => {
      if (!msg) return t('auth.error_generic');
      const m = msg.toLowerCase();
      if (m === 'tenant_pending_approval') return t('auth.pending_approval_title');
      if (m === 'tenant_rejected') return t('auth.rejected_title');
      if (m.includes('too many') || m.includes('rate limit') || m.includes('429')) return t('auth.error_rate_limit');
      if (m.includes('invalid credentials') || m.includes('invalid email or password')) return t('auth.error_invalid_creds');
      if (m.includes('already exists') || m.includes('duplicate') || m.includes('already registered')) return t('auth.error_email_exists');
      if (m.includes('sso is not enabled') || m.includes('sso not enabled')) return t('auth.error_sso_disabled');
      if (m.includes('invalid or expired') || m.includes('expired reset token')) return t('auth.error_token_expired');
      if (m.includes('sso login failed') || m.includes('sso error')) return t('auth.error_sso_disabled');
      if (m === 'email_not_verified') return t('auth.verify_email_not_verified');
      if (m.includes('password must be at least') || m.includes('password too short') || m.includes('password too weak')) return t('auth.error_password_weak');
      if (m.includes('token and new password') || m.includes('token is required') || m.includes('reset token')) return t('auth.error_token_required');
      if (m.includes('email is required') || m.includes('email missing')) return t('auth.error_email_required');
      if (m.includes('failed to') || m.includes('failed:') || m.includes('process request') || m.includes('internal server') || m.includes('something went wrong')) return t('auth.error_generic');
      // If the message still looks like an English technical error (no Vietnamese characters), fall back to generic
      if (/^[a-zA-Z0-9\s.,!?'"-]+$/.test(msg) && msg.length < 120) return t('auth.error_generic');
      return msg;
  };
  const handleHashTokens = useCallback((hash: string) => {
      // Support both legacy hash URLs and clean URLs.
      // After App.tsx converts #/xxx → /xxx, tokens move from hash to pathname/search.
      // Password reset remains link-based; email verification is OTP-only.
      //    and /reset-password/{token} (path — used by the reset-password email link).
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const resetFromSearch = new URLSearchParams(window.location.search).get('reset_token');
      const resetFromPath = pathParts[0] === 'reset-password' && pathParts[1] ? pathParts[1] : null;
      const resetMatch = hash.match(/reset_token=([a-f0-9]+)/) || (resetFromSearch ? [null, resetFromSearch] : null) || (resetFromPath ? [null, resetFromPath] : null);
      if (resetMatch) {
          setOtp(resetMatch[1] as string);
          setTokenFromUrl(true);
          setView('FORGOT_VERIFY');
          setGlobalError('');
          setSuccessMsg('');
          window.history.replaceState(null, '', `/${ROUTES.LOGIN}`);
          return true;
      }
      return false;
  }, [t, onLoginSuccess]);
  useEffect(() => {
    if (view !== 'VERIFY_EMAIL' || otpSecondsLeft <= 0) return;
    const timer = window.setInterval(() => setOtpSecondsLeft((value: number) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [view, otpSecondsLeft]);
  useEffect(() => {
      const savedEmail = localStorage.getItem('sgs_last_email');
      if (savedEmail) setEmail(savedEmail);
      handleHashTokens(window.location.hash);
  }, []);
  // Re-check hash on every hashchange — fixes the case where the user is
  // already on the Login page (e.g. FORGOT_REQUEST view) and then clicks
  // the reset link in their email, which changes the hash without unmounting
  // this component. Without this listener the useEffect above never re-fires.
  useEffect(() => {
      const onHashChange = () => handleHashTokens(window.location.hash);
      window.addEventListener('hashchange', onHashChange);
      return () => window.removeEventListener('hashchange', onHashChange);
  }, [handleHashTokens]);
  // Real-time B2B Email Check
  useEffect(() => {
      if (email.includes('@')) {
          const domain = email.split('@')[1];
          const isFree = AUTH_CONFIG.FREE_EMAIL_DOMAINS.includes(domain);
          setIsPersonalEmail(isFree);
      } else {
          setIsPersonalEmail(false);
      }
  }, [email]);

  const triggerShake = () => {
      setShake(true);
      setTimeout(() => setShake(false), 500);
  };
  const validate = () => {
      const errors: Record<string, string> = {};      
      // Common Email Validation
      if (view !== 'FORGOT_VERIFY') {
          const trimmedEmail = email.trim();
          if (!trimmedEmail) errors.email = t('auth.error_email_required');
          else if (!AUTH_CONFIG.EMAIL_REGEX.test(trimmedEmail)) errors.email = t('auth.error_email_invalid');
      }
      // Login Validation
      if (view === 'LOGIN' && !isSsoMode && !password) errors.password = t('auth.error_password_required');
      // Registration Validation
      if (view === 'REGISTER') {
          if (!name.trim()) errors.name = t('auth.error_name_required');
          if (registerMode === 'VENDOR') {
              if (!company.trim()) errors.company = t('auth.error_company_required');
              else if (company.trim().length < 2) errors.company = t('auth.error_company_required');
          }
          if (!password) errors.password = t('auth.error_password_required');
          else if (calculatePasswordStrength(password) < 2) errors.password = t('auth.error_password_weak');
      }
      // Forgot Password Validation
      if (view === 'FORGOT_VERIFY') {
          if (!otp.trim()) errors.otp = t('auth.error_token_required');
          if (!newPassword) errors.newPassword = t('auth.error_password_required');
          else if (calculatePasswordStrength(newPassword) < 2) errors.newPassword = t('auth.error_password_weak');
      }
      return errors;
  };
  const handleResendReset = async () => {
      if (resendingReset || !email) return;
      setResendingReset(true);
      setResentResetMsg('');
      try {
          const resendRes = await db.requestPasswordReset(email.trim());
          if ((resendRes as any)?.devResetToken) {
              setDevResetInfo({ token: (resendRes as any).devResetToken, url: (resendRes as any).devResetUrl });
          }
          setResentResetMsg(t('auth.resend_reset_sent'));
      } catch {
          setResentResetMsg(t('auth.error_generic'));
      } finally {
          setResendingReset(false);
      }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGlobalError('');
    setSuccessMsg('');    
    const errors = validate();
    if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        triggerShake();
        return;
    }
    setLoading(true);    
    try {
      const trimmedEmail = email.trim();
      if (view === 'FORGOT_REQUEST') {
          const resetRes = await db.requestPasswordReset(trimmedEmail);
          // Dev mode: backend trả devResetToken + devResetUrl khi không có email thật
          if ((resetRes as any)?.devResetToken) {
              setDevResetInfo({
                  token: (resetRes as any).devResetToken,
                  url: (resetRes as any).devResetUrl,
              });
          } else {
              setDevResetInfo(null);
          }
          setSuccessMsg(t('auth.success_reset'));
          setView('FORGOT_VERIFY');
          setLoading(false);
          return;
      }
      if (view === 'FORGOT_VERIFY') {
          const resetResult = await db.resetPassword(otp, newPassword);
          const resetEmail = (resetResult as any)?.email || email.trim();
          setOtp('');
          // Auto-login immediately after successful password reset
          if (resetEmail) {
              setSuccessMsg(t('auth.pass_changed_success'));
              try {
                  await db.authenticate(resetEmail, newPassword);
                  if (rememberMe) localStorage.setItem('sgs_last_email', resetEmail);
                  onLoginSuccess();
              } catch {
                  // Auto-login failed — fall back to login form with email pre-filled
                  setEmail(resetEmail);
                  setPassword('');
                  setNewPassword('');
                  setTokenFromUrl(false);
                  setTimeout(() => {
                      setSuccessMsg('');
                      setView('LOGIN');
                  }, 1500);
              }
          } else {
              setSuccessMsg(t('auth.pass_changed_success'));
              setPassword('');
              setNewPassword('');
              setTokenFromUrl(false);
              setTimeout(() => {
                  setSuccessMsg('');
                  setView('LOGIN');
              }, 2000);
          }
          return;
      }
      // 3. SSO LOGIN
      if (isSsoMode) {
          await db.authenticateViaSSO(trimmedEmail);
      } 
      // 4. REGISTER — 2 luồng theo registerMode được chọn:
      //    • VENDOR  → onboard-vendor (ADMIN, workspace riêng, trial 14 ngày)
      //    • SALES   → register thường (SALES, vào host tenant SGS Land)
      else if (view === 'REGISTER') {
        const result = registerMode === 'VENDOR'
          ? await db.onboardVendor(company.trim(), name.trim(), trimmedEmail, password)
          : await db.register(name.trim(), trimmedEmail, password);
        if (result?.needsVerification) {
          setRegisteredEmail(trimmedEmail);
          setEmailOtp('');
          setOtpSecondsLeft(300);
          setView('VERIFY_EMAIL');
          setLoading(false);
          return;
        }
        // Fallback (shouldn't happen): auto-login if server skipped verification
        await db.authenticate(trimmedEmail, password);
      } 
      // 5. STANDARD LOGIN
      else {
        await db.authenticate(trimmedEmail, password);
      }      
      if (rememberMe) {
        localStorage.setItem('sgs_last_email', trimmedEmail);
      } else {
        localStorage.removeItem('sgs_last_email');
      }
      onLoginSuccess();
    } catch (err: any) {
      // 2FA required: admin has TOTP enabled — show code input step
      if (err?.code === 'TWO_FACTOR_REQUIRED') {
        pendingCredentials.current = { email: email.trim(), password };
        setTotpCode('');
        setTotpError('');
        setView('TWO_FACTOR');
        setLoading(false);
        return;
      }
      // Special case: login blocked because email not yet verified
      if (err?.code === 'EMAIL_NOT_VERIFIED') {
        setRegisteredEmail(err.email || email.trim());
        setEmailOtp('');
        setOtpSecondsLeft(300);
        setView('VERIFY_EMAIL');
        setLoading(false);
        return;
      }
      // Gated B2B: vendor workspace chờ SGSLand duyệt
      if (err?.code === 'TENANT_PENDING_APPROVAL') {
        setRegisteredEmail(err.email || email.trim());
        setView('PENDING_APPROVAL');
        setLoading(false);
        return;
      }
      // Gated B2B: vendor workspace bị từ chối
      if (err?.code === 'TENANT_REJECTED') {
        setRegisteredEmail(err.email || email.trim());
        setView('TENANT_REJECTED');
        setLoading(false);
        return;
      }
      const msg = localizeServerError(err.message || '');
      setGlobalError(msg);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };
  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const creds = pendingCredentials.current;
    if (!creds || !totpCode.trim()) return;
    setTotpLoading(true);
    setTotpError('');
    try {
      await db.authenticateWithTotp(creds.email, creds.password, totpCode.trim());
      if (rememberMe) localStorage.setItem('sgs_last_email', creds.email);
      onLoginSuccess();
    } catch (err: any) {
      setTotpError(err.message?.includes('Invalid') || err.message?.includes('invalid') ? 'Mã không đúng. Thử lại hoặc dùng backup code.' : 'Xác thực thất bại. Thử lại.');
      setTotpCode('');
    } finally {
      setTotpLoading(false);
    }
  };
  const handleResendVerification = async () => {
    const targetEmail = registeredEmail || email.trim();
    if (!targetEmail) return;
    setResending(true);
    setResentSuccess('');
    try {
      await db.requestEmailOtp(targetEmail, language);
      setEmailOtp('');
      setOtpSecondsLeft(300);
      setResentSuccess(t('auth.verify_email_resent'));
    } catch (error: any) {
      setResentSuccess(error?.code === 'OTP_RATE_LIMITED' ? t('auth.verify_email_rate_limited') : t('auth.verify_email_resend_error'));
    } finally {
      setResending(false);
    }
  };
  const handleEmailOtpSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!registeredEmail || !/^\d{6}$/.test(emailOtp)) return;
    setLoading(true);
    setGlobalError('');
    try {
      const result = await db.verifyEmailOtp(registeredEmail, emailOtp);
      if (result?.needsApproval) {
        setView('PENDING_APPROVAL');
      } else {
        setSuccessMsg(t('auth.verify_email_success'));
        window.setTimeout(() => onLoginSuccess(), 500);
      }
    } catch (error: any) {
      setGlobalError(error?.code === 'OTP_EXPIRED' ? t('auth.verify_email_expired') : t('auth.verify_email_invalid'));
      setEmailOtp('');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };
  const handleGoogleLogin = () => {
    setGlobalError(t('auth.google_coming_soon'));
    triggerShake();
  };
  const getInputClass = useCallback((hasError: boolean) => {
      return `w-full bg-white/5 border rounded-xl pl-10 pr-4 py-3 text-[16px] focus:ring-2 transition-all outline-none text-white placeholder-white/25
      ${hasError 
          ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-500/5' 
          : 'border-white/10 focus:border-[var(--sgs-primary)]/50 focus:ring-[var(--sgs-primary)]/50 focus:bg-white/8'}`;
  }, []);
  return (
    <div className="min-h-[100dvh] w-full flex bg-black text-white font-sans selection:bg-[var(--sgs-primary)]/30 selection:text-[var(--sgs-primary)] overflow-hidden relative" data-login-root style={{ backgroundColor: "var(--sgs-primary-deep)", color: "#ffffff" }}><style>{`[data-login-root] input:not([type=checkbox]){padding-left:2.5rem !important;padding-right:2.5rem}`}</style>
      
      
      {/* FORM COLUMN */}
      <div className="w-full lg:w-[520px] xl:w-[600px] flex flex-col relative z-20 overflow-y-auto no-scrollbar scroll-smooth h-[100dvh] bg-black/40 backdrop-blur-md border-r border-white/5 shadow-2xl">        
        {/* Top Bar */}
        <div className="p-8 flex justify-between items-center">
             <div className="flex items-center gap-3">
                <Logo className="w-8 h-8 text-white" strokeWidth={2.5} />
                <span className="font-bold text-lg tracking-tight">SGS<span className="text-sgs-text-muted">ID</span></span>
             </div>
             <div className="flex items-center gap-3">
                <button
                    onClick={() => setLanguage(language === 'vn' ? 'en' : 'vn')}
                    title={t('nav.lang_switch')}
                    aria-label={t('nav.lang_switch')}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-xs2 font-extrabold text-gray-400 hover:text-white border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all tracking-tighter"
                >
                    {language.toUpperCase()}
                </button>
                <button 
                    onClick={() => window.location.href = language === 'en' ? '/en' : `/${ROUTES.LANDING}`}
                    className="text-xs font-bold text-sgs-text-muted hover:text-white transition-colors"
                >
                    {t('legal.back_home')}
                </button>
             </div>
        </div>
        <div className="flex-1 flex flex-col px-8 md:px-14 justify-center min-h-[600px]">            
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-white animate-enter">
                    {view === 'REGISTER' ? t('auth.register_title') : view.startsWith('FORGOT') ? t('auth.reset_title') : view === 'VERIFY_EMAIL' ? t('auth.verify_email_title') : view === 'PENDING_APPROVAL' ? t('auth.pending_approval_title') : view === 'TENANT_REJECTED' ? t('auth.rejected_title') : view === 'TWO_FACTOR' ? 'Xác thực 2 bước' : t('auth.welcome')}
                </h1>
                <p className="text-gray-400 text-sm leading-relaxed max-w-sm animate-enter" style={{animationDelay: '0.1s'}}>
                    {view === 'REGISTER' ? t('auth.register_subtitle') : 
                     view === 'FORGOT_VERIFY' && !tokenFromUrl ? (t('auth.check_email_subtitle') || 'Chúng tôi đã gửi link tới hộp thư của bạn.') :
                     view === 'FORGOT_VERIFY' && tokenFromUrl ? (t('auth.new_pass_subtitle') || 'Đặt mật khẩu mới cho tài khoản của bạn.') :
                     view === 'FORGOT_REQUEST' ? t('auth.reset_subtitle') :
                     view === 'VERIFY_EMAIL' ? t('auth.verify_email_subtitle') :
                     view === 'PENDING_APPROVAL' ? t('auth.pending_approval_subtitle') :
                     view === 'TENANT_REJECTED' ? t('auth.rejected_subtitle') :
                     view === 'TWO_FACTOR' ? 'Nhập mã 6 chữ số từ ứng dụng Authenticator của bạn.' :
                     t('auth.login_subtitle')}
                </p>
            </div>
             {/* ── VERIFY EMAIL OTP VIEW ─────────────────────── */}
            {view === 'VERIFY_EMAIL' && (
                 <form onSubmit={handleEmailOtpSubmit} className={`space-y-5 animate-enter ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`} style={{animationDelay: '0.2s'}}>
                    <div className="bg-[var(--sgs-primary)]/100/10 border border-[var(--sgs-primary)]/20 rounded-2xl p-6 text-center">
                        <div className="text-5xl mb-4">✉️</div>
                        <p className="text-sm text-gray-400 mb-2">{t('auth.verify_email_sent_to')}</p>
                        <p className="text-white font-bold text-base mb-4 break-all">{registeredEmail}</p>
                        <p className="text-xs text-sgs-on-dark-muted leading-relaxed">{t('auth.verify_email_instruction')}</p>
                    </div>
                     {globalError && <div className="text-rose-200 text-xs font-medium bg-rose-500/10 p-3 rounded-xl border border-rose-500/20" role="alert">{globalError}</div>}
                     <div className="flex justify-center gap-2" onPaste={(event: any) => {
                         const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                         if (pasted) { event.preventDefault(); setEmailOtp(pasted); }
                     }}>
                         {Array.from({ length: 6 }, (_, index) => (
                             <input key={index} aria-label={`${t('auth.verify_email_code_label')} ${index + 1}`} inputMode="numeric"
                                 autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={1} autoFocus={index === 0}
                                 value={emailOtp[index] || ''} onChange={(event: any) => {
                                     const value = event.target.value.replace(/\D/g, '').slice(-1);
                                     const next = emailOtp.split(''); next[index] = value; setEmailOtp(next.join('').slice(0, 6));
                                     if (value) event.currentTarget.nextElementSibling?.focus();
                                 }} onKeyDown={(event: any) => {
                                     if (event.key === 'Backspace' && !emailOtp[index]) event.currentTarget.previousElementSibling?.focus();
                                 }} className="w-11 h-14 bg-white/5 border border-white/10 focus:border-[var(--sgs-primary)]/60 focus:ring-2 focus:ring-[var(--sgs-primary)]/20 rounded-xl text-white text-center text-2xl font-mono outline-none transition-all" />
                         ))}
                     </div>
                     <p className="text-center text-xs text-gray-400">{otpSecondsLeft > 0 ? `${t('auth.verify_email_expires')} ${Math.floor(otpSecondsLeft / 60)}:${String(otpSecondsLeft % 60).padStart(2, '0')}` : t('auth.verify_email_expired')}</p>
                     <button type="submit" disabled={loading || emailOtp.length !== 6 || otpSecondsLeft === 0} className="w-full bg-[var(--sgs-primary)] hover:bg-[var(--sgs-primary)]/100 disabled:bg-white/10 disabled:text-white/30 text-white font-bold rounded-xl py-3.5 text-sm transition-all">
                         {loading ? t('auth.verify_email_verifying') : t('auth.verify_email_confirm')}
                     </button>
                     {resentSuccess && <div className="text-emerald-200 text-xs font-medium bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-center" role="status">{resentSuccess}</div>}
                     <button type="button" onClick={handleResendVerification} disabled={resending || otpSecondsLeft > 240} className="w-full bg-white/5 border border-white/10 text-white/70 font-semibold rounded-xl py-3 text-sm hover:bg-white/10 hover:text-white transition-all disabled:opacity-50">
                         {resending ? t('auth.verify_email_resending') : t('auth.verify_email_resend')}
                     </button>
                 </form>
            )}
            {/* ── PENDING APPROVAL VIEW ─────────────────────── */}
            {view === 'PENDING_APPROVAL' && (
                <div className="space-y-5 animate-enter" style={{animationDelay: '0.2s'}}>
                    <div className="bg-sgs-accent/10 border border-amber-500/20 rounded-2xl p-6 text-center">
                        <div className="text-5xl mb-4">⏳</div>
                        <h3 className="text-white font-bold text-lg mb-2">{t('auth.pending_approval_heading')}</h3>
                        <p className="text-sm text-gray-400 mb-2">{t('auth.pending_approval_email_verified')}</p>
                        <p className="text-amber-300 font-semibold text-sm break-all mb-3">{registeredEmail}</p>
                        <p className="text-xs text-gray-400 leading-relaxed">{t('auth.pending_approval_desc')}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-gray-400 leading-relaxed">
                        <p className="font-semibold text-white/60 mb-1">{t('auth.pending_approval_process')}</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>{t('auth.pending_approval_step1')}</li>
                            <li>{t('auth.pending_approval_step2')}</li>
                            <li>{t('auth.pending_approval_step3')}</li>
                        </ul>
                    </div>
                    <button
                        type="button"
                        onClick={() => { setView('LOGIN'); setGlobalError(''); setPassword(''); }}
                        className="w-full bg-white/5 border border-white/10 text-white/70 font-semibold rounded-xl py-3 text-sm hover:bg-white/10 hover:text-white transition-all"
                    >
                        {t('auth.btn_back_login')}
                    </button>
                </div>
            )}
            {/* ── TENANT REJECTED VIEW ──────────────────────── */}
            {view === 'TENANT_REJECTED' && (
                <div className="space-y-5 animate-enter" style={{animationDelay: '0.2s'}}>
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 text-center">
                        <div className="text-5xl mb-4">❌</div>
                        <h3 className="text-white font-bold text-lg mb-2">{t('auth.rejected_heading')}</h3>
                        <p className="text-sm text-gray-400 mb-2">{t('auth.rejected_account_label')}</p>
                        <p className="text-rose-300 font-semibold text-sm break-all mb-3">{registeredEmail}</p>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            {t('auth.rejected_desc_before')}{' '}
                            <a href="mailto:support@sgsland.vn" className="text-sgs-text-muted hover:underline">support@sgsland.vn</a>{' '}
                            {t('auth.rejected_desc_after')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => { setView('LOGIN'); setGlobalError(''); setPassword(''); }}
                        className="w-full bg-white/5 border border-white/10 text-white/70 font-semibold rounded-xl py-3 text-sm hover:bg-white/10 hover:text-white transition-all"
                    >
                        {t('auth.btn_back_login')}
                    </button>
                </div>
            )}
            {/* ── TWO FACTOR VIEW ───────────────────────────── */}
            {view === 'TWO_FACTOR' && (
                <form onSubmit={handleTotpSubmit} className="space-y-5 animate-enter" style={{animationDelay: '0.2s'}}>
                    <div className="bg-[var(--sgs-primary)]/100/10 border border-[var(--sgs-primary)]/20 rounded-2xl p-5 text-center">
                        <div className="w-14 h-14 bg-[var(--sgs-primary)]/100/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <svg className="w-7 h-7 text-[var(--sgs-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">Mã thay đổi mỗi 30 giây. Bạn cũng có thể dùng <span className="text-[var(--sgs-primary)] font-semibold">backup code</span>.</p>
                    </div>
                    {totpError && (
                        <div className="text-rose-200 text-xs font-medium bg-rose-500/10 p-3 rounded-xl border border-rose-500/20" role="alert">
                            {totpError}
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label htmlFor="totp-code" className="text-xs3 font-bold uppercase tracking-wider text-gray-400 ml-1">Mã xác thực</label>
                        <input
                            id="totp-code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={10}
                            value={totpCode}
                            onChange={e => setTotpCode(e.target.value.replace(/\s/g, ''))}
                            autoFocus
                            placeholder="000000"
                            className="w-full bg-white/5 border border-white/10 focus:border-[var(--sgs-primary)]/60 focus:ring-2 focus:ring-[var(--sgs-primary)]/20 rounded-xl px-4 py-3.5 text-white text-center text-2xl font-mono tracking-[0.5em] placeholder:text-white/20 outline-none transition-all"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={totpLoading || totpCode.trim().length < 6}
                        className="w-full bg-[var(--sgs-primary)] hover:bg-[var(--sgs-primary)]/100 disabled:bg-white/10 disabled:text-white/30 text-white font-bold rounded-xl py-3.5 text-sm transition-all flex items-center justify-center gap-2"
                    >
                        {totpLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                        Xác nhận
                    </button>
                    <button
                        type="button"
                        onClick={() => { setView('LOGIN'); setTotpCode(''); setTotpError(''); pendingCredentials.current = null; }}
                        className="w-full bg-white/5 border border-white/10 text-white/60 font-semibold rounded-xl py-3 text-sm hover:bg-white/10 hover:text-white transition-all"
                    >
                        Quay lại đăng nhập
                    </button>
                </form>
            )}
            {/* ── AUTH FORMS (all other views) ──────────────── */}
            <form onSubmit={handleSubmit} className={`space-y-5 animate-enter ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''} ${(view === 'VERIFY_EMAIL' || view === 'PENDING_APPROVAL' || view === 'TENANT_REJECTED' || view === 'TWO_FACTOR') ? 'hidden' : ''}`} style={{animationDelay: '0.2s'}}>
                {/* Global Feedback */}
                {globalError && (
                    <div className="text-rose-200 text-xs font-medium bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 flex items-start animate-pulse" role="alert">
                        {globalError}
                    </div>
                )}
                {successMsg && (
                    <div className="text-emerald-200 text-xs font-medium bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 flex items-start" role="status">
                        {successMsg}
                    </div>
                )}                
                {/* --- REGISTRATION FIELDS --- */}
                {view === 'REGISTER' && (
                    <>
                        {/* Tab switcher: Nhân viên kinh doanh | Vendor/Đội nhóm */}
                        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10">
                            <button
                                type="button"
                                onClick={() => { setRegisterMode('SALES'); setCompany(''); setFieldErrors({}); }}
                                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                    registerMode === 'SALES'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                {t('auth.register_tab_sales') || 'Nhân viên'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setRegisterMode('VENDOR'); setFieldErrors({}); }}
                                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                    registerMode === 'VENDOR'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                {t('auth.register_tab_vendor') || 'Công ty'}
                            </button>
                        </div>
                        {/* Họ tên — luôn hiển thị */}
                        <div className="space-y-1.5 group">
                            <label htmlFor="auth-name" className="text-xs3 font-bold uppercase tracking-wider ml-1 text-gray-400">{t('auth.label_name')}</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-white/35"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></span>
                                <input id="auth-name" value={name} onChange={e => setName(e.target.value)} className={getInputClass(!!fieldErrors.name)} placeholder={t('auth.placeholder_name')} aria-describedby={fieldErrors.name ? 'err-name' : undefined} />
                            </div>
                            {fieldErrors.name && <p id="err-name" className="text-xs2 text-rose-400 ml-1">{fieldErrors.name}</p>}
                        </div>
                        {/* Tên doanh nghiệp/đội nhóm — chỉ hiển thị khi VENDOR */}
                        {registerMode === 'VENDOR' && (
                            <div className="space-y-1.5 group">
                                <label htmlFor="auth-company" className="text-xs3 font-bold uppercase tracking-wider ml-1 text-gray-400">{t('auth.label_company_team') || 'Doanh nghiệp / Đội nhóm'}</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3.5 text-white/35"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg></span>
                                    <input id="auth-company" value={company} onChange={e => setCompany(e.target.value)} className={getInputClass(!!fieldErrors.company)} placeholder={t('auth.placeholder_company_team') || 'Tên doanh nghiệp hoặc đội nhóm'} autoComplete="organization" required aria-describedby={fieldErrors.company ? 'err-company' : undefined} />
                                </div>
                                {fieldErrors.company && <p id="err-company" className="text-xs2 text-rose-400 ml-1">{fieldErrors.company}</p>}
                            </div>
                        )}
                        {/* Hint theo loại tài khoản */}
                        {registerMode === 'VENDOR' ? (
                            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <svg className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                <p className="text-xs2 text-emerald-200 leading-relaxed">{t('auth.vendor_onboard_hint')}</p>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-sgs-accent/10 border border-amber-500/20">
                                <svg className="w-4 h-4 text-sgs-accent-text mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                <p className="text-xs2 text-amber-200 leading-relaxed">{t('auth.sales_onboard_hint')}</p>
                            </div>
                        )}
                    </>
                )}                
                {/* --- EMAIL INPUT (Shared) --- */}
                {view !== 'FORGOT_VERIFY' && (
                    <div className="space-y-1.5 group">
                        <label htmlFor="auth-email" className="text-xs3 font-bold uppercase tracking-wider ml-1 text-gray-400">{t('auth.label_email')}</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3.5 text-white/35"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></span>
                            <input id="auth-email" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} className={getInputClass(!!fieldErrors.email)} placeholder={t('auth.placeholder_email')} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby={fieldErrors.email ? 'err-email' : undefined} />
                        </div>
                        {fieldErrors.email && <p id="err-email" className="text-xs2 text-rose-400 ml-1">{fieldErrors.email}</p>}                        
                        {/* B2B Nudge */}
                        {isPersonalEmail && view === 'REGISTER' && (
                            <div className="flex items-center gap-2 mt-1 ml-1 text-sgs-accent-text">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                <p className="text-xs2 font-medium">{t('auth.b2b_nudge')}</p>
                            </div>
                        )}
                    </div>
                )}
                {/* --- FORGOT PASSWORD VERIFY STEP --- */}
                {view === 'FORGOT_VERIFY' && (
                    <>
                        {!tokenFromUrl ? (
                            /* Waiting for user to click email link — no form, just info + resend */
                            <div className="bg-[var(--sgs-primary)]/100/10 p-5 rounded-2xl border border-[var(--sgs-primary)]/20 animate-enter text-center space-y-4">
                                <div className="w-12 h-12 bg-[var(--sgs-primary)]/100/20 rounded-full flex items-center justify-center mx-auto">
                                    <svg className="w-6 h-6 text-sgs-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                </div>
                                <p className="text-sm font-bold text-white">{t('auth.check_email_title')}</p>
                                <p className="text-xs text-[var(--sgs-primary)] leading-relaxed">
                                    {t('auth.check_email_body')} <span className="font-bold text-white">{email}</span>.<br/>
                                    {t('auth.check_email_instruction')}
                                </p>
                                <p className="text-xs2 text-[var(--sgs-primary)]/60">{t('auth.check_email_spam')}</p>
                                {/* Dev mode: hiện link reset trực tiếp khi email không thật */}
                                {devResetInfo && (
                                    <div className="bg-sgs-accent/10 p-3 rounded-xl border border-amber-500/30 text-left">
                                        <p className="text-xs2 font-bold text-sgs-accent-text uppercase tracking-wider mb-2">[DEV] Link đặt lại mật khẩu:</p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOtp(devResetInfo.token);
                                                setTokenFromUrl(true);
                                                setSuccessMsg('');
                                            }}
                                            className="text-xs text-amber-200 break-all font-mono hover:underline text-left w-full"
                                        >
                                            {devResetInfo.url}
                                        </button>
                                        <p className="text-xs2 text-amber-400/60 mt-1">↑ Click để điền token vào form</p>
                                    </div>
                                )}
                                {resentResetMsg ? (
                                    <p className={`text-xs2 font-semibold ${resentResetMsg === t('auth.resend_reset_sent') ? 'text-emerald-400' : 'text-rose-400'}`}>{resentResetMsg}</p>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleResendReset}
                                        disabled={resendingReset}
                                        className="text-xs font-bold text-sgs-text-muted hover:text-sgs-on-dark-muted transition-colors disabled:opacity-60 underline underline-offset-2"
                                    >
                                        {resendingReset ? t('auth.resend_reset_sending') : t('auth.resend_reset_email')}
                                    </button>
                                )}
                                {/* Manual token paste — fallback khi email vào spam hoặc không nhận được */}
                                <div className="pt-2 border-t border-white/10">
                                    {!showManualToken ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowManualToken(true)}
                                            className="text-xs2 text-sgs-text-muted hover:text-gray-300 transition-colors underline underline-offset-2"
                                        >
                                            {t('auth.paste_token_prompt') || 'Đã có link đặt lại mật khẩu? Dán vào đây'}
                                        </button>
                                    ) : (
                                        <div className="space-y-2 text-left animate-enter">
                                            <p className="text-xs2 text-gray-400">{t('auth.paste_token_label') || 'Dán link hoặc mã token từ email:'}</p>
                                            <input
                                                type="text"
                                                value={manualToken}
                                                onChange={e => setManualToken(e.target.value)}
                                                placeholder="https://...reset-password/abc123... hoặc chỉ token"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 font-mono focus:outline-none focus:border-[var(--sgs-primary)]/50"
                                            />
                                            <button
                                                type="button"
                                                disabled={!manualToken.trim()}
                                                onClick={() => {
                                                    // Hỗ trợ cả link đầy đủ và bare token
                                                    const raw = manualToken.trim();
                                                    const match = raw.match(/reset-password\/([a-f0-9]{40,})/i) || raw.match(/reset_token=([a-f0-9]{40,})/i) || raw.match(/^([a-f0-9]{40,})$/i);
                                                    const tok = match ? match[1] : raw;
                                                    setOtp(tok);
                                                    setTokenFromUrl(true);
                                                    setSuccessMsg('');
                                                    setManualToken('');
                                                    setShowManualToken(false);
                                                }}
                                                className="w-full bg-sgs-primary text-white font-semibold rounded-xl py-2 text-xs hover:bg-sgs-primary transition-colors disabled:opacity-40"
                                            >
                                                {t('auth.paste_token_confirm') || 'Xác nhận & Đặt mật khẩu mới'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Token from URL — valid link, show new password form */
                            <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 animate-enter flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="text-xs2 text-emerald-300">{t('auth.valid_reset_link')}</p>
                                <input type="hidden" value={otp} readOnly />
                            </div>
                        )}
                    </>
                )}
                {/* --- PASSWORD INPUT --- */}
                {(view !== 'FORGOT_REQUEST' && !isSsoMode && !(view === 'FORGOT_VERIFY' && !tokenFromUrl)) && (
                    <div className="space-y-1.5 group">
                        <div className="flex justify-between ml-1 items-center">
                            <label htmlFor="auth-password" className="text-xs3 font-bold uppercase tracking-wider text-gray-400">
                                {view === 'FORGOT_VERIFY' ? t('auth.new_pass_label') : t('auth.label_password')}
                            </label>
                            {view === 'LOGIN' && (
                                <button type="button" onClick={() => { setView('FORGOT_REQUEST'); setGlobalError(''); setFieldErrors({}); }} className="text-xs3 font-bold text-sgs-text-muted hover:text-sgs-on-dark-muted transition-colors">
                                    {t('auth.forgot_password')}
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-3.5 text-white/35"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></span>
                            <input
                                id="auth-password"
                                type={showPassword ? "text" : "password"}
                                value={view === 'FORGOT_VERIFY' ? newPassword : password}
                                onChange={e => view === 'FORGOT_VERIFY' ? setNewPassword(e.target.value) : setPassword(e.target.value)}
                                className={`${getInputClass(!!fieldErrors.password || !!fieldErrors.newPassword)} pr-12`}
                                placeholder={t('auth.placeholder_password')}
                                autoComplete={view === 'LOGIN' ? 'current-password' : 'new-password'}
                                aria-describedby={(fieldErrors.password || fieldErrors.newPassword) ? 'err-password' : undefined}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                                aria-pressed={showPassword}
                                className="absolute right-3 top-3 p-1 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPassword ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg>
                            </button>
                        </div>
                        {(fieldErrors.password || fieldErrors.newPassword) && <p id="err-password" className="text-xs2 text-rose-400 ml-1">{fieldErrors.password || fieldErrors.newPassword}</p>}
                        
                        {(view === 'REGISTER' || view === 'FORGOT_VERIFY') && (
                            <div className="pt-2 flex items-center gap-2">
                                <div className="h-1 flex-1 bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        role="progressbar"
                                        aria-valuenow={calculatePasswordStrength(view === 'FORGOT_VERIFY' ? newPassword : password) * 25}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-label={t('auth.password_strength')}
                                        className={`h-full transition-all duration-500 ease-out
                                        ${calculatePasswordStrength(view === 'FORGOT_VERIFY' ? newPassword : password) < 2 ? 'bg-rose-500' : calculatePasswordStrength(view === 'FORGOT_VERIFY' ? newPassword : password) < 4 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${(calculatePasswordStrength(view === 'FORGOT_VERIFY' ? newPassword : password) / 4) * 100}%` }}>
                                    </div>
                                </div>
                                <span className="text-xs2 font-bold text-sgs-text-muted uppercase">
                                    {calculatePasswordStrength(view === 'FORGOT_VERIFY' ? newPassword : password) < 2 ? t('auth.weak') : calculatePasswordStrength(view === 'FORGOT_VERIFY' ? newPassword : password) < 4 ? t('auth.medium') : t('auth.strong')}
                                </span>
                            </div>
                        )}
                    </div>
                )}                
                {/* Remember Me Checkbox for Login */}
                {view === 'LOGIN' && !isSsoMode && (
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="remember" 
                            checked={rememberMe} 
                            onChange={e => setRememberMe(e.target.checked)}
                            className="w-4 h-4 accent-[var(--sgs-primary)] rounded cursor-pointer"
                        />
                        <label htmlFor="remember" className="text-xs text-gray-400 cursor-pointer select-none">{t('auth.remember_me')}</label>
                    </div>
                )}
                {!(view === 'FORGOT_VERIFY' && !tokenFromUrl) && (
                <button 
                    type="submit" 
                    disabled={loading} 
                    data-submit-btn style={{ color: "var(--sgs-primary-deep)", backgroundColor: "#ffffff" }} className="w-full bg-white text-[#09090b] font-bold rounded-xl py-3.5 text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] disabled:opacity-70 disabled:hover:scale-100 mt-2"
                >
                    {loading ? t('auth.processing') : (
                        view === 'REGISTER' ? t('auth.btn_register') : 
                        view === 'FORGOT_REQUEST' ? t('auth.btn_reset') : 
                        view === 'FORGOT_VERIFY' ? t('auth.btn_change_pass') : 
                        t('auth.btn_login')
                    )}
                </button>
                )}
            </form>
            {/* ACTION FOOTER */}
            {view === 'LOGIN' && (
                <div className="animate-enter mt-6" style={{animationDelay: '0.3s'}}>
                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10"></span></div>
                        <div className="relative flex-1 justify-center text-xs2 uppercase font-bold tracking-widest text-center"><span className="bg-black px-3 text-sgs-text-muted">{t('auth.or')}</span></div>
                    </div>
                    <div className="space-y-3">
                        <button type="button" onClick={() => { setIsSsoMode(!isSsoMode); setGlobalError(''); }} className="w-full bg-white/5 border border-white/10 text-white/70 font-bold rounded-xl py-3 text-sm hover:bg-white/10 hover:text-white transition-all flex justify-center items-center gap-3">
                            {isSsoMode ? t('auth.password_login') : t('auth.sso_login')}
                        </button>                        
                        {!isSsoMode && (
                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full bg-white/5 border border-white/10 text-white/70 font-bold rounded-xl py-3 text-sm hover:bg-white/10 hover:text-white transition-all flex justify-center items-center gap-3 disabled:opacity-50"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84.81-.06z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                {t('auth.google_login')}
                            </button>
                        )}
                    </div>
                </div>
            )}
            <div className="mt-auto py-8 text-center text-sm font-medium text-sgs-text-muted animate-enter">
                {view === 'REGISTER' ? t('auth.has_account') : (view.startsWith('FORGOT') || view === 'VERIFY_EMAIL' || view === 'PENDING_APPROVAL' || view === 'TENANT_REJECTED') ? '' : t('auth.no_account')}
                
                {!view.startsWith('FORGOT') && view !== 'VERIFY_EMAIL' && view !== 'PENDING_APPROVAL' && view !== 'TENANT_REJECTED' && (
                    <button type="button" onClick={() => { setView(view === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setGlobalError(''); setFieldErrors({}); setPassword(''); }} className="text-white hover:text-sgs-on-dark-muted font-bold ml-1 transition-colors">
                        {view === 'REGISTER' ? t('auth.login_link') : t('auth.register_link')}
                    </button>
                )}                
                {(view.startsWith('FORGOT') || view === 'VERIFY_EMAIL') && (
                    <button type="button" onClick={() => { setView('LOGIN'); setGlobalError(''); setFieldErrors({}); setSuccessMsg(''); setDevResetInfo(null); setResentSuccess(''); setTokenFromUrl(false); setOtp(''); setEmailOtp(''); }} className="text-white hover:text-sgs-on-dark-muted font-bold ml-1 transition-colors">
                        ← {t('auth.verify_email_back_login')}
                    </button>
                )}
            </div>
        </div>
      </div>
      <MarketingColumn view={view} t={t} />
    </div>
  );
};