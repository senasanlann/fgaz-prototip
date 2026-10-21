import React, { useState, useMemo, useTransition } from 'react';
import { Header } from './components/Header';
import { ScenarioSelector } from './components/ScenarioSelector';
import { InteractiveTimeline } from './components/InteractiveTimeline';
import { AiDetectionPanel } from './components/AiDetectionPanel';
import { InteractiveCharts } from './components/InteractiveCharts';
import { ComparisonSection } from './components/ComparisonSection';
import { EnvironmentalImpactCalculator } from './components/EnvironmentalImpactCalculator';
import { ScientificTransparency } from './components/ScientificTransparency';
import { ScenarioKey, getScenarioInference } from './data/scenarios';
import { EnvironmentalAssumptions, DEFAULT_ASSUMPTIONS } from './utils/impact';

export const App: React.FC = () => {
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>('leak_20');
  const [isPending, startTransition] = useTransition();

  // Run the validated TypeScript Autoencoder inference engine on the selected scenario
  const scenarioData = useMemo(() => {
    return getScenarioInference(scenarioKey);
  }, [scenarioKey]);

  // Selected simulation day (default to latest day of the scenario)
  const [selectedDay, setSelectedDay] = useState<number>(scenarioData.definition.days - 1);

  // Environmental impact assumptions
  const [assumptions, setAssumptions] = useState<EnvironmentalAssumptions>({ ...DEFAULT_ASSUMPTIONS });

  // Handle scenario switch
  const handleScenarioChange = (newKey: ScenarioKey) => {
    startTransition(() => {
      setScenarioKey(newKey);
      const newScData = getScenarioInference(newKey);
      setSelectedDay(newScData.definition.days - 1);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 selection:bg-blue-100 selection:text-blue-900">
      {/* 1. Header with exact title and prominent prototype label */}
      <Header />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-6">
        {/* 2. Scenario selector */}
        <ScenarioSelector
          currentScenarioKey={scenarioKey}
          onScenarioChange={handleScenarioChange}
          isInferring={isPending}
        />

        {/* 3. Interactive timeline with day slider and play/pause */}
        <InteractiveTimeline
          scenarioData={scenarioData}
          selectedDay={selectedDay}
          onDayChange={setSelectedDay}
        />

        {/* 4. AI detection panel with status, score, threshold, streak & top 2 features */}
        <AiDetectionPanel
          scenarioData={scenarioData}
          selectedDay={selectedDay}
        />

        {/* 5. 4 Interactive charts strictly obeying timeline causality */}
        <InteractiveCharts
          scenarioData={scenarioData}
          selectedDay={selectedDay}
        />

        {/* 6. AI vs conventional alarm comparison */}
        <ComparisonSection scenarioData={scenarioData} />

        {/* 7. Environmental & financial impact calculator */}
        <EnvironmentalImpactCalculator
          scenarioData={scenarioData}
          assumptions={assumptions}
          onAssumptionsChange={setAssumptions}
        />

        {/* 8. Scientific transparency and limitations */}
        <ScientificTransparency />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-10 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="font-semibold text-slate-700">
            Climathon F-Gaz Erken Kaçak Tespiti Araştırma Prototipi
          </p>
          <p className="text-slate-500">
            Orijinal scikit-learn Autoencoder modeli, TypeScript çıkarım motoru üzerinden doğrudan çalıştırılmaktadır.
          </p>
          <p className="text-[11px] text-slate-400">
            Bu uygulama araştırma ve konsept kanıtlama (PoC) amaçlıdır; sahada ticari veya endüstriyel karar verme amacıyla tek başına kullanılamaz.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
