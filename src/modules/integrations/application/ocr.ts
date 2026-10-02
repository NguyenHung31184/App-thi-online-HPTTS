import { scanIdCard } from '../data/ocr-proxy';

/** OCR always goes through the server proxy, so it is always available to the page. */
export const isOcrConfigured = (): boolean => true;

export const analyzeCccdByImageFile = scanIdCard;
