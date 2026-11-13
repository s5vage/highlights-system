export interface BookRow {
  id: string;
  file_path: string | null;
  cover_path: string | null;
  storage: string | null;
}

// Which files belong to this person's books. Each one is worked out from the book's own id and the
// person's id, never from a path someone typed in, so deleting an account can't touch anyone else's files.
export function accountFiles(uid: string, books: BookRow[]): { b2: string[]; supabase: string[] } {
  const b2: string[] = [];
  const supabase: string[] = [];
  for (const b of books) {
    const id = b.id.toLowerCase();
    const mine = `${uid}/${id}.pdf`;
    const legacy = `${id}.pdf`;
    const pdf = b.file_path === mine ? mine : b.file_path === legacy ? legacy : null;
    if (pdf) (b.storage === 'r2' ? b2 : supabase).push(pdf);

    const coverMine = `${uid}/covers/${id}.jpg`;
    const coverLegacy = `covers/${id}.jpg`;
    const cover = b.cover_path === coverMine ? coverMine : b.cover_path === coverLegacy ? coverLegacy : null;
    if (cover) supabase.push(cover);
  }
  return { b2, supabase };
}