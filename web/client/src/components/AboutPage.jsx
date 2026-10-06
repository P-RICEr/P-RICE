import { Sprout, Target, Users, GraduationCap } from "lucide-react";

const SDGS = [
  {
    n: 2,
    title: "Zero Hunger",
    text:
      "Better price monitoring and forecasting supports food security and helps keep staple rice affordable.",
  },
  {
    n: 3,
    title: "Good Health and Well-Being",
    text:
      "Helping keep rice prices stable indirectly protects household nutrition and public health.",
  },
  {
    n: 8,
    title: "Decent Work and Economic Growth",
    text:
      "Forward-looking price estimates help retailers, distributors, and farmers manage risk and inventory.",
  },
  {
    n: 9,
    title: "Industry, Innovation and Infrastructure",
    text:
      "Applies machine learning to strengthen digital agricultural monitoring infrastructure in the Philippines.",
  },
];

const BENEFICIARIES = [
  "Rice wholesalers, distributors, and retailers",
  "Government agencies (e.g. DA Bantay Presyo, Ricelytics)",
  "Filipino households and consumers",
  "Farmers",
  "Future researchers and the field of Computer Science / Data Analytics",
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rice-800 text-white">
          <Sprout className="h-7 w-7" />
        </span>
        <h1 className="text-2xl font-extrabold text-rice-900 dark:text-white">P-RICE</h1>
        <p className="mt-1 text-sm text-rice-700 dark:text-rice-300">
          An XGBoost Regression Based Model for Philippine Rice Price Forecasting
        </p>
      </div>

      <div className="rounded-2xl border border-rice-100 bg-white p-6 text-sm leading-relaxed text-rice-900/90 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-rice-100/90">
        <p>
          Rice is a basic commodity and a staple of Filipino cuisine, and keeping it affordable
          is essential to the nutrition and well-being of Filipinos. But rice prices in the
          Philippines are highly volatile and difficult to predict, making it hard for retailers,
          distributors, and households to plan ahead. <strong>P-RICE</strong> is an XGBoost
          regression model that forecasts Philippine retail rice prices, months ahead, using
          historical price data together with agricultural, macroeconomic, and weather-related
          indicators (Brent crude oil, farmgate price, inflation, rice stocks, exchange rate,
          temperature, rainfall, and volume of production).
          This dashboard shows those forecasts, benchmarked against ARIMA and a naive baseline,
          alongside the factors driving each prediction.
        </p>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-rice-700 dark:text-rice-300">
          <Target className="h-4 w-4" />
          Supports these Sustainable Development Goals
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {SDGS.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border border-rice-100 bg-white p-4 dark:border-white/10 dark:bg-white/5"
            >
              <p className="text-xs font-bold text-rice-600 dark:text-rice-300">SDG {s.n}</p>
              <p className="text-sm font-semibold text-rice-900 dark:text-white">{s.title}</p>
              <p className="mt-1 text-xs text-rice-900/70 dark:text-rice-100/70">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-rice-700 dark:text-rice-300">
          <Users className="h-4 w-4" />
          Who this helps
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {BENEFICIARIES.map((b) => (
            <li
              key={b}
              className="rounded-lg border border-rice-100 bg-white px-3 py-2 text-sm text-rice-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              {b}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-rice-100 bg-rice-50 p-4 text-xs text-rice-900/80 dark:border-white/10 dark:bg-white/5 dark:text-rice-100/80">
        <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-rice-700 dark:text-rice-300" />
        <p>
          See <strong>Chapter 1 (Introduction)</strong> of the P-RICE research paper for the full
          context, research questions, objectives, significance, and scope/limitations behind
          this dashboard.
        </p>
      </div>
    </div>
  );
}
