import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, XCircle, ArrowRight, Download } from 'lucide-react';
import {
  generateId,
  parseCsvWithHeader,
  validateProductCsvRows,
  type Category,
  type Product,
  type TaxRate,
  type CsvRowValidation,
} from '@/domain';
import { db } from '@/data/db';

interface CsvImportDialogProps {
  categories: Category[];
  taxRates: TaxRate[];
  onImportComplete: () => Promise<void>;
}

export const CsvImportDialog: React.FC<CsvImportDialogProps> = ({
  categories,
  taxRates,
  onImportComplete,
}) => {
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [validations, setValidations] = useState<CsvRowValidation[] | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'invalid'>('all');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    skipped: number;
    durationMs: number;
  } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      processCsv(text);
    };
    reader.readAsText(file);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCsvContent(text);
    if (text.trim()) {
      processCsv(text);
    } else {
      setValidations(null);
    }
  };

  const processCsv = (text: string) => {
    const { rows } = parseCsvWithHeader(text);
    const results = validateProductCsvRows(rows);
    setValidations(results);
    setImportSummary(null);
  };

  const handleDownloadTemplate = () => {
    const template =
      'sku,name,price,cost,barcodes,category,tax_rate,unit,track_stock,allow_fractional\r\n' +
      'COCA-500,Coca Cola 500ml,25.00,18.00,7501055300075,Bebidas,16,unit,true,false\r\n' +
      'MANZANA-KG,Manzana Roja,45.50,32.00,123456789012,Frutas,0,kg,true,true\r\n';

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_productos_pos.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const executeImport = async () => {
    if (!validations) return;
    const validRows = validations.filter((v) => v.isValid && v.product);
    if (validRows.length === 0) return;

    setIsImporting(true);
    setProgress(0);
    const startTime = performance.now();

    try {
      const nowIso = new Date().toISOString();
      const existingCategoriesMap = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
      const existingTaxesMap = new Map(taxRates.map((t) => [t.rateBp, t]));
      const defaultTax = taxRates[0];

      const newCategoriesToInsert: Category[] = [];
      const newProductsToInsert: Product[] = [];

      for (let i = 0; i < validRows.length; i++) {
        const item = validRows[i]?.product;
        if (!item) continue;

        // Resolve or create Category
        let catId: string | null = null;
        if (item.categoryName) {
          const catKey = item.categoryName.toLowerCase();
          let cat = existingCategoriesMap.get(catKey);
          if (!cat) {
            cat = {
              id: generateId(),
              name: item.categoryName,
              parentId: null,
              sort: existingCategoriesMap.size + 1,
              version: 1,
              updatedAt: nowIso,
            };
            existingCategoriesMap.set(catKey, cat);
            newCategoriesToInsert.push(cat);
          }
          catId = cat.id;
        }

        // Resolve or assign Tax Rate
        let taxId = defaultTax?.id ?? generateId();
        if (item.taxRatePercent !== undefined) {
          const bp = Math.round(item.taxRatePercent * 100);
          const tax = existingTaxesMap.get(bp);
          if (tax) {
            taxId = tax.id;
          }
        }

        const product: Product = {
          id: generateId(),
          sku: item.sku,
          name: item.name,
          barcodes: item.barcodes,
          categoryId: catId,
          taxRateId: taxId,
          priceMinor: item.priceMinor,
          costMinor: item.costMinor,
          trackStock: item.trackStock,
          unit: item.unit,
          allowFractional: item.allowFractional,
          active: true,
          custom: item.custom,
          version: 1,
          updatedAt: nowIso,
        };

        newProductsToInsert.push(product);

        if (i % 250 === 0 || i === validRows.length - 1) {
          setProgress(Math.round(((i + 1) / validRows.length) * 100));
        }
      }

      // Perform bulk inserts
      if (newCategoriesToInsert.length > 0) {
        await db.categories.bulkPut(newCategoriesToInsert);
      }
      if (newProductsToInsert.length > 0) {
        await db.products.bulkPut(newProductsToInsert);
      }

      const durationMs = Math.round(performance.now() - startTime);
      setImportSummary({
        imported: newProductsToInsert.length,
        skipped: validations.length - validRows.length,
        durationMs,
      });

      await onImportComplete();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error durante la importación');
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = validations?.filter((v) => v.isValid).length ?? 0;
  const invalidCount = validations ? validations.length - validCount : 0;

  const PREVIEW_LIMIT = 50;
  const displayedRows = validations
    ? validations.filter((v) => {
        if (filterMode === 'valid') return v.isValid;
        if (filterMode === 'invalid') return !v.isValid;
        return true;
      })
    : [];

  const previewRows = displayedRows.slice(0, PREVIEW_LIMIT);

  return (
    <div className="space-y-6">
      {/* Header & Template Download */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-emerald-600" />
            Importación Masiva de Productos (CSV)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sube o pega un archivo CSV delimitado por comas según el estándar RFC 4180.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          Descargar Plantilla CSV
        </button>
      </div>

      {/* Upload Zone / Text Input */}
      {!validations && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* File Picker Box */}
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-white/50 dark:bg-slate-900/50">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-file-picker"
            />
            <label
              htmlFor="csv-file-picker"
              className="cursor-pointer flex flex-col items-center w-full"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-3">
                <FileText className="w-7 h-7" />
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Seleccionar archivo CSV
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Haz clic para buscar en tu dispositivo
              </span>
            </label>
          </div>

          {/* Paste Raw Textarea */}
          <div className="space-y-2">
            <label
              htmlFor="csv-raw-textarea"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              O pegar contenido CSV directamente:
            </label>
            <textarea
              id="csv-raw-textarea"
              rows={6}
              value={csvContent}
              onChange={handleTextareaChange}
              placeholder="sku,name,price,barcodes&#10;P1,Producto Ejemplo,15.50,12345678"
              className="w-full p-3 font-mono text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      )}

      {/* Validation & Preview Section */}
      {validations && (
        <div className="space-y-4">
          {/* Summary Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Archivo: {fileName ?? 'Texto pegado'} ({validations.length} filas detectadas)
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
                    filterMode === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todos ({validations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('valid')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors min-h-[36px] flex items-center gap-1.5 ${
                    filterMode === 'valid'
                      ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-sm'
                      : 'text-emerald-600 hover:text-emerald-800'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Válidos ({validCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('invalid')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors min-h-[36px] flex items-center gap-1.5 ${
                    filterMode === 'invalid'
                      ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-400 shadow-sm'
                      : 'text-rose-600 hover:text-rose-800'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Con Errores ({invalidCount})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setValidations(null);
                  setCsvContent('');
                  setFileName(null);
                }}
                className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeImport}
                disabled={validCount === 0 || isImporting}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-md disabled:opacity-50"
              >
                <span>Importar {validCount} Válidos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Import Progress Bar */}
          {isImporting && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Guardando productos en la base de datos local...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Banner */}
          {importSummary && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between">
              <div>
                Importación completada: {importSummary.imported} productos importados en{' '}
                {importSummary.durationMs} ms ({importSummary.skipped} filas omitidas con errores).
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm max-h-[480px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-2.5 px-3">Fila</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Nombre</th>
                  <th className="py-2.5 px-3">Precio</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3">Detalle / Errores</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previewRows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 ${
                      !row.isValid ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-mono text-slate-400">{row.rowNumber}</td>
                    <td className="py-2 px-3">
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Válido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          Error
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-900 dark:text-white">
                      {row.product?.sku ?? row.raw.sku ?? row.raw.codigo ?? '-'}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {row.product?.name ?? row.raw.name ?? row.raw.nombre ?? '-'}
                    </td>
                    <td className="py-2 px-3 font-mono">
                      {row.product
                        ? `$${(row.product.priceMinor / 100).toFixed(2)}`
                        : (row.raw.price ?? '-')}
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      {row.product?.categoryName ?? row.raw.category ?? '-'}
                    </td>
                    <td className="py-2 px-3">
                      {row.errors.length > 0 ? (
                        <span className="text-rose-600 font-medium">{row.errors.join('; ')}</span>
                      ) : (
                        <span className="text-slate-400">Listo para importar</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {displayedRows.length > PREVIEW_LIMIT && (
            <p className="text-[11px] text-slate-500 text-center italic">
              Mostrando las primeras {PREVIEW_LIMIT} filas de {displayedRows.length} en la vista
              previa.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
