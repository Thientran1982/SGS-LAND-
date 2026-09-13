const fs = require('fs');
const [,, target, oldFile, newFile] = process.argv;
const content = fs.readFileSync(target, 'utf8');
const oldStr = fs.readFileSync(oldFile, 'utf8');
const newStr = fs.readFileSync(newFile, 'utf8');
const parts = content.split(oldStr);
const count = parts.length - 1;
if (count !== 1) {
  console.error('FAIL ' + target + ': old string found ' + count + ' times (expected 1)');
  process.exit(1);
}
fs.writeFileSync(target, parts.join(newStr));
console.log('OK ' + target);
