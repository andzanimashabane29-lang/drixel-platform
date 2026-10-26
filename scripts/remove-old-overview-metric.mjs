import fs from 'node:fs'
const path = 'src/App.tsx'
let text = fs.readFileSync(path, 'utf8')
const start = text.indexOf('\nfunction Metric(')
const end = text.indexOf('\nfunction DirectoryNotice(', start)
if (start >= 0 && end > start) text = text.slice(0, start) + text.slice(end)
fs.writeFileSync(path, text)
