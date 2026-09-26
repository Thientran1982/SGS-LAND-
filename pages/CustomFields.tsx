import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dropdown } from '../components/Dropdown';
import dbApi from '../services/dbApi';
import { useTranslation } from '../services/i18n';
import {
  SettingsPage,
  SettingsHeader,
  SettingsCard,
  StatTile,
  StatGrid,
  DistributionBar,
  StatusBadge,
  EmptyState,
  Segment,
} from '../components/settings/SettingsUI';

/**
 * CustomFields.tsx – manage tenant custom fields.
 * Data lives in the custom_fields table (Postgres) via /api/custom-fields.
 */

interface CustomField {
  id: string;
  label: string;
  key: string;
  entity: string;
  type: string;
  required: boolean;
}

// Values accepted by the API (server/routes/customFieldRoutes.ts); labels are i18n keys.
const ENTITIES = [
  { value: 'listing', labelKey: 'customfields.entity_listing' },
  { value: 'lead', labelKey: 'customfields.entity_lead' },
  { value: 'project', labelKey: 'customfields.entity_project' },
  { value: 'contract', labelKey: 'customfields.entity_contract' },
];

const FIELD_TYPES = [
  { value: 'text', labelKey: 'customfields.type_text' },
  { value: 'number', labelKey: 'customfields.type_number' },
  { value: 'date', labelKey: 'customfields.type_date' },
  { value: 'select', labelKey: 'customfields.type_select' },
  { value: 'boolean', labelKey: 'customfields.type_boolean' },
];

const ICONS = {
  FIELDS: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7m9-3v6m-3-3h6" /></svg>,
  ADD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  ALERT: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>,
};

/** Count fields per value, known options first (in their order), unknown values appended. */
const countBy = (fields: CustomField[], pick: (f: CustomField) => string, known: { value: string }[], labelOf: (v: string) => string): Segment[] => {
  const counts = new Map<string, number>();
  fields.forEach((f) => counts.set(pick(f), (counts.get(pick(f)) || 0) + 1));
  const order = [...known.map((k) => k.value), ...[...counts.keys()].filter((v) => !known.some((k) => k.value === v))];
  return order.map((v) => ({ label: labelOf(v), value: counts.get(v) || 0 }));
};

