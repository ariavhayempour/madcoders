// Register the React renderer on every AstroContainer so pages/layouts with React islands (MobileNav, AdminNav, DeleteEventButton) render instead of throwing.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { loadRenderers } from 'astro:container';

const original = AstroContainer.create.bind(AstroContainer);

AstroContainer.create = async (options = {}) => {
  const reactRenderers = await loadRenderers([getContainerRenderer()]);
  return original({
    ...options,
    renderers: [...(options.renderers ?? []), ...reactRenderers],
  });
};
