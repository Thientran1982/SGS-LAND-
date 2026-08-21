import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'Replace default campaign set with Vietnamese daily weekly monthly drafts',

  async up(client: PoolClient) {
    await client.query(`
      DELETE FROM campaigns
       WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

      INSERT INTO campaigns
        (tenant_id, name, description, channel, status, audience, subject, body_html,
         schedule_type, scheduled_at, recurrence_type, ab_test)
      VALUES
        (
          '00000000-0000-0000-0000-000000000001',
          'Bản tin bất động sản hằng ngày',
          'Gửi bản tin ngắn mỗi ngày cho lead đang quan tâm, tập trung vào nguồn hàng mới, thay đổi giá và cơ hội phù hợp.',
          'EMAIL', 'DRAFT',
          '{"source":"leads","lead_stages":["QUALIFIED","PROPOSAL","NEGOTIATION"]}'::jsonb,
          'Bản tin bất động sản hôm nay dành cho {{name}}',
          '<p>Chào {{name}},</p><p>Đây là bản tin bất động sản trong ngày từ SGS LAND.</p><p>Đội ngũ sẽ cập nhật nguồn hàng mới, biến động giá và những lựa chọn phù hợp với nhu cầu của bạn.</p><p>Hãy phản hồi email này nếu bạn muốn được tư vấn riêng.</p>',
          'SCHEDULED', CURRENT_DATE + INTERVAL '1 day' + INTERVAL '9 hours', 'DAILY', '{"enabled":false}'::jsonb
        ),
        (
          '00000000-0000-0000-0000-000000000001',
          'Tổng hợp cơ hội đầu tư hằng tuần',
          'Gửi tổng hợp cơ hội đầu tư nổi bật mỗi tuần cho lead đủ điều kiện, kèm nhận định thị trường và lời mời tư vấn.',
          'EMAIL', 'DRAFT',
          '{"source":"leads","lead_stages":["QUALIFIED","PROPOSAL","NEGOTIATION"]}'::jsonb,
          'Tổng hợp cơ hội đầu tư tuần này | SGS LAND',
          '<p>Chào {{name}},</p><p>SGS LAND gửi bạn tổng hợp những cơ hội bất động sản đáng chú ý trong tuần.</p><p>Nội dung gồm nguồn hàng mới, mức giá tham khảo, tiến độ dự án và các điểm cần lưu ý trước khi quyết định.</p><p>Nếu bạn muốn nhận danh sách phù hợp ngân sách, hãy trả lời email này để đội ngũ hỗ trợ.</p>',
          'SCHEDULED', date_trunc('week', CURRENT_TIMESTAMP) + INTERVAL '7 days' + INTERVAL '9 hours', 'WEEKLY', '{"enabled":false}'::jsonb
        ),
        (
          '00000000-0000-0000-0000-000000000001',
          'Báo cáo thị trường và danh mục hằng tháng',
          'Gửi báo cáo chuyên sâu mỗi tháng cho lead đang trong giai đoạn cân nhắc, giúp theo dõi thị trường và xây dựng kế hoạch đầu tư.',
          'EMAIL', 'DRAFT',
          '{"source":"leads","lead_stages":["QUALIFIED","PROPOSAL","NEGOTIATION"]}'::jsonb,
          'Báo cáo thị trường tháng mới từ SGS LAND',
          '<p>Chào {{name}},</p><p>Đây là báo cáo thị trường bất động sản tháng mới từ SGS LAND.</p><p>Báo cáo tổng hợp xu hướng giá, thanh khoản, hạ tầng, dự án đáng chú ý và các cơ hội cần theo dõi.</p><p>Đội ngũ SGS LAND sẵn sàng cùng bạn rà soát danh mục và xây dựng kế hoạch phù hợp.</p>',
          'SCHEDULED', date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month' + INTERVAL '9 hours', 'MONTHLY', '{"enabled":false}'::jsonb
        );
    `);
  },
};

export default migration;