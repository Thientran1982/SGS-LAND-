/**
 * sequenceTemplates.ts
 *
 * Thư viện các sequence mẫu cho nền tảng SGS LAND.
 * Mỗi template chứa sẵn các bước (steps) phù hợp với từng tình huống
 * chăm sóc khách hàng bất động sản.
 */

export interface SequenceTemplateStep {
  id: string;
  type: 'EMAIL' | 'SMS' | 'ZALO' | 'WAIT' | 'CREATE_TASK';
  delayHours: number;
  subject?: string;
  content?: string;
  taskTitle?: string;
}

export interface SequenceTemplate {
  id: string;
  name: string;
  description: string;
  triggerEvent: string;
  category: 'lead' | 'nurture' | 'closing' | 'retention';
  icon: string;
  steps: SequenceTemplateStep[];
}

export const SEQUENCE_TEMPLATES: SequenceTemplate[] = [
  // ── Lead mới từ landing page ────────────────────────────────────────────────
  {
    id: 'tpl_landing_lead_welcome',
    name: 'Chào Mừng Lead Landing Page',
    description: 'Chuỗi 4 bước cho lead mới từ form landing page. Liên hệ ngay, gửi thông tin, nhắc nhở và chốt lịch xem nhà.',
    triggerEvent: 'NEW',
    category: 'lead',
    icon: '🏠',
    steps: [
      {
        id: '1',
        type: 'CREATE_TASK',
        delayHours: 0,
        taskTitle: 'Gọi điện tư vấn lead mới trong 30 phút',
      },
      {
        id: '2',
        type: 'EMAIL',
        delayHours: 1,
        subject: 'SGS Land – Thông tin dự án {{project}} bạn quan tâm',
        content: 'Xin chào {{name}},\n\nCảm ơn bạn đã quan tâm đến dự án. Chúng tôi đã chuẩn bị đầy đủ thông tin:\n- Bảng giá mới nhất\n- Mặt bằng phân khu\n- Chính sách ưu đãi\n\nChuyên viên tư vấn sẽ gửi tài liệu chi tiết qua email trong ít phút.\n\nHotline: 0971 132 378\n\nTrân trọng,\nĐội ngũ SGS Land',
      },
      {
        id: '3',
        type: 'WAIT',
        delayHours: 48,
      },
      {
        id: '4',
        type: 'EMAIL',
        delayHours: 0,
        subject: 'SGS Land – Bạn có muốn đặt lịch xem dự án không?',
        content: 'Xin chào {{name}},\n\nChúng tôi muốn hỏi thăm bạn đã có cơ hội xem thông tin dự án chưa?\n\nĐội ngũ SGS Land sẵn sàng đưa bạn đi tham quan thực tế hoàn toàn miễn phí, không ràng buộc.\n\nĐặt lịch ngay: 0971 132 378\n\nTrân trọng,\nĐội ngũ SGS Land',
      },
      {
        id: '5',
        type: 'CREATE_TASK',
        delayHours: 0,
        taskTitle: 'Follow-up lead sau 48h — xác nhận nhu cầu và đặt lịch xem',
      },
    ],
  },

  // ── Lead chưa phản hồi sau 7 ngày ──────────────────────────────────────────
  {
    id: 'tpl_cold_lead_reactivation',
    name: 'Tái Kích Hoạt Lead Nguội',
    description: 'Kích hoạt lại lead chưa phản hồi sau 7+ ngày. Cung cấp thêm giá trị, tạo urgency, giao task follow-up.',
    triggerEvent: 'CONTACTED',
    category: 'nurture',
    icon: '🔥',
    steps: [
      {
        id: '1',
        type: 'EMAIL',
        delayHours: 0,
        subject: 'SGS Land – Thị trường BĐS đang có biến động, cơ hội cho bạn',
        content: 'Xin chào {{name}},\n\nChúng tôi nhận thấy bạn chưa có cơ hội trao đổi với tư vấn viên SGS Land.\n\nHiện tại thị trường đang có những biến động tích cực:\n- Lãi suất vay mua nhà từ 6%/năm\n- Chủ đầu tư đang có chính sách ưu đãi thanh toán linh hoạt\n- Quỹ căn tốt đang cạn dần\n\nNếu bạn còn quan tâm, hãy cho chúng tôi biết thời gian thuận tiện để trao đổi:\n📞 0971 132 378\n\nTrân trọng,\nSGS Land',
      },
      {
        id: '2',
        type: 'WAIT',
        delayHours: 72,
      },
      {
        id: '3',
        type: 'EMAIL',
        delayHours: 0,
        subject: 'SGS Land – Lần cuối chúng tôi liên hệ bạn về dự án này',
        content: 'Xin chào {{name}},\n\nĐây là email cuối chúng tôi gửi về chủ đề này. Nếu bạn đã tìm được giải pháp phù hợp, chúc mừng bạn!\n\nNếu bạn vẫn đang tìm kiếm, chúng tôi luôn sẵn sàng tư vấn miễn phí:\n📞 0971 132 378\n🌐 sgsland.vn\n\nChúc bạn sớm tìm được căn nhà ưng ý!\n\nTrân trọng,\nSGS Land',
      },
      {
        id: '4',
        type: 'CREATE_TASK',
        delayHours: 0,
        taskTitle: 'Quyết định: chuyển sang "Không tiếp tục" hoặc giữ lại để chăm sóc dài hạn',
      },
    ],
  },

  // ── Khách hàng đang cân nhắc ─────────────────────────────────────────────────
  {
    id: 'tpl_decision_nurture',
    name: 'Chăm Sóc Khách Đang Cân Nhắc',
    description: 'Chuỗi nội dung giá trị cho khách đang so sánh nhiều dự án. Cung cấp phân tích, testimonial và khuyến khích đặt cọc.',
    triggerEvent: 'PROPOSAL',
    category: 'closing',
    icon: '⚖️',
    steps: [
      {
        id: '1',
        type: 'EMAIL',
        delayHours: 0,
        subject: 'SGS Land – Phân tích so sánh dự án giúp bạn quyết định đúng',
        content: 'Xin chào {{name}},\n\nChúng tôi hiểu bạn đang cân nhắc nhiều lựa chọn. Để hỗ trợ bạn, chúng tôi đã chuẩn bị:\n\n✅ Bảng so sánh ưu/nhược điểm các dự án tương đương\n✅ Phân tích xu hướng giá khu vực\n✅ Kinh nghiệm từ 100+ khách hàng đã mua\n\nHãy cho chúng tôi biết bạn cần tư vấn thêm về khía cạnh nào!\n📞 0971 132 378\n\nTrân trọng,\nSGS Land',
      },
      {
        id: '2',
        type: 'WAIT',
        delayHours: 96,
      },
      {
        id: '3',
        type: 'EMAIL',
        delayHours: 0,
        subject: 'SGS Land – Câu chuyện thành công của khách hàng',
        content: 'Xin chào {{name}},\n\nChúng tôi muốn chia sẻ câu chuyện của anh Minh Tuấn (TP.HCM), đã mua căn hộ qua SGS Land:\n\n"Tôi đã so sánh nhiều dự án trong 3 tháng. Nhờ đội ngũ SGS Land tư vấn chi tiết và minh bạch, tôi đã chọn được căn hộ phù hợp với ngân sách và được vay lãi suất ưu đãi 6.5%/năm."\n\nBạn có muốn chúng tôi tư vấn như vậy không?\n📞 0971 132 378\n\nTrân trọng,\nSGS Land',
      },
      {
        id: '4',
        type: 'WAIT',
        delayHours: 72,
      },
      {
        id: '5',
        type: 'CREATE_TASK',
        delayHours: 0,
        taskTitle: 'Gọi điện chốt deal — hỏi thẳng về quyết định đặt cọc',
      },
    ],
  },

  // ── Sau khi ký hợp đồng ──────────────────────────────────────────────────────
  {
    id: 'tpl_post_contract',
    name: 'Chăm Sóc Sau Ký Hợp Đồng',
    description: 'Duy trì mối quan hệ với khách hàng đã mua. Hướng dẫn thanh toán, cập nhật tiến độ và xin referral.',
    triggerEvent: 'WON',
    category: 'retention',
    icon: '🎉',
    steps: [
      {
        id: '1',
        type: 'EMAIL',
        delayHours: 2,
        subject: 'SGS Land – Chúc mừng {{name}} đã sở hữu căn nhà mơ ước!',
        content: 'Xin chào {{name}},\n\nChúc mừng bạn đã hoàn tất giao dịch! Đây là bước ngoặt quan trọng.\n\nBước tiếp theo của bạn:\n1. Giữ lại hợp đồng gốc ở nơi an toàn\n2. Theo dõi lịch thanh toán đúng hạn\n3. Liên hệ ngân hàng để hoàn thiện hồ sơ vay (nếu có)\n\nMọi thắc mắc, liên hệ ngay:\n📞 0971 132 378\n\nTrân trọng,\nĐội ngũ SGS Land',
      },
      {
        id: '2',
        type: 'WAIT',
        delayHours: 720,
      },
      {
        id: '3',
        type: 'EMAIL',
        delayHours: 0,
        subject: 'SGS Land – Cập nhật tiến độ dự án tháng này',
        content: 'Xin chào {{name}},\n\nChúng tôi muốn cập nhật cho bạn tiến độ mới nhất của dự án.\n\nNếu bạn có câu hỏi về tiến độ thanh toán hoặc pháp lý, đội ngũ SGS Land luôn sẵn sàng hỗ trợ:\n📞 0971 132 378\n\nNgoài ra, nếu bạn có người thân hoặc bạn bè đang tìm mua BĐS, hãy giới thiệu SGS Land — chúng tôi sẽ có chính sách ưu đãi đặc biệt!\n\nTrân trọng,\nSGS Land',
      },
      {
        id: '4',
        type: 'WAIT',
        delayHours: 720,
      },
      {
        id: '5',
        type: 'CREATE_TASK',
        delayHours: 0,
        taskTitle: 'Xin referral từ khách hàng đã mua — tặng voucher tư vấn',
      },
    ],
  },

  // ── Nhà đầu tư đang tìm kiếm ─────────────────────────────────────────────────
  {
    id: 'tpl_investor_outreach',
    name: 'Tiếp Cận Nhà Đầu Tư',
    description: 'Chuỗi nội dung phân tích ROI và cơ hội đầu tư cho khách hàng có hồ sơ nhà đầu tư.',
    triggerEvent: 'NEW',
    category: 'lead',
    icon: '📈',
    steps: [
      {
        id: '1',
        type: 'EMAIL',
        delayHours: 0,
        subject: 'SGS Land – Phân tích ROI bất động sản khu vực bạn quan tâm',
        content: 'Xin chào {{name}},\n\nDành cho nhà đầu tư đang tìm kiếm cơ hội sinh lời từ BĐS, SGS Land cung cấp:\n\n📊 Phân tích ROI chi tiết theo khu vực\n🏗️ Đánh giá tiềm năng tăng giá 3-5 năm\n💰 So sánh các hình thức đầu tư: mua để cho thuê, mua để bán\n🏦 Tư vấn đòn bẩy tài chính tối ưu\n\nĐặt lịch tư vấn đầu tư MIỄN PHÍ:\n📞 0971 132 378\n\nTrân trọng,\nSGS Land Investment Advisory',
      },
      {
        id: '2',
        type: 'WAIT',
        delayHours: 48,
      },
      {
        id: '3',
        type: 'EMAIL',
        delayHours: 0,
        subject: 'SGS Land – 3 dự án BĐS tiềm năng cao Q2/2026',
        content: 'Xin chào {{name}},\n\nChúng tôi muốn giới thiệu 3 dự án có tiềm năng tăng giá cao trong quý này:\n\n1. Khu vực TP.HCM mở rộng — hạ tầng đang được đầu tư mạnh\n2. Khu Đông TP.HCM — hưởng lợi từ metro và đường vành đai\n3. Tỉnh thành lân cận — giá thấp, dư địa tăng lớn\n\nBạn muốn nhận báo cáo chi tiết về dự án nào?\n📞 0971 132 378\n\nTrân trọng,\nSGS Land',
      },
      {
        id: '4',
        type: 'CREATE_TASK',
        delayHours: 24,
        taskTitle: 'Gọi hỏi phản hồi về báo cáo đầu tư và đặt lịch gặp mặt',
      },
    ],
  },

  // ── Khách hàng cũ / Upsell ────────────────────────────────────────────────────
  {
    id: 'tpl_upsell_existing',
    name: 'Upsell Khách Hàng Hiện Tại',
    description: 'Giới thiệu cơ hội mua thêm hoặc nâng cấp cho khách hàng đã từng giao dịch với SGS Land.',
    triggerEvent: 'WON',
    category: 'retention',
    icon: '💎',
    steps: [
      {
        id: '1',
        type: 'WAIT',
        delayHours: 2160,
      },
      {
        id: '2',
        type: 'EMAIL',
        delayHours: 0,
        subject: 'SGS Land – Cơ hội đầu tư mới dành riêng cho khách hàng VIP',
        content: 'Xin chào {{name}},\n\nVới tư cách là khách hàng VIP của SGS Land, bạn được ưu tiên tiếp cận các cơ hội bất động sản mới nhất trước khi mở bán rộng rãi.\n\nHiện tại chúng tôi đang có:\n🏡 Căn hộ cao cấp với view sông — Giá gốc chủ đầu tư\n🏘️ Biệt thự vườn ven đô — Pháp lý hoàn chỉnh\n🏢 Officetel trung tâm — Cho thuê ngay từ ngày 1\n\nĐể nhận thông tin chi tiết và giá ưu đãi VIP:\n📞 0971 132 378\n\nTrân trọng,\nSGS Land VIP Club',
      },
      {
        id: '3',
        type: 'CREATE_TASK',
        delayHours: 72,
        taskTitle: 'Follow-up upsell — hỏi nhu cầu đầu tư tiếp theo',
      },
    ],
  },
];
