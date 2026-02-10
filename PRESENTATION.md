# Reveal.js Presentation

A simple reveal.js presentation for supertitles.

## Features

- **Keyboard navigation** - Arrow keys, space, or swipe to navigate
- **Overview mode** - Press ESC to see all slides
- **Responsive** - Works on desktop and mobile
- **Themes** - Multiple built-in themes available

## Usage

1. Open `presentation.html` in a web browser
2. Navigate slides:
   - **Arrow keys** or **Space** - Next/previous slide
   - **ESC** - Toggle overview mode
   - **F** - Fullscreen mode
   - **S** - Speaker notes (if enabled)

## Editing Slides

Edit `presentation.html` to add/modify slides. Each slide is a `<section>` element:

```html
<section>
    <h2>Slide Title</h2>
    <p>Slide content</p>
</section>
```

### Vertical Slides

Nest sections to create vertical slides:

```html
<section>
    <section>
        <h2>Horizontal Slide</h2>
    </section>
    <section>
        <h2>Vertical Slide Below</h2>
    </section>
</section>
```

## Available Themes

Change the theme by modifying the CSS link in `presentation.html`:

- `black.css` (default)
- `white.css`
- `league.css`
- `beige.css`
- `sky.css`
- `night.css`
- `serif.css`
- `simple.css`
- `solarized.css`
- `blood.css`
- `moon.css`

Example:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.0.4/dist/theme/white.css">
```

## Advanced Features

### Fragments

Reveal content incrementally:

```html
<section>
    <p class="fragment">Appears first</p>
    <p class="fragment">Appears second</p>
</section>
```

### Markdown Support

Add markdown plugin to write slides in Markdown:

```html
<section data-markdown>
    <textarea data-template>
        ## Slide Title
        - Bullet point 1
        - Bullet point 2
    </textarea>
</section>
```

### Background Colors

```html
<section data-background-color="#ff0000">
    <h2>Red Background</h2>
</section>
```

### Background Images

```html
<section data-background-image="image.jpg">
    <h2>Image Background</h2>
</section>
```

## Configuration

Modify `Reveal.initialize()` in `presentation.html`:

```javascript
Reveal.initialize({
    hash: true,              // URL hash navigation
    transition: 'slide',     // none/fade/slide/convex/concave/zoom
    controls: true,          // Display controls
    progress: true,          // Progress bar
    center: true,            // Vertical centering
    keyboard: true,          // Keyboard shortcuts
    overview: true,          // Overview mode
    touch: true,             // Touch navigation
    loop: false,             // Loop presentation
    autoSlide: 0             // Auto-slide interval (ms)
});
```

## Documentation

Full documentation: https://revealjs.com/

## Integration with PDF Annotations

The reveal.js presentation can be used alongside the PDF annotation tool for supertitles workflow:

1. Use PDF annotation tool to mark slide transitions in presentation PDFs
2. Use this reveal.js presentation for web-based slideshow delivery
3. Annotations can help coordinate timing between slides and supertitles
