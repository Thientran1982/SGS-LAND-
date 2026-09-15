import { Type, type Schema } from '@google/genai';

/**
 * The extraction contract shared by the production router, the router eval,
 * and the schema drift check. Keep this list in sync with the extraction
 * object documented in routerPrompts.ts.
 */
export const ROUTER_EXTRACTION_FIELDS = [
    'budget_min',
    'budget_max',
    'location_keyword',
    'unknown_location',
    'property_type',
    'bedrooms',
    'area_min',
    'area_max',
    'loan_amount',
    'loan_years',
    'loan_rate',
    'loan_to_value_percent',
    'loan_metric',
    'loan_program',
    'loan_fee_type',
    'tax_rate',
    'loan_type',
    'legal_concern',
    'valuation_address',
    'valuation_area',
    'valuation_bedrooms',
    'valuation_legal',
    'contract_type',
    'lead_name',
    'escalation_reason',
    'explicit_question',
    'marketing_campaign',
    'valuation_road_width',
    'valuation_direction',
    'valuation_floor',
    'valuation_frontage',
    'valuation_furnishing',
    'valuation_building_age',
    'floor_min',
    'floor_max',
    'unit_direction',
    'tower',
    'project_name',
    'inventory_page',
] as const;

export type RouterExtraction = Partial<Record<typeof ROUTER_EXTRACTION_FIELDS[number], unknown>> & {
    budget_min?: number;
    budget_max?: number;
    location_keyword?: string;
    unknown_location?: boolean;
    property_type?: string;
    bedrooms?: number;
    area_min?: number;
    area_max?: number;
    loan_amount?: number;
    loan_years?: number;
    loan_rate?: number;
    loan_to_value_percent?: number;
    loan_metric?: string;
    loan_program?: string;
    loan_fee_type?: string;
    tax_rate?: number;
    loan_type?: string;
    legal_concern?: string;
    valuation_address?: string;
    valuation_area?: number;
    valuation_bedrooms?: number;
    valuation_legal?: string;
    contract_type?: string;
    lead_name?: string;
    escalation_reason?: string;
    explicit_question?: string;
    marketing_campaign?: string;
    valuation_road_width?: number;
    valuation_direction?: string;
    valuation_floor?: number;
    valuation_frontage?: number;
    valuation_furnishing?: string;
    valuation_building_age?: number;
    floor_min?: number;
    floor_max?: number;
    unit_direction?: string;
    tower?: string;
    project_name?: string;
    inventory_page?: number;
};

