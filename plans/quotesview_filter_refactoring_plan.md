# Piano di Refactoring: QuotesView.tsx Filtri

## Problema Identificato

In `QuotesView.tsx` i filtri della tabella esibiscono un comportamento incoerente:
- Appaiono aperti in modo casuale al caricamento iniziale della pagina
- Non rispettano uno stato iniziale predicibile
- Mancano di gestione del click outside per chiuderli

## Root Cause Analysis

### Differenza tra QuotesView.tsx e ClientsView.tsx

| Aspetto | ClientsView.tsx (✓ Funziona) | QuotesView.tsx (✗ Problema) |
|---------|------------------------------|------------------------------|
| **Gestione Filtri** | Interna a `StandardTable` | Esterna, `TableFilter` nelle intestazioni |
| **Stato Filtri** | `activeFilterCol` in `StandardTable` | Nessuno stato per apertura/chiusura |
| **Click Outside** | Implementato in `StandardTable` (linee 92-112) | Assente |
| **onClose** | `setActiveFilterCol(null)` | `onClose={() => {}}` (funzione vuota) |

### Codice problematico in QuotesView.tsx

```tsx
// Linee 1392-1431 - Filtri renderizzati direttamente senza controllo stato
<th className="...">
  <TableFilter
    title={t('crm:quotes.quoteCode', { defaultValue: 'CODE' })}
    options={uniqueQuoteCodes}
    selectedValues={quoteCodeFilter}
    onFilterChange={setQuoteCodeFilter}
    sortDirection={sortColumn === 'quoteCode' ? sortDirection : null}
    onSortChange={() => handleSort('quoteCode')}
    onClose={() => {}}  // ← Funzione vuota! Il filtro non si chiude
  />
</th>
```

## Soluzione Proposta: Refactoring a Pattern Data-Driven

Trasformare `QuotesView.tsx` per usare `StandardTable` con le props `data` e `columns`, come fa `ClientsView.tsx`.

### Vantaggi
1. **Coerenza**: Stesso pattern di ClientsView.tsx e altre viste
2. **Manutenibilità**: Logica di filtraggio centralizzata in StandardTable
3. **Stabilità**: Gestione stato filtri robusta e testata
4. **DRY**: Elimina duplicazione logica filtri/paginazione

### Schema del Refactoring

```mermaid
flowchart TB
    subgraph Prima["QuotesView.tsx (Attuale)"]
        A1[Filter State: clientFilter, statusFilter, quoteCodeFilter]
        A2[Sort State: sortColumn, sortDirection]
        A3[Pagination State: currentPage, rowsPerPage]
        A4[Manual Filtering: filteredQuotes useMemo]
        A5[Manual Pagination: paginatedQuotes]
        A6[TableFilter components in headers]
        A7[Custom table rendering]
    end
    
    subgraph Dopo["QuotesView.tsx (Refactored)"]
        B1[StandardTable props: data={quotes}]
        B2[Column definitions with accessorKey/accessorFn]
        B3[Cell renderers for custom formatting]
        B4[StandardTable handles filtering/sorting/pagination]
    end
    
    A1 --> B1
    A2 --> B1
    A3 --> B1
    A4 --> B1
    A5 --> B1
    A6 --> B2
    A7 --> B3
```

### Dettaglio Implementativo

#### 1. Definizione Colonne (come ClientsView.tsx)

