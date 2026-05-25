import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FRONTEND_INVENTORY = 'docs/planning/sw-08/frontend-consumer-contract-inventory.json';
const DEFAULT_BACKEND_ARTIFACT = 'docs/planning/sw-08/backend-contract-artifact.json';
const DEFAULT_REPORT_DIR = 'reports/sw-08-contract-safety-gate';
const DEFAULT_MODE = 'hard-fail';

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
  if (Number.isNaN(expiryTimestamp)) {
    validationErrors.push('Exception expiryDate must be a parseable date.');
  } else if (expiryTimestamp < Date.now()) {
    validationErrors.push('Exception expiryDate has already passed.');
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
  };
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
    '',
  ];

  if (result.exception) {
    lines.push(`- Exception: ${result.exception.filePath}`);
    lines.push(`- Exception ticket: ${result.exception.followUpTicket}`);
    lines.push('');
  }

  if (result.findings.length === 0) {
    lines.push('No drift detected.', '');
    return lines.join('\n');
  }

  lines.push('| Category | Severity | Owner | Producer surface | Consumer location | Field | Expected | Actual | Remediation hint |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');

  for (const finding of result.findings) {
    lines.push(
      `| ${finding.category} | ${finding.severity} | ${finding.ownerTag} | ${finding.producerContractSurface} | ${escapeMarkdownCell(finding.consumerLocation)} | ${finding.fieldPath ?? 'n/a'} | ${escapeMarkdownCell(finding.expected)} | ${escapeMarkdownCell(finding.actual)} | ${escapeMarkdownCell(finding.remediationHint)} |`,
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
}

function main() {
  const args = parseArgs(process.argv);
  const mode = normalizeMode(args.mode);
  const frontendInventory = readJsonFile(args.frontendInventory);
  const backendArtifact = readJsonFile(args.backendArtifact);

  const frontendContracts = flattenContracts(frontendInventory);
  const backendContracts = flattenContracts(backendArtifact);
  const backendById = indexByContractId(backendContracts);

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
  const hasBreakingFindings = findings.some((finding) => finding.severity === 'breaking');
  const shouldFailForBreakingDrift = hasBreakingFindings && !exceptionApplies && mode !== 'report-only';
  const shouldFailForInvalidException = exceptionHasErrors && mode !== 'report-only';
  const shouldFail = shouldFailForBreakingDrift || shouldFailForInvalidException;
  const decision =
    mode === 'report-only'
      ? 'report-only'
      : shouldFailForInvalidException
        ? 'invalid-exception'
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
  if (exceptionApplies) {
    console.log(`Approved exception applied: ${exception.filePath}`);
    console.log(`Exception ticket: ${exception.manifest.followUpTicket}`);
  } else if (exceptionHasErrors) {
    console.log(`Invalid exception supplied: ${exception.filePath}`);
    for (const validationError of exception.validationErrors) {
      console.log(`- ${validationError}`);
    }
  }
  if (findings.length > 0) {
    for (const finding of findings) {
      console.log(
        `- ${finding.category} | ${finding.severity} | ${finding.ownerTag} | ${finding.surfaceLabel} | ${finding.contractId} | ${finding.fieldPath ?? 'n/a'} | ${getRemediationHint(finding.ownerTag)}`,
      );
    }
  } else {
    console.log('No drift detected.');
  }

  if (shouldFail) {
    console.error(
      shouldFailForInvalidException
        ? 'Hard fail: exception metadata is invalid and does not satisfy SW-08 policy.'
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