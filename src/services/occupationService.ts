import { supabase } from '../lib/supabaseClient';
import type { Occupation } from '../types';

/**
 * Lấy danh sách nghề đào tạo từ bảng courses của app quản lý TTDT (cùng Supabase).
 * Nếu dùng chung DB với app quản lý thì nghề đào tạo chính là các khóa/chương trình trong bảng courses.
 */
export async function listOccupations(): Promise<Occupation[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, name, code')
    .order('name');
  if (error) {
    console.warn('listOccupations (courses):', error.message);
    return [];
  }
  return (data ?? []).map((r: { id: string; name: string; code?: string }) => ({
    id: r.id,
    name: r.name ?? '',
    code: r.code ?? undefined,
  })) as Occupation[];
}

export async function getOccupation(id: string): Promise<Occupation | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, name, code')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return {
    id: (data as { id: string }).id,
    name: (data as { name: string }).name ?? '',
    code: (data as { code?: string }).code,
  } as Occupation;
}
