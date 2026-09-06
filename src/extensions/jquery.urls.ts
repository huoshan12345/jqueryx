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

$.fn.refineUrls = function <T extends JQuery<Element>>(
  this: T,
  hosts: MatchPattern[],
  baseUrl: URL,
  options?: RefineUrlsOptions | ((path: string) => string),
) {
  // Preserve the existing path-rewrite callback form.
  const settings = typeof options === 'function' ? { pathRewrite: options } : options ?? {};
  const { pathRewrite } = settings;
  const nodes = this;

  const images: JQuery<Element>[] = [];
  for (const e of nodes) {
    const node = $(e);

    let attrName: string;
    switch (e.tagName) {
      case 'A':
        attrName = 'href';
        break;
      case 'IMG':
        attrName = 'src';
        images.push(node);
        break;
      default:
        console.styled('unsupported tag: ', { text: e.tagName, color: 'blue' });
        continue;
    }

    const src = node.attr(attrName);

    if (!src)
      continue;

    if (!src.startsWith("http")) // 本站链接
      continue;

    let u: URL;
    try {
      u = new URL(src);
    } catch (e) {
      console.log('invalid url: ', src);
      continue;
    }

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
    node.attr(attrName, newSrc);

    const text = node.text();
    if (!text)
      continue;

    const newText = text.replace(src, newSrc);
    if (text === newText)
      continue;

    node.text(newText);
  }

  for (const node of images) {
    updateImageFallback(node[0] as HTMLImageElement, settings.addImageFallbackLinks === true);
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

