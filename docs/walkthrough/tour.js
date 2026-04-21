import { spine } from './slides.js';

function renderSlide(slide) {
  const stage = document.getElementById('tour-stage');
  stage.innerHTML = `
    <section class="tour-slide">
      <h1>${slide.title}</h1>
      ${slide.body}
    </section>
  `;
}

renderSlide(spine[0]);
