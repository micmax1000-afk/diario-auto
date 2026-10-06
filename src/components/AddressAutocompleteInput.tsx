import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { searchAddressSuggestions, type GeocodeResult } from "../utils/geocoding";

interface Props {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion: (result: GeocodeResult) => void;
}

export default function AddressAutocompleteInput({ id, label, placeholder, value, onChange, onSelectSuggestion }: Props) {
  const { i18n } = useTranslation();
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchAddressSuggestions(value, 5, i18n.language)
        .then((results) => {
          setSuggestions(results);
          setOpen(results.length > 0);
        })
        .catch(() => {
          setSuggestions([]);
        });
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, i18n.language]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="field autocomplete-field" ref={wrapperRef}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(suggestions.length > 0)}
      />
      {open && suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onSelectSuggestion(s);
                  setOpen(false);
                }}
              >
                {s.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
