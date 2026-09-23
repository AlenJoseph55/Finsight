"use client";

import React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  PieChart,
  Lightbulb,
  Repeat,
  Sparkles,
  Bell,
  BookOpen,
  Settings,
  ChevronRight,
} from "lucide-react";
import { FinSightLogo } from "@/components/brand/FinSightLogo";

export type NavTab = "home" | "portfolio" | "insights" | "sips" | "research" | "alerts" | "learn";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unreadAlertsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  unreadAlertsCount,
}) => {
  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: "home", label: "Overview", icon: LayoutDashboard },
    { id: "portfolio", label: "Portfolio", icon: PieChart },
    { id: "sips", label: "SIPs & Cashflow", icon: Repeat },
    { id: "insights", label: "Analysis", icon: Lightbulb },
    { id: "research", label: "Ask AI", icon: Sparkles },
    { id: "alerts", label: "Alerts", icon: Bell, badge: unreadAlertsCount },
    { id: "learn", label: "Learn", icon: BookOpen },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col shrink-0 min-h-screen select-none">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center border-b border-slate-100">
        <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
          <FinSightLogo variant="full" height={30} />
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-emerald-50/80 text-emerald-800 font-semibold shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-emerald-700" : "text-slate-400 group-hover:text-slate-600"
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && item.badge > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Profile & Settings */}
      <div className="p-3 border-t border-slate-100 space-y-2">
        <button
          onClick={() => onSelectTab("learn")}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
        >
          <Settings className="w-4 h-4 text-slate-400" />
          <span>Settings</span>
        </button>

        {/* User Card */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-xs flex items-center justify-center">
              R
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900 leading-none">Rahul</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Free Plan</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </aside>
  );
};
