import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import { DexieCustomFieldDefRepository } from '@/data/repositories';
import { DynamicCustomFields } from '@/ui/dynamic-custom-fields';
import { CustomFieldManager } from './custom-field-manager';
import type { CustomFieldDef } from '@/domain';

describe('Dynamic Custom Fields (S3-T3)', () => {
  let db: AppDatabase;
  let customRepo: DexieCustomFieldDefRepository;

  const sampleDefs: CustomFieldDef[] = [
    {
      id: 'field-1',
      entity: 'product',
      key: 'color',
      label: 'Color del Producto',
      type: 'select',
      options: ['Rojo', 'Azul', 'Negro'],
      required: false,
      showOn: ['form', 'pos'],
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'field-2',
      entity: 'product',
      key: 'imei',
      label: 'Código IMEI',
      type: 'text',
      required: true,
      showOn: ['form', 'pos', 'receipt'],
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'field-3',
      entity: 'customer',
      key: 'credit_limit',
      label: 'Límite de Crédito',
      type: 'number',
      required: false,
      showOn: ['form'],
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'field-4',
      entity: 'sale',
      key: 'is_gift',
      label: '¿Es para regalo?',
      type: 'bool',
      required: false,
      showOn: ['pos', 'receipt'],
      version: 1,
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    db = createAppDatabase(`test_custom_fields_${Date.now()}_${Math.random()}`);
    customRepo = new DexieCustomFieldDefRepository(db);
  });

  describe('DynamicCustomFields UI', () => {
    it('renders all field types and captures changes into values dictionary', () => {
      let currentValues: Record<string, unknown> = {
        color: 'Rojo',
        imei: '356938035643809',
      };

      const handleChange = (newVals: Record<string, unknown>) => {
        currentValues = newVals;
      };

      const { rerender } = render(
        <DynamicCustomFields defs={sampleDefs} values={currentValues} onChange={handleChange} />,
      );

      // Verify labels and required mark
      expect(screen.getByText('Color del Producto')).toBeInTheDocument();
      const imeiLabel = screen.getByText('Código IMEI');
      expect(imeiLabel).toBeInTheDocument();

      // Change select value
      const select = screen.getByLabelText('Color del Producto');
      fireEvent.change(select, { target: { value: 'Azul' } });
      expect(currentValues.color).toBe('Azul');

      // Change text value
      const textInput = screen.getByLabelText(/código imei/i);
      fireEvent.change(textInput, { target: { value: '123456789012345' } });
      expect(currentValues.imei).toBe('123456789012345');

      // Change number value
      const numberInput = screen.getByLabelText(/límite de crédito/i);
      fireEvent.change(numberInput, { target: { value: '5000' } });
      expect(currentValues.credit_limit).toBe(5000);

      // Toggle boolean
      const boolInput = screen.getByLabelText('¿Es para regalo?');
      fireEvent.click(boolInput);
      expect(currentValues.is_gift).toBe(true);

      // Re-render with null defs
      rerender(<DynamicCustomFields defs={[]} values={{}} onChange={() => {}} />);
      expect(screen.queryByText('Color del Producto')).not.toBeInTheDocument();
    });
  });

  describe('CustomFieldManager UI', () => {
    it('filters fields by entity and creates a new custom field definition', async () => {
      let savedDef: CustomFieldDef | null = null;
      let deletedId: string | null = null;

      render(
        <CustomFieldManager
          customFieldDefs={sampleDefs}
          onSave={async (d) => {
            savedDef = d;
          }}
          onDelete={async (id) => {
            deletedId = id;
          }}
        />,
      );

      // Default tab is product
      expect(screen.getByText('Color del Producto')).toBeInTheDocument();
      expect(screen.getByText('Código IMEI')).toBeInTheDocument();
      expect(screen.queryByText('Límite de Crédito')).not.toBeInTheDocument();

      // Switch to customer tab
      fireEvent.click(screen.getByRole('button', { name: 'Clientes' }));
      expect(screen.getByText('Límite de Crédito')).toBeInTheDocument();
      expect(screen.queryByText('Color del Producto')).not.toBeInTheDocument();

      // Switch to sale tab
      fireEvent.click(screen.getByRole('button', { name: 'Ventas' }));
      expect(screen.getByText('¿Es para regalo?')).toBeInTheDocument();

      // Open new modal
      const newBtn = screen.getByRole('button', { name: /nuevo campo/i });
      fireEvent.click(newBtn);

      expect(
        screen.getByRole('heading', { name: /nuevo campo personalizado/i }),
      ).toBeInTheDocument();

      // Fill label
      const labelInput = screen.getByLabelText(/etiqueta visible/i);
      fireEvent.change(labelInput, { target: { value: 'Número de Mesa' } });

      const saveBtn = screen.getByRole('button', { name: /guardar/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(savedDef).not.toBeNull();
        expect(savedDef?.entity).toBe('sale');
        expect(savedDef?.label).toBe('Número de Mesa');
        expect(savedDef?.key).toBe('numero_de_mesa');
      });

      // Delete field
      const deleteBtn = screen.getByRole('button', { name: /eliminar ¿es para regalo\?/i });
      fireEvent.click(deleteBtn);
      expect(deletedId).toBe('field-4');
    });
  });

  describe('DexieCustomFieldDefRepository', () => {
    it('saves, queries by entity, lists all, and deletes custom field definitions', async () => {
      for (const def of sampleDefs) {
        await customRepo.save(def);
      }

      const all = await customRepo.listAll();
      expect(all).toHaveLength(4);

      const productFields = await customRepo.listByEntity('product');
      expect(productFields).toHaveLength(2);

      const customerFields = await customRepo.listByEntity('customer');
      expect(customerFields).toHaveLength(1);
      expect(customerFields[0]?.key).toBe('credit_limit');

      const saleFields = await customRepo.listByEntity('sale');
      expect(saleFields).toHaveLength(1);

      await customRepo.delete('field-1');
      expect(await customRepo.getById('field-1')).toBeNull();
    });
  });
});
