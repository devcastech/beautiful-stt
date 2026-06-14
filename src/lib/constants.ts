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
    name: 'Qwen_Qwen3.5-4B-Q4_K_S.gguf',
    label: 'Qwen3.5 4B (Q4)- 2.85GB',
    description: 'Velocidad y precisión moderadas',
  },
  {
    name: 'Qwen_Qwen3.5-4B-Q6_K.gguf',
    label: 'Qwen3.5 4B (Q6)- 3.81GB',
    description: 'Perfecto balance entre velocidad y precisión',
  },
  //https://huggingface.co/bartowski/Qwen_Qwen3.5-4B-GGUF/resolve/main/Qwen_Qwen3.5-4B-Q8_0.gguf?download=true
  {
    name: 'Qwen_Qwen3.5-4B-Q8_0.gguf',
    label: 'Qwen3.5 4B (Q8)- 4.62GB',
    description: 'Máximo precisión - más lento',
  },
];
