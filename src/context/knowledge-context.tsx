"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  loadProfiles,
  saveProfile as persistProfile,
  deleteProfile as removeStoredProfile,
} from "@/lib/knowledge-storage";
import type { KnowledgeBase } from "@/types/knowledge";

interface KnowledgeContextValue {
  profiles: KnowledgeBase[];
  ready: boolean;
  error: string;
  refreshProfiles: () => void;
  saveProfile: (profile: KnowledgeBase) => KnowledgeBase;
  deleteProfile: (id: string) => void;
}

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<KnowledgeBase[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  // Storage remains the persistence layer; context shares its current state.
  const refreshProfiles = useCallback(() => {
    try {
      setProfiles(loadProfiles());
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Saved profiles could not be loaded."
      );
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refreshProfiles();

    // Keep other open tabs in sync when their browser storage changes.
    function handleStorage(event: StorageEvent) {
      if (
        event.storageArea === window.localStorage &&
        (event.key === "moknowledge.profiles.v1" || event.key === null)
      ) {
        refreshProfiles();
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => window.removeEventListener("storage", handleStorage);
  }, [refreshProfiles]);

  const saveProfile = useCallback((profile: KnowledgeBase) => {
    // Only update shared state after storage confirms the write succeeded.
    // Errors propagate to the editor's existing error handler.
    const saved = persistProfile(profile);

    setProfiles((current) =>
      current.some((item) => item.id === saved.id)
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved]
    );

    setError("");
    return saved;
  }, []);

  const deleteProfile = useCallback((id: string) => {
    // Failed writes leave the current UI state untouched.
    removeStoredProfile(id);
    setProfiles((current) => current.filter((item) => item.id !== id));
    setError("");
  }, []);

  const value = useMemo(
    () => ({
      profiles,
      ready,
      error,
      refreshProfiles,
      saveProfile,
      deleteProfile,
    }),
    [profiles, ready, error, refreshProfiles, saveProfile, deleteProfile]
  );

  return (
    <KnowledgeContext.Provider value={value}>
      {children}
    </KnowledgeContext.Provider>
  );
}

// Components receive a clear error if the provider was not installed.
export function useKnowledge() {
  const context = useContext(KnowledgeContext);

  if (!context) {
    throw new Error("useKnowledge must be used within KnowledgeProvider.");
  }

  return context;
}