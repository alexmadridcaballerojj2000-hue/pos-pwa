import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for generating valid EAN-13 check digit
function generateEan13(index: number): string {
  const base = `750${String(index).padStart(9, '0')}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(base[i]!, 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return `${base}${check}`;
}

const CATEGORIES = [
  'Abarrotes',
  'Bebidas',
  'Lácteos y Huevos',
  'Limpieza y Hogar',
  'Farmacia y Cuidado Personal',
  'Frutas y Verduras',
  'Carnicería y Salchichonería',
  'Panadería y Dulcería',
];

const NOUNS = [
  'Galletas',
  'Refresco',
  'Jugo',
  'Leche',
  'Yogurt',
  'Detergente',
  'Jabón',
  'Shampoo',
  'Cereal',
  'Arroz',
  'Frijol',
  'Aceite',
  'Café',
  'Té',
  'Atún',
  'Sopa',
  'Pasta',
  'Mayonesa',
  'Salsa',
  'Chocolate',
  'Pan',
  'Queso',
  'Jamón',
  'Agua',
  'Papitas',
  'Limpiador',
  'Desinfectante',
  'Servilletas',
  'Papel Higiénico',
  'Suavizante',
];

const ADJECTIVES = [
  'Original',
  'Natural',
  'Extra',
  'Premium',
  'Clásico',
  'Especial',
  'Familiar',
  'Integral',
  'Sin Azúcar',
  'Ligero',
  'Concentrado',
  'Cremoso',
  'Crujiente',
  'Tradicional',
  'Casero',
  'Gourmet',
  'Intenso',
  'Fresco',
  'Artesanal',
  'Económico',
];

const PACKS = ['250g', '500g', '1kg', '2kg', '355ml', '500ml', '1L', '2L', '12 pzas', 'Pack 4'];

export function generateProductData(count = 10000) {
  const rows = [];
  rows.push('sku,name,price,cost,barcodes,category,tax_rate,unit,track_stock,allow_fractional');

  for (let i = 1; i <= count; i++) {
    const sku = `PROD-${String(i).padStart(5, '0')}`;
    const noun = NOUNS[i % NOUNS.length];
    const adj = ADJECTIVES[(i * 3) % ADJECTIVES.length];
    const pack = PACKS[(i * 7) % PACKS.length];
    const name = `${noun} ${adj} ${pack} #${i}`;
    const category = CATEGORIES[i % CATEGORIES.length];
    const priceNum = ((i % 200) + 10) * 1.5;
    const costNum = priceNum * 0.7;
    const barcode = generateEan13(i);
    const taxRate = i % 10 === 0 ? '0' : i % 5 === 0 ? '8' : '16';
    const isWeight = i % 15 === 0;
    const unit = isWeight ? 'kg' : 'unit';
    const allowFractional = isWeight ? 'true' : 'false';

    rows.push(
      `${sku},"${name}",${priceNum.toFixed(2)},${costNum.toFixed(2)},${barcode},${category},${taxRate},${unit},true,${allowFractional}`,
    );
  }

  return rows.join('\r\n');
}

export function main() {
  const targetDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log('Generando archivo CSV con 10,000 productos...');
  const csv10k = generateProductData(10000);
  const path10k = path.join(targetDir, 'sample_10000_products.csv');
  fs.writeFileSync(path10k, csv10k, 'utf-8');
  console.log(`✓ Archivo creado: ${path10k} (${(csv10k.length / 1024 / 1024).toFixed(2)} MB)`);

  console.log('Generando archivo CSV con 1,000 productos para pruebas rápidas...');
  const csv1k = generateProductData(1000);
  const path1k = path.join(targetDir, 'sample_1000_products.csv');
  fs.writeFileSync(path1k, csv1k, 'utf-8');
  console.log(`✓ Archivo creado: ${path1k} (${(csv1k.length / 1024).toFixed(1)} KB)`);

  console.log('\n¡Semilla generada exitosamente!');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
