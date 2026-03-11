/**
 * useCameraOCR — ML Kit Text Recognition for Indian plates
 * On-device, free, offline-capable (Google ML Kit v2)
 */

import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition  from '@react-native-ml-kit/text-recognition';

// Indian plate patterns
const PLATE_PATTERNS = [
  /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/,  // standard: MH12AB4567
  /^BH\d{2}[A-Z]{1,2}\d{4}$/,           // Bharat series: BH01AA1234
  /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/,     // older format
];

const normalise = (raw: string) => raw.replace(/[\s\-\.O]/g, '').toUpperCase()
  // Common OCR fixes
  .replace(/\bO\b/g, '0');   // standalone O → 0

function isPlate(text: string): boolean {
  const clean = text.replace(/[\s\-\.]/g, '').toUpperCase();
  return PLATE_PATTERNS.some(p => p.test(clean));
}

function extractBestPlate(blocks: { text: string; lines?: { text: string }[] }[]): string | null {
  const candidates: string[] = [];

  for (const block of blocks) {
    candidates.push(block.text.replace(/\n/g, ' '));
    // Individual lines
    if (block.lines) {
      candidates.push(...block.lines.map(l => l.text));
    }
    // Merged words
    const merged = block.text.replace(/\s+/g, '').toUpperCase();
    candidates.push(merged);
  }

  for (const c of candidates) {
    const clean = c.replace(/[\s\-\.]/g, '').toUpperCase();
    if (isPlate(clean)) return clean;
  }
  return null;
}

export interface UseCameraOCRResult {
  scanPlate:        () => Promise<string | null>;
  isScanning:       boolean;
  capturedImageUri: string | null;
  clearImage:       () => void;
  lastRawOcrText:   string;
}

export function useCameraOCR(): UseCameraOCRResult {
  const [isScanning,        setIsScanning]        = useState(false);
  const [capturedImageUri,  setCapturedImageUri]  = useState<string | null>(null);
  const [lastRawOcrText,    setLastRawOcrText]    = useState('');

  const scanPlate = useCallback(async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return null;

    setIsScanning(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes:    ImagePicker.MediaTypeOptions.Images,
        quality:       0.9,
        allowsEditing: true,
        aspect:        [16, 5],  // wide — plate aspect ratio
      });

      if (result.canceled || !result.assets?.[0]?.uri) return null;

      const uri = result.assets[0].uri;
      setCapturedImageUri(uri);

      const recognition = await TextRecognition.recognize(uri);
      const allText = (recognition.blocks || []).map(b => b.text).join(' | ');
      setLastRawOcrText(allText);

      return extractBestPlate(recognition.blocks || []);
    } catch (err) {
      console.error('OCR error:', err);
      return null;
    } finally {
      setIsScanning(false);
    }
  }, []);

  const clearImage = useCallback(() => {
    setCapturedImageUri(null);
    setLastRawOcrText('');
  }, []);

  return { scanPlate, isScanning, capturedImageUri, clearImage, lastRawOcrText };
}
