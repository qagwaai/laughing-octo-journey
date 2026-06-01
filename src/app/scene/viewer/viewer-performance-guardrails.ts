import type { ExternalObjectDescriptor } from '../../model/external-object-descriptor';

export interface Sw13M4BalancedPerformanceBudget {
  maxDescriptorEntries: number;
  maxGateEntries: number;
  maxGateDescriptorBytes: number;
}

export const SW13_M4_BALANCED_PERFORMANCE_BUDGET: Readonly<Sw13M4BalancedPerformanceBudget> = {
  // Locked M4 envelope values consumed by Nova runtime checks.
  maxDescriptorEntries: 16,
  maxGateEntries: 3,
  maxGateDescriptorBytes: 328,
};

export interface DescriptorEnvelopeValidationSummary {
  descriptorEntries: number;
  gateEntries: number;
  largestGateDescriptorBytes: number;
}

export interface DescriptorEnvelopeValidationResult {
  valid: boolean;
  reason?: string;
  summary: DescriptorEnvelopeValidationSummary;
}

function getDescriptorByteSize(descriptor: ExternalObjectDescriptor): number {
  return new TextEncoder().encode(JSON.stringify(descriptor)).length;
}

export function validateSw13M4DescriptorEnvelope(
  descriptors: readonly ExternalObjectDescriptor[],
  budget: Sw13M4BalancedPerformanceBudget = SW13_M4_BALANCED_PERFORMANCE_BUDGET,
): DescriptorEnvelopeValidationResult {
  let descriptorEntries = 0;
  let gateEntries = 0;
  let largestGateDescriptorBytes = 0;

  for (const descriptor of descriptors) {
    if (descriptor.domain === 'gates') {
      gateEntries += 1;
      const gateDescriptorBytes = getDescriptorByteSize(descriptor);
      if (gateDescriptorBytes > largestGateDescriptorBytes) {
        largestGateDescriptorBytes = gateDescriptorBytes;
      }

      if (gateDescriptorBytes > budget.maxGateDescriptorBytes) {
        return {
          valid: false,
          reason:
            `gate descriptor ${descriptor.descriptorId} exceeds max byte size ` +
            `${budget.maxGateDescriptorBytes} (received ${gateDescriptorBytes})`,
          summary: {
            descriptorEntries,
            gateEntries,
            largestGateDescriptorBytes,
          },
        };
      }

      if (gateEntries > budget.maxGateEntries) {
        return {
          valid: false,
          reason: `gate descriptor entries exceed max ${budget.maxGateEntries}`,
          summary: {
            descriptorEntries,
            gateEntries,
            largestGateDescriptorBytes,
          },
        };
      }
      continue;
    }

    descriptorEntries += 1;
    if (descriptorEntries > budget.maxDescriptorEntries) {
      return {
        valid: false,
        reason: `descriptor entries exceed max ${budget.maxDescriptorEntries}`,
        summary: {
          descriptorEntries,
          gateEntries,
          largestGateDescriptorBytes,
        },
      };
    }
  }

  return {
    valid: true,
    summary: {
      descriptorEntries,
      gateEntries,
      largestGateDescriptorBytes,
    },
  };
}
