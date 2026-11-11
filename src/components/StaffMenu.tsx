// Voce "Accedi" del menu principale. Dopo l'accesso diventa il menu dell'utente,
// con solo le sezioni del gestionale che il suo ruolo può aprire.
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, LogIn, LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { staffStatusQuery, useStaffLogout } from "@/components/gestionale/kit";
import { STAFF_NAV } from "@/components/gestionale/nav";
import { LOCAL_DB } from "@/lib/catalog";
import { canAny, ROLES } from "@/lib/staff-roles";

export function StaffMenu({ itemClass, iconClass }: { itemClass: string; iconClass: string }) {
  // L'accesso esiste solo nell'installazione su server (database locale).
  const status = useQuery({ ...staffStatusQuery, enabled: LOCAL_DB });
  const logout = useStaffLogout();
  const navigate = useNavigate();
  if (!LOCAL_DB || !status.data?.configured) return null;

  const user = status.data.user;
  if (!user)
    return (
      <Link
        to="/accedi"
        className={itemClass}
        activeProps={{ className: "border-primary! bg-primary! text-primary-foreground!" }}
      >
        <LogIn className={iconClass} /> Accedi
      </Link>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`${itemClass} border-border!`}
        aria-label={`Menu di ${user.full_name}`}
      >
        <UserRound className={iconClass} /> {user.full_name.split(" ")[0]}
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="truncate">{user.full_name}</div>
          <div className="text-xs font-normal text-muted-foreground">{ROLES[user.role].label}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {STAFF_NAV.filter((n) => canAny(user.role, n.perms)).map((n) => (
          <DropdownMenuItem key={n.to} asChild>
            <Link to={n.to} className="cursor-pointer">
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={async () => {
            await logout();
            void navigate({ to: "/" });
          }}
        >
          <LogOut className="h-4 w-4" /> Esci
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
