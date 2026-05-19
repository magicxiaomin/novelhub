#!/usr/bin/env tsx
import {
  auditQuarantineRegister,
  formatQuarantineRegisterAudit,
} from '../packages/shared/src/audit-quarantine-register';

const repoRoot = process.cwd();

try {
  const result = auditQuarantineRegister({ repoRoot });
  console.log(formatQuarantineRegisterAudit(result));
  if (!result.ok) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
