"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { FinSightLogo } from "@/components/brand/FinSightLogo";

interface LandingNavbarProps {
  onOpenUpload: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({ onOpenUpload }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#fbfbfa]/90 backdrop-blur-md border-b border-[#ecece8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
          <FinSightLogo variant="full" height={34} className="h-7 sm:h-8.5 w-auto" />
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#4a5550]">
          <a href="#features" className="hover:text-[#11241c] transition-colors">
            Product
          </a>
          <a href="#how-it-works" className="hover:text-[#11241c] transition-colors">
            How it Works
          </a>
          <a href="#privacy" className="hover:text-[#11241c] transition-colors">
            Privacy
          </a>
          <a href="#faq" className="hover:text-[#11241c] transition-colors">
            FAQ
          </a>
        </nav>

        {/* Right CTA */}
        <div className="hidden sm:flex items-center gap-5">
          <Link
            href="/login"
            className="text-sm font-semibold text-[#324039] hover:text-[#11241c] transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-[#324039] hover:text-[#11241c] transition-colors"
          >
            Live Demo
          </Link>
          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#11241c] text-white text-xs font-semibold hover:bg-[#1c382c] shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <span>Get Started Free</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenUpload}
            className="px-3 py-1.5 rounded-full bg-[#11241c] text-white text-[11px] sm:text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            Get Started
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 -mr-1 text-[#324039] rounded-lg hover:bg-slate-100 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#ecece8] bg-[#fbfbfa] px-4 py-5 space-y-3.5 text-sm font-medium text-[#4a5550] animate-in slide-in-from-top-2 duration-150">
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-1 hover:text-[#11241c]"
          >
            Product
          </a>
          <a
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-1 hover:text-[#11241c]"
          >
            How it Works
          </a>
          <a
            href="#privacy"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-1 hover:text-[#11241c]"
          >
            Privacy
          </a>
          <a
            href="#faq"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-1 hover:text-[#11241c]"
          >
            FAQ
          </a>
          <div className="pt-3 border-t border-[#ecece8] flex flex-col gap-2">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 rounded-xl bg-white border border-[#e2e2dd] font-semibold text-xs text-[#11241c]"
            >
              Launch Live Demo
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
