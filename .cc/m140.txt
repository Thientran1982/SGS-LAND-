import type { Migration } from './runner';
import type { PoolClient } from 'pg';

type SeedSequence = {
  name: string;
  triggerEvent: string;
  steps: Array<Record<string, unknown>>;
};

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const SEQUENCES: SeedSequence[] = [
  {
    name: 'Chào mừng lead mới và kéo truy cập',
    triggerEvent: 'NEW',
    steps: [
      { id: 'welcome-1', type: 'CREATE_TASK', delayHours: 0, taskTitle: 'Gọi lead mới trong 30 phút và xác nhận nhu cầu' },
      { id: 'welcome-2', type: 'EMAIL', delayHours: 1, subject: 'Chào {{name}} — tài liệu BĐS bạn đang quan tâm', content: '<p>Chào {{name}},</p><p>Cảm ơn bạn đã quan tâm đến SGS LAND. Bạn có thể xem nguồn hàng mới tại <a href="https://sgsland.vn/bat-dong-san">Marketplace bất động sản</a>.</p><p>Đội ngũ sẽ gửi bảng giá, mặt bằng và chính sách phù hợp với nhu cầu của bạn.</p>' },
      { id: 'welcome-3', type: 'WAIT', delayHours: 48 },
      { id: 'welcome-4', type: 'EMAIL', delayHours: 0, subject: '{{name}}, bạn đã xem nguồn hàng mới chưa?', content: '<p>Chào {{name}},</p><p>Mời bạn xem các dự án đang được cập nhật tại <a href="https://sgsland.vn/du-an">Danh sách dự án SGS LAND</a>.</p><p>Nếu bạn cho biết ngân sách và khu vực mong muốn, chuyên viên sẽ lọc nhanh các lựa chọn phù hợp.</p>' },
      { id: 'welcome-5', type: 'CREATE_TASK', delayHours: 0, taskTitle: 'Follow-up lead mới sau 48 giờ và gửi link dự án phù hợp' },
    ],
  },
  {
    name: 'Nuôi dưỡng khách đang quan tâm dự án',
    triggerEvent: 'CONTACTED',
    steps: [
      { id: 'nurture-1', type: 'EMAIL', delayHours: 0, subject: '3 điều cần kiểm tra trước khi chọn dự án', content: '<p>Chào {{name}},</p><p>Trước khi quyết định, bạn nên kiểm tra pháp lý, tiến độ hạ tầng và tổng chi phí sở hữu.</p><p>SGS LAND tổng hợp thêm các bài phân tích tại <a href="https://sgsland.vn/tin-tuc">Trung tâm tin tức</a>.</p>' },
      { id: 'nurture-2', type: 'WAIT', delayHours: 72 },
      { id: 'nurture-3', type: 'EMAIL', delayHours: 0, subject: 'So sánh nhanh các lựa chọn phù hợp với {{name}}', content: '<p>Chào {{name}},</p><p>Chúng tôi có thể giúp bạn so sánh giá, vị trí, tiện ích và tiến độ giữa các dự án.</p><p><a href="https://sgsland.vn/bat-dong-san">Xem các sản phẩm đang có</a> hoặc trả lời email này để nhận tư vấn riêng.</p>' },
      { id: 'nurture-4', type: 'CREATE_TASK', delayHours: 0, taskTitle: 'Gọi tư vấn và xác nhận tiêu chí lựa chọn của lead' },
    ],
  },
  {
    name: 'Bản tin thị trường và nội dung thu hút truy cập',
    triggerEvent: 'QUALIFIED',
    steps: [
      { id: 'traffic-1', type: 'EMAIL', delayHours: 0, subject: 'Bản tin thị trường BĐS mới nhất từ SGS LAND', content: '<p>Chào {{name}},</p><p>Đây là bản tin thị trường với các thay đổi đáng chú ý về giá, hạ tầng và nguồn cung.</p><p><a href="https://sgsland.vn/tin-tuc">Đọc bài phân tích mới nhất</a> để cập nhật trước khi ra quyết định.</p>' },
      { id: 'traffic-2', type: 'WAIT', delayHours: 168 },
      { id: 'traffic-3', type: 'EMAIL', delayHours: 0, subject: 'Mời {{name}} xem danh sách BĐS đang được quan tâm', content: '<p>Chào {{name}},</p><p>Chúng tôi vừa cập nhật các sản phẩm nổi bật theo khu vực và ngân sách.</p><p><a href="https://sgsland.vn/bat-dong-san">Khám phá Marketplace SGS LAND</a> và gửi lại mã sản phẩm bạn muốn xem.</p>' },
      { id: 'traffic-4', type: 'CREATE_TASK', delayHours: 0, taskTitle: 'Theo dõi lượt truy cập và gọi lại lead có tương tác' },
    ],
  },
  {
    name: 'Tái kích hoạt lead nguội sau 7 ngày',
    triggerEvent: 'LOST',
    steps: [
      { id: 'reactivate-1', type: 'EMAIL', delayHours: 0, subject: '{{name}}, SGS LAND có nguồn hàng mới phù hợp hơn', content: '<p>Chào {{name}},</p><p>Có thể nhu cầu của bạn đã thay đổi. SGS LAND vừa cập nhật thêm nguồn hàng và chính sách mới.</p><p><a href="https://sgsland.vn/bat-dong-san">Xem nguồn hàng mới</a> hoặc trả lời “TƯ VẤN” để được hỗ trợ.</p>' },
      { id: 'reactivate-2', type: 'WAIT', delayHours: 72 },
      { id: 'reactivate-3', type: 'EMAIL', delayHours: 0, subject: 'Bạn còn muốn nhận thông tin BĐS từ SGS LAND không?', content: '<p>Chào {{name}},</p><p>Đây là lời nhắc cuối trong chuỗi này. Nếu vẫn quan tâm, bạn có thể xem <a href="https://sgsland.vn/tin-tuc">tin tức thị trường</a> hoặc phản hồi để chúng tôi cập nhật đúng nhu cầu.</p>' },
      { id: 'reactivate-4', type: 'CREATE_TASK', delayHours: 0, taskTitle: 'Xác nhận trạng thái lead: tiếp tục chăm sóc hoặc dừng liên hệ' },
    ],
  },
  {
    name: 'Chăm sóc khách đang cân nhắc và chốt lịch',
    triggerEvent: 'PROPOSAL',
    steps: [
      { id: 'consider-1', type: 'EMAIL', delayHours: 0, subject: 'Bảng so sánh giúp {{name}} chọn dự án phù hợp', content: '<p>Chào {{name}},</p><p>SGS LAND có thể hỗ trợ so sánh pháp lý, vị trí, giá và khả năng thanh khoản của các lựa chọn bạn đang cân nhắc.</p><p><a href="https://sgsland.vn/du-an">Xem thông tin dự án</a> hoặc đặt lịch tư vấn trực tiếp.</p>' },
      { id: 'consider-2', type: 'WAIT', delayHours: 96 },
      { id: 'consider-3', type: 'EMAIL', delayHours: 0, subject: '{{name}}, mời bạn đặt lịch xem dự án', content: '<p>Chào {{name}},</p><p>Bạn có thể đặt lịch xem dự án cùng chuyên viên SGS LAND, không ràng buộc.</p><p>Hãy trả lời email với thời gian thuận tiện hoặc xem thêm <a href="https://sgsland.vn/bat-dong-san">các sản phẩm đang mở bán</a>.</p>' },
      { id: 'consider-4', type: 'CREATE_TASK', delayHours: 0, taskTitle: 'Gọi chốt lịch xem dự án và cập nhật nhu cầu' },
    ],
  },
  {
    name: 'Chốt giao dịch và xác nhận quyết định',
    triggerEvent: 'NEGOTIATION',
    steps: [
      { id: 'closing-1', type: 'EMAIL', delayHours: 0, subject: 'Tóm tắt phương án và bước tiếp theo cho {{name}}', content: '<p>Chào {{name}},</p><p>SGS LAND gửi lại tóm tắt phương án, chi phí dự kiến và các bước cần chuẩn bị.</p><p>Đội ngũ sẵn sàng giải đáp minh bạch trước khi bạn quyết định.</p>' },
      { id: 'closing-2', type: 'WAIT', delayHours: 48 },
      { id: 'closing-3', type: 'CREATE_TASK', delayHours: 0, taskTitle: 'Gọi xác nhận quyết định, xử lý vướng mắc và cập nhật trạng thái giao dịch' },
    ],
  },
  {
    name: 'Chăm sóc sau giao dịch và giới thiệu khách mới',
    triggerEvent: 'WON',
    steps: [
      { id: 'retention-1', type: 'EMAIL', delayHours: 2, subject: 'Chúc mừng {{name}} hoàn tất giao dịch cùng SGS LAND', content: '<p>Chào {{name}},</p><p>Chúc mừng bạn đã hoàn tất giao dịch. SGS LAND sẽ tiếp tục đồng hành trong các mốc thanh toán, pháp lý và tiến độ.</p>' },
      { id: 'retention-2', type: 'WAIT', delayHours: 720 },
      { id: 'retention-3', type: 'EMAIL', delayHours: 0, subject: 'Cập nhật tiến độ và cơ hội mới dành cho khách hàng SGS LAND', content: '<p>Chào {{name}},</p><p>Mời bạn xem <a href="https://sgsland.vn/tin-tuc">bản tin thị trường</a> và các cơ hội mới trên <a href="https://sgsland.vn/bat-dong-san">Marketplace</a>.</p><p>Nếu có người thân đang tìm mua hoặc đầu tư, SGS LAND sẵn sàng hỗ trợ tận tâm.</p>' },
      { id: 'retention-4', type: 'CREATE_TASK', delayHours: 0, taskTitle: 'Xin feedback sau giao dịch và ghi nhận referral nếu khách giới thiệu' },
    ],
  },
];

const migration: Migration = {
  description: 'Replace legacy default sequences with Vietnamese customer-care and traffic journeys',

  async up(client: PoolClient) {
    await client.query('DELETE FROM sequences WHERE tenant_id = $1', [TENANT_ID]);
    for (const sequence of SEQUENCES) {
      await client.query(
        `INSERT INTO sequences (tenant_id, name, trigger_event, steps, is_active)
         VALUES ($1, $2, $3, $4, false)`,
        [TENANT_ID, sequence.name, sequence.triggerEvent, JSON.stringify(sequence.steps)],
      );
    }
  },

  async down(client: PoolClient) {
    await client.query('DELETE FROM sequences WHERE tenant_id = $1', [TENANT_ID]);
  },
};

export default migration;