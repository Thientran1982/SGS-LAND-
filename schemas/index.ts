import { z } from 'zod';

// ─── Regex helpers ───────────────────────────────────────────────────────────
const VN_PHONE_REGEX = /^(\+84|0)[0-9]{9,10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Login form ──────────────────────────────────────────────────────────────
export const loginSchema = z.object({
    email: z
        .string()
        .min(1, 'Email không được để trống')
        .regex(EMAIL_REGEX, 'Email không hợp lệ'),
    password: z
        .string()
        .min(6, 'Mật khẩu tối thiểu 6 ký tự')
        .max(100, 'Mật khẩu tối đa 100 ký tự'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// ─── Create Lead form ────────────────────────────────────────────────────────
export const createLeadSchema = z.object({
    name: z
        .string()
        .min(1, 'Họ tên không được để trống')
        .max(100, 'Họ tên tối đa 100 ký tự'),
    phone: z
        .string()
        .min(1, 'Số điện thoại không được để trống')
        .regex(VN_PHONE_REGEX, 'Số điện thoại không hợp lệ (VD: 0901234567)'),
    email: z
        .string()
        .optional()
        .refine(
            (v) => !v || EMAIL_REGEX.test(v),
            'Email không hợp lệ'
        ),
    address: z.string().max(200, 'Địa chỉ tối đa 200 ký tự').optional(),
    source: z.string().optional(),
    notes: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
    budget: z
        .number()
        .min(0, 'Ngân sách không được âm')
        .optional(),
    propertyType: z.string().optional(),
    location: z.string().optional(),
    assignedTo: z.string().optional(),
});

export type CreateLeadFormData = z.infer<typeof createLeadSchema>;

// ─── Create Listing form ─────────────────────────────────────────────────────
export const createListingSchema = z.object({
    title: z
        .string()
        .min(1, 'Tiêu đề không được để trống')
        .max(200, 'Tiêu đề tối đa 200 ký tự'),
    price: z
        .number()
        .min(0, 'Giá không được âm'),
    currency: z.enum(['VND', 'USD']).default('VND'),
    area: z
        .number()
        .min(1, 'Diện tích tối thiểu 1 m²')
        .optional(),
    bedrooms: z.number().min(0).max(20).optional(),
    bathrooms: z.number().min(0).max(20).optional(),
    location: z.string().min(1, 'Địa chỉ không được để trống'),
    type: z.string().min(1, 'Loại bất động sản không được để trống'),
    status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'RENTED']).default('AVAILABLE'),
    description: z.string().max(5000, 'Mô tả tối đa 5000 ký tự').optional(),
    projectId: z.string().optional(),
    floorNumber: z.number().min(0).max(200).optional(),
    direction: z.string().optional(),
    furnishing: z.string().optional(),
    images: z.array(z.string()).default([]),
});

export type CreateListingFormData = z.infer<typeof createListingSchema>;

// ─── Validation helpers ──────────────────────────────────────────────────────

/** Returns the first error message for a field, or undefined */
export function getFieldError<T extends Record<string, unknown>>(
    errors: Partial<Record<keyof T, { message?: string }>>,
    field: keyof T
): string | undefined {
    return errors[field]?.message;
}

/** Safe parse wrapper — returns { success, data, errors } */
export function safeValidate<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
        const key = issue.path.join('.');
        if (key && !errors[key]) {
            errors[key] = issue.message;
        }
    }
    return { success: false, errors };
}
