import React from 'react';
import { Snowflake, ShieldAlert, Cpu } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white flex items-center justify-center shadow-xs shrink-0">
              <Snowflake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  F-Gaz Erken Kaçak Tespit Sistemi
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Cpu className="w-3 h-3 text-emerald-600" />
                  TypeScript Autoencoder Çıkarımı
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed">
                Mevcut soğutma telemetrisi üzerinden ek gaz kaçağı sensörüne gerek kalmadan soğutucu akışkan mikro-kaçaklarını erken aşamada tespit eden anomali analiz paneli.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold shadow-2xs">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Sentetik Veri ile Çalışan Araştırma Prototipi</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
