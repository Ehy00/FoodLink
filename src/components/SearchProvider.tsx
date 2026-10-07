"use client";

// Holds the resident's current search in memory, and only in memory.
// Nothing here is written to localStorage, cookies or the URL, so closing or
// refreshing the tab erases it. That is what "Your question is not saved" means.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, postJson } from "@/lib/client-api";
import { coarsen, type Point } from "@/lib/geo";
import type { ListingView, ParseResult, SearchTags } from "@/lib/types";

export const EMPTY_TAGS: SearchTags = {
  needs: [],
  audiences: [],
  noId: false,
  wheelchair: false,
  when: "any",
  zip: null,
};

type Status = "idle" | "parsing" | "searching" | "ready" | "error" | "rate";

interface SearchResponse {
  matches: ListingView[];
  unconfirmed: ListingView[];
  origin: Point | null;
  originKind: "device" | "zip" | "none";
  zipOutsidePilot: boolean;
}

interface AskResponse extends SearchResponse {
  tags: SearchTags;
  engine: ParseResult["engine"];
  lang: ParseResult["lang"];
}

interface SearchState {
  status: Status;
  /** The words typed into Ask FoodLink, if any. Memory only. */
  query: string | null;
  /** In-memory sequence number used to keep conversational turns distinct. */
  queryId: number;
  engine: ParseResult["engine"] | null;
  tags: SearchTags;
  matches: ListingView[];
  unconfirmed: ListingView[];
  origin: Point | null;
  originKind: SearchResponse["originKind"];
  zipOutsidePilot: boolean;
  hasSearched: boolean;
  errorMessage: string | null;
}

interface SearchApi extends SearchState {
  /** Plain-words search: AI parses the text, then the Search API runs. */
  ask: (text: string, continueConversation?: boolean) => Promise<void>;
  /** Search with explicit tags (ZIP box, quick filters, or after editing a tag). */
  search: (tags: SearchTags, keepQuery?: boolean) => Promise<void>;
  /** Ask the browser for the device location once. Resolves false if unavailable or denied. */
  locate: () => Promise<boolean>;
  /** The rounded device location for this visit, if the resident shared it. */
  deviceOrigin: Point | null;
}

const INITIAL: SearchState = {
  status: "idle",
  query: null,
  queryId: 0,
  engine: null,
  tags: EMPTY_TAGS,
  matches: [],
  unconfirmed: [],
  origin: null,
  originKind: "none",
  zipOutsidePilot: false,
  hasSearched: false,
  errorMessage: null,
};

const SearchContext = createContext<SearchApi | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SearchState>(INITIAL);
  const [deviceOrigin, setDeviceOrigin] = useState<Point | null>(null);
  const deviceRef = useRef<Point | null>(null);
  // Ignore responses from older requests if the resident edits tags quickly.
  const requestId = useRef(0);

  const run = useCallback(async (tags: SearchTags, extra: Partial<SearchState>) => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, ...extra, tags, status: "searching", errorMessage: null }));
    try {
      const result = await postJson<SearchResponse>("/api/search", { tags, origin: deviceRef.current });
      if (id !== requestId.current) return;
      setState((s) => ({ ...s, ...result, status: "ready", hasSearched: true, errorMessage: null }));
    } catch (err) {
      if (id !== requestId.current) return;
      const rate = err instanceof ApiError && err.status === 429;
      const message = err instanceof Error ? err.message : null;
      setState((s) => ({ ...s, status: rate ? "rate" : "error", hasSearched: true, errorMessage: message }));
    }
  }, []);

  const search = useCallback(
    (tags: SearchTags, keepQuery = false) => run(tags, keepQuery ? {} : { query: null, engine: null }),
    [run],
  );

  const ask = useCallback(
    async (text: string, continueConversation = false) => {
      const id = ++requestId.current;
      const previousTags = state.tags;
      setState((s) => ({
        ...s,
        status: "parsing",
        query: text,
        queryId: s.queryId + 1,
        engine: null,
        errorMessage: null,
      }));

      try {
        const result = await postJson<AskResponse>("/api/ask", {
          text,
          previousTags: continueConversation ? previousTags : null,
          continueConversation,
          origin: deviceRef.current,
        });
        if (id !== requestId.current) return;

        setState((s) => ({
          ...s,
          ...result,
          tags: result.tags,
          engine: result.engine,
          status: "ready",
          hasSearched: true,
          errorMessage: null,
        }));
      } catch (err) {
        if (id !== requestId.current) return;
        const rate = err instanceof ApiError && err.status === 429;
        const message = err instanceof Error ? err.message : null;
        setState((s) => ({ ...s, status: rate ? "rate" : "error", hasSearched: true, errorMessage: message }));
      }
    },
    [state.tags],
  );

  const locate = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(false);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            // Rounded to about a city block before it leaves this function.
            const point = coarsen({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            deviceRef.current = point;
            setDeviceOrigin(point);
            resolve(true);
          },
          () => resolve(false),
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 },
        );
      }),
    [],
  );

  const value = useMemo<SearchApi>(
    () => ({ ...state, ask, search, locate, deviceOrigin }),
    [state, ask, search, locate, deviceOrigin],
  );
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchApi {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used inside SearchProvider");
  return ctx;
}
