/**
 * useBarcodeScanner.js
 * Shared hook for ZXing barcode scanning via npm (@zxing/browser).
 * Used by both AddMedicationModal and SellPage.
 *
 * Usage:
 *   const { videoRef, scanAreaRef, isActive, status, startScan, stopScan } =
 *     useBarcodeScanner({ onScan, onError });
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';


const SUPPORTED_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
];

export function useBarcodeScanner({ onScan, onError } = {}) {
  const videoRef    = useRef(null);
  const scanAreaRef = useRef(null);
  const readerRef   = useRef(null);
  const controlsRef = useRef(null); // returned by decodeFromVideoDevice — needed to stop

  const [isActive, setIsActive] = useState(false);
  const [status,   setStatus]   = useState({ type: 'idle', msg: 'Camera not started' });

  // Clean up on unmount
  useEffect(() => () => stopScan(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopScan = useCallback(() => {
    if (controlsRef.current) {
      try { controlsRef.current.stop(); } catch {}
      controlsRef.current = null;
    }
    if (readerRef.current) {
      try { BrowserMultiFormatReader.releaseAllStreams(); } catch {}
      readerRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    scanAreaRef.current?.classList.remove('scan-active');
  }, []);

  const startScan = useCallback(async () => {
    if (isActive) return;

    setStatus({ type: 'active', msg: 'Starting camera…' });

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS);
    hints.set(DecodeHintType.TRY_HARDER, true);

    try {
      // Enumerate cameras — prefer rear-facing
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (!devices.length) throw new Error('No cameras found on this device.');

      // Pick the last camera (typically the rear/environment camera on phones)
      const deviceId = devices[devices.length - 1].deviceId;

      readerRef.current = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 150,   // ms between decode attempts
        delayBetweenScanSuccess: 1500,   // ms before next scan after a hit
      });

      setIsActive(true);
      scanAreaRef.current?.classList.add('scan-active');
      setStatus({ type: 'active', msg: '📸 Point at the barcode on the medicine box' });

      controlsRef.current = await readerRef.current.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result, err) => {
          if (result) {
            stopScan();
            if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
            onScan?.(result.getText());
          }
          // err fires continuously when no barcode is in frame — intentionally ignored
        }
      );
    } catch (err) {
      stopScan();
      const msg = err?.message || String(err);
      const friendly = msg.toLowerCase().includes('permission')
        ? '❌ Camera permission denied. Please allow camera access and try again.'
        : msg.toLowerCase().includes('no cameras')
        ? '❌ No camera found on this device.'
        : `❌ Scanner error: ${msg}`;
      setStatus({ type: 'error', msg: friendly });
      onError?.(err);
    }
  }, [isActive, onScan, onError, stopScan]);

  return { videoRef, scanAreaRef, isActive, status, startScan, stopScan, setStatus };
}
