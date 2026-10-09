import { useMemo } from 'react';

import styles from './ContentPages.module.css';
import { type DocumentId, documents } from './documents';
import { MarkdownDocument, parseMarkdown } from './markdown';

/** A content page rendered from its Markdown file (About Us, How It Works, Privacy Policy, Terms of Use, …). */
function DocumentPage({ id }: Readonly<{ id: DocumentId }>) {
  const blocks = useMemo(() => parseMarkdown(documents[id]), [id]);
  const titleId = `document-${id}`;
  return (
    <article className={`${styles.article} ${styles.document}`} aria-labelledby={titleId}>
      <MarkdownDocument
        blocks={blocks}
        titleId={titleId}
        classNames={{
          title: 'page-title',
          h2: styles.h2 ?? '',
          h3: styles.h3 ?? '',
          list: styles.list ?? '',
        }}
      />
    </article>
  );
}

export const AboutPage = () => <DocumentPage id="about" />;
export const HowItWorksPage = () => <DocumentPage id="howItWorks" />;
export const PrivacyPage = () => <DocumentPage id="privacy" />;
export const TermsPage = () => <DocumentPage id="terms" />;
export const DisclaimerPage = () => <DocumentPage id="disclaimer" />;
export const CookiePolicyPage = () => <DocumentPage id="cookies" />;
export const AccessibilityPage = () => <DocumentPage id="accessibility" />;
