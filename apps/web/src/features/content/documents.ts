import aboutUs from '../../content/pages/about-us.md?raw';
import accessibility from '../../content/pages/accessibility.md?raw';
import cookiePolicy from '../../content/pages/cookie-policy.md?raw';
import disclaimer from '../../content/pages/disclaimer.md?raw';
import howItWorks from '../../content/pages/how-it-works.md?raw';
import privacyPolicy from '../../content/pages/privacy-policy.md?raw';
import termsOfUse from '../../content/pages/terms-of-use.md?raw';

/**
 * Site content pages. Each page's text lives in its own Markdown file under `src/content/pages/` so it can be edited
 * (or reviewed by legal) without touching code; the file's `#` heading is the page title.
 */
export const documents = {
  about: aboutUs,
  howItWorks,
  privacy: privacyPolicy,
  terms: termsOfUse,
  disclaimer,
  cookies: cookiePolicy,
  accessibility,
} as const;

export type DocumentId = keyof typeof documents;
