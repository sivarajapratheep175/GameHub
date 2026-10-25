import type { User } from "firebase/auth";

export function getFallbackDisplayName(user: User | null) {
  return user?.displayName?.trim() || user?.email?.split("@")[0]?.trim() || "Player";
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "PL";
}
