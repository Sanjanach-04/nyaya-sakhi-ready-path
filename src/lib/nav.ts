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
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, key: "nav.dashboard" },
  { to: "/chat", icon: MessageCircleHeart, key: "nav.chat" },
  { to: "/rights", icon: BookOpenText, key: "nav.rights" },
  { to: "/schemes", icon: Landmark, key: "nav.schemes" },
  { to: "/drafter", icon: FileEdit, key: "nav.drafter" },
  { to: "/legal-aid", icon: HeartHandshake, key: "nav.legalAid" },
  { to: "/history", icon: History, key: "nav.history" },
  { to: "/profile", icon: UserRound, key: "nav.profile" },
  { to: "/admin", icon: ShieldCheck, key: "nav.admin", adminOnly: true },
];
