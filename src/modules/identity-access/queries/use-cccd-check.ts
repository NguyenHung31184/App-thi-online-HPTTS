import { useMutation } from '@tanstack/react-query';
import type { OcrCccdResult } from '../../../types';
import { analyzeCccdByImageFile, isOcrConfigured } from '../../integrations/public';
import { verifyCccdForExam } from '../application/session';

/** Reads a CCCD photo (OCR through the integrations proxy). */
export function useReadCccdCard() {
  return useMutation({ mutationFn: (file: File) => analyzeCccdByImageFile(file) });
}

export const useOcrAvailable = (): boolean => isOcrConfigured();

/** The server check of the CCCD for the signed-in exam account. */
export function useVerifyCccd() {
  return useMutation({
    mutationFn: ({ card, examAccountEmail }: { card: OcrCccdResult; examAccountEmail: string | undefined }) => verifyCccdForExam(card, examAccountEmail),
  });
}
