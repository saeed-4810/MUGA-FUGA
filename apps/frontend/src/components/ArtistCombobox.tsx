import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type ApiError } from "../lib/api";

export interface ArtistOption {
  id: string;
  name: string;
  status: "pending" | "published" | "rejected";
  imageUrl?: string;
}

interface ArtistComboboxProps {
  value: ArtistOption | null;
  onChange: (artist: ArtistOption | null) => void;
  onRequestNew: (name: string) => void;
  disabled?: boolean;
}

const normalise = (value: string) => value.trim().toLowerCase();

export const ArtistCombobox = ({
  value,
  onChange,
  onRequestNew,
  disabled = false,
}: ArtistComboboxProps) => {
  const { t } = useTranslation("artists");
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const [query, setQuery] = useState(value?.name ?? "");
  const [items, setItems] = useState<ArtistOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value?.name]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      const search = query.trim();
      const suffix = search ? `&q=${encodeURIComponent(search)}` : "";
      api
        .get<{ items: ArtistOption[] }>(`/artists?status=published${suffix}`)
        .then((res) => {
          setItems(res.items);
          setActiveIndex(0);
        })
        .catch((err) => {
          setError(err as ApiError);
          setItems([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [query]);

  const exactMatch = useMemo(
    () => items.some((artist) => normalise(artist.name) === normalise(query)),
    [items, query]
  );
  const canRequest = query.trim().length > 0 && !exactMatch;

  const selectArtist = (artist: ArtistOption) => {
    onChange(artist);
    setQuery(artist.name);
    setOpen(false);
  };

  const requestNew = () => {
    const name = query.trim();
    onRequestNew(name);
    setOpen(false);
  };

  const move = (direction: 1 | -1) => {
    if (items.length === 0) return;
    setOpen(true);
    setActiveIndex((current) => (current + direction + items.length) % items.length);
  };

  return (
    <div className="relative">
      <label htmlFor={inputId} className="label">
        {t("combobox.label")}
      </label>
      <input
        id={inputId}
        role="combobox"
        aria-busy={loading}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && items[activeIndex] ? `${listboxId}-${items[activeIndex].id}` : undefined
        }
        className="input"
        value={query}
        disabled={disabled}
        placeholder={t("combobox.placeholder")}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange(null);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
          } else if (event.key === "Enter" && open && items[activeIndex]) {
            event.preventDefault();
            selectArtist(items[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (
        <div
          className="border-line bg-surface shadow-glow absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border p-2"
          role="listbox"
          aria-busy={loading}
          id={listboxId}
        >
          {loading && (
            <div className="text-ink-muted px-3 py-2 text-sm">{t("combobox.loading")}</div>
          )}
          {error && !loading && (
            <div role="alert" className="px-3 py-2 text-sm text-red-600 dark:text-red-300">
              {t("combobox.error", { code: error.code })}
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="text-ink-muted px-3 py-2 text-sm">{t("combobox.empty")}</div>
          )}
          {!loading &&
            !error &&
            items.map((artist, index) => (
              <button
                type="button"
                role="option"
                aria-selected={value?.id === artist.id}
                id={`${listboxId}-${artist.id}`}
                key={artist.id}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-surface-muted" : "hover:bg-surface-muted"
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectArtist(artist)}
              >
                {artist.imageUrl ? (
                  <img src={artist.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="bg-surface-muted text-ink-subtle grid h-8 w-8 place-items-center rounded-full">
                    ♪
                  </span>
                )}
                <span>{artist.name}</span>
              </button>
            ))}
          {canRequest && (
            <button
              type="button"
              className="btn-ghost mt-2 h-9 w-full justify-start"
              onClick={requestNew}
            >
              {t("combobox.addNew", { name: query.trim() })}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
