import { useEffect } from 'react';

export const SITE_NAME = 'Docsmith';
/** Creator credit shown in the footer. */
export const CREATOR_INSTAGRAM = 'https://www.instagram.com/_gr_tech_circuits/';
/** Change this to your support address before deploying. */
export const CONTACT_EMAIL = 'support@example.com';

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const full = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Free PDF & Image Tools in Your Browser`;
    document.title = full;
    setMeta('description', description);
    setMeta('og:title', full, 'property');
    setMeta('og:description', description, 'property');
  }, [title, description]);
}
