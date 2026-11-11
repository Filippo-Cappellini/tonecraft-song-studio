// Sezioni del gestionale e ruoli che le vedono: usate dal menu laterale e dal menu utente in alto.
import {
  BarChart3,
  BookOpen,
  Boxes,
  KeyRound,
  Package,
  ShoppingCart,
  Store,
  Truck,
  UserCog,
  Users,
} from "lucide-react";
import type { Permission } from "@/lib/staff-roles";

export type NavItem = {
  to: string;
  label: string;
  icon: typeof Package;
  perms: readonly Permission[];
  exact?: boolean;
};
export const STAFF_NAV: NavItem[] = [
  {
    to: "/gestionale",
    label: "Riepilogo",
    icon: BarChart3,
    perms: ["catalogo", "magazzino", "vendite"],
    exact: true,
  },
  { to: "/gestionale/vendite", label: "Vendite", icon: ShoppingCart, perms: ["vendite"] },
  { to: "/gestionale/prodotti", label: "Prodotti", icon: Package, perms: ["magazzino", "vendite"] },
  { to: "/gestionale/movimenti", label: "Movimenti", icon: Boxes, perms: ["magazzino"] },
  { to: "/gestionale/tabelle/customers", label: "Clienti", icon: Users, perms: ["vendite"] },
  { to: "/gestionale/tabelle/suppliers", label: "Fornitori", icon: Truck, perms: ["magazzino"] },
  {
    to: "/gestionale/negozi",
    label: "Negozi online",
    icon: Store,
    perms: ["catalogo", "magazzino", "vendite"],
  },
  { to: "/gestionale/catalogo", label: "Catalogo app", icon: BookOpen, perms: ["catalogo"] },
  { to: "/gestionale/utenti", label: "Utenti e registro", icon: UserCog, perms: ["admin"] },
  {
    to: "/gestionale/account",
    label: "Il mio account",
    icon: KeyRound,
    perms: ["catalogo", "magazzino", "vendite"],
  },
];
