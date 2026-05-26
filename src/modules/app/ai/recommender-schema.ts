/** Local schema for recommendation preference UI (RAG chatbot has no /schema endpoint). */
export const RECOMMENDER_INPUT_SCHEMA = {
  engine: "plant-rag-chatbot",
  fields: {
    city: { type: "string", required: true, example: "Karachi" },
    light_pref: { type: "enum", required: true, values: ["low", "medium", "high"] },
    water_pref: { type: "enum", required: false, values: ["low", "medium", "high"] },
    pet_friendly: { type: "boolean", required: true },
    space: { type: "enum", required: true, values: ["small", "medium", "large"] },
    top_n: { type: "integer", required: false, min: 1, max: 20, default: 3 },
  },
  upstream: {
    base_url: "https://plant-rag-chatbot-en.onrender.com",
    chat_path: "/chat",
  },
} as const;
