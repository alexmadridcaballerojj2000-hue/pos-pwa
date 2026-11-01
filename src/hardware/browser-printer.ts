import type { ReceiptDoc } from '@/domain';
import { renderReceiptToHtml } from '@/domain';
import type { ReceiptPrinter, PrinterStatus } from './types';

/**
 * BrowserPrinter: fallback printer implementation that renders the ReceiptDoc
 * as HTML/CSS formatted for 58 mm or 80 mm thermal roll paper and invokes
 * the native browser print dialog via an isolated hidden iframe.
 *
 * Supported in 100% of browsers (Chrome, Edge, Firefox, Safari iOS/macOS).
 */
export class BrowserPrinter implements ReceiptPrinter {
  async print(doc: ReceiptDoc): Promise<void> {
    if (typeof document === 'undefined') {
      return;
    }

    const html = renderReceiptToHtml(doc);

    return new Promise((resolve) => {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        iframe.srcdoc = html;
        iframe.onload = () => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (err) {
            console.error('Error invoking print dialog on iframe:', err);
          } finally {
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
              resolve();
            }, 1000);
          }
        };
      } catch (err) {
        console.error('BrowserPrinter failed to create iframe:', err);
        resolve();
      }
    });
  }

  async openDrawer(): Promise<void> {
    // In BrowserPrinter (HTML) mode, hardware drawer pulse is not directly accessible.
    // Resolves cleanly without throwing.
  }

  async testPrint(): Promise<void> {
    const testDoc: ReceiptDoc = {
      paperWidthMm: 80,
      blocks: [
        { type: 'text', text: 'TICKET DE PRUEBA', align: 'center', bold: true, size: 'large' },
        {
          type: 'text',
          text: 'Impresora del Navegador (HTML / CSS)',
          align: 'center',
          size: 'small',
        },
        { type: 'divider', char: '=' },
        { type: 'row', left: 'Estado:', right: 'Conectada / OK' },
        { type: 'row', left: 'Fecha y hora:', right: new Date().toLocaleString('es-ES') },
        { type: 'divider', char: '-' },
        { type: 'text', text: 'Prueba de caracteres en español:', bold: true },
        { type: 'text', text: 'á é í ó ú - Á É Í Ó Ú - ñ Ñ - ¿ ? - ¡ ! - €' },
        { type: 'divider', char: '=' },
        { type: 'text', text: '¡Calibración completada con éxito!', align: 'center' },
        { type: 'feed', lines: 2 },
      ],
    };

    await this.print(testDoc);
  }

  async status(): Promise<PrinterStatus> {
    return {
      connected: true,
      type: 'browser',
      deviceName: 'Impresora del Sistema / Navegador',
      supported: typeof window !== 'undefined',
    };
  }
}

export const browserPrinter = new BrowserPrinter();
