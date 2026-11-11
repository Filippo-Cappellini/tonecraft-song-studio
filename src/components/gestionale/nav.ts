// Sezioni del gestionale e ruoli che le vedono: usate dal menu laterale e dal menu utente in alto.
import { Database, KeyRound, Store, UserCog } from "lucide-react";
import type { Permission } from "@/lib/staff-roles";

export type NavItem = {
  to: string;
  label: string;
  icon: typeof Database;
  perms: readonly Permission[];
  exact?: boolean;
};

export const STAFF_NAV: NavItem[] = [
  { to: "/gestionale", label: "Database", icon: Database, perms: ["vedere"], exact: true },
  { to: "/gestionale/negozi", label: "Negozi online", icon: Store, perms: ["vedere"] },
  { to: "/gestionale/utenti", label: "Utenti e registro", icon: UserCog, perms: ["admin"] },
  { to: "/gestionale/account", label: "Il mio account", icon: KeyRound, perms: ["vedere"] },
];
