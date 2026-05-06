import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type ApiError } from "../lib/api";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

import { cn } from "@/lib/utils";

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
const getInitial = (name: string) => name.trim().charAt(0).toUpperCase() || "♪";

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
  const canRequest = !loading && query.trim().length > 0 && !exactMatch;

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
    <div>
      <Label htmlFor={inputId}>{t("combobox.label")}</Label>
      <div className="relative mt-2">
        <Input
          id={inputId}
          role="combobox"
          aria-busy={loading}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && items[activeIndex] ? `${listboxId}-${items[activeIndex].id}` : undefined
          }
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
            className="border-border bg-popover text-popover-foreground shadow-glow absolute left-0 right-0 top-full z-50 mt-3 max-h-72 overflow-auto rounded-xl border p-2"
            role="listbox"
            aria-busy={loading}
            id={listboxId}
          >
            {loading && (
              <div className="text-muted-foreground px-3 py-2 text-sm">{t("combobox.loading")}</div>
            )}
            {error && !loading && (
              <div role="alert" className="text-destructive px-3 py-2 text-sm dark:text-red-200">
                {t("combobox.error", { code: error.code })}
              </div>
            )}
            {!loading && !error && items.length === 0 && (
              <div className="text-muted-foreground px-3 py-2 text-sm">{t("combobox.empty")}</div>
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
                  className={cn(
                    "hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none focus-visible:ring-2",
                    index === activeIndex && "bg-accent text-accent-foreground"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectArtist(artist)}
                >
                  {artist.imageUrl ? (
                    <img
                      src={artist.imageUrl}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="bg-muted text-muted-foreground grid h-8 w-8 place-items-center rounded-full">
                      {getInitial(artist.name)}
                    </span>
                  )}
                  <span>{artist.name}</span>
                </button>
              ))}
            {canRequest && (
              <Button
                type="button"
                className="mt-2 h-9 w-full justify-start"
                variant="ghost"
                onClick={requestNew}
              >
                {t("combobox.addNew", { name: query.trim() })}
              </Button>
            )}
          </div>
        )}
      </div>
      {value && (
        <div className="border-border bg-muted/40 mt-3 flex items-center gap-3 rounded-xl border p-3 text-sm">
          {value.imageUrl ? (
            <img src={value.imageUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="bg-muted text-muted-foreground grid h-9 w-9 place-items-center rounded-full text-xs font-semibold">
              {getInitial(value.name)}
            </span>
          )}
          <div>
            <div className="font-medium">{value.name}</div>
            <div className="text-muted-foreground text-xs">{t(`status.${value.status}`)}</div>
          </div>
        </div>
      )}
    </div>
  );
};
