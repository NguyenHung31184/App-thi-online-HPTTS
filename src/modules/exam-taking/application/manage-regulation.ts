import { acknowledgeRegulation, fetchMyRegulationStatus } from '../data/regulation-repository';
import type { RegulationStatus } from '../domain/regulation';

export function getMyRegulationStatus(): Promise<RegulationStatus | null> {
  return fetchMyRegulationStatus();
}

export function confirmRegulationRead(version: string): Promise<string> {
  return acknowledgeRegulation(version);
}
