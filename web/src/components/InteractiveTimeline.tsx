import React, { useEffect, useState } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, RotateCcw, Calendar, Gauge } from 'lucide-react';
import { ProcessedScenarioData } from '../data/scenarios';

interface InteractiveTimelineProps {
  scenarioData: ProcessedScenarioData;
  selectedDay: number;
  onDayChange: (day: number) => void;
}

export const InteractiveTimeline: React.FC<InteractiveTimelineProps> = ({
  scenarioData,
  selectedDay,
  onDayChange,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);

  const minDay = 3;
  const maxDay = scenarioData.definition.days - 1;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isPlaying) {
      const intervalMs = Math.max(120, 450 / speed);
      timer = setInterval(() => {
        onDayChange(selectedDay >= maxDay ? minDay : selectedDay + 1);
      }, intervalMs);
    }
    return () => clearInterval(timer);
  }, [isPlaying, selectedDay, maxDay, speed, onDayChange]);

  const handleStepPrev = () => {
    setIsPlaying(false);
    onDayChange(Math.max(minDay, selectedDay - 1));
  };

  const handleStepNext = () => {
    setIsPlaying(false);
    onDayChange(Math.min(maxDay, selectedDay + 1));
  };

  const handleReset = () => {
    setIsPlaying(false);
    onDayChange(minDay);
  };

  const currentPoint = scenarioData.telemetryDaily[selectedDay];
  const currentDate = currentPoint?.date || '';

  // Milestones that can be jumped to
  const leakStartDay = scenarioData.definition.leak_start_day;
  const aiDetectionDay = scenarioData.aiDetectionDay;
  const conventionalDay = scenarioData.conventionalAlarmDay;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            Simülasyon Zamanı:{' '}
            <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Gün {selectedDay}
            </span>{' '}
            <span className="text-xs text-slate-500 font-normal">/ {maxDay} gün</span>
          </h3>
          <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
            {currentDate}
          </span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleReset}
            title="Başa dön (Gün 3)"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleStepPrev}
            disabled={selectedDay <= minDay}
            title="1 gün geri"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Durdur' : 'Canlı Oynat'}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors shadow-2xs ${
              isPlaying
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? 'Durdur' : 'Canlı Oynat'}</span>
          </button>
          <button
            type="button"
            onClick={handleStepNext}
            disabled={selectedDay >= maxDay}
            title="1 gün ileri"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-200">
            <Gauge className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="text-xs bg-slate-50 border border-slate-200 rounded-md px-1.5 py-1 text-slate-700 focus:outline-none"
            >
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main slider */}
      <div className="relative pt-1 pb-1">
        <input
          type="range"
          min={minDay}
          max={maxDay}
          value={selectedDay}
          onChange={(e) => {
            setIsPlaying(false);
            onDayChange(Number(e.target.value));
          }}
          className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />

        {/* Milestone bookmark jump buttons */}
        <div className="flex justify-between items-center text-[11px] text-slate-500 mt-2 font-mono">
          <button
            type="button"
            onClick={() => onDayChange(minDay)}
            className="hover:text-blue-600 transition-colors"
          >
            Gün {minDay}
          </button>

          {leakStartDay && (
            <button
              type="button"
              onClick={() => onDayChange(leakStartDay)}
              className={`hover:text-slate-800 transition-colors flex items-center gap-1 ${
                selectedDay >= leakStartDay ? 'text-slate-700 font-bold' : 'text-slate-400'
              }`}
            >
              <span>📍 Kaçak (G{leakStartDay})</span>
            </button>
          )}

          {aiDetectionDay && (
            <button
              type="button"
              onClick={() => onDayChange(aiDetectionDay)}
              className={`hover:text-rose-600 transition-colors flex items-center gap-1 ${
                selectedDay >= aiDetectionDay ? 'text-rose-600 font-bold' : 'text-slate-400'
              }`}
            >
              <span>🚨 AI Tespiti (G{aiDetectionDay})</span>
            </button>
          )}

          {conventionalDay && (
            <button
              type="button"
              onClick={() => onDayChange(conventionalDay)}
              className={`hover:text-blue-600 transition-colors flex items-center gap-1 ${
                selectedDay >= conventionalDay ? 'text-blue-600 font-bold' : 'text-slate-400'
              }`}
            >
              <span>🔔 Klasik Alarm (G{conventionalDay})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onDayChange(maxDay)}
            className="hover:text-blue-600 transition-colors"
          >
            Gün {maxDay}
          </button>
        </div>
      </div>
    </div>
  );
};
