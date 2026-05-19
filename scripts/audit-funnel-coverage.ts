#!/usr/bin/env tsx
import {
  formatFunnelCoverageAudit,
  auditFunnelCoverage,
} from '../packages/shared/src/audit-funnel-coverage';

const repoRoot = process.cwd();

try {
  const result = auditFunnelCoverage({ repoRoot });
  console.log(formatFunnelCoverageAudit(result));
  if (!result.ok) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
