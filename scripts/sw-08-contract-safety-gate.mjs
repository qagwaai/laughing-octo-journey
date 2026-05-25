import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FRONTEND_INVENTORY = 'docs/planning/sw-08/frontend-consumer-contract-inventory.json';
const DEFAULT_BACKEND_ARTIFACT = 'docs/planning/sw-08/backend-contract-artifact.json';
const DEFAULT_REPORT_DIR = 'reports/sw-08-contract-safety-gate';
const DEFAULT_MODE = 'hard-fail';
const DEFAULT_EXCEPTION_MAX_DAYS = Number.parseInt(process.env.SW08_EXCEPTION_MAX_DAYS ?? '14', 10);
const DEFAULT_EXCEPTION_NEAR_EXPIRY_DAYS = Number.parseInt(process.env.SW08_EXCEPTION_NEAR_EXPIRY_DAYS ?? '3', 10);
const WEEKLY_WINDOW_DAYS = 7;
const ROLLING_WINDOW_DAYS = 30;
const REPEAT_DRIFT_THRESHOLD = Number.parseInt(process.env.SW08_REPEAT_DRIFT_THRESHOLD ?? '3', 10);
const REQUIRED_SURFACE_IDS = [
  'auth/session',
  'character/ship',
  'market/ledger',
  'mission flows',
  'item catalog/fabrication',
  'ship-external-view',
];

const REMEDIATION_HINTS = {
  'backend remediation': 'Update the backend contract artifact and migration notes, then re-run the gate.',
  'frontend remediation': 'Update frontend consumer mappings and fallback handling, then re-run the gate.',
  'coordinated fix': 'Coordinate producer and consumer changes together and keep the exception short-lived.',
};

function resolveWorkspacePath(relativePath) {
  return path.resolve(process.cwd(), relativePath);
}

function readJsonFile(filePath) {
  const resolvedPath = resolveWorkspacePath(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Missing JSON file: ${filePath}`);
  }

  const raw = fs.readFileSync(resolvedPath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Unable to parse ${filePath}: ${error.message}`);
  }
}

function parseArgs(argv) {
  const args = {
    frontendInventory: DEFAULT_FRONTEND_INVENTORY,
    backendArtifact: DEFAULT_BACKEND_ARTIFACT,
    reportDir: DEFAULT_REPORT_DIR,
    mode: DEFAULT_MODE,
    exceptionFile: process.env.SW08_CONTRACT_EXCEPTION_FILE ?? '',
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--frontend-inventory' && next) {
      args.frontendInventory = next;
      index += 1;
      continue;
    }

    if (token === '--backend-artifact' && next) {
      args.backendArtifact = next;
      index += 1;
      continue;
    }

    if (token === '--report-dir' && next) {
      args.reportDir = next;
      index += 1;
      continue;
    }

    if (token === '--mode' && next) {
      args.mode = next;
      index += 1;
      continue;
    }

    if (token === '--exception-file' && next) {
      args.exceptionFile = next;
      index += 1;
      continue;
    }
  }

  return args;
}

function normalizeMode(mode) {
  const normalizedMode = String(mode ?? '').trim().toLowerCase();
  if (normalizedMode === 'report-only' || normalizedMode === 'soft-fail' || normalizedMode === 'hard-fail') {
    return normalizedMode;
  }

  return DEFAULT_MODE;
}

function isCanonicalInventoryPath(frontendInventoryPath) {
  return path.normalize(String(frontendInventoryPath ?? '')) === path.normalize(DEFAULT_FRONTEND_INVENTORY);
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function flattenContracts(catalog) {
  const surfaces = Array.isArray(catalog?.surfaces) ? catalog.surfaces : [];
  return surfaces.flatMap((surface) => {
    const surfaceContracts = Array.isArray(surface?.contracts) ? surface.contracts : [];
    return surfaceContracts.map((contract) => ({
      surfaceId: String(surface?.id ?? '').trim(),
      surfaceLabel: String(surface?.label ?? surface?.id ?? 'Unknown surface').trim(),
      surfaceOwnerTag: String(surface?.ownerTag ?? 'frontend remediation').trim(),
      consumerFiles: Array.isArray(surface?.consumerFiles) ? surface.consumerFiles : [],
      ...contract,
    }));
  });
}

function indexByContractId(contracts) {
  return new Map(contracts.map((contract) => [String(contract.contractId ?? '').trim(), contract]));
}

function toComparableValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean))].sort();
}

