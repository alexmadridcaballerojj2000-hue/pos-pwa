import React, { useEffect, useMemo, useState } from 'react';
import { Search, User, UserPlus, UserX, Check, X, Phone, Building } from 'lucide-react';
import { v7 } from '@/domain';
import type { Customer, UUID } from '@/domain';
import { createRepositories, repositories, type Repositories } from '@/data/repositories';
import type { AppDatabase } from '@/data/db';
import { useI18n } from '@/app/i18n';

export interface CustomerSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentCustomerId?: UUID | null;
  onSelectCustomer: (customer: Customer | null) => void;
  db?: AppDatabase;
  customerRepo?: Repositories['customers'];
}

export const CustomerSelectorDialog: React.FC<CustomerSelectorDialogProps> = ({
  isOpen,
  onClose,
  currentCustomerId,
  onSelectCustomer,
  db,
  customerRepo: injectedRepo,
}) => {
  const { t } = useI18n();

  const repo = useMemo(() => {
    if (injectedRepo) return injectedRepo;
    if (db) return createRepositories(db).customers;
    return repositories.customers;
  }, [injectedRepo, db]);

  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Quick create form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newTaxId, setNewTaxId] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Load / search customers
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const results = await repo.search(searchQuery);
        if (isMounted) {
          setCustomers(results);
        }
      } finally {
        if (isMounted) setIsSearching(false);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, searchQuery, repo]);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setMode('search');
      setSearchQuery('');
      setNewName('');
      setNewPhone('');
      setNewTaxId('');
      setNewAddress('');
      setFormError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (customer: Customer | null) => {
    onSelectCustomer(customer);
    onClose();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setFormError(t('wizard.nameRequired'));
      return;
    }

    try {
      setIsSaving(true);
      const newCustomer: Customer = {
        id: v7(),
        name: trimmedName,
        phone: newPhone.trim() || undefined,
        taxId: newTaxId.trim() || undefined,
        address: newAddress.trim() || undefined,
        custom: {},
        version: 1,
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      };

      await repo.save(newCustomer);
      handleSelect(newCustomer);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar cliente');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-selector-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-card text-card-foreground border border-border w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 id="customer-selector-title" className="text-base font-bold text-foreground">
                {t('pos.selectCustomer')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {mode === 'search'
                  ? 'Asigne un cliente a la venta actual o dé de alta uno nuevo'
                  : t('pos.quickNewCustomer')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="p-3 border-b border-border bg-muted/10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('search')}
            className={`flex-1 min-h-[44px] py-2 px-3 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 ${
              mode === 'search'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Search className="h-4 w-4" />
            <span>Buscar cliente</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('create');
              if (searchQuery.trim() && !newName) {
                setNewName(searchQuery.trim());
              }
            }}
            className={`flex-1 min-h-[44px] py-2 px-3 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 ${
              mode === 'create'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            <span>{t('pos.quickNewCustomer')}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mode === 'search' ? (
            <div className="space-y-3">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('pos.searchCustomerPlaceholder')}
                  className="w-full pl-10 pr-4 h-12 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              {/* Public General / Remove selection option */}
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full min-h-[48px] p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                  !currentCustomerId
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-border/80 bg-background hover:bg-muted/50 text-foreground'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      !currentCustomerId
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <UserX className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t('pos.generalCustomer')}</div>
                    <div className="text-xs text-muted-foreground">
                      Venta a consumidor final sin registrar cliente
                    </div>
                  </div>
                </div>
                {!currentCustomerId && (
                  <span className="text-xs font-bold text-primary flex items-center gap-1">
                    <Check className="h-4 w-4" />
                    Actual
                  </span>
                )}
              </button>

              {/* Customer List */}
              <div className="space-y-2 pt-1">
                {isSearching && customers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Buscando clientes...
                  </div>
                ) : customers.length === 0 ? (
                  <div className="py-8 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">{t('pos.noCustomersFound')}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('create');
                        setNewName(searchQuery.trim());
                      }}
                      className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>Dar de alta como nuevo cliente</span>
                    </button>
                  </div>
                ) : (
                  customers.map((c) => {
                    const isSelected = c.id === currentCustomerId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelect(c)}
                        className={`w-full min-h-[48px] p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary shadow-2xs'
                            : 'border-border/70 bg-card hover:bg-muted/50 text-foreground'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold truncate">{c.name}</span>
                            {isSelected && (
                              <span className="text-[10px] uppercase font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                                Seleccionado
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                            {c.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {c.phone}
                              </span>
                            )}
                            {c.taxId && (
                              <span className="flex items-center gap-1">
                                <Building className="h-3 w-3" />
                                {c.taxId}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="h-5 w-5 text-primary shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Quick Create Form */
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              {formError && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs font-semibold text-destructive">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="quick-cust-name" className="text-xs font-bold text-foreground">
                  {t('wizard.businessName')} / Nombre completo *
                </label>
                <input
                  id="quick-cust-name"
                  type="text"
                  autoFocus
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Juan Pérez o Comercializadora del Norte"
                  className="w-full h-11 px-3.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="quick-cust-phone" className="text-xs font-bold text-foreground">
                    {t('wizard.phone')}
                  </label>
                  <input
                    id="quick-cust-phone"
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Ej. 55 1234 5678"
                    className="w-full h-11 px-3.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="quick-cust-taxid" className="text-xs font-bold text-foreground">
                    {t('wizard.taxId')} (RFC / NIT)
                  </label>
                  <input
                    id="quick-cust-taxid"
                    type="text"
                    value={newTaxId}
                    onChange={(e) => setNewTaxId(e.target.value)}
                    placeholder="Ej. PEJU800101XYZ"
                    className="w-full h-11 px-3.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="quick-cust-address" className="text-xs font-bold text-foreground">
                  {t('wizard.address')}
                </label>
                <input
                  id="quick-cust-address"
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Ej. Av. Hidalgo 45, Col. Centro"
                  className="w-full h-11 px-3.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('search')}
                  className="min-h-[48px] px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted transition-colors"
                >
                  {t('wizard.back')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors shadow-xs flex items-center justify-center gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{isSaving ? t('wizard.saving') : t('pos.saveAndAssign')}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
