import { supabase } from '../../../platform/supabase/client';
import { regulationAckErrorMessage, type RegulationStatus } from '../domain/regulation';

/** The published regulation and whether the signed-in student confirmed this version; null when none is published. */
export async function fetchMyRegulationStatus(): Promise<RegulationStatus | null> {
  const { data, error } = await supabase.rpc('get_my_regulation_status');
  if (error) throw error;
  const row = (data as Array<{ title: string; url: string; version: string; acknowledged_at: string | null }> | null)?.[0];
  if (!row) return null;
  return { title: row.title, url: row.url, version: row.version, acknowledgedAt: row.acknowledged_at };
}

/** Records the confirmation for the version the student opened; the server rejects a version that changed since. */
export async function acknowledgeRegulation(version: string): Promise<string> {
  const { data, error } = await supabase.rpc('acknowledge_regulation', { p_version: version });
  if (error) throw new Error(regulationAckErrorMessage(error.message));
  return data as string;
}
