import { describe, expect, it } from 'vitest';
import { detectGuideDataGroup, renderGuideDataSummary } from '../../server/ai/guideDataSources';

describe('guide data sources', () => {
  it('routes supported page questions to the correct read-only group', () => {
    expect(detectGuideDataGroup('Tóm tắt các lead hiện tại')).toBe('leads');
    expect(detectGuideDataGroup('How many listings are available in inventory?')).toBe('inventory');
    expect(detectGuideDataGroup('Có bao nhiêu hợp đồng đã ký?')).toBe('contracts');
    expect(detectGuideDataGroup('Tôi có tin nhắn Zalo chưa đọc không?')).toBe('inbox');
    expect(detectGuideDataGroup('Tổng quan Dashboard hiện tại có những số liệu gì?')).toBe('dashboard');
  });

  it('does not misroute procedural questions to metric summaries', () => {
    expect(detectGuideDataGroup('Làm thế nào để tạo một lead?')).toBeNull();
    expect(detectGuideDataGroup('Tôi có thể làm gì trên Dashboard?')).toBeNull();
    expect(detectGuideDataGroup('How do I create a listing?')).toBeNull();
  });

  it('does not classify operations and task guide questions as data summaries', () => {
    expect(detectGuideDataGroup('Tôi có thể làm gì trong mục Quản lý công việc?')).toBeNull();
    expect(detectGuideDataGroup('Hướng dẫn dùng bảng Kanban')).toBeNull();
    expect(detectGuideDataGroup('Các mục vận hành gồm những gì?')).toBeNull();
  });

  it('renders localized summaries without exposing record-level PII', () => {
    const vn = renderGuideDataSummary({
      group: 'leads',
      language: 'vn',
      status: 'ok',
      scope: 'personal',
      freshness: '2026-08-21T00:00:00.000Z',
      summary: { total: 4, new: 2, won: 1, lost: 1 },
    });
    const en = renderGuideDataSummary({
      group: 'leads',
      language: 'en',
      status: 'ok',
      scope: 'company',
      freshness: '2026-08-21T00:00:00.000Z',
      summary: { total: 4, new: 2, won: 1, lost: 1 },
    });
    expect(vn).toContain('Tóm tắt dữ liệu');
    expect(en).toContain('Data summary');
    expect(vn).not.toContain('phone');
    expect(en).not.toContain('email');
  });

  it('uses an explicit empty state instead of inventing metrics', () => {
    expect(renderGuideDataSummary({
      group: 'inbox',
      language: 'en',
      status: 'empty',
      scope: 'company',
      freshness: '2026-08-21T00:00:00.000Z',
      summary: {},
    })).toContain('No data is available');
  });

  it('labels restricted Inbox summaries as personal scope', () => {
    const output = renderGuideDataSummary({
      group: 'inbox',
      language: 'en',
      status: 'ok',
      scope: 'personal',
      freshness: '2026-08-21T00:00:00.000Z',
      summary: { zalo: 2, facebook: 0, webChat: 1, avgResponseMinutes: 8 },
    });
    expect(output).toContain('personal scope');
    expect(output).toContain('Unread messages');
  });
});