export const ROUTER_SCHEMA: Schema = {
    type: Type.OBJECT,
    properties: {
        next_step: {
            type: Type.STRING,
            enum: [
                'SEARCH_INVENTORY',
                'CALCULATE_LOAN',
                'DRAFT_BOOKING',
                'EXPLAIN_LEGAL',
                'EXPLAIN_MARKETING',
                'DRAFT_CONTRACT',
                'ANALYZE_LEAD',
                'ESTIMATE_VALUATION',
                'DIRECT_ANSWER',
                'CLARIFY',
                'ESCALATE_TO_HUMAN',
            ] as string[],
            description: 'Hành động phù hợp nhất cho tin nhắn khách hàng.',
        },
        extraction: {
            type: Type.OBJECT,
            properties: {
                budget_min: { type: Type.NUMBER, description: 'Ngân sách tối thiểu (VNĐ)' },
                budget_max: { type: Type.NUMBER, description: 'Ngân sách tối đa (VNĐ)' },
                location_keyword: { type: Type.STRING, description: 'Khu vực/địa điểm khách đề cập' },
                unknown_location: { type: Type.BOOLEAN, description: 'Địa danh chưa chuẩn hoá được' },
                property_type: { type: Type.STRING, description: 'Loại BĐS' },
                bedrooms: { type: Type.NUMBER, description: 'Số phòng ngủ tối thiểu để lọc kho hàng' },
                area_min: { type: Type.NUMBER, description: 'Diện tích tối thiểu (m²)' },
                area_max: { type: Type.NUMBER, description: 'Diện tích tối đa (m²)' },
                loan_amount: { type: Type.NUMBER, description: 'Số tiền vay (VNĐ)' },
                loan_years: { type: Type.NUMBER, description: 'Thời hạn vay (năm)' },
                loan_rate: { type: Type.NUMBER, description: 'Lãi suất (%/năm)' },
                loan_to_value_percent: { type: Type.NUMBER, description: 'Tỷ lệ khoản vay trên giá trị tài sản (%)' },
                loan_metric: { type: Type.STRING, description: 'Chỉ số vay: DTI hoặc LTV' },
                loan_program: { type: Type.STRING, description: 'Chương trình vay' },
                loan_fee_type: { type: Type.STRING, description: 'Loại phí vay' },
                tax_rate: { type: Type.NUMBER, description: 'Thuế suất phần trăm' },
                loan_type: { type: Type.STRING, description: 'Kiểu tính lãi: simple hoặc compound' },
                legal_concern: { type: Type.STRING, description: 'Loại pháp lý khách quan tâm' },
                valuation_address: { type: Type.STRING, description: 'Địa chỉ BĐS cần định giá' },
                valuation_area: { type: Type.NUMBER, description: 'Diện tích BĐS cần định giá (m²)' },
                valuation_bedrooms: { type: Type.NUMBER, description: 'Số phòng ngủ BĐS cần định giá' },
                valuation_legal: { type: Type.STRING, description: 'Pháp lý BĐS cần định giá' },
                contract_type: { type: Type.STRING, description: 'Loại hợp đồng' },
                lead_name: { type: Type.STRING, description: 'Tên lead nếu khách nêu rõ' },
                escalation_reason: { type: Type.STRING, description: 'Lý do chuyển người thật' },
                explicit_question: { type: Type.STRING, description: 'Câu hỏi chính xác của khách hàng' },
                marketing_campaign: { type: Type.STRING, description: 'Tên chiến dịch/ưu đãi' },
                valuation_road_width: { type: Type.NUMBER, description: 'Chiều rộng đường trước nhà (mét)' },
                valuation_direction: { type: Type.STRING, description: 'Hướng nhà' },
                valuation_floor: { type: Type.NUMBER, description: 'Tầng của BĐS cần định giá' },
                valuation_frontage: { type: Type.NUMBER, description: 'Chiều rộng mặt tiền (mét)' },
                valuation_furnishing: { type: Type.STRING, description: 'Tình trạng nội thất' },
                valuation_building_age: { type: Type.NUMBER, description: 'Tuổi công trình (năm)' },
                floor_min: { type: Type.NUMBER, description: 'Tầng tối thiểu muốn lọc' },
                floor_max: { type: Type.NUMBER, description: 'Tầng tối đa muốn lọc' },
                unit_direction: { type: Type.STRING, description: 'Hướng căn hộ/nhà' },
                tower: { type: Type.STRING, description: 'Tòa/block/tháp' },
                project_name: { type: Type.STRING, description: 'Tên dự án cụ thể' },
                inventory_page: { type: Type.NUMBER, description: 'Số trang kết quả kho hàng' },
            },
        },
        confidence: {
            type: Type.NUMBER,
            description: 'Độ tin cậy phân loại từ 0 đến 1',
        },
        additional_intents: {
            type: Type.ARRAY,
            description: 'Tối đa 2 intent phụ',
            items: {
                type: Type.STRING,
                enum: [
                    'SEARCH_INVENTORY',
                    'CALCULATE_LOAN',
                    'EXPLAIN_LEGAL',
                    'EXPLAIN_MARKETING',
                    'DRAFT_CONTRACT',
                    'ANALYZE_LEAD',
                    'ESTIMATE_VALUATION',
                ] as string[],
            },
        },
    },
    required: ['next_step', 'confidence', 'extraction'],
};