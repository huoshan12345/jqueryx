import type { MatchPattern } from 'builtinx';
import type { RefineUrlsOptions } from '../types/lib.js';

declare global {
  interface JQuery<TElement = HTMLElement> {
    /** Rewrites matching URLs. Image fallback links require an explicit option. */
    refineUrls(
      this: this & JQuery<Element>,
      hosts: MatchPattern[],
      baseUrl: URL,
      options?: RefineUrlsOptions | ((path: string) => string),
    ): this;
  }
}

const regExternalLink = /^(?:https?:|\/\/)/i;

$.fn.refineUrls = function <T extends JQuery<Element>>(
  this: T,
  hosts: MatchPattern[],
  baseUrl: URL,
  options?: RefineUrlsOptions | ((path: string) => string),
) {
  // Preserve the existing path-rewrite callback form.
  const settings = typeof options === 'function' ? { pathRewrite: options } : options ?? {};
  const { pathRewrite, addImageFallbackLinks } = settings;
  const elements = this;

  const images: JQuery<Element>[] = [];
  for (const el of elements) {
    const $el = $(el);

    let attrName: string;
    switch (el.tagName) {
      case 'A':
        attrName = 'href';
        break;
      case 'IMG':
        attrName = 'src';
        images.push($el);
        break;
      default:
        console.styled('unsupported tag: ', { text: el.tagName, color: 'blue' });
        continue;
    }

    const src = $el.attr(attrName)?.trim();

    if (!src)
      continue;

    // Keep ordinary relative links unchanged; accept explicit HTTP(S) and protocol-relative URLs.
    if (regExternalLink.test(src) === false)
      continue;

    let u: URL;
    try {
      u = new URL(src, el.baseURI);
    } catch (e) {
      console.log('invalid url: ', src);
      continue;
    }

    if (u.protocol !== 'http:' && u.protocol !== 'https:')
      continue;

    if (u.host === baseUrl.host) // 本站链接
      continue;

    if (hosts.matchesAny(u.host) === false)
      continue;

    if (pathRewrite) {
      u.pathname = pathRewrite(u.pathname);
    }

    // 同站链接
    u.protocol = baseUrl.protocol;
    u.hostname = baseUrl.hostname;
    u.port = baseUrl.port;

    const newSrc = u.toString();
    $el.attr(attrName, newSrc);

    for (const textNode of $el.textNodes()) {
      const text = textNode.nodeValue;
      if (!text)
        continue;

      const newText = text.replaceAll(src, () => newSrc);
      if (text === newText)
        continue;

      textNode.nodeValue = newText;
    }
  }

  for (const node of images) {
    updateImageFallback(node[0] as HTMLImageElement, addImageFallbackLinks === true);
  }

  return this;
};

interface ImageFallback {
  link: HTMLAnchorElement;
  updateVisibility: () => void;
}

const imageFallbacks = new WeakMap<HTMLImageElement, ImageFallback>();

function updateImageFallback(image: HTMLImageElement, enabled: boolean): void {
  const src = image.getAttribute('src');
  let fallback = imageFallbacks.get(image);
  if (!enabled || !src) {
    if (fallback) {
      image.removeEventListener('load', fallback.updateVisibility);
      image.removeEventListener('error', fallback.updateVisibility);
      fallback.link.remove();
      imageFallbacks.delete(image);
    }
    return;
  }

  if (!fallback) {
    const link = image.ownerDocument.createElement('a');
    link.rel = 'noreferrer';
    link.target = '_blank';
    const updateVisibility = () => {
      link.style.display = image.complete && image.naturalHeight > 0 ? 'none' : 'block';
    };
    fallback = { link, updateVisibility };
    imageFallbacks.set(image, fallback);
    image.addEventListener('load', updateVisibility);
    image.addEventListener('error', updateVisibility);
  }

  fallback.link.setAttribute('href', src);
  fallback.link.textContent = src;
  if (image.nextSibling !== fallback.link) {
    image.after(fallback.link);
  }
  fallback.updateVisibility();
}
