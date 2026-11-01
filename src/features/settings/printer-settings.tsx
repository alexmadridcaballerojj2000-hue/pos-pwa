import React, { useState, useEffect } from 'react';
import {
  Printer,
  Usb,
  Radio,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  Scissors,
  Unlock,
} from 'lucide-react';
import type { PrinterConfig } from '@/domain';
import { printerService } from '@/hardware';
import { useI18n } from '@/app/i18n';

export interface PrinterSettingsProps {
  config: PrinterConfig;
  onChange: (newConfig: PrinterConfig) => void;
}

export const PrinterSettings: React.FC<PrinterSettingsProps> = ({ config, onChange }) => {
  const { t } = useI18n();
  const [isPairing, setIsPairing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [usbSupported, setUsbSupported] = useState(false);
  const [serialSupported, setSerialSupported] = useState(false);

  useEffect(() => {
    setUsbSupported(printerService.isHardwareSupported('usb'));
    setSerialSupported(printerService.isHardwareSupported('serial'));
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  const handleDriverChange = (driver: 'browser' | 'usb' | 'serial') => {
    const updated = { ...config, driver };
    onChange(updated);
    printerService.setConfig(updated);
  };

  const handleWidthChange = (paperWidthMm: 58 | 80) => {
    const updated = { ...config, paperWidthMm };
    onChange(updated);
    printerService.setConfig(updated);
  };

  const handleCodePageChange = (codePage: 'CP858' | 'CP1252' | 'CP437') => {
    const updated = { ...config, codePage };
    onChange(updated);
    printerService.setConfig(updated);
  };

  const handleAutoCutToggle = (autoCut: boolean) => {
    const updated = { ...config, autoCut };
    onChange(updated);
    printerService.setConfig(updated);
  };

  const handleOpenDrawerToggle = (openDrawer: boolean) => {
    const updated = { ...config, openDrawer };
    onChange(updated);
    printerService.setConfig(updated);
  };

  const handleDrawerPinChange = (drawerPin: 2 | 5) => {
    const updated = { ...config, drawerPin };
    onChange(updated);
    printerService.setConfig(updated);
  };

  const handleBaudRateChange = (serialBaudRate: number) => {
    const updated = { ...config, serialBaudRate };
    onChange(updated);
    printerService.setConfig(updated);
  };

  const handlePair = async () => {
    if (config.driver === 'browser') return;
    setIsPairing(true);
    try {
      const info = await printerService.pairDevice(config.driver);
      const updated: PrinterConfig = {
        ...config,
        usbVendorId: info.vendorId,
        usbProductId: info.productId,
      };
      onChange(updated);
      printerService.setConfig(updated);
      showFeedback(
        'success',
        info.vendorId && info.productId
          ? `Dispositivo vinculado: 0x${info.vendorId.toString(16).padStart(4, '0')}:0x${info.productId.toString(16).padStart(4, '0')}`
          : 'Dispositivo vinculado con éxito',
      );
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : t('printer.testError'));
    } finally {
      setIsPairing(false);
    }
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    try {
      await printerService.testPrint();
      showFeedback('success', t('printer.testSuccess'));
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : t('printer.testError'));
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestDrawer = async () => {
    setIsTesting(true);
    try {
      await printerService.openDrawer();
      showFeedback('success', 'Pulso de apertura enviado al cajón');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Error al abrir el cajón');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Driver selector */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Printer className="w-5 h-5 text-emerald-600" />
          {t('printer.driver')}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Browser driver */}
          <button
            type="button"
            onClick={() => handleDriverChange('browser')}
            className={`min-h-[48px] p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
              config.driver === 'browser'
                ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-200 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="font-bold text-sm">Navegador Web</span>
              <Printer className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Diálogo nativo de impresión del sistema. Compatible con cualquier impresora instalada.
            </span>
          </button>

          {/* WebUSB driver */}
          <button
            type="button"
            onClick={() => handleDriverChange('usb')}
            className={`min-h-[48px] p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
              config.driver === 'usb'
                ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-200 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="font-bold text-sm">WebUSB (Directo)</span>
              <Usb className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Conexión USB ESC/POS sin diálogo. Impresión térmica ultra-rápida.
            </span>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold">
              <span
                className={`w-2 h-2 rounded-full ${usbSupported ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
              <span className={usbSupported ? 'text-emerald-600' : 'text-amber-600'}>
                {usbSupported ? t('printer.supported') : t('printer.unsupported')}
              </span>
            </div>
          </button>

          {/* WebSerial driver */}
          <button
            type="button"
            onClick={() => handleDriverChange('serial')}
            className={`min-h-[48px] p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
              config.driver === 'serial'
                ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-200 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="font-bold text-sm">WebSerial (COM / RS232)</span>
              <Radio className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Puerto Serie o adaptadores USB-Serial (Prolific, FTDI, CH340).
            </span>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold">
              <span
                className={`w-2 h-2 rounded-full ${serialSupported ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
              <span className={serialSupported ? 'text-emerald-600' : 'text-amber-600'}>
                {serialSupported ? t('printer.supported') : t('printer.unsupported')}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Hardware Pairing Card */}
      {config.driver !== 'browser' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Usb className="w-5 h-5 text-emerald-600" />
                Vinculación de Dispositivo ({config.driver === 'usb' ? 'WebUSB' : 'WebSerial'})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {config.usbVendorId && config.usbProductId ? (
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {t('printer.pairedDevice')}: Vendor ID 0x
                    {config.usbVendorId.toString(16).padStart(4, '0')}, Product ID 0x
                    {config.usbProductId.toString(16).padStart(4, '0')}
                  </span>
                ) : (
                  <span>{t('printer.noDevicePaired')}</span>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={handlePair}
              disabled={isPairing || (config.driver === 'usb' ? !usbSupported : !serialSupported)}
              className="min-h-[48px] px-5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Usb className="w-4 h-4" />
              <span>
                {isPairing
                  ? 'Vinculando...'
                  : config.driver === 'usb'
                    ? t('printer.pairUsb')
                    : t('printer.pairSerial')}
              </span>
            </button>
          </div>

          {config.driver === 'serial' && (
            <div className="pt-2">
              <label
                htmlFor="printer-baud-rate"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('printer.baudRate')}
              </label>
              <select
                id="printer-baud-rate"
                value={config.serialBaudRate ?? 9600}
                onChange={(e) => handleBaudRateChange(Number(e.target.value))}
                className="w-full sm:w-48 h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              >
                <option value={9600}>9600 bps (Estándar)</option>
                <option value={19200}>19200 bps</option>
                <option value={38400}>38400 bps</option>
                <option value={115200}>115200 bps</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Formatting & Hardware Features */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Parámetros de Formato y Bobina
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="printer-paper-width"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              {t('printer.paperWidth')}
            </label>
            <select
              id="printer-paper-width"
              value={config.paperWidthMm}
              onChange={(e) => handleWidthChange(Number(e.target.value) as 58 | 80)}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              <option value={58}>{t('printer.paper58')}</option>
              <option value={80}>{t('printer.paper80')}</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="printer-code-page"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              {t('printer.codePage')}
            </label>
            <select
              id="printer-code-page"
              value={config.codePage}
              onChange={(e) => handleCodePageChange(e.target.value as 'CP858' | 'CP1252' | 'CP437')}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              <option value="CP858">{t('printer.cp858')}</option>
              <option value="CP1252">{t('printer.cp1252')}</option>
              <option value="CP437">{t('printer.cp437')}</option>
            </select>
          </div>
        </div>

        <div className="pt-2 space-y-3">
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer min-h-[48px]">
            <input
              type="checkbox"
              checked={config.autoCut}
              onChange={(e) => handleAutoCutToggle(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-emerald-600"
            />
            <div>
              <span className="block text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-emerald-600" />
                {t('printer.autoCut')}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Envía el comando de corte parcial GS V al finalizar cada impresión.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer min-h-[48px]">
            <input
              type="checkbox"
              checked={config.openDrawer}
              onChange={(e) => handleOpenDrawerToggle(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-emerald-600"
            />
            <div>
              <span className="block text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Unlock className="w-4 h-4 text-emerald-600" />
                {t('printer.openDrawer')}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Dispara el solenoide del cajón conectado al puerto RJ11 de la impresora al registrar
                una venta en efectivo.
              </span>
            </div>
          </label>

          {config.openDrawer && (
            <div className="pl-7 pt-1">
              <label
                htmlFor="printer-drawer-pin"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('printer.drawerPin')}
              </label>
              <select
                id="printer-drawer-pin"
                value={config.drawerPin}
                onChange={(e) => handleDrawerPinChange(Number(e.target.value) as 2 | 5)}
                className="w-full sm:w-64 h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              >
                <option value={2}>{t('printer.pin2')}</option>
                <option value={5}>{t('printer.pin5')}</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Diagnostics / Testing */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-emerald-600" />
          Diagnóstico y Pruebas en Vivo
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Ejecuta pruebas reales para verificar alineación de columnas, códigos de barras, códigos
          QR, acentos y apertura de cajón.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handleTestPrint}
            disabled={isTesting}
            className="min-h-[48px] px-5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4 text-emerald-600" />
            <span>{isTesting ? t('printer.testing') : t('printer.testPrint')}</span>
          </button>

          <button
            type="button"
            onClick={handleTestDrawer}
            disabled={isTesting}
            className="min-h-[48px] px-5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Unlock className="w-4 h-4 text-emerald-600" />
            <span>{isTesting ? t('printer.testing') : t('printer.testDrawer')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
