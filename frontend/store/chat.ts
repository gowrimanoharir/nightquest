// Minimal UI store for chat visibility.
// Chat messages are local state inside ChatSheet — not here.
import { create } from 'zustand';

interface ChatUIStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useChatUIStore = create<ChatUIStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
