import { meili } from "./meilisearch";

/**
 * Function words that flood descriptions; omitted pronouns / "it" so titles like *It* or *Back to You* stay strong.
 * Titles still rank first via `searchableAttributes` order.
 */
const EN_STOP_WORDS = [
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "if",
  "in",
  "into",
  "is",
  "may",
  "might",
  "must",
  "nor",
  "not",
  "of",
  "on",
  "or",
  "shall",
  "should",
  "so",
  "such",
  "than",
  "that",
  "the",
  "then",
  "there",
  "these",
  "this",
  "those",
  "through",
  "to",
  "too",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "whose",
  "why",
  "will",
  "with",
  "would",
];

let initialised = false;

export async function setupBooksIndex() {
  if (initialised) return meili.index("works");

  // Create index if it doesn't exist, wait for the task to complete
  try {
    const task = await meili.createIndex("works", { primaryKey: "id" });
    await meili.tasks.waitForTask(task.taskUid);
  } catch {
    // Index already exists — that's fine
  }

  const index = meili.index("works");

  const task = await index.updateSettings({
    searchableAttributes: ["title", "subtitle", "authors", "series", "description"],
    filterableAttributes: ["genres", "series_slugs", "author_ids", "first_published", "average_rating"],
    sortableAttributes: ["average_rating", "first_published", "ratings_count"],
    displayedAttributes: [
      "id", "title", "subtitle", "authors", "author_ids", "genres", "series", "series_slugs",
      "description", "first_published", "average_rating",
      "ratings_count", "cover_url",
    ],
    typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 5, twoTypos: 9 } },
    stopWords: EN_STOP_WORDS,
    pagination: { maxTotalHits: 10000 },
  });

  await meili.tasks.waitForTask(task.taskUid);

  initialised = true;
  return index;
}
