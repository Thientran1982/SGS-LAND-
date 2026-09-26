// Minh panel: hide the visible "Trợ lý Minh" title (kept for screen readers); native <select> -> shared Dropdown.
import fs from 'node:fs';
const DRY = !!process.env.DRY;
const F = 'components/GuideAssistant.tsx';
let s = fs.readFileSync(F, 'utf8');
const report = [];
const step = (name, a, b) => { if (!s.includes(a)) { report.push('FAIL ' + name); return; } s = s.replace(a, () => b); };

step('import', "import { useTranslation } from '../services/i18n';\n", "import { useTranslation } from '../services/i18n';\nimport { Dropdown } from './Dropdown';\n");
step('hide title', '<h2 className="truncate text-[15px] font-semibold leading-5">{t(\'guide.title\')}</h2>', '<h2 className="sr-only">{t(\'guide.title\')}</h2>');
const i = s.indexOf('<label className="relative min-w-0 flex-1">\n                            <span className="sr-only">{t(\'guide.conversation_selector\')}</span>');
const endMarker = '</label>\n';
const j = i < 0 ? -1 : s.indexOf(endMarker, i);
if (i < 0 || j < 0) report.push('FAIL select block');
else {
  s = s.slice(0, i) + `<Dropdown
                            className="min-w-0 flex-1"
                            variant="compact"
                            value={activeConversation?.id ?? ''}
                            onChange={value => selectConversation(String(value))}
                            placeholder={t('guide.conversation_selector')}
                            options={conversations.map(conversation => ({ value: conversation.id, label: conversationLabel(conversation) }))}
                        />
` + s.slice(j + endMarker.length);
}
step('new conv btn height', 'className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--sgs-champagne)]/20',
  'className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--sgs-champagne)]/20');
if (!report.length) { if (!DRY) fs.writeFileSync(F, s); report.push('OK   ' + F); }
report.push('ChevronDown still used: ' + (s.split('ChevronDown').length - 1));
console.log(report.join('\n'));
