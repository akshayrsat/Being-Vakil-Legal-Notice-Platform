// Words for the page that opens when a screen crashes.
// Production must not tell visitors to run the local practice command.

export const PRODUCTION_PAGE_ERROR =
  "Refresh the browser. If this keeps happening, wait a moment and try again.";

export const DEVELOPMENT_PAGE_ERROR =
  "Refresh the browser. If it keeps happening, go back to the terminal window, stop the site, and start it again with npm run dev. That recreates the practice database.";

export function pageDidNotOpenCopy(nodeEnv: string | undefined = process.env.NODE_ENV): string {
  return nodeEnv === "production" ? PRODUCTION_PAGE_ERROR : DEVELOPMENT_PAGE_ERROR;
}
