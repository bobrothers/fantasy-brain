'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface PlayerResult {
  id: string;
  name: string;
  team: string | null;
  position: string;
  injuryStatus: string | null;
}

interface PlayerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (player: PlayerResult) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

export default function PlayerAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'ENTER PLAYER NAME',
  className = '',
  inputClassName = '',
  disabled = false,
}: PlayerAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlayerResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch suggestions when value changes (debounced)
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.players || []);
        setIsOpen(data.players?.length > 0);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 150);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, fetchSuggestions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (player: PlayerResult) => {
    onChange(player.name);
    setIsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    onSelect?.(player);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        if (highlightedIndex >= 0) {
          e.preventDefault();
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const getInjuryBadge = (status: string | null) => {
    if (!status) return null;
    const colors: Record<string, string> = {
      Out: 'bg-red-900 text-red-300',
      IR: 'bg-red-900 text-red-300',
      Doubtful: 'bg-red-900/70 text-red-300',
      Questionable: 'bg-amber-900 text-amber-300',
      Probable: 'bg-emerald-900 text-emerald-300',
      DNR: 'bg-purple-900 text-purple-300', // Did Not Report / Resting
    };
    return (
      <span className={`px-1.5 py-0.5 text-[10px] uppercase ${colors[status] || 'bg-zinc-700 text-zinc-300'}`}>
        {status}
      </span>
    );
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => value.length >= 2 && suggestions.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full bg-zinc-900 border-2 border-zinc-700 px-4 py-4 text-lg tracking-wide placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 transition-colors disabled:opacity-50 ${inputClassName}`}
          style={{ caretColor: '#fbbf24' }}
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-amber-400 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 shadow-xl max-h-80 overflow-y-auto">
          {suggestions.map((player, index) => (
            <button
              key={player.id}
              type="button"
              className={`w-full px-4 py-3 text-left flex items-center justify-between transition-colors ${
                index === highlightedIndex
                  ? 'bg-zinc-800'
                  : 'hover:bg-zinc-800/50'
              }`}
              onClick={() => handleSelect(player)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="flex items-center gap-3">
                <span className="text-zinc-100 font-medium">{player.name}</span>
                {getInjuryBadge(player.injuryStatus)}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">{player.position}</span>
                {player.team && (
                  <span className="bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                    {player.team}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
