import React, { useState, useMemo, useRef, useEffect } from 'react';
import { XIcon } from './Icons';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  selectedValues,
  onChange,
  placeholder = "Seleccione...",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
        // Timeout to allow the input to be rendered before focusing
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() =>
    options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [options, searchTerm]
  );

  const toggleOption = (value: string) => {
    const newSelectedValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(newSelectedValues);
  };

  const getButtonLabel = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === options.length) return "Todos";
    if (selectedValues.length <= 2) {
      return options
        .filter(opt => selectedValues.includes(opt.value))
        .map(opt => opt.label)
        .join(", ");
    }
    return `${selectedValues.length} seleccionados`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm h-10"
      >
        <span className="block truncate text-gray-800 dark:text-gray-200">{getButtonLabel()}</span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute mt-1 w-full rounded-md bg-white dark:bg-gray-700 shadow-lg z-20 border dark:border-gray-600">
          <div className="p-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:ring-primary focus:border-primary"
            />
          </div>
          <ul className="max-h-60 overflow-auto">
            {filteredOptions.map(option => (
              <li
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className="cursor-pointer select-none relative py-2 pl-3 pr-4 hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option.value)}
                    readOnly
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:bg-gray-900 dark:border-gray-600 dark:checked:bg-primary"
                  />
                  <span className="ml-3 block font-normal truncate text-gray-900 dark:text-gray-200">{option.label}</span>
                </div>
              </li>
            ))}
            {filteredOptions.length === 0 && (
                <li className="text-center text-sm text-gray-500 py-2">No se encontraron resultados.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;