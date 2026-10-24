import React from 'react';
import Select, { components } from 'react-select';

const SELECT_ALL_VALUE = '__select_all__';

export const selectStyles = {
  control: (base, state) => ({
    ...base,
    backgroundColor: '#ffffff',
    borderColor: state.isFocused ? '#2A9D8F' : '#e2e8f0',
    borderRadius: '0.75rem',
    padding: '2px 4px',
    minHeight: '42px',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(42, 157, 143, 0.15)' : 'none',
    '&:hover': {
      borderColor: '#2A9D8F',
    },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '0.85rem',
    overflow: 'hidden',
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
    border: '1px solid #f1f5f9',
    zIndex: 9999,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.selectProps.isMulti
      ? state.isFocused
        ? '#f1f5f9'
        : state.isSelected
        ? '#f0fdf4'
        : '#ffffff'
      : state.isSelected
      ? '#2A9D8F'
      : state.isFocused
      ? '#eef7f4'
      : '#ffffff',
    color: state.selectProps.isMulti
      ? '#1e293b'
      : state.isSelected
      ? '#ffffff'
      : '#1e293b',
    fontWeight: state.isSelected ? 600 : 400,
    fontSize: '0.9rem',
    padding: '9px 12px',
    cursor: 'pointer',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#94a3b8',
    fontSize: '0.9rem',
  }),
  singleValue: (base) => ({
    ...base,
    color: '#1e293b',
    fontWeight: 500,
    fontSize: '0.92rem',
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),
};

function CheckboxOption(props) {
  const { data, isSelected, selectProps } = props;
  const isSelectAll = data.value === SELECT_ALL_VALUE;
  const allRealOptions = (selectProps.options || []).filter((o) => o.value !== SELECT_ALL_VALUE);
  const currentSelected = (selectProps.value || []).filter((o) => o.value !== SELECT_ALL_VALUE);
  const checked = isSelectAll
    ? allRealOptions.length > 0 && currentSelected.length === allRealOptions.length
    : isSelected;

  return (
    <components.Option {...props}>
      <div
        className={`flex items-center gap-2.5 ${
          isSelectAll ? 'pb-1.5 mb-1 border-b border-slate-200 font-bold text-forest-700' : ''
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          readOnly
          className="w-4 h-4 rounded border-slate-300 text-forest-600 focus:ring-0 pointer-events-none accent-[#2A9D8F]"
        />
        <span className="truncate">{data.label}</span>
      </div>
    </components.Option>
  );
}

function MultiValueContainer({ children, ...props }) {
  const { selectProps } = props;
  const allRealOptions = (selectProps.options || []).filter((o) => o.value !== SELECT_ALL_VALUE);
  const selected = (selectProps.value || []).filter((o) => o.value !== SELECT_ALL_VALUE);
  const inputAndPlaceholder = React.Children.toArray(children).filter(
    (child) => child && child.type !== components.MultiValue
  );

  let summaryText = '';
  if (selected.length > 0) {
    if (selected.length === allRealOptions.length) {
      summaryText = `כל המשפחות (${selected.length})`;
    } else {
      summaryText = `${selected.length} נבחרו: ${selected.map((s) => s.label).join('، ')}`;
    }
  }

  return (
    <components.ValueContainer {...props}>
      <div className="flex items-center gap-1 overflow-hidden w-full">
        {summaryText && (
          <span className="text-sm font-medium text-slate-800 truncate">{summaryText}</span>
        )}
        {inputAndPlaceholder}
      </div>
    </components.ValueContainer>
  );
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'בחירה...',
  isClearable = false,
  isSearchable = true,
  isMulti = false,
  closeMenuOnSelect,
  portal = false,
}) {
  const multiOptions =
    isMulti && options.length > 1
      ? [{ value: SELECT_ALL_VALUE, label: 'בחירת כל המשפחות' }, ...options]
      : options;

  const selectedOption = isMulti
    ? options.filter((o) => Array.isArray(value) && value.some((v) => String(v) === String(o.value)))
    : options.find((o) => String(o.value) === String(value)) || null;

  return (
    <Select
      isRtl
      isMulti={isMulti}
      hideSelectedOptions={!isMulti}
      closeMenuOnSelect={closeMenuOnSelect ?? !isMulti}
      options={isMulti ? multiOptions : options}
      value={selectedOption}
      onChange={(opt, actionMeta) => {
        if (isMulti) {
          if (actionMeta?.option?.value === SELECT_ALL_VALUE) {
            const allSelected = selectedOption.length === options.length;
            onChange(allSelected ? [] : options.map((o) => o.value));
            return;
          }
          const clean = (opt || []).filter((o) => o.value !== SELECT_ALL_VALUE);
          onChange(clean.map((o) => o.value));
        } else {
          onChange(opt ? opt.value : '');
        }
      }}
      placeholder={placeholder}
      isClearable={isClearable}
      isSearchable={isSearchable}
      components={
        isMulti
          ? {
              Option: CheckboxOption,
              ValueContainer: MultiValueContainer,
            }
          : undefined
      }
      noOptionsMessage={() => 'לא נמצאו תוצאות'}
      menuPortalTarget={portal && typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"
      styles={selectStyles}
    />
  );
}
