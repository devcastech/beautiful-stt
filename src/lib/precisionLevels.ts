export const PRECISION_LEVELS = [
  { beamSize: 1, label: "Básico", description: "Lo más rápido, para audios claros" },
  { beamSize: 2, label: "Estándar", description: "Buen resultado en la mayoría de audios" },
  { beamSize: 5, label: "Alto", description: "Menos errores en audios difíciles" },
  { beamSize: 8, label: "Máximo", description: "Máxima precisión, más lento" },
];

export const precisionLevel = (beamSize: number) =>
  PRECISION_LEVELS.reduce((match, level) =>
    level.beamSize <= beamSize ? level : match,
  );
