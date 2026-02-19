export const models = [
  {
    name: 'ggml-tiny.bin',
    label: 'Tiny',
    description: 'Extra rápido · menos preciso · 77.7MB',
  },
  {
    name: 'ggml-small.bin',
    label: 'Small',
    description: 'Rápido · preciso · 488MB (recomendado)',
    default: true,
  },
  {
    name: 'ggml-medium-q8_0.bin',
    label: 'Medium',
    description: 'Moderado · preciso · 823MB',
  },
  {
    name: 'ggml-large-v3-turbo.bin',
    label: 'Large Turbo',
    description: 'Moderado · más preciso · 1.62GB',
  },
  {
    name: 'ggml-large-v3.bin',
    label: 'Large v3',
    description: 'Lento · ultra preciso · 3.1GB',
  },
];

export const llmModels = [
  {
    name: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    label: 'Llama 3.2 3B (Q4) - 2.02GB',
    description: 'Ultra veloz. Ideal para hardware limitado y lógica muy básica.',
    default: true,
  },
  {
    name: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    label: 'Phi-3.5 Mini (Q4) - 2.39GB',
    description: 'Compacto. Buen razonamiento para tareas de texto simples.',
  },
  {
    name: 'Llama-3.2-3B-Instruct-Q6_K_L.gguf',
    label: 'Llama 3.2 3B (Q6) - 2.74GB',
    description: 'Equilibrado en 3B. Más estable que Q4 sin perder velocidad.',
  },
  {
    name: 'Llama-3.2-3B-Instruct-Q8_0.gguf',
    label: 'Llama 3.2 3B (Q8) - 3.42GB',
    description: 'Máxima precisión 3B. Reduce alucinaciones en modelos pequeños.',
  },
  {
    name: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    label: 'Llama 3.1 8B (Q4) - 4.92GB',
    description: 'Ganador. Gran lógica, entiende negaciones y limpia bien el audio.',
  },
  {
    name: 'Qwen2.5-14B-Instruct-IQ2_M.gguf',
    label: 'Qwen2.5-14B (Q2) - 5.36GB',
    description: 'Máxima precisión en. Ideal para tareas complejas.',
  },
  
  {
    name: 'gemma-2-9b-it-Q4_K_L.gguf',
    label: 'Gemma 2 9b (Q4) - 5.98GB',
    description: 'Data specialist. El mejor extrayendo cifras y datos exactos.',
  },
  {
    name: 'Ministral-8B-Instruct-2410-Q4_K_S.gguf',
    label: 'Ministral 8B (Q4) - 4.77GB',
    description: 'Mistral 8B compacto. Alta calidad de instrucción en tamaño eficiente.',
  },
  {
    name: 'phi-4-Q4_0.gguf',
    label: 'Phi-4 (Q4) - 8.38GB',
    description: 'Elite. Razonamiento profesional y corrección fonética superior.',
  },
];