function compareEnumValues(expectedValues, actualValues) {
  const expected = toComparableValues(expectedValues);
  const actual = toComparableValues(actualValues);

  if (expected.length === 0) {
    return actual.length === 0;
  }

  if (expected.length !== actual.length) {
    return false;
  }

  return expected.every((value, index) => value === actual[index]);
}

function compareEnumValuesWithPolicy(expectedValues, actualValues, allowAdditionalValues) {
  if (allowAdditionalValues === true) {
    const expected = toComparableValues(expectedValues);
    const actual = toComparableValues(actualValues);
    return expected.every((value) => actual.includes(value));
  }

  return compareEnumValues(expectedValues, actualValues);
}

function buildFieldIndex(fields) {
  const index = new Map();
  for (const field of Array.isArray(fields) ? fields : []) {
    const pathValue = String(field?.path ?? '').trim();
    if (!pathValue) {
      continue;
    }

    index.set(pathValue, field);
  }

  return index;
}

function findRenamedContract(expectedContract, backendContracts) {
  return backendContracts.find((candidate) => {
    return (
      candidate.surfaceId === expectedContract.surfaceId &&
      String(candidate.kind ?? '').trim() === String(expectedContract.kind ?? '').trim() &&
      (String(candidate.requestEvent ?? '').trim() !== String(expectedContract.requestEvent ?? '').trim() ||
        String(candidate.responseEvent ?? '').trim() !== String(expectedContract.responseEvent ?? '').trim())
    );
  });
}

function formatConsumerLocation(consumerFiles) {
  const files = Array.isArray(consumerFiles) ? consumerFiles.filter(Boolean) : [];
  return files.length > 0 ? files.join(', ') : 'n/a';
}

function getRemediationHint(ownerTag) {
  return REMEDIATION_HINTS[String(ownerTag ?? '').trim()] ?? 'Review the owning contract surface and update the consumer or producer contract as needed.';
}

function getNextAction(finding) {
  const category = String(finding?.category ?? '').trim();
  const fieldPath = String(finding?.fieldPath ?? 'n/a').trim();

  if (category === 'missing required field') {
    return `Restore required field ${fieldPath} in producer contract or update frontend expectation, then run npm run contract:check:stage3.`;
  }

  if (category === 'type mismatch') {
    return `Align producer and consumer type at ${fieldPath} and re-run npm run contract:check:stage3.`;
  }

  if (category === 'enum/value mismatch') {
    return `Align enum values at ${fieldPath} or document safe extension policy, then re-run npm run contract:check:stage3.`;
  }

  if (category === 'endpoint/event missing' || category === 'endpoint/event renamed') {
    return 'Restore endpoint/event compatibility or coordinated alias path, then re-run npm run contract:check:stage3.';
  }

  return 'Review the drift details, assign owner, and re-run npm run contract:check:stage3.';
}

function buildFindingSignature(finding) {
  return [finding.contractId, finding.category, finding.fieldPath].map((value) => String(value ?? '').trim()).join('::');
}

