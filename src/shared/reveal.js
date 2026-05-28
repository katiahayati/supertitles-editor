// Single Reveal.js HTML generator for exported presentations.
// (Replaces the two divergent copies that previously lived in recital-manager.js
// and presentation-editor.js.)

import { escapeHtml } from './escape.js';

function styleToCss(styleObj = {}) {
  return Object.entries(styleObj)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`)
    .join('; ');
}

function slideSection(slide) {
  const styles = slide.styles || {};
  if (slide.type === 'title' || slide.type === 'title-subtitle') {
    const titleCss = styleToCss(styles.title);
    const subtitleCss = styleToCss(styles.subtitle);
    return `
                <section>
                    <h1 style="${titleCss}">${escapeHtml(slide.title)}</h1>
                    ${slide.subtitle ? `<h2 style="${subtitleCss}; white-space: pre-wrap;">${escapeHtml(slide.subtitle)}</h2>` : ''}
                </section>`;
  }
  if (slide.type === 'title-content') {
    const titleCss = styleToCss(styles.title);
    const contentCss = styleToCss(styles.content);
    return `
                <section>
                    <h2 style="${titleCss}">${escapeHtml(slide.title)}</h2>
                    <p style="${contentCss}; white-space: pre-wrap;">${escapeHtml(slide.content)}</p>
                </section>`;
  }
  if (slide.type === 'content') {
    const contentCss = styleToCss(styles.content);
    return `
                <section>
                    <p style="${contentCss}; white-space: pre-wrap;">${escapeHtml(slide.content)}</p>
                </section>`;
  }
  return '';
}

export function generateRevealHtml(slides, { title = 'Presentation' } = {}) {
  const slidesHtml = slides.map(slideSection).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.5.0/reveal.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.5.0/theme/white.min.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Roboto:wght@100;300;400;500;700;900&display=swap" rel="stylesheet">
    <style>
        .reveal { font-family: 'Roboto', sans-serif; }
        .reveal h1 { font-family: 'Cinzel', serif; font-weight: 700; text-transform: none; color: #000; }
        .reveal h2 { font-family: 'Roboto', sans-serif; text-transform: none; color: #000; }
        .reveal section { color: #000; padding-bottom: 100px; }
    </style>
</head>
<body>
    <div class="reveal">
        <div class="slides">
${slidesHtml}
        </div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.5.0/reveal.min.js"></script>
    <script>
        Reveal.initialize({
            hash: true,
            slideNumber: 'c/t',
            controls: true,
            progress: true,
            center: true,
            transition: 'none'
        });
    </script>
</body>
</html>`;
}
