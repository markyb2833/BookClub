/**
 * Curated genre mapping.
 * Keys are normalised Open Library subject strings (lowercase).
 * Values are the clean genre name we display.
 *
 * Any OL subject not matched here is discarded.
 */
export const GENRE_MAP: Record<string, string> = {
  // Fiction broad
  "fiction": "Fiction",
  "fiction, general": "Fiction",
  "literary fiction": "Literary Fiction",
  "literary collections": "Literary Fiction",
  "classic literature": "Classics",
  "classical literature": "Classics",

  // Genre fiction
  "fantasy": "Fantasy",
  "fantasy fiction": "Fantasy",
  "fiction, fantasy, general": "Fantasy",
  "fiction, fantasy, epic": "Fantasy",
  "magic": "Fantasy",
  "epic fantasy": "Fantasy",
  "high fantasy": "Fantasy",
  "science fiction": "Science Fiction",
  "fiction, science fiction, general": "Science Fiction",
  "science fiction, general": "Science Fiction",
  "space opera": "Science Fiction",
  "dystopian fiction": "Dystopian",
  "dystopia": "Dystopian",
  "horror": "Horror",
  "horror fiction": "Horror",
  "ghost stories": "Horror",
  "thriller": "Thriller",
  "thrillers": "Thriller",
  "suspense": "Thriller",
  "mystery": "Mystery",
  "mystery fiction": "Mystery",
  "detective fiction": "Mystery",
  "crime": "Crime",
  "crime fiction": "Crime",
  "romance": "Romance",
  "romance fiction": "Romance",
  "fiction, romance, general": "Romance",
  "love stories": "Romance",
  "historical fiction": "Historical Fiction",
  "fiction, historical, general": "Historical Fiction",
  "fiction, historical": "Historical Fiction",
  "adventure": "Adventure",
  "adventure fiction": "Adventure",
  "action & adventure": "Adventure",

  // Non-fiction
  "biography": "Biography",
  "biography & autobiography": "Biography",
  "autobiography": "Biography",
  "memoir": "Memoir",
  "history": "History",
  "world history": "History",
  "philosophy": "Philosophy",
  "psychology": "Psychology",
  "self-help": "Self-Help",
  "personal growth": "Self-Help",
  "motivational": "Self-Help",
  "science": "Science",
  "popular science": "Science",
  "technology": "Technology",
  "computers": "Technology",
  "business": "Business",
  "economics": "Business",
  "politics": "Politics",
  "political science": "Politics",
  "travel": "Travel",
  "cooking": "Food & Drink",
  "food": "Food & Drink",
  "health": "Health",
  "health & fitness": "Health",
  "art": "Art",
  "music": "Music",
  "true crime": "True Crime",
  "religion": "Religion & Spirituality",
  "spirituality": "Religion & Spirituality",
  "nature": "Nature",
  "environment": "Nature",

  // Children's / YA
  "children's fiction": "Children's",
  "children's literature": "Children's",
  "juvenile fiction": "Children's",
  "juvenile literature": "Children's",
  "young adult fiction": "Young Adult",
  "young adult literature": "Young Adult",
  "ya fiction": "Young Adult",

  // Poetry / Drama
  "poetry": "Poetry",
  "drama": "Drama",
  "plays": "Drama",

  // Graphic
  "comics & graphic novels": "Comics & Graphic Novels",
  "graphic novels": "Comics & Graphic Novels",
};

/**
 * Given a list of raw OL subjects, return a deduplicated list
 * of clean genre names (max 5).
 */
export function mapSubjectsToGenres(subjects: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const subject of subjects) {
    const key = subject.toLowerCase().trim();
    const genre = GENRE_MAP[key];
    if (genre && !seen.has(genre)) {
      seen.add(genre);
      result.push(genre);
    }
    if (result.length >= 5) break;
  }

  return result;
}

export function genreSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