function parseApprovedException(exceptionFile, findings) {
  if (!exceptionFile) {
    return null;
  }

  const manifest = readJsonFile(exceptionFile);
  const validationErrors = [];
  const requiredFields = ['reason', 'impact', 'expiryDate', 'rollbackPlan', 'followUpTicket', 'followUpOwner'];

  if (String(manifest?.status ?? '').trim() !== 'approved') {
    validationErrors.push('Exception status must be approved.');
  }

  for (const fieldName of requiredFields) {
    if (!String(manifest?.[fieldName] ?? '').trim()) {
      validationErrors.push(`Exception is missing required field: ${fieldName}.`);
    }
  }

  if (manifest?.approvals?.frontendLead !== true) {
    validationErrors.push('Exception must include frontendLead approval.');
  }

  if (manifest?.approvals?.backendLead !== true) {
    validationErrors.push('Exception must include backendLead approval.');
  }

  const expiryTimestamp = Date.parse(String(manifest?.expiryDate ?? ''));
  const nowTimestamp = Date.now();
  let expiryDaysRemaining = null;
  let nearExpiry = false;
  if (Number.isNaN(expiryTimestamp)) {
    validationErrors.push('Exception expiryDate must be a parseable date.');
  } else if (expiryTimestamp < nowTimestamp) {
    validationErrors.push('Exception expiryDate has already passed.');
  } else {
    expiryDaysRemaining = Number(((expiryTimestamp - nowTimestamp) / (24 * 60 * 60 * 1000)).toFixed(2));

    if (isFiniteNumber(DEFAULT_EXCEPTION_MAX_DAYS) && DEFAULT_EXCEPTION_MAX_DAYS > 0) {
      const maxWindowMs = DEFAULT_EXCEPTION_MAX_DAYS * 24 * 60 * 60 * 1000;
      if (expiryTimestamp - nowTimestamp > maxWindowMs) {
        validationErrors.push(`Exception expiryDate exceeds max allowed window (${DEFAULT_EXCEPTION_MAX_DAYS} days).`);
      }
    }

    if (isFiniteNumber(DEFAULT_EXCEPTION_NEAR_EXPIRY_DAYS) && DEFAULT_EXCEPTION_NEAR_EXPIRY_DAYS >= 0) {
      nearExpiry = expiryDaysRemaining <= DEFAULT_EXCEPTION_NEAR_EXPIRY_DAYS;
    }
  }

  const allowedFindings = Array.isArray(manifest?.allowedFindings) ? manifest.allowedFindings : [];
  if (allowedFindings.length === 0) {
    validationErrors.push('Exception must include at least one allowedFinding entry.');
  }

  const allowedSignatures = new Set(
    allowedFindings
      .map((item) => [item?.contractId, item?.category, item?.fieldPath].map((value) => String(value ?? '').trim()).join('::'))
      .filter((signature) => signature !== '::'),
  );
  const unmatchedFindings = findings
    .map(buildFindingSignature)
    .filter((signature) => !allowedSignatures.has(signature));

  if (unmatchedFindings.length > 0) {
    validationErrors.push(`Exception does not cover findings: ${unmatchedFindings.join(', ')}.`);
  }

  return {
    filePath: exceptionFile,
    manifest,
    validationErrors,
    isApproved: validationErrors.length === 0,
    nearExpiry,
    expiryDaysRemaining,
    matchedFindingSignatures: findings.map(buildFindingSignature).filter((signature) => allowedSignatures.has(signature)),
  };
}

function summarizeByKey(findings, key) {
  return findings.reduce((summary, finding) => {
    const bucket = String(finding?.[key] ?? 'unknown').trim() || 'unknown';
    summary[bucket] = (summary[bucket] ?? 0) + 1;
    return summary;
  }, {});
}

function toReportFinding(finding) {
  return {
    ...finding,
    consumerLocation: formatConsumerLocation(finding.consumerFiles),
    producerContractSurface: finding.surfaceLabel,
    producerLocation: finding.backendArtifactPath,
    remediationHint: getRemediationHint(finding.ownerTag),
    nextAction: getNextAction(finding),
  };
}

