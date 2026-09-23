"use client";

import React from "react";
import { Shield, PieChart, Repeat, Bell } from "lucide-react";

export const LearnView: React.FC = () => {
  const guides = [
    {
      icon: Shield,
      color: "bg-emerald-50 text-emerald-700",
      title: "How FinSight Protects Your Privacy",
      summary:
        "Unlike traditional wealth apps, FinSight never asks for your broker passwords, OTPs, or PAN details. Statements are read in-memory and sensitive details are never saved or shared.",
    },
    {
      icon: PieChart,
      color: "bg-amber-50 text-amber-700",
      title: "Understanding Sector Concentration Risk",
      summary:
        "Putting more than 25-30% of your money into a single sector (such as Financial Services or Tech) leaves you vulnerable if that industry faces regulatory or economic slowdowns. Diversifying protects your returns.",
    },
    {
      icon: Repeat,
      color: "bg-indigo-50 text-indigo-700",
      title: "The Power of Regular SIP Compounding",
      summary:
        "Consistent monthly investing harnesses rupee cost averaging and compounding returns. Over 10 to 20 years, compounding often generates far more wealth than the total cash deposited.",
    },
    {
      icon: Bell,
      color: "bg-sky-50 text-sky-700",
      title: "How Proactive Market Alerts Work",
      summary:
        "FinSight continuously reads major financial headlines, identifies which sectors are impacted (e.g. RBI rate hikes affecting banking), and immediately notifies you if your portfolio has exposure.",
    },
  ];

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs max-w-3xl space-y-6">
      <div className="pb-4 border-b border-slate-100">
        <h3 className="text-base font-bold text-slate-900 tracking-tight">Investor Guides</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Simple, jargon-free explanations of how FinSight analyzes your money
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {guides.map((g, i) => {
          const Icon = g.icon;
          return (
            <div
              key={i}
              className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:bg-slate-50 transition-colors space-y-2.5"
            >
              <div className={`w-9 h-9 rounded-xl ${g.color} flex items-center justify-center`}>
                <Icon className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">{g.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">{g.summary}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
