import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Coins,
  ShieldAlert,
  CreditCard,
  Printer,
  Sliders,
  Activity,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Settings, PaymentMethodConfig, CustomFieldDef } from '@/domain';
import { repositories } from '@/data/repositories';
import { CustomFieldManager } from '@/features/catalog/custom-field-manager';
import { useI18n } from '@/app/i18n';

type SettingsTab = 'business' | 'sales' | 'payments' | 'receipt' | 'customFields' | 'system';

const DEFAULT_SETTINGS: Settings = {
  id: 'singleton',
  business: {
    name: 'Mi Tienda POS',
    taxId: '',
    address: '',
    phone: '',
    footerText: '¡Gracias por su preferencia!',
  },
  currency: {
    code: 'MXN',
    decimals: 2,
    symbol: '$',
  },
  pricesIncludeTax: false,
  requireShift: true,
  allowNegativeStock: true,
  maxDiscountBp: 1000,
  paymentMethods: [
    { id: 'cash', label: 'Efectivo', kind: 'cash', active: true, requireReference: false },
    {
      id: 'card',
      label: 'Tarjeta Débito / Crédito',
      kind: 'card',
      active: true,
      requireReference: true,
    },
    {
      id: 'transfer',
      label: 'Transferencia Bancaria',
      kind: 'transfer',
      active: true,
      requireReference: true,
    },
  ],
  modules: {},
  receipt: {
    paperWidthMm: 80,
    template: {},
  },
  mode: 'local',
};

