import {
  LayoutDashboard,
  MessageCircleHeart,
  BookOpenText,
  Landmark,
  FileEdit,
  HeartHandshake,
  History,
  UserRound,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { TranslationKey } from "@/i18n/en";

export interface NavItem {
  to: string;
  icon: LucideIcon;
  key: TranslationKey;
  /** Short one-word label for the desktop header bar. */
  shortKey?: TranslationKey;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, key: "nav.dashboard", shortKey: "navShort.dashboard" },
  { to: "/chat", icon: MessageCircleHeart, key: "nav.chat", shortKey: "navShort.chat" },
  { to: "/rights", icon: BookOpenText, key: "nav.rights", shortKey: "navShort.rights" },
  { to: "/schemes", icon: Landmark, key: "nav.schemes", shortKey: "navShort.schemes" },
  { to: "/drafter", icon: FileEdit, key: "nav.drafter", shortKey: "navShort.drafter" },
  { to: "/legal-aid", icon: HeartHandshake, key: "nav.legalAid", shortKey: "navShort.legalAid" },
  { to: "/history", icon: History, key: "nav.history", shortKey: "navShort.history" },
  { to: "/profile", icon: UserRound, key: "nav.profile" },
  { to: "/admin", icon: ShieldCheck, key: "nav.admin", adminOnly: true },
];
