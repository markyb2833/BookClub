import { meili } from "./meilisearch";

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
    searchableAttributes: ["title", "subtitle", "authors", "description"],
    filterableAttributes: ["genres", "first_published", "average_rating"],
    sortableAttributes: ["average_rating", "first_published", "ratings_count"],
    displayedAttributes: [
      "id", "title", "subtitle", "authors", "genres",
      "description", "first_published", "average_rating",
      "ratings_count", "cover_url",
    ],
    typoTolerance: { enabled: true },
    pagination: { maxTotalHits: 10000 },
  });

  await meili.tasks.waitForTask(task.taskUid);

  initialised = true;
  return index;
}