function evaluateCriticalSurfaceCoverage(catalog) {
  const surfaces = Array.isArray(catalog?.surfaces) ? catalog.surfaces : [];
  const presentIds = new Set(
    surfaces
      .map((surface) => String(surface?.id ?? '').trim())
      .filter(Boolean),
  );

  const missingSurfaceIds = REQUIRED_SURFACE_IDS.filter((surfaceId) => !presentIds.has(surfaceId));

  return {
    requiredSurfaceIds: REQUIRED_SURFACE_IDS,
    presentSurfaceIds: [...presentIds].sort(),
    missingSurfaceIds,
    status: missingSurfaceIds.length === 0 ? 'complete' : 'incomplete',
  };
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function appendJsonLine(filePath, payload) {
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
}

function summarizeFindingsBy(events, selector) {
  return events.reduce((summary, event) => {
    const findings = Array.isArray(event?.findings) ? event.findings : [];
    for (const finding of findings) {
      const key = String(selector(finding) ?? '').trim();
      if (!key) {
        continue;
      }

      summary[key] = (summary[key] ?? 0) + 1;
    }

    return summary;
  }, {});
}

function collectRepeatOffenders(events, threshold) {
  const counts = {};
  for (const event of events) {
    const findings = Array.isArray(event?.findings) ? event.findings : [];
    for (const finding of findings) {
      const surfaceId = String(finding?.surfaceId ?? '').trim();
      const category = String(finding?.category ?? '').trim();
      if (!surfaceId || !category) {
        continue;
      }

      const key = `${surfaceId}::${category}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return Object.entries(counts)
    .filter(([, count]) => count >= threshold)
    .map(([key, count]) => {
      const [surfaceId, category] = key.split('::');
      return { surfaceId, category, count };
    })
    .sort((a, b) => b.count - a.count);
}

function computeWindowMetrics(events, windowDays, nowTimestamp = Date.now()) {
  const windowStartTimestamp = nowTimestamp - windowDays * 24 * 60 * 60 * 1000;
  const scopedEvents = events
    .filter((event) => Number.isFinite(event?.timestampMs) && event.timestampMs >= windowStartTimestamp)
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const isFailureDecision = (decision) =>
    decision === 'hard-fail' || decision === 'invalid-exception' || decision === 'coverage-gap';
  const isRecoveredDecision = (decision) => decision === 'pass' || decision === 'approved-exception';

  const resolutionDurationsMs = [];
  for (let index = 0; index < scopedEvents.length; index += 1) {
    const event = scopedEvents[index];
    if (!isFailureDecision(String(event?.decision ?? '').trim())) {
      continue;
    }

    for (let nextIndex = index + 1; nextIndex < scopedEvents.length; nextIndex += 1) {
      const candidate = scopedEvents[nextIndex];
      if (!isRecoveredDecision(String(candidate?.decision ?? '').trim())) {
        continue;
      }

      resolutionDurationsMs.push(candidate.timestampMs - event.timestampMs);
      break;
    }
  }

  const mttrHours =
    resolutionDurationsMs.length > 0
      ? Number((resolutionDurationsMs.reduce((total, value) => total + value, 0) / resolutionDurationsMs.length / 3600000).toFixed(2))
      : null;

  const findingsByClass = summarizeFindingsBy(scopedEvents, (finding) => finding.category);
  const findingsBySurface = summarizeFindingsBy(scopedEvents, (finding) => finding.surfaceId);
  const findingsByOwnerTag = summarizeFindingsBy(scopedEvents, (finding) => finding.ownerTag);
  const repeatOffenders = collectRepeatOffenders(scopedEvents, REPEAT_DRIFT_THRESHOLD);

  const bypassEvents = scopedEvents.filter((event) => String(event?.decision ?? '').trim() === 'approved-exception');
  const bypassCount = bypassEvents.length;
  const expiredBypasses = scopedEvents.filter((event) => event?.exceptionExpired === true).length;
  const nearExpiryBypasses = scopedEvents.filter((event) => event?.exceptionNearExpiry === true).length;

  const totalFindings = scopedEvents.reduce((total, event) => total + Number(event?.findingCount ?? 0), 0);
  const falsePositiveProxyRate = totalFindings > 0 ? Number((bypassEvents.reduce((sum, event) => sum + Number(event?.findingCount ?? 0), 0) / totalFindings).toFixed(3)) : 0;

  return {
    windowDays,
    generatedAt: new Date(nowTimestamp).toISOString(),
    eventsInWindow: scopedEvents.length,
    driftCount: totalFindings,
    driftCountByClass: findingsByClass,
    impactedSurfaceCounts: findingsBySurface,
    ownerTagCounts: findingsByOwnerTag,
    mttrHours,
    bypassCount,
    expiredBypasses,
    nearExpiryBypasses,
    repeatOffenders,
    falsePositiveBaseline: {
      proxyRate: falsePositiveProxyRate,
      metric: 'approved_exception_findings / total_findings',
      actionPlan: [
        'Prioritize top repeat offender surfaces for contract alignment with producer owners.',
        'Require migration notes when frontend assumptions or consumer inventory fields change.',
        'Review allowAdditionalValues usage quarterly to ensure it remains narrowly scoped.',
      ],
    },
  };
}

function renderWeeklyMetricsMarkdown(metrics) {
  const lines = [
    '# SW-08 Weekly Metrics',
    '',
    `- Window (days): ${metrics.windowDays}`,
    `- Generated at: ${metrics.generatedAt}`,
    `- Events in window: ${metrics.eventsInWindow}`,
    `- Drift count: ${metrics.driftCount}`,
    `- Drift by class: ${JSON.stringify(metrics.driftCountByClass)}`,
    `- Impacted surfaces: ${JSON.stringify(metrics.impactedSurfaceCounts)}`,
    `- Owner tags: ${JSON.stringify(metrics.ownerTagCounts)}`,
    `- MTTR (hours): ${metrics.mttrHours ?? 'n/a'}`,
    `- Bypass count: ${metrics.bypassCount}`,
    `- Expired bypasses: ${metrics.expiredBypasses}`,
    `- Near-expiry bypasses: ${metrics.nearExpiryBypasses}`,
    `- Repeat offenders: ${metrics.repeatOffenders.length > 0 ? JSON.stringify(metrics.repeatOffenders) : 'none'}`,
    `- False-positive baseline (${metrics.falsePositiveBaseline.metric}): ${metrics.falsePositiveBaseline.proxyRate}`,
    '',
  ];

  if (Array.isArray(metrics.falsePositiveBaseline?.actionPlan)) {
    lines.push('## Baseline Action Plan');
    for (const action of metrics.falsePositiveBaseline.actionPlan) {
      lines.push(`- ${action}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function compareContract(expectedContract, backendContract, allBackendContracts) {
  const findings = [];
  const ownerTag = String(expectedContract.ownerTag ?? expectedContract.surfaceOwnerTag ?? 'frontend remediation').trim();
  const consumerFiles = Array.isArray(expectedContract.consumerFiles) ? expectedContract.consumerFiles : [];
  const backendArtifactPath = String(expectedContract.backendArtifactPath ?? '').trim() || 'unknown backend artifact';
  const baseContext = {
    surfaceId: expectedContract.surfaceId,
    surfaceLabel: expectedContract.surfaceLabel,
    contractId: expectedContract.contractId,
    ownerTag,
    consumerFiles,
    backendArtifactPath,
  };

  if (!backendContract) {
    const renamed = findRenamedContract(expectedContract, allBackendContracts);
    findings.push({
      ...baseContext,
      category: renamed ? 'endpoint/event renamed' : 'endpoint/event missing',
      severity: 'breaking',
      fieldPath: 'n/a',
      detail: renamed
        ? `Backend contract exists under a renamed socket contract for ${expectedContract.contractId}.`
        : `Backend contract ${expectedContract.contractId} was not found in the backend artifact.`,
      expected: `${expectedContract.requestEvent} -> ${expectedContract.responseEvent}`,
      actual: renamed ? `${renamed.requestEvent} -> ${renamed.responseEvent}` : 'missing',
    });
    return findings;
  }

  if (String(expectedContract.requestEvent ?? '').trim() !== String(backendContract.requestEvent ?? '').trim()) {
    findings.push({
      ...baseContext,
      category: 'endpoint/event renamed',
      severity: 'breaking',
      fieldPath: 'requestEvent',
      detail: `Request event changed for ${expectedContract.contractId}.`,
      expected: String(expectedContract.requestEvent ?? '').trim(),
      actual: String(backendContract.requestEvent ?? '').trim() || 'missing',
    });
  }

  if (String(expectedContract.responseEvent ?? '').trim() !== String(backendContract.responseEvent ?? '').trim()) {
    findings.push({
      ...baseContext,
      category: 'endpoint/event renamed',
      severity: 'breaking',
      fieldPath: 'responseEvent',
      detail: `Response event changed for ${expectedContract.contractId}.`,
      expected: String(expectedContract.responseEvent ?? '').trim(),
      actual: String(backendContract.responseEvent ?? '').trim() || 'missing',
    });
  }

  const requestExpected = buildFieldIndex(expectedContract.requestFields);
  const requestActual = buildFieldIndex(backendContract.requestFields);
  const responseExpected = buildFieldIndex(expectedContract.responseFields);
  const responseActual = buildFieldIndex(backendContract.responseFields);

  for (const [fieldPath, expectedField] of requestExpected.entries()) {
    const actualField = requestActual.get(fieldPath);
    const contextPath = `request.${fieldPath}`;
    if (!actualField) {
      if (expectedField.required === true) {
        findings.push({
          ...baseContext,
          category: 'missing required field',
          severity: 'breaking',
          fieldPath: contextPath,
          detail: `Required request field ${contextPath} is missing from the backend artifact.`,
          expected: expectedField.type,
          actual: 'missing',
        });
      }
      continue;
    }

    if (expectedField.required === true && actualField.required !== true) {
      findings.push({
        ...baseContext,
        category: 'missing required field',
        severity: 'breaking',
        fieldPath: contextPath,
        detail: `Required request field ${contextPath} is not marked required by the backend artifact.`,
        expected: 'required',
        actual: String(actualField.required ?? 'missing'),
      });
    }

    if (String(expectedField.type ?? '').trim() !== String(actualField.type ?? '').trim()) {
      findings.push({
        ...baseContext,
        category: 'type mismatch',
        severity: 'breaking',
        fieldPath: contextPath,
        detail: `Request field ${contextPath} changed type.`,
        expected: String(expectedField.type ?? '').trim(),
        actual: String(actualField.type ?? '').trim() || 'missing',
      });
    }

    if (
      expectedField.type === 'enum' &&
      !compareEnumValuesWithPolicy(expectedField.values, actualField.values, expectedField.allowAdditionalValues === true)
    ) {
      findings.push({
        ...baseContext,
        category: 'enum/value mismatch',
        severity: 'breaking',
        fieldPath: contextPath,
        detail: `Request enum values changed for ${contextPath}.`,
        expected: JSON.stringify(toComparableValues(expectedField.values)),
        actual: JSON.stringify(toComparableValues(actualField.values)),
      });
    }
  }

  for (const [fieldPath, expectedField] of responseExpected.entries()) {
    const actualField = responseActual.get(fieldPath);
    const contextPath = `response.${fieldPath}`;
    if (!actualField) {
      if (expectedField.required === true) {
        findings.push({
          ...baseContext,
          category: 'missing required field',
          severity: 'breaking',
          fieldPath: contextPath,
          detail: `Required response field ${contextPath} is missing from the backend artifact.`,
          expected: expectedField.type,
          actual: 'missing',
        });
      }
      continue;
    }

    if (expectedField.required === true && actualField.required !== true) {
      findings.push({
        ...baseContext,
        category: 'missing required field',
        severity: 'breaking',
        fieldPath: contextPath,
        detail: `Required response field ${contextPath} is not marked required by the backend artifact.`,
        expected: 'required',
        actual: String(actualField.required ?? 'missing'),
      });
    }

    if (String(expectedField.type ?? '').trim() !== String(actualField.type ?? '').trim()) {
      findings.push({
        ...baseContext,
        category: 'type mismatch',
        severity: 'breaking',
        fieldPath: contextPath,
        detail: `Response field ${contextPath} changed type.`,
        expected: String(expectedField.type ?? '').trim(),
        actual: String(actualField.type ?? '').trim() || 'missing',
      });
    }

    if (
      expectedField.type === 'enum' &&
      !compareEnumValuesWithPolicy(expectedField.values, actualField.values, expectedField.allowAdditionalValues === true)
    ) {
      findings.push({
        ...baseContext,
        category: 'enum/value mismatch',
        severity: 'breaking',
        fieldPath: contextPath,
        detail: `Response enum values changed for ${contextPath}.`,
        expected: JSON.stringify(toComparableValues(expectedField.values)),
        actual: JSON.stringify(toComparableValues(actualField.values)),
      });
    }
  }

  return findings;
}

function escapeMarkdownCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function renderMarkdownReport(result) {
  const lines = [
    '# SW-08 Contract Safety Gate Report',
    '',
    `- Mode: ${result.mode}`,
    `- Decision: ${result.decision}`,
    `- Frontend inventory: ${result.frontendInventoryPath}`,
    `- Backend artifact: ${result.backendArtifactPath}`,
    `- Contracts checked: ${result.contractCount}`,
    `- Findings: ${result.findings.length}`,
    `- Critical surface coverage: ${result.criticalSurfaceCoverage.status}`,
    '',
  ];

  if (result.exception) {
    lines.push(`- Exception: ${result.exception.filePath}`);
    if (result.exception.followUpTicket) {
      lines.push(`- Exception ticket: ${result.exception.followUpTicket}`);
    }
    if (result.exceptionNearExpiry === true) {
      lines.push('- Exception status: near-expiry');
    }
    lines.push('');
  }

  if (result.criticalSurfaceCoverage.missingSurfaceIds.length > 0) {
    lines.push(`- Missing critical surfaces: ${result.criticalSurfaceCoverage.missingSurfaceIds.join(', ')}`);
    lines.push('');
  }

  if (result.findings.length === 0) {
    lines.push('No drift detected.', '');
    return lines.join('\n');
  }

  lines.push('| Category | Severity | Owner | Producer surface | Consumer location | Field | Expected | Actual | Remediation hint | Next action |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');

  for (const finding of result.findings) {
    lines.push(
      `| ${finding.category} | ${finding.severity} | ${finding.ownerTag} | ${finding.producerContractSurface} | ${escapeMarkdownCell(finding.consumerLocation)} | ${finding.fieldPath ?? 'n/a'} | ${escapeMarkdownCell(finding.expected)} | ${escapeMarkdownCell(finding.actual)} | ${escapeMarkdownCell(finding.remediationHint)} | ${escapeMarkdownCell(finding.nextAction)} |`,
    );
  }

  lines.push('', '## Notes');
  lines.push('- Report-only mode keeps CI green while drift is collected and triaged.');
  lines.push('- Soft-fail mode returns a non-zero exit code unless the drift is covered by an approved exception manifest.');
  lines.push('- Hard-fail mode blocks PRs for breaking drift and blocks invalid exception manifests even if drift is absent.');
  lines.push('- Suggested owner tags are advisory and come from the frontend inventory entry for each contract.');
  return lines.join('\n');
}

function writeReportArtifacts(reportDir, result) {
  const resolvedReportDir = resolveWorkspacePath(reportDir);
  fs.mkdirSync(resolvedReportDir, { recursive: true });
  fs.writeFileSync(path.join(resolvedReportDir, 'report.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(resolvedReportDir, 'report.md'), `${renderMarkdownReport(result)}\n`, 'utf8');

  const metricsLogPath = path.join(resolvedReportDir, 'gate-events.jsonl');
  appendJsonLine(metricsLogPath, {
    timestampMs: Date.now(),
    decision: result.decision,
    findingCount: result.findingCount,
    findings: result.findings.map((finding) => ({
      category: finding.category,
      surfaceId: finding.surfaceId,
      ownerTag: finding.ownerTag,
      contractId: finding.contractId,
      fieldPath: finding.fieldPath,
    })),
    exceptionApplied: result.exceptionApplied,
    exceptionExpired: Array.isArray(result.exceptionValidationErrors)
      ? result.exceptionValidationErrors.some((error) => String(error).includes('expiryDate has already passed'))
      : false,
    exceptionNearExpiry: result.exceptionNearExpiry,
  });

  const allEvents = readJsonLines(metricsLogPath);
  const weeklyMetrics = computeWindowMetrics(allEvents, WEEKLY_WINDOW_DAYS);
  const rollingMetrics = computeWindowMetrics(allEvents, ROLLING_WINDOW_DAYS);
  fs.writeFileSync(path.join(resolvedReportDir, 'weekly-metrics.json'), `${JSON.stringify(weeklyMetrics, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(resolvedReportDir, 'weekly-metrics.md'), `${renderWeeklyMetricsMarkdown(weeklyMetrics)}\n`, 'utf8');
  fs.writeFileSync(path.join(resolvedReportDir, 'rolling-30d-trends.json'), `${JSON.stringify(rollingMetrics, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(resolvedReportDir, 'rolling-30d-trends.md'), `${renderWeeklyMetricsMarkdown(rollingMetrics)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv);
  const mode = normalizeMode(args.mode);
  const frontendInventory = readJsonFile(args.frontendInventory);
  const backendArtifact = readJsonFile(args.backendArtifact);

  const frontendContracts = flattenContracts(frontendInventory);
  const backendContracts = flattenContracts(backendArtifact);
  const backendById = indexByContractId(backendContracts);
  const criticalSurfaceCoverage = evaluateCriticalSurfaceCoverage(frontendInventory);

  const findings = frontendContracts.flatMap((contract) => {
    const contractId = String(contract.contractId ?? '').trim();
    return compareContract(
      {
        ...contract,
        backendArtifactPath: args.backendArtifact,
      },
      backendById.get(contractId),
      backendContracts,
    );
  });

  const exception = parseApprovedException(args.exceptionFile, findings);
  const exceptionApplies = Boolean(exception && exception.isApproved);
  const exceptionHasErrors = Boolean(exception && exception.validationErrors.length > 0);
  const exceptionNearExpiry = Boolean(exceptionApplies && exception?.nearExpiry);
  const hasBreakingFindings = findings.some((finding) => finding.severity === 'breaking');
  const enforceCoverage = isCanonicalInventoryPath(args.frontendInventory);
  const shouldFailForBreakingDrift = hasBreakingFindings && !exceptionApplies && mode !== 'report-only';
  const shouldFailForInvalidException = exceptionHasErrors && mode !== 'report-only';
  const shouldFailForCoverageGap = enforceCoverage && criticalSurfaceCoverage.missingSurfaceIds.length > 0 && mode !== 'report-only';
  const shouldFail = shouldFailForBreakingDrift || shouldFailForInvalidException || shouldFailForCoverageGap;
  const decision =
    mode === 'report-only'
      ? 'report-only'
      : shouldFailForInvalidException
        ? 'invalid-exception'
        : shouldFailForCoverageGap
          ? 'coverage-gap'
        : shouldFailForBreakingDrift
          ? 'hard-fail'
          : exceptionApplies && findings.length > 0
            ? 'approved-exception'
            : 'pass';

  const result = {
    mode,
    decision,
    frontendInventoryPath: args.frontendInventory,
    backendArtifactPath: args.backendArtifact,
    contractCount: frontendContracts.length,
    findingCount: findings.length,
    summaryByCategory: summarizeByKey(findings, 'category'),
    summaryByOwnerTag: summarizeByKey(findings, 'ownerTag'),
    summaryBySeverity: summarizeByKey(findings, 'severity'),
    criticalSurfaceCoverage,
    exceptionValidationErrors: exceptionHasErrors ? exception.validationErrors : [],
    exceptionNearExpiry,
    exceptionApplied: exceptionApplies,
    findings: findings.map(toReportFinding),
    exception: exceptionApplies
      ? {
          filePath: exception.filePath,
          reason: exception.manifest.reason,
          impact: exception.manifest.impact,
          expiryDate: exception.manifest.expiryDate,
          rollbackPlan: exception.manifest.rollbackPlan,
          followUpTicket: exception.manifest.followUpTicket,
          followUpOwner: exception.manifest.followUpOwner,
          approvals: exception.manifest.approvals,
          allowedFindings: exception.manifest.allowedFindings,
          matchedFindingSignatures: exception.matchedFindingSignatures,
        }
      : exception
        ? {
            filePath: exception.filePath,
            validationErrors: exception.validationErrors,
          }
        : null,
  };

  writeReportArtifacts(args.reportDir, result);

  console.log(`SW-08 contract safety gate completed in ${mode} mode.`);
  console.log(`Decision: ${decision}`);
  console.log(`Contracts checked: ${result.contractCount}`);
  console.log(`Findings: ${result.findingCount}`);
  console.log(`Critical surface coverage: ${criticalSurfaceCoverage.status}`);
  if (criticalSurfaceCoverage.missingSurfaceIds.length > 0) {
    console.log(`Missing critical surfaces: ${criticalSurfaceCoverage.missingSurfaceIds.join(', ')}`);
    if (!enforceCoverage) {
      console.log('Coverage enforcement skipped for non-canonical fixture inventory.');
    }
  }
  if (exceptionApplies) {
    console.log(`Approved exception applied: ${exception.filePath}`);
    console.log(`Exception ticket: ${exception.manifest.followUpTicket}`);
    if (exceptionNearExpiry) {
      console.log(`Exception near expiry: ${exception.expiryDaysRemaining} days remaining.`);
    }
  } else if (exceptionHasErrors) {
    console.log(`Invalid exception supplied: ${exception.filePath}`);
    for (const validationError of exception.validationErrors) {
      console.log(`- ${validationError}`);
    }
  }

  const rollingMetricsPath = path.join(resolveWorkspacePath(args.reportDir), 'rolling-30d-trends.json');
  const rollingMetrics = fs.existsSync(rollingMetricsPath)
    ? JSON.parse(fs.readFileSync(rollingMetricsPath, 'utf8'))
    : { repeatOffenders: [] };
  if (result.findingCount > 0 && Array.isArray(rollingMetrics.repeatOffenders) && rollingMetrics.repeatOffenders.length > 0) {
    console.log(`Escalation note: repeat drift threshold (${REPEAT_DRIFT_THRESHOLD}) reached for:`);
    for (const offender of rollingMetrics.repeatOffenders) {
      console.log(`- ${offender.surfaceId} | ${offender.category} | count=${offender.count}`);
    }
  }
  if (findings.length > 0) {
    for (const finding of findings) {
      console.log(
        `- ${finding.category} | ${finding.severity} | ${finding.ownerTag} | ${finding.surfaceLabel} | ${finding.contractId} | ${finding.fieldPath ?? 'n/a'} | ${getRemediationHint(finding.ownerTag)} | ${getNextAction(finding)}`,
      );
    }
  } else {
    console.log('No drift detected.');
  }

  if (shouldFail) {
    console.error(
      shouldFailForInvalidException
        ? 'Hard fail: exception metadata is invalid and does not satisfy SW-08 policy.'
        : shouldFailForCoverageGap
          ? 'Hard fail: frontend critical surface coverage is incomplete.'
        : 'Hard fail: breaking contract drift detected and no approved exception was supplied.',
    );
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}