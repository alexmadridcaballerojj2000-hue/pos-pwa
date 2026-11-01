import type { ReceiptDoc } from '../receipt';
import type { CodePage } from './codepages';
import { EscPosEncoder } from './encoder';

export interface EscPosRenderOptions {
  columns?: number;
  codePage?: CodePage;
  autoCut?: boolean;
  openDrawer?: boolean;
  drawerPin?: 2 | 5;
}

/**
 * Pure domain function that renders a ReceiptDoc intermediate representation
 * to an ESC/POS byte sequence (Uint8Array).
 *
 * Conforms to SPEC §9:
 * - Supports 58 mm (typically 32 columns) and 80 mm (typically 42 or 48 columns).
 * - Accurately lays out 2-column key-value rows.
 * - Handles text alignment, bold, sizing, dividers, barcodes, QR and paper cut.
 */
export function renderReceiptToEscPos(
  doc: ReceiptDoc,
  options: EscPosRenderOptions = {},
): Uint8Array {
  const {
    columns = doc.paperWidthMm === 58 ? 32 : 48,
    codePage = 'CP858',
    autoCut = true,
    openDrawer = false,
    drawerPin = 2,
  } = options;

  const encoder = new EscPosEncoder(codePage);
  encoder.init().setCodePage(codePage);

  // If initial drawer pulse requested
  if (openDrawer) {
    encoder.pulseDrawer(drawerPin);
  }

  let hasCutBlock = false;

  for (const block of doc.blocks) {
    switch (block.type) {
      case 'pulse': {
        encoder.pulseDrawer(drawerPin);
        break;
      }

      case 'text': {
        const align = block.align ?? 'left';
        encoder.setAlign(align);
        encoder.setBold(Boolean(block.bold));

        if (block.size === 'large') {
          encoder.setSize(2, 2);
        } else {
          encoder.setSize(1, 1);
        }

        encoder.line(block.text);

        // Reset formatting
        encoder.setSize(1, 1);
        encoder.setBold(false);
        encoder.setAlign('left');
        break;
      }

      case 'row': {
        encoder.setBold(Boolean(block.bold));
        encoder.setAlign('left');

        const leftStr = block.left || '';
        const rightStr = block.right || '';

        const totalChars = leftStr.length + rightStr.length;

        if (totalChars < columns) {
          const spaceCount = columns - totalChars;
          const spaces = ' '.repeat(spaceCount);
          encoder.line(`${leftStr}${spaces}${rightStr}`);
        } else {
          // Truncate left string so right string always fits cleanly
          const availableLeft = Math.max(0, columns - rightStr.length - 1);
          const truncatedLeft =
            leftStr.length > availableLeft ? leftStr.slice(0, availableLeft) : leftStr;
          const spaceCount = Math.max(1, columns - truncatedLeft.length - rightStr.length);
          const spaces = ' '.repeat(spaceCount);
          encoder.line(`${truncatedLeft}${spaces}${rightStr}`);
        }

        encoder.setBold(false);
        break;
      }

      case 'divider': {
        const ch = block.char ?? '-';
        encoder.setAlign('left');
        encoder.line(ch.repeat(columns));
        break;
      }

      case 'feed': {
        encoder.feed(block.lines);
        break;
      }

      case 'barcode': {
        encoder.setAlign('center');
        encoder.barcode(block.data, block.format ?? 'CODE128', 64);
        encoder.setAlign('left');
        break;
      }

      case 'qr': {
        encoder.setAlign('center');
        encoder.qrCode(block.data, 4, 'M');
        encoder.setAlign('left');
        break;
      }

      case 'cut': {
        hasCutBlock = true;
        encoder.feed(3);
        encoder.cut('partial');
        break;
      }

      default:
        break;
    }
  }

  // Automatic feed & cut at the end if not explicitly cut in blocks
  if (autoCut && !hasCutBlock) {
    encoder.feed(3);
    encoder.cut('partial');
  }

  return encoder.build();
}