```tsx
const columns = useMemo<Column<Quote>[]>(
  () => [
    {
      header: t('crm:quotes.quoteCode', { defaultValue: 'CODE' }),
      accessorKey: 'quoteCode',
      cell: ({ row }) => (
        <div className="font-mono text-sm font-bold text-slate-500">
          {row.quoteCode}
        </div>
      ),
    },
    {
      header: t('crm:quotes.clientColumn'),
      accessorKey: 'clientName',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 text-praetor rounded-xl flex items-center justify-center text-sm">
            <i className="fa-solid fa-file-invoice"></i>
          </div>
          <div>
            <div className={isHistoryRow(row) ? 'font-bold text-slate-400' : 'font-bold text-slate-800'}>
              {row.clientName}
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase">
              {t('crm:quotes.itemsCount', { count: row.items.length })}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: t('crm:quotes.totalColumn'),
      id: 'total',
      accessorFn: (row) => calculateTotals(row.items, row.discount).total,
      cell: ({ row }) => {
        const { total } = calculateTotals(row.items, row.discount);
        const expired = isQuoteExpired(row);
        const isHistory = isHistoryRow(row);
        return (
          <span className={`text-sm font-bold ${isHistory ? 'text-slate-400' : 'text-slate-700'}`}>
            {total.toFixed(2)} {currency}
          </span>
        );
      },
    },
    {
      header: t('crm:quotes.paymentTermsColumn'),
      accessorKey: 'paymentTerms',
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-slate-600">
          {row.paymentTerms === 'immediate'
            ? t('crm:quotes.immediatePayment')
            : row.paymentTerms}
        </span>
      ),
    },
    {
      header: t('crm:quotes.expirationColumn'),
      accessorKey: 'expirationDate',
      cell: ({ row }) => {
        const expired = isQuoteExpired(row);
        const isHistory = isHistoryRow(row);
        return (
          <div className={`text-sm ${isHistory ? 'text-slate-400' : expired ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
            {new Date(row.expirationDate).toLocaleDateString()}
            {expired && !isHistory && (
              <span className="ml-2 text-[10px] font-black">{t('crm:quotes.expiredLabel')}</span>
            )}
          </div>
        );
      },
    },
    {
      header: t('crm:quotes.statusColumn'),
      accessorKey: 'status',
      cell: ({ row }) => {
        const expired = isQuoteExpired(row);
        return (
          <StatusBadge
            type={expired ? 'expired' : (row.status as StatusType)}
            label={getStatusLabel(row.status)}
          />
        );
      },
    },
    {
      header: t('crm:quotes.actionsColumn'),
      id: 'actions',
      align: 'right',
      disableSorting: true,
      disableFiltering: true,
      cell: ({ row }) => (
        // Action buttons component
      ),
    },
  ],
  [t, currency, quoteIdsWithSales, quoteSaleStatuses]
);
```

#### 2. Uso StandardTable

```tsx
<StandardTable<Quote>
  title={t('crm:quotes.activeQuotes')}
  data={quotes}
  columns={columns}
  defaultRowsPerPage={5}
  onRowClick={(row) => !isHistoryRow(row) && openEditModal(row)}
  rowClassName={(row) => {
    const expired = isQuoteExpired(row);
    const isHistory = isHistoryRow(row);
    return isHistory 
      ? 'bg-slate-50 text-slate-400' 
      : expired 
        ? 'hover:bg-slate-50/50 cursor-pointer bg-red-50/30' 
        : 'hover:bg-slate-50/50 cursor-pointer';
  }}
  headerAction={
    <button
      onClick={openAddModal}
      className="bg-praetor text-white px-4 py-2.5 rounded-xl text-sm font-black shadow-xl shadow-slate-200 transition-all hover:bg-slate-700 active:scale-95 flex items-center gap-2"
    >
      <i className="fa-solid fa-plus"></i> {t('crm:quotes.createNewQuote')}
    </button>
  }
/>
```

#### 3. Helper Functions da Spostare/Esportare

```tsx
// Helper per determinare se una riga è history
const isHistoryRow = useCallback((quote: Quote) => {
  const expired = isQuoteExpired(quote);
  const hasSale = hasSaleForQuote(quote);
  return quote.status === 'denied' || expired || hasSale;
}, [quoteIdsWithSales, quoteSaleStatuses]);

// Helper per calcolare totali
const calculateTotals = useCallback((items: QuoteItem[], globalDiscount: number) => {
  // ... existing logic
}, [products]);
```

### Codice da Rimuovere

1. **Stato filtri** (linee 98-102):
   - `clientFilter`, `statusFilter`, `quoteCodeFilter`
   - `sortColumn`, `sortDirection`

2. **Stato paginazione** (linee 85-96):
   - `currentPage`, `rowsPerPage`
   - `handleRowsPerPageChange`

3. **Filtered quotes useMemo** (linee 104-133):
   - `filteredQuotes` calculation

4. **Unique values** (linee 136-149):
   - `uniqueClients`, `uniqueStatuses`, `uniqueQuoteCodes`

5. **Handle sort** (linee 151-158):
   - `handleSort` function

6. **Paginazione manuale** (linee 576-579):
   - `totalPages`, `startIndex`, `paginatedQuotes`

7. **Tabella manuale** (linee 1387-1457):
   - Intera sezione `<table>` con `<TableFilter>` nelle intestazioni

### Modifiche a StandardTable (se necessario)

Se `StandardTable` non supporta alcune funzionalità necessarie:

1. **Footer personalizzato**: Verificare se `externalFooter` è sufficiente
2. **Row click con condizione**: Verificare se `onRowClick` supporta condizioni
3. **Empty state**: Verificare se è necessario personalizzare il messaggio "no quotes"

### Test da Effettuare

1. **Filtri collassati di default**: Al caricamento, nessun filtro aperto
2. **Apertura filtro**: Click su icona filtro apre il popup
3. **Chiusura filtro**: Click outside chiude il popup
4. **Persistenza stato**: Il filtro rimane aperto durante re-render
5. **Selezione filtri**: I filtri selezionati funzionano correttamente
6. **Sorting**: Click su sort ordina la colonna
7. **Paginazione**: Cambio pagina funziona
8. **Rows per page**: Cambio righe per pagina funziona
9. **Row click**: Click su riga apre il modal (se non history)
10. **History row**: Riga history non cliccabile

## Timeline Stimata

| Fase | Descrizione |
|------|-------------|
| 1 | Creare helper functions (`isHistoryRow`, `calculateTotals`) con `useCallback` |
| 2 | Definire array `columns` con `useMemo` |
| 3 | Sostituire tabella manuale con `StandardTable` |
| 4 | Rimuovere stato e logica obsoleta |
| 5 | Test e verifica |

## File Coinvolti

- `components/QuotesView.tsx` - Modifica principale
- `components/StandardTable.tsx` - Verifica compatibilità (readonly)

## Note

- `StandardTable` gestisce già: filtri, sorting, paginazione, click outside
- La logica di `isHistoryRow` deve essere condivisa tra `columns` e eventuali altri usi
- I calcoli dei totali devono essere memoizzati per performance
