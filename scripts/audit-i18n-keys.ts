import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import messagesJson from '../packages/shared/src/messages/en.json';
import { buildI18nKeyAuditReport } from '../packages/shared/src/audit-i18n-keys';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const report = buildI18nKeyAuditReport({ repoRoot, messages: messagesJson });

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
