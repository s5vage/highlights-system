import { Note } from '@/lib/types';
import { extractWikiLinkTitles } from '@/modules/notes/helpers';

export interface GraphNode {
  id: string;
  title: string;
  folderId: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export function computeGraphData(notes: Note[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const relevant = notes.filter((n) => !n.is_journal);
  const nodes: GraphNode[] = relevant.map((n) => ({
    id: n.id,
    title: n.title || 'Untitled',
    folderId: n.folder_id,
  }));

  const seen = new Set<string>();
  const edges: GraphEdge[] = [];

  relevant.forEach((n) => {
    const titles = extractWikiLinkTitles(n.content);
    titles.forEach((t) => {
      const match = relevant.find((m) => m.title.trim().toLowerCase() === t.trim().toLowerCase());
      if (match && match.id !== n.id) {
        const key = `${n.id}->${match.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push({ source: n.id, target: match.id });
        }
      }
    });
  });

  return { nodes, edges };
}

export function graphSignature(nodes: GraphNode[], edges: GraphEdge[]): string {
  return (
    nodes.map((n) => `${n.id}:${n.title}`).join(',') +
    '|' +
    edges.map((e) => `${e.source}>${e.target}`).join(',')
  );
}