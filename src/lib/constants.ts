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
    label: 'Llama 3.2 3B (Q4)',
    description: 'Meta · 2.02GB',
    default: true,
  },
  {
    name: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    label: 'Phi-3.5 Mini (Q4)',
    description: 'Microsoft · 2.39GB',
  },
  {
    name: 'Llama-3.2-3B-Instruct-Q6_K_L.gguf',
    label: 'Llama 3.2 3B (Q6)',
    description: 'Meta · 2.74GB',
  },
  {
    name: 'Llama-3.2-3B-Instruct-Q8_0.gguf',
    label: 'Llama 3.2 3B (Q8)',
    description: 'Meta · 3.42GB',
  },
];
