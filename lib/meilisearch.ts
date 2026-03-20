import { MeiliSearch } from "meilisearch";

export const meili = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST ?? "http://localhost:7700",
  apiKey: process.env.MEILISEARCH_API_KEY ?? "localdevmasterkey",
});
