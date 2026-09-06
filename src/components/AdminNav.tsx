import { useEffect, useState } from "react";
import { Menu, LayoutDashboard, CalendarDays, Users, Inbox } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard,
  events: CalendarDays,
  rsvps: Users,
  submissions: Inbox,
} as const;

export type AdminLink = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  count?: number;
  active?: boolean;
};

export default function AdminNav({ links }: { links: AdminLink[] }) {
  const [open, setOpen] = useState(false);
  const [unreadSubmissions, setUnreadSubmissions] = useState<number | undefined>(
    links.find((l) => l.icon === "submissions")?.count
  );

  // Kept in sync with the submissions inbox while it's open in the same tab.
  useEffect(() => {
    const handler = () => {
      setUnreadSubmissions(document.querySelectorAll('tr[data-id][data-read="false"]').length);
    };
    document.addEventListener("submissions:changed", handler);
    return () => document.removeEventListener("submissions:changed", handler);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "text-white hover:bg-white/15 hover:text-white lg:hidden"
        )}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar">
        <SheetHeader>
          <SheetTitle className="font-serif text-lg">Badger Journals Admin</SheetTitle>
        </SheetHeader>
        <nav className="grid gap-1 px-3 pb-6">
          {links.map((l) => {
            const Icon = ICONS[l.icon];
            const count = l.icon === "submissions" ? unreadSubmissions : l.count;
            return (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={l.active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  l.active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-black/[0.04]"
                )}
              >
                <Icon className="size-[18px]" />
                {l.label}
                {count != null && count > 0 && (
                  <span
                    className={cn(
                      "ml-auto grid h-5 min-w-[22px] place-items-center rounded-full px-1.5 text-xs font-bold",
                      l.active ? "bg-primary text-primary-foreground" : "bg-black/[0.06] text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </a>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
