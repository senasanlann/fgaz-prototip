import React from 'react';
import { BookOpen, HelpCircle, AlertOctagon, CheckCircle2, Sliders, ShieldAlert } from 'lucide-react';

export const ScientificTransparency: React.FC = () => {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <BookOpen className="w-5 h-5 text-blue-600" />
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          Bilimsel Şeffaflık, Model Mekanizması ve Sınırlar
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pillar 1: Autoencoder Nasıl Çalışır? */}
        <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h3>1. Autoencoder Anomali Modeli Nasıl Çalışır?</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Model, yapay zeka sınıflandırıcısı yerine bir <strong>Autoencoder (10 &rarr; 16 &rarr; 4 &rarr; 16 &rarr; 10 MLPRegressor)</strong> kullanır. Model yalnızca <strong>tamamen sağlıklı</strong> dolabın telemetrisiyle eğitilir ve normal soğutma döngüsünün çok değişkenli korelasyonlarını öğrenir.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Gaz eksildiğinde sistem durumu normal uzayın dışına çıkar ve rekonstrüksiyon hatası artar. Model, fiziksel olarak kaçağa işaret eden yönlü hataları (<code className="font-mono text-slate-800 bg-slate-200 px-1 rounded">LEAK_SIGN</code>) filtreler; ters yönlü sapmaları yanlış alarm üretmemesi için eler.
          </p>
        </div>

        {/* Pillar 2: Neden Ek Gaz Sensörüne İhtiyaç Yoktur? */}
        <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <h3>2. Neden Özel Bir Gaz Kaçağı Sensörü Gerekmez?</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Soğutma çevriminde soğutucu akışkan azaldığında (undercharge), evaporatör beslemesi bozulur. Termostat kabini 3–5 °C arasında tutmaya devam edebilse bile termodinamik imza hemen değişir:
          </p>
          <ul className="text-xs text-slate-600 space-y-1 pl-3 border-l-2 border-blue-400">
            <li><strong>Emme basıncı düşer</strong> (ΔT_evap = 15 · d^1.3 K)</li>
            <li><strong>Kızgınlık (superheat) belirgin şekilde artar</strong> (ΔSH = 60 · d^1.5 K)</li>
            <li><strong>Kompresör çalışma süresi (duty cycle) artar</strong> (η_cap = 1 - 3 · d²)</li>
          </ul>
          <p className="text-xs text-slate-600 leading-relaxed">
            Model bu çoklu termodinamik sapmayı gazın henüz %4–10'u kaçmışken yakalar.
          </p>
        </div>

        {/* Pillar 3: Hangi Kontrol Cihazı Ölçümleri Gereklidir? */}
        <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3>3. Mevcut Kontrol Cihazından Hangi Ölçümler Alınır?</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Market soğutma kontrol cihazlarının (Danfoss, Carel, Dixell vb.) standart olarak kaydettiği 6 temel telemetri ve 4 bağlam değişkeni kullanılır:
          </p>
          <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
            <span>• Emme Basıncı (bar)</span>
            <span>• Dış Ortam Sıcaklığı (°C)</span>
            <span>• Kızgınlık Sıcaklığı (K)</span>
            <span>• Saat Sinüs / Kosinüs</span>
            <span>• Kompresör Açık/Kapalı (%)</span>
            <span>• Hafta Sonu Göstergesi</span>
            <span>• Kabin Ort./Maks. Sıcaklık</span>
            <span>• Tüketilen Enerji (kWh)</span>
          </div>
        </div>

        {/* Pillar 4: Sentetik Veri ve Saha Sınırları */}
        <div className="bg-amber-50/70 p-4 sm:p-5 rounded-xl border border-amber-200 space-y-2.5">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <h3>4. Sentetik Veri, Saha Geçerlemesi ve Teşhis Sınırları</h3>
          </div>
          <p className="text-xs text-amber-950 leading-relaxed">
            Bu prototip <strong>üretim-hazır (production-ready) bir sistem değildir</strong>; basitleştirilmiş fiziksel simülatör (<code className="font-mono bg-amber-100 px-1 rounded">simulator.py</code>) üzerinde eğitilmiş ve test edilmiştir.
          </p>
          <ul className="text-xs text-amber-900 space-y-1.5 pl-3 border-l-2 border-amber-400">
            <li>
              <strong>Sahada denenmemiştir:</strong> Gerçek market ortamındaki sensör arızaları, kirlenmiş kondenserler, fan arızaları veya bakım müdahaleleri farklı anomali dinamikleri yaratabilir.
            </li>
            <li>
              <strong>Kesin kaçak onayı değildir:</strong> Modelin "kırmızı alarm" vermesi kesin bir gaz kaçağını garanti etmez; yalnızca soğutma çevriminde normal dışı bir sapma olduğunu gösterir ve teknisyenin sahada kaçak testi (köpük veya halojen dedektörü) yapması için erken uyarı sağlar.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
};