export default function CustomFields() {
  const { t, language } = useTranslation();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [label, setLabel] = useState('');
  const [entity, setEntity] = useState('listing');
  const [type, setType] = useState('text');
  const [required, setRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const mapRow = (r: any): CustomField => ({
    id: r.id,
    label: r.label,
    key: r.fieldKey ?? r.field_key ?? '',
    entity: r.entity,
    type: r.fieldType ?? r.field_type ?? 'text',
    required: !!r.required,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await dbApi.getCustomFields();
      setFields((rows as any[]).map(mapRow));
    } catch (e: any) {
      setError(e?.message || t('customfields.err_load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!label.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const row = await dbApi.createCustomField({ label: label.trim(), entity, fieldType: type, required });
      setFields((prev) => [...prev, mapRow(row)]);
      setLabel('');
      setRequired(false);
    } catch (e: any) {
      setError(e?.message || t('customfields.err_add'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const prev = fields;
    setFields((f) => f.filter((x) => x.id !== id));
    try {
      await dbApi.deleteCustomField(id);
    } catch (e: any) {
      setError(e?.message || t('customfields.err_delete'));
      setFields(prev);
    }
  };

  const entityOptions = useMemo(() => ENTITIES.map((e) => ({ value: e.value, label: t(e.labelKey) })), [t]);
  const typeOptions = useMemo(() => FIELD_TYPES.map((x) => ({ value: x.value, label: t(x.labelKey) })), [t]);
  const entityLabel = useCallback((v: string) => entityOptions.find((e) => e.value === v)?.label || v, [entityOptions]);
  const typeLabel = useCallback((v: string) => typeOptions.find((x) => x.value === v)?.label || v, [typeOptions]);

  const locale = language === 'vn' ? 'vi-VN' : 'en-US';
  const num = (n: number) => n.toLocaleString(locale);

  const stats = useMemo(() => {
    const byEntity = countBy(fields, (f) => f.entity, ENTITIES, entityLabel);
    const byType = countBy(fields, (f) => f.type, FIELD_TYPES, typeLabel);
    const requiredCount = fields.filter((f) => f.required).length;
    return {
      byEntity,
      byType,
      requiredCount,
      requiredPct: fields.length ? Math.round((requiredCount / fields.length) * 100) : null,
      entitiesUsed: byEntity.filter((s) => s.value > 0).length,
      typesUsed: byType.filter((s) => s.value > 0).length,
    };
  }, [fields, entityLabel, typeLabel]);

  // Until the first load finishes, KPI values are unknown rather than zero.
  const kpi = (n: number) => (loading && fields.length === 0 ? '—' : num(n));

  return (
    <SettingsPage>
      <SettingsHeader
        icon={ICONS.FIELDS}
        title={t('customfields.title')}
        description={t('customfields.subtitle')}
      />

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-[var(--ui-danger)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--ui-danger)]">
          <span className="mt-0.5 shrink-0">{ICONS.ALERT}</span>
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}

      <StatGrid cols={4}>
        <StatTile label={t('customfields.stat_total')} value={kpi(fields.length)} tone="brand" />
        <StatTile
          label={t('customfields.stat_required')}
          value={kpi(stats.requiredCount)}
          hint={stats.requiredPct != null ? t('customfields.stat_required_hint', { n: stats.requiredPct }) : undefined}
          tone={stats.requiredCount > 0 ? 'accent' : 'neutral'}
        />
        <StatTile
          label={t('customfields.stat_entities')}
          value={loading && fields.length === 0 ? '—' : <>{stats.entitiesUsed}<span className="text-base font-semibold text-[var(--text-tertiary)]"> / {ENTITIES.length}</span></>}
        />
        <StatTile
          label={t('customfields.stat_types')}
          value={loading && fields.length === 0 ? '—' : <>{stats.typesUsed}<span className="text-base font-semibold text-[var(--text-tertiary)]"> / {FIELD_TYPES.length}</span></>}
        />
      </StatGrid>

      <SettingsCard title={t('customfields.add_title')} description={t('customfields.add_desc')}>
        <form
          onSubmit={(e) => { e.preventDefault(); add(); }}
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto_auto]"
        >
          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor="custom-field-label" className="mb-1.5 ml-0.5 block text-xs font-semibold text-[var(--text-tertiary)]">{t('customfields.label_name')}</label>
            <input
              id="custom-field-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('customfields.placeholder_name')}
              className="ui-input w-full min-h-[44px] text-[16px] sm:text-sm"
            />
          </div>
          <Dropdown label={t('customfields.label_entity')} value={entity} onChange={(v) => setEntity(v as string)} options={entityOptions} />
          <Dropdown label={t('customfields.label_type')} value={type} onChange={(v) => setType(v as string)} options={typeOptions} />
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-1 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-5 w-5 cursor-pointer accent-[var(--sgs-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
            />
            <span>{t('customfields.label_required')}</span>
          </label>
          <button
            type="submit"
            disabled={saving || !label.trim()}
            className="ui-button ui-button-primary ui-button-md inline-flex min-h-[44px] items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ICONS.ADD} {saving ? t('customfields.saving') : t('customfields.btn_add')}
          </button>
        </form>
      </SettingsCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SettingsCard title={t('customfields.by_entity')}>
          {loading && fields.length === 0 ? (
            <div className="py-2 text-xs text-[var(--text-tertiary)]" role="status">{t('customfields.loading')}</div>
          ) : (
            <DistributionBar segments={stats.byEntity} ariaLabel={t('customfields.by_entity_aria')} emptyText={t('customfields.dist_empty')} formatValue={num} />
          )}
        </SettingsCard>
        <SettingsCard title={t('customfields.by_type')}>
          {loading && fields.length === 0 ? (
            <div className="py-2 text-xs text-[var(--text-tertiary)]" role="status">{t('customfields.loading')}</div>
          ) : (
            <DistributionBar segments={stats.byType} ariaLabel={t('customfields.by_type_aria')} emptyText={t('customfields.dist_empty')} formatValue={num} />
          )}
        </SettingsCard>
      </div>

      <SettingsCard
        title={t('customfields.list_title')}
        description={!loading || fields.length > 0 ? t('customfields.list_desc', { n: num(fields.length) }) : undefined}
      >
        {loading && fields.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--text-secondary)] animate-pulse" role="status">{t('customfields.loading')}</div>
        ) : fields.length === 0 ? (
          <EmptyState icon={ICONS.FIELDS} title={t('customfields.empty_title')} description={t('customfields.empty_desc')} />
        ) : (
          <>
            {/* Mobile: stacked rows */}
            <ul className="divide-y divide-[var(--glass-border)] md:hidden">
              {fields.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{f.label}</span>
                      {f.required && <StatusBadge tone="accent">{t('customfields.label_required')}</StatusBadge>}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-xs text-[var(--text-tertiary)]">{f.key}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">{entityLabel(f.entity)} · {typeLabel(f.type)}</div>
                  </div>
                  <DeleteButton label={t('customfields.delete')} ariaLabel={t('customfields.delete_aria', { name: f.label })} onClick={() => remove(f.id)} />
                </li>
              ))}
            </ul>

            {/* Tablet/desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--glass-border)] text-left text-xs font-medium text-[var(--text-secondary)]">
                    <th scope="col" className="pb-3 pr-4">{t('customfields.label_name')}</th>
                    <th scope="col" className="pb-3 pr-4">{t('customfields.col_key')}</th>
                    <th scope="col" className="pb-3 pr-4">{t('customfields.label_entity')}</th>
                    <th scope="col" className="pb-3 pr-4">{t('customfields.col_type')}</th>
                    <th scope="col" className="pb-3 pr-4">{t('customfields.label_required')}</th>
                    <th scope="col" className="pb-3"><span className="sr-only">{t('customfields.delete')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f) => (
                    <tr key={f.id} className="border-b border-[var(--glass-border)] transition-colors last:border-0 hover:bg-[var(--glass-surface)]">
                      <td className="py-2 pr-4 font-semibold text-[var(--text-primary)]">{f.label}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-[var(--text-tertiary)]">{f.key}</td>
                      <td className="py-2 pr-4 text-[var(--text-secondary)]">{entityLabel(f.entity)}</td>
                      <td className="py-2 pr-4 text-[var(--text-secondary)]">{typeLabel(f.type)}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge tone={f.required ? 'accent' : 'neutral'}>{f.required ? t('customfields.yes') : t('customfields.no')}</StatusBadge>
                      </td>
                      <td className="py-2 text-right">
                        <DeleteButton label={t('customfields.delete')} ariaLabel={t('customfields.delete_aria', { name: f.label })} onClick={() => remove(f.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SettingsCard>
    </SettingsPage>
  );
}

const DeleteButton: React.FC<{ label: string; ariaLabel: string; onClick: () => void }> = ({ label, ariaLabel, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    className="ui-button ui-button-ghost ui-button-sm inline-flex min-h-[40px] shrink-0 items-center gap-1.5 text-[var(--ui-danger)]"
  >
    {ICONS.TRASH} {label}
  </button>
);
