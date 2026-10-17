import React from 'react';
import Select from 'react-select';

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
    zIndex: 50,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? '#2A9D8F'
      : state.isFocused
      ? '#eef7f4'
      : '#ffffff',
    color: state.isSelected ? '#ffffff' : '#1e293b',
    fontWeight: state.isSelected ? 600 : 400,
    fontSize: '0.92rem',
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
};

export default function CustomSelect({ options, value, onChange, placeholder = 'בחירה...', isClearable = false, isSearchable = true }) {
  const selectedOption = options.find((o) => String(o.value) === String(value)) || null;

  return (
    <Select
      isRtl
      options={options}
      value={selectedOption}
      onChange={(opt) => onChange(opt ? opt.value : '')}
      placeholder={placeholder}
      isClearable={isClearable}
      isSearchable={isSearchable}
      noOptionsMessage={() => 'לא נמצאו תוצאות'}
      styles={selectStyles}
    />
  );
}
