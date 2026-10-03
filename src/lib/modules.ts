import { ModuleDef } from './types';

export const MODULES: ModuleDef[] = [
  {
    id: 'highlights',
    label: 'Highlights',
    icon: '✦',
    description: 'Clipped text, color-coded and tagged',
    accent: 'bg-yellow-500',
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: '📝',
    description: 'Rich-text notes and journal entries',
    accent: 'bg-blue-500',
  },
  {
    id: 'canvas',
    label: 'Canvas',
    icon: '🖼️',
    description: 'Infinite whiteboard for sketches and layout',
    accent: 'bg-pink-500',
  },
  {
    id: 'graph',
    label: 'Graph',
    icon: '🕸️',
    description: 'How your notes and highlights connect',
    accent: 'bg-green-500',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: '⚙️',
    description: 'Account, theme, connected devices',
    accent: 'bg-gray-500',
  },
  {
    id: 'trash',
    label: 'Trash',
    icon: '🗑️',
    description: 'Recently deleted items',
    accent: 'bg-red-500',
  },
];