export const SettingsView: React.FC = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>('business');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [isSavedNotice, setIsSavedNotice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async (isMountedRef?: () => boolean) => {
    const [savedSettings, fields] = await Promise.all([
      repositories.settings.get(),
      repositories.customFieldDefs.listAll(),
    ]);

    if (!isMountedRef || isMountedRef()) {
      if (savedSettings) {
        setSettings(savedSettings);
      }
      setCustomFields(fields);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadData(() => isMounted);
    return () => {
      isMounted = false;
    };
  }, [loadData]);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await repositories.settings.save(settings);
      setIsSavedNotice(true);
      setTimeout(() => setIsSavedNotice(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const updateBusiness = (key: keyof Settings['business'], val: string) => {
    setSettings((prev) => ({
      ...prev,
      business: {
        ...prev.business,
        [key]: val,
      },
    }));
  };

  const updateCurrency = (key: keyof Settings['currency'], val: string | number) => {
    setSettings((prev) => ({
      ...prev,
      currency: {
        ...prev.currency,
        [key]: val,
      },
    }));
  };

  const togglePaymentMethodActive = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map((m) =>
        m.id === id ? { ...m, active: !m.active } : m,
      ),
    }));
  };

  const togglePaymentMethodReference = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map((m) =>
        m.id === id ? { ...m, requireReference: !m.requireReference } : m,
      ),
    }));
  };

  const handleAddPaymentMethod = () => {
    const newId = `custom_${Date.now()}`;
    const newMethod: PaymentMethodConfig = {
      id: newId,
      label: 'Nuevo Método',
      kind: 'other',
      active: true,
      requireReference: false,
    };
    setSettings((prev) => ({
      ...prev,
      paymentMethods: [...prev.paymentMethods, newMethod],
    }));
  };

  const handleDeletePaymentMethod = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.filter((m) => m.id !== id),
    }));
  };

  const handleSaveCustomField = async (field: CustomFieldDef) => {
    await repositories.customFieldDefs.save(field);
    const updated = await repositories.customFieldDefs.listAll();
    setCustomFields(updated);
  };

  const handleDeleteCustomField = async (id: string) => {
    await repositories.customFieldDefs.delete(id);
    const updated = await repositories.customFieldDefs.listAll();
    setCustomFields(updated);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Ajustes del Sistema
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configuración global del negocio, reglas de venta, métodos de pago y recibos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isSavedNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              ¡Cambios guardados!
            </span>
          )}
          <button
            type="button"
            onClick={() => handleSaveSettings()}
            disabled={isSaving}
            className="min-h-[48px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 shadow-md transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : t('common.save')}</span>
          </button>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="flex flex-wrap gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('business')}
          className={`min-h-[40px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'business'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Negocio y Moneda</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          className={`min-h-[40px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'sales'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Reglas de Venta</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`min-h-[40px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'payments'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Métodos de Pago</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receipt')}
          className={`min-h-[40px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'receipt'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Ticket / Recibo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('customFields')}
          className={`min-h-[40px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'customFields'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Campos Dinámicos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`min-h-[40px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'system'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Diagnósticos</span>
        </button>
      </div>

      {/* Tab 1: Business and Currency */}
      {activeTab === 'business' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Datos de la Empresa / Negocio
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="settings-biz-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Nombre Comercial / Razón Social *
                </label>
                <input
                  id="settings-biz-name"
                  type="text"
                  value={settings.business.name}
                  onChange={(e) => updateBusiness('name', e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="settings-biz-taxid"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Identificación Fiscal (RFC / RUT / NIF)
                </label>
                <input
                  id="settings-biz-taxid"
                  type="text"
                  value={settings.business.taxId ?? ''}
                  onChange={(e) => updateBusiness('taxId', e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm uppercase"
                />
              </div>

              <div>
                <label
                  htmlFor="settings-biz-phone"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Teléfono de Atención
                </label>
                <input
                  id="settings-biz-phone"
                  type="tel"
                  value={settings.business.phone ?? ''}
                  onChange={(e) => updateBusiness('phone', e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="settings-biz-address"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Dirección del Establecimiento
                </label>
                <input
                  id="settings-biz-address"
                  type="text"
                  value={settings.business.address ?? ''}
                  onChange={(e) => updateBusiness('address', e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-600" />
              Moneda y Formato de Precios
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="settings-curr-code"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Código ISO (ej. MXN, USD, EUR)
                </label>
                <input
                  id="settings-curr-code"
                  type="text"
                  value={settings.currency.code}
                  onChange={(e) => updateCurrency('code', e.target.value.toUpperCase())}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm uppercase"
                />
              </div>

              <div>
                <label
                  htmlFor="settings-curr-symbol"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Símbolo de Moneda (ej. $, €, S/)
                </label>
                <input
                  id="settings-curr-symbol"
                  type="text"
                  value={settings.currency.symbol}
                  onChange={(e) => updateCurrency('symbol', e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="settings-curr-decimals"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Decimales para Cobro
                </label>
                <select
                  id="settings-curr-decimals"
                  value={settings.currency.decimals}
                  onChange={(e) => updateCurrency('decimals', Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                >
                  <option value={0}>0 (Sin decimales - ej. JPY, CLP)</option>
                  <option value={2}>2 (Estándar centavos - ej. USD, MXN, EUR)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Sales Rules */}
      {activeTab === 'sales' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-600" />
            Reglas de Venta y Control Operativo
          </h2>

          <div className="space-y-4">
            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer min-h-[48px]">
              <input
                type="checkbox"
                checked={settings.pricesIncludeTax}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, pricesIncludeTax: e.target.checked }))
                }
                className="mt-0.5 w-4 h-4 rounded text-emerald-600"
              />
              <div>
                <span className="block text-sm font-bold text-slate-900 dark:text-white">
                  Los precios de venta ya incluyen impuestos
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Si está marcado, el total de la línea es exactamente el precio ingresado y el
                  impuesto se desglosa internamente (base = precio / (1 + tasa)).
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer min-h-[48px]">
              <input
                type="checkbox"
                checked={settings.requireShift}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, requireShift: e.target.checked }))
                }
                className="mt-0.5 w-4 h-4 rounded text-emerald-600"
              />
              <div>
                <span className="block text-sm font-bold text-slate-900 dark:text-white">
                  Requerir turno de caja abierto para cobrar
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Impide realizar ventas si no hay un turno activo con fondo de caja aperturado.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer min-h-[48px]">
              <input
                type="checkbox"
                checked={settings.allowNegativeStock}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, allowNegativeStock: e.target.checked }))
                }
                className="mt-0.5 w-4 h-4 rounded text-emerald-600"
              />
              <div>
                <span className="block text-sm font-bold text-slate-900 dark:text-white">
                  Permitir ventas con stock negativo
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Permite vender artículos con inventario en 0 sin bloquear el cobro (para posterior
                  ajuste de inventario).
                </span>
              </div>
            </label>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <label
                htmlFor="settings-discount-limit"
                className="block text-sm font-bold text-slate-900 dark:text-white"
              >
                Descuento Máximo Permitido a Cajeros (% sin PIN de Gerente)
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="settings-discount-limit"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.maxDiscountBp / 100}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      maxDiscountBp: Math.round(Number(e.target.value) * 100),
                    }))
                  }
                  className="w-32 h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold"
                />
                <span className="text-sm font-semibold text-slate-500">%</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cualquier descuento superior a este límite requerirá aprobación con PIN de gerente o
                dueño.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Payment Methods */}
      {activeTab === 'payments' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                Configuración de Métodos de Pago
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Habilita las formas de pago aceptadas en caja y solicita folio o referencia cuando
                aplique.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddPaymentMethod}
              className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              Agregar Método
            </button>
          </div>

          <div className="space-y-3">
            {settings.paymentMethods.map((m) => (
              <div
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={m.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSettings((prev) => ({
                          ...prev,
                          paymentMethods: prev.paymentMethods.map((pm) =>
                            pm.id === m.id ? { ...pm, label: val } : pm,
                          ),
                        }));
                      }}
                      className="font-bold text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-none text-slate-900 dark:text-white px-1"
                    />
                    <span className="block text-xs font-mono text-slate-400 px-1">
                      Tipo: {m.kind}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={m.requireReference}
                      onChange={() => togglePaymentMethodReference(m.id)}
                      className="w-4 h-4 rounded text-emerald-600"
                    />
                    Pedir referencia / folio
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={m.active}
                      onChange={() => togglePaymentMethodActive(m.id)}
                      className="w-4 h-4 rounded text-emerald-600"
                    />
                    Activo
                  </label>

                  {m.kind === 'other' && (
                    <button
                      type="button"
                      onClick={() => handleDeletePaymentMethod(m.id)}
                      className="min-h-[44px] min-w-[44px] p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center justify-center"
                      aria-label={`Eliminar ${m.label}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Receipt Configuration */}
      {activeTab === 'receipt' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-600" />
            Configuración de Tickets Térmicos
          </h2>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="settings-receipt-width"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Ancho del Papel de la Impresora
              </label>
              <select
                id="settings-receipt-width"
                value={settings.receipt.paperWidthMm}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    receipt: {
                      ...prev.receipt,
                      paperWidthMm: Number(e.target.value) as 58 | 80,
                    },
                  }))
                }
                className="w-full sm:w-64 h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              >
                <option value={58}>58 mm (Impresora compacta / Bluetooth)</option>
                <option value={80}>80 mm (Impresora de punto de venta estándar)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="settings-receipt-footer"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Pie de Ticket (Mensaje de despedida o políticas)
              </label>
              <textarea
                id="settings-receipt-footer"
                rows={3}
                value={settings.business.footerText ?? ''}
                onChange={(e) => updateBusiness('footerText', e.target.value)}
                placeholder="¡Gracias por su compra! Cambios válidos dentro de los 7 días con ticket."
                className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Dynamic Custom Fields Manager */}
      {activeTab === 'customFields' && (
        <CustomFieldManager
          customFieldDefs={customFields}
          onSave={handleSaveCustomField}
          onDelete={handleDeleteCustomField}
        />
      )}

      {/* Tab 6: System & Diagnostics */}
      {activeTab === 'system' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            Estado del Sistema y Diagnóstico Local
          </h2>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitorea el espacio de almacenamiento utilizado por IndexedDB, el estado de la cola de
            sincronización (Outbox) y la información del dispositivo.
          </p>

          <div className="pt-2">
            <Link
              to="/diagnostics"
              className="inline-flex items-center gap-2 px-5 min-h-[48px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm shadow-sm transition-colors"
            >
              <Activity className="w-5 h-5 text-emerald-600" />
              <span>Abrir Panel de Diagnóstico Completo</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
