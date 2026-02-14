"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader2,
  Check,
  Users,
  Edit3,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";

export interface LibraryCharacter {
  id: string;
  name: string;
  category: string;
  tags: string[];
  thumbnail: string;
  texturePath: string;
  isPreRigged: boolean;
}

export interface SelectedCharacter {
  libraryCharId: string;
  name: string; // Customizable display name
  thumbnail: string;
  texturePath: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface CharacterBrowserProps {
  selectedCharacters: SelectedCharacter[];
  onSelectionChange: (characters: SelectedCharacter[]) => void;
  maxCharacters?: number;
  pageSize?: number;
}

export function CharacterBrowser({
  selectedCharacters,
  onSelectionChange,
  maxCharacters = 4,
  pageSize = 12,
}: CharacterBrowserProps) {
  const [characters, setCharacters] = useState<LibraryCharacter[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [previewChar, setPreviewChar] = useState<LibraryCharacter | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize,
    total: 0,
    totalPages: 0,
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when category changes
  useEffect(() => {
    setPage(1);
  }, [activeCategory]);

  const fetchCharacters = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (activeCategory !== "all") params.set("category", activeCategory);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/characters?${params}`);
      if (!res.ok) throw new Error("Failed to fetch characters");
      const data = await res.json();
      setCharacters(data.characters);
      setCategories(data.categories);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Failed to load characters:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, activeCategory, debouncedSearch]);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  function isSelected(charId: string): boolean {
    return selectedCharacters.some((s) => s.libraryCharId === charId);
  }

  function toggleCharacter(char: LibraryCharacter) {
    if (isSelected(char.id)) {
      // Deselect
      onSelectionChange(selectedCharacters.filter((s) => s.libraryCharId !== char.id));
    } else if (selectedCharacters.length < maxCharacters) {
      // Select
      onSelectionChange([
        ...selectedCharacters,
        {
          libraryCharId: char.id,
          name: char.name,
          thumbnail: char.thumbnail,
          texturePath: char.texturePath,
        },
      ]);
    }
  }

  function startEditName(charId: string) {
    const selected = selectedCharacters.find((s) => s.libraryCharId === charId);
    if (selected) {
      setEditingName(charId);
      setEditNameValue(selected.name);
    }
  }

  function saveEditName(charId: string) {
    if (editNameValue.trim()) {
      onSelectionChange(
        selectedCharacters.map((s) =>
          s.libraryCharId === charId ? { ...s, name: editNameValue.trim() } : s
        )
      );
    }
    setEditingName(null);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-violet-500" />
          <h3 className="font-semibold">Select Characters</h3>
          <Badge variant="outline" className="ml-1">
            {selectedCharacters.length}/{maxCharacters}
          </Badge>
        </div>
        {pagination.total > 0 && (
          <span className="text-xs text-muted-foreground">
            {pagination.total} character{pagination.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search characters..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={activeCategory === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveCategory("all")}
        >
          All
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(cat)}
            className="capitalize"
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Character grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : characters.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? "No characters match your search" : "No characters available"}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          <AnimatePresence mode="popLayout">
            {characters.map((char) => {
              const selected = isSelected(char.id);
              const atLimit = selectedCharacters.length >= maxCharacters && !selected;

              return (
                <motion.button
                  key={char.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => !atLimit && toggleCharacter(char)}
                  className={cn(
                    "relative rounded-xl border-2 p-2 transition-all cursor-pointer group",
                    "hover:shadow-md hover:border-violet-300",
                    selected
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 shadow-md"
                      : "border-gray-200 dark:border-gray-700",
                    atLimit && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {/* Selection indicator */}
                  {selected && (
                    <div className="absolute top-1 right-1 z-10 bg-violet-500 rounded-full p-0.5">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}

                  {/* Preview button (visible on hover) */}
                  <div
                    className="absolute top-1 left-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewChar(char);
                    }}
                  >
                    <div className="bg-black/60 hover:bg-black/80 rounded-full p-1 cursor-pointer">
                      <Eye className="h-3 w-3 text-white" />
                    </div>
                  </div>

                  {/* Character thumbnail */}
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 mb-1">
                    <img
                      src={char.thumbnail}
                      alt={char.name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>

                  {/* Name */}
                  <p className="text-xs font-medium truncate text-center">{char.name}</p>

                  {/* Category badge */}
                  <Badge variant="secondary" className="mt-1 text-[10px] capitalize w-full justify-center">
                    {char.category}
                  </Badge>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter((p) => {
                // Show first, last, current, and adjacent pages
                if (p === 1 || p === pagination.totalPages) return true;
                if (Math.abs(p - page) <= 1) return true;
                return false;
              })
              .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                  acc.push("ellipsis");
                }
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-sm">
                    ...
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant={page === item ? "default" : "ghost"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setPage(item)}
                    disabled={isLoading}
                  >
                    {item}
                  </Button>
                )
              )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages || isLoading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Selected characters preview */}
      {selectedCharacters.length > 0 && (
        <div className="border-t pt-4 space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Selected Characters</h4>
          <div className="flex flex-wrap gap-3">
            {selectedCharacters.map((char) => (
              <div
                key={char.libraryCharId}
                className="flex items-center gap-2 bg-violet-50 dark:bg-violet-950/30 rounded-lg px-3 py-2 border border-violet-200 dark:border-violet-800"
              >
                <img
                  src={char.thumbnail}
                  alt={char.name}
                  className="w-8 h-8 rounded object-contain bg-white"
                />

                {editingName === char.libraryCharId ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      className="h-6 w-24 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEditName(char.libraryCharId);
                        if (e.key === "Escape") setEditingName(null);
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => saveEditName(char.libraryCharId)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <span className="text-sm font-medium">{char.name}</span>
                )}

                <button
                  onClick={() => startEditName(char.libraryCharId)}
                  className="text-muted-foreground hover:text-foreground"
                  title="Rename character"
                >
                  <Edit3 className="h-3 w-3" />
                </button>

                <button
                  onClick={() =>
                    onSelectionChange(
                      selectedCharacters.filter((s) => s.libraryCharId !== char.libraryCharId)
                    )
                  }
                  className="text-muted-foreground hover:text-red-500"
                  title="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Character preview modal */}
      <Dialog open={!!previewChar} onOpenChange={(open) => !open && setPreviewChar(null)}>
        <DialogContent className="sm:max-w-md">
          {previewChar && (() => {
            const previewSelected = isSelected(previewChar.id);
            const previewAtLimit = selectedCharacters.length >= maxCharacters && !previewSelected;

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {previewChar.name}
                    <Badge variant="secondary" className="capitalize text-xs">
                      {previewChar.category}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col items-center gap-4">
                  {/* Large character image */}
                  <div className="w-72 h-72 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border">
                    <img
                      src={previewChar.texturePath}
                      alt={previewChar.name}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Tags */}
                  {previewChar.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {previewChar.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs capitalize">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Select / Deselect button */}
                  <Button
                    className="w-full"
                    variant={previewSelected ? "outline" : "default"}
                    disabled={previewAtLimit}
                    onClick={() => {
                      toggleCharacter(previewChar);
                      if (!previewSelected) setPreviewChar(null);
                    }}
                  >
                    {previewSelected ? (
                      <>
                        <X className="h-4 w-4 mr-2" /> Remove from Selection
                      </>
                    ) : previewAtLimit ? (
                      `Max ${maxCharacters} characters selected`
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" /> Select Character
                      </>
                    )}
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
