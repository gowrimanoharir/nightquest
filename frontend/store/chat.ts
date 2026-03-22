// Minimal UI store for chat visibility and panel expansion.
// Chat messages are local state inside ChatSheet — not here.
import { create } from 'zustand';

interface ChatUIStore {
  isOpen: boolean;
  panelExpanded: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  togglePanelExpanded: () => void;
}

export const useChatUIStore = create<ChatUIStore>((set) => ({
  isOpen: false,
  panelExpanded: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  togglePanelExpanded: () => set((s) => ({ panelExpanded: !s.panelExpanded })),
}));
