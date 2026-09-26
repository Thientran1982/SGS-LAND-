import fs from 'node:fs';
const out = [];
let p = fs.readFileSync('pages/Auction.tsx', 'utf8');
const a = `onChange={e => setStepPrice(e.target.value)} placeholder={t('auction.money_ph')}`;
if (p.includes(a)) { p = p.replace(a, `onChange={e => setStepPrice(e.target.value)} placeholder={t('auction.step_ph')}`); fs.writeFileSync('pages/Auction.tsx', p); out.push('OK page'); } else out.push('FAIL page');
let l = fs.readFileSync('config/locales.ts', 'utf8');
const m = [...l.matchAll(/^(\s*)"auction\.money_ph":.*$/gm)];
if (m.length === 2 && !l.includes('"auction.step_ph"')) {
  const [vn, en] = m;
  const enEnd = en.index + en[0].length;
  l = l.slice(0, enEnd) + `\n${en[1]}"auction.step_ph": "e.g. 50 triệu",` + l.slice(enEnd);
  const vnEnd = vn.index + vn[0].length;
  l = l.slice(0, vnEnd) + `\n${vn[1]}"auction.step_ph": "VD: 50 triệu",` + l.slice(vnEnd);
  fs.writeFileSync('config/locales.ts', l); out.push('OK locales');
} else out.push('FAIL locales ' + m.length);
console.log(out.join('\n'));
