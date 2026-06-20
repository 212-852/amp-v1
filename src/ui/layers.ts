export const ui_layer = {
  content: 0,
  chat_composer: 50,
  footer: 50,
  header: 60,
  dropdown: 70,
  overlay: 1000,
  modal: 1010,
} as const

export const ui_layer_class = {
  chat_composer: "z-[50]",
  footer: "z-[50]",
  header: "z-[60]",
  dropdown: "z-[70]",
  overlay: "z-[1000]",
  modal: "z-[1010]",
} as const
