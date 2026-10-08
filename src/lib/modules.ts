import { Highlighter, NotebookPen, Shapes, Network, SlidersHorizontal, Trash2 } from 'lucide-react';
import { ModuleDef } from './types';

export const MODULES: ModuleDef[] = [
  {
    id: 'highlights',
    label: 'Highlights',
    icon: Highlighter,
    description: 'Everything you have clipped from the web, tagged and searchable',
    hue: 'yellow',
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: NotebookPen,
    description: 'Write, organize, and link your own notes',
    hue: 'blue',
  },
  {
    id: 'canvas',
    label: 'Canvas',
    icon: Shapes,
    description: 'An infinite whiteboard for sketches and layouts',
    hue: 'pink',
  },
  {
    id: 'graph',
    label: 'Graph',
    icon: Network,
    description: 'See how your notes connect to each other',
    hue: 'green',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SlidersHorizontal,
    description: 'Theme, account, and connected devices',
    hue: 'gray',
  },
  {
    id: 'trash',
    label: 'Trash',
    icon: Trash2,
    description: 'Recently deleted items you can still recover',
    hue: 'red',
  },
];