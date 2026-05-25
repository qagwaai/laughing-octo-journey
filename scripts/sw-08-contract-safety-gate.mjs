import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FRONTEND_INVENTORY = 'docs/planning/sw-08/frontend-consumer-contract-inventory.json';
const DEFAULT_BACKEND_ARTIFACT = 'docs/planning/sw-08/backend-contract-artifact.json';
const DEFAULT_REPORT_DIR = 'reports/sw-08-contract-safety-gate';

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
  }

  return args;
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
  if (expected.length !== actual.length) {
    return false;
  }

  return expected.every((value, index) => value === actual[index]);
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

function compareContract(expectedContract, backendContract, allBackendContracts) {
  const findings = [];
  const ownerTag = String(expectedContract.ownerTag ?? expectedContract.surfaceOwnerTag ?? 'frontend remediation').trim();
  const consumerFiles = Array.isArray(expectedContract.consumerFiles) ? expectedContract.consumerFiles : [];
  const baseContext = {
    surfaceId: expectedContract.surfaceId,
    surfaceLabel: expectedContract.surfaceLabel,
    contractId: expectedContract.contractId,
    ownerTag,
    consumerFiles,
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

    if (expectedField.type === 'enum' && !compareEnumValues(expectedField.values, actualField.values)) {
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

    if (expectedField.type === 'enum' && !compareEnumValues(expectedField.values, actualField.values)) {
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
    `- Frontend inventory: ${result.frontendInventoryPath}`,
    `- Backend artifact: ${result.backendArtifactPath}`,
    `- Contracts checked: ${result.contractCount}`,
    `- Findings: ${result.findings.length}`,
    '',
  ];

  if (result.findings.length === 0) {
    lines.push('No drift detected in report-only mode.', '');
    return lines.join('\n');
  }

  lines.push('| Category | Owner | Surface | Contract | Field | Expected | Actual | Consumer files |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');

  for (const finding of result.findings) {
    lines.push(
      `| ${finding.category} | ${finding.ownerTag} | ${finding.surfaceLabel} | ${finding.contractId} | ${finding.fieldPath ?? 'n/a'} | ${escapeMarkdownCell(finding.expected)} | ${escapeMarkdownCell(finding.actual)} | ${escapeMarkdownCell((finding.consumerFiles ?? []).join(', '))} |`,
    );
  }

  lines.push('', '## Notes');
  lines.push('- Report-only mode keeps CI green while drift is collected and triaged.');
  lines.push('- Suggested owner tags are advisory and come from the frontend inventory entry for each contract.');
  return lines.join('\n');
}

function buildSummaryByCategory(findings) {
  return findings.reduce((summary, finding) => {
    summary[finding.category] = (summary[finding.category] ?? 0) + 1;
    return summary;
  }, {});
}

function writeReportArtifacts(reportDir, result) {
  const resolvedReportDir = resolveWorkspacePath(reportDir);
  fs.mkdirSync(resolvedReportDir, { recursive: true });
  fs.writeFileSync(path.join(resolvedReportDir, 'report.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(resolvedReportDir, 'report.md'), `${renderMarkdownReport(result)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv);
  const frontendInventory = readJsonFile(args.frontendInventory);
  const backendArtifact = readJsonFile(args.backendArtifact);

  const frontendContracts = flattenContracts(frontendInventory);
  const backendContracts = flattenContracts(backendArtifact);
  const backendById = indexByContractId(backendContracts);

  const findings = frontendContracts.flatMap((contract) => {
    const contractId = String(contract.contractId ?? '').trim();
    return compareContract(contract, backendById.get(contractId), backendContracts);
  });

  const result = {
    mode: 'report-only',
    frontendInventoryPath: args.frontendInventory,
    backendArtifactPath: args.backendArtifact,
    contractCount: frontendContracts.length,
    findingCount: findings.length,
    summaryByCategory: buildSummaryByCategory(findings),
    findings,
  };

  writeReportArtifacts(args.reportDir, result);

  console.log('SW-08 contract safety gate completed in report-only mode.');
  console.log(`Contracts checked: ${result.contractCount}`);
  console.log(`Findings: ${result.findingCount}`);
  if (findings.length > 0) {
    for (const finding of findings) {
      console.log(
        `- ${finding.category} | ${finding.ownerTag} | ${finding.surfaceLabel} | ${finding.contractId} | ${finding.fieldPath ?? 'n/a'}`,
      );
    }
  } else {
    console.log('No drift detected.');
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}