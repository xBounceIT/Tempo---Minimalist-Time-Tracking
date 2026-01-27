import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface TableFilterProps {
  title: string;
  options: string[];
  selectedValues: string[];
  onFilterChange: (selected: string[]) => void;
  sortDirection: 'asc' | 'desc' | null;
  onSortChange: (dir: 'asc' | 'desc' | null) => void;
  onClose: () => void;
}

const TableFilter: React.FC<TableFilterProps> = ({
  title,
  options,
  selectedValues,
  onFilterChange,
  sortDirection,
  onSortChange,
  onClose,
}) => {
  const { t } = useTranslation('common');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter((opt) => String(opt).toLowerCase().includes(searchTerm.toLowerCase()));
  }, [options, searchTerm]);

  const handleCheckboxChange = (value: string) => {
    const newSelected = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onFilterChange(newSelected);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Select all visible options
      const newSelected = Array.from(new Set([...selectedValues, ...filteredOptions]));
      onFilterChange(newSelected);
    } else {
      // Deselect all visible options
      const newSelected = selectedValues.filter((val) => !filteredOptions.includes(val));
      onFilterChange(newSelected);
    }
  };

  const isAllSelected =
    filteredOptions.length > 0 && filteredOptions.every((opt) => selectedValues.includes(opt));
  const isIndeterminate =
    !isAllSelected && filteredOptions.some((opt) => selectedValues.includes(opt));

  return (
    <div className="absolute top-0 left-full ml-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-50 flex flex-col text-left font-normal animate-in fade-in zoom-in-95 duration-200">
      {/* Header with Sort Controls */}
      <div className="p-2 border-b border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {title}
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => onSortChange('asc')}
            title={t('table.sortAsc')}
            className={`flex-1 p-1.5 text-xs font-bold rounded border transition-colors flex items-center justify-center ${
              sortDirection === 'asc'
                ? 'bg-praetor text-white border-praetor'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <i className="fa-solid fa-arrow-down-a-z"></i>
          </button>
          <button
            onClick={() => onSortChange('desc')}
            title={t('table.sortDesc')}
            className={`flex-1 p-1.5 text-xs font-bold rounded border transition-colors flex items-center justify-center ${
              sortDirection === 'desc'
                ? 'bg-praetor text-white border-praetor'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <i className="fa-solid fa-arrow-up-a-z"></i>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b border-slate-100">
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('table.search')}
            className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:ring-1 focus:ring-praetor transition-all"
            autoFocus
          />
        </div>
      </div>

      {/* Options List */}
      <div className="max-h-40 overflow-y-auto p-1.5 space-y-0.5">
        <label className="flex items-center gap-1.5 px-1.5 py-1 hover:bg-slate-50 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(input) => {
              if (input) input.indeterminate = isIndeterminate;
            }}
            onChange={handleSelectAll}
            className="w-3.5 h-3.5 rounded text-praetor focus:ring-praetor border-gray-300"
          />
          <span className="text-[11px] text-slate-600 select-none">({t('table.selectAll')})</span>
        </label>
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-1.5 px-1.5 py-1 hover:bg-slate-50 rounded cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedValues.includes(opt)}
                onChange={() => handleCheckboxChange(opt)}
                className="w-3.5 h-3.5 rounded text-praetor focus:ring-praetor border-gray-300"
              />
              <span className="text-[11px] text-slate-600 truncate select-none" title={opt}>
                {opt}
              </span>
            </label>
          ))
        ) : (
          <div className="text-center py-3 text-[11px] text-slate-400">{t('table.noResults')}</div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-slate-100 bg-slate-50 rounded-b-lg">
        <button
          onClick={() => {
            onFilterChange([]);
            // onSortChange(null); // Optional: clear sort too? usually separate.
          }}
          className="text-[11px] font-bold text-slate-500 hover:text-red-500 transition-colors"
        >
          {t('table.clearFilter')}
        </button>
      </div>
    </div>
  );
};

export default TableFilter;
