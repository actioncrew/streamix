import {
  debounce,
  filter,
  fromEvent,
  map,
  onAnimationFrame,
  onIntersection,
  onResize,
  slidingPair,
  tap,
} from '@actioncrew/streamix';

// Text animation setup
const setupTextAnimation = (element: HTMLElement) => {
  // Split text into spans
  const text = element.textContent || '';
  element.innerHTML = ''; // Clear existing content

  const spans = text.split('').map((char, i) => {
    const span = document.createElement('span');
    span.textContent = char === ' ' ? '\u00A0' : char; // Use non-breaking space for spaces
    span.style.display = 'inline-block';
    span.style.opacity = '0';
    span.style.transform = 'translateY(20px)';
    span.style.transition = `all 0.5s ease ${i * 0.01}s`; // Add sequential delay
    element.appendChild(span);
    return span;
  });

  // Animation state
  let isVisible = false;

  // Intersection Observer animation
  return onIntersection(element, { threshold: 0.5 })
    .pipe(
      tap((intersecting) => {
        if (intersecting && !isVisible) {
          isVisible = true;
          spans.forEach((span) => {
            span.style.opacity = '1';
            span.style.transform = 'translateY(0)';
          });
        } else if (!intersecting && isVisible) {
          isVisible = false;
          spans.forEach((span) => {
            span.style.opacity = '0';
            span.style.transform = 'translateY(20px)';
          });
        }
      })
    );
};

// Initialize animation for all text elements
document.querySelectorAll('.animate-text').forEach((element) => {
  if (element instanceof HTMLElement) {
    setupTextAnimation(element).subscribe();
  }
});

// Helper function for smooth interpolation (same as before)
const interpolate = (
  current: number,
  target: number,
  speed: number
): number => {
  return current + (target - current) * speed;
};

// Hero Section Animation with GSAP-like smooth effects
const hero = document.querySelector('.hero') as HTMLElement;
const heroTitle = hero.querySelector('h1') as HTMLElement;
const heroParagraph = hero.querySelector('p') as HTMLElement;

if (hero) {
  let targetScale = 1;
  let currentScale = 1;
  let targetOpacity = 0;
  let currentOpacity = 0;
  let targetTitleOpacity = 0;
  let currentTitleOpacity = 0;
  let targetParagraphOpacity = 0;
  let currentParagraphOpacity = 0;
  let targetTitleTranslateY = 20;
  let currentTitleTranslateY = 20;
  let targetParagraphTranslateY = 20;
  let currentParagraphTranslateY = 20;

  hero.style.willChange = 'opacity, transform';
  heroTitle.style.willChange = 'opacity, transform';
  heroParagraph.style.willChange = 'opacity, transform';

  // GSAP-like smooth animation onAnimationFrame using tap
  onAnimationFrame()
    .pipe(
      tap(() => {
        // Interpolate values smoothly (GSAP-like effect)
        currentScale = interpolate(currentScale, targetScale, 0.1);
        currentOpacity = interpolate(currentOpacity, targetOpacity, 0.1);
        currentTitleOpacity = interpolate(
          currentTitleOpacity,
          targetTitleOpacity,
          0.1
        );
        currentParagraphOpacity = interpolate(
          currentParagraphOpacity,
          targetParagraphOpacity,
          0.1
        );
        currentTitleTranslateY = interpolate(
          currentTitleTranslateY,
          targetTitleTranslateY,
          0.1
        );
        currentParagraphTranslateY = interpolate(
          currentParagraphTranslateY,
          targetParagraphTranslateY,
          0.1
        );

        // Apply interpolated values to styles
        hero.style.transform = `scale(${currentScale})`;
        hero.style.opacity = `${currentOpacity}`;
        heroTitle.style.opacity = `${currentTitleOpacity}`;
        heroTitle.style.transform = `translateY(${currentTitleTranslateY}px)`;
        heroParagraph.style.opacity = `${currentParagraphOpacity}`;
        heroParagraph.style.transform = `translateY(${currentParagraphTranslateY}px)`;
      })
    )
    .subscribe();

  // Trigger animations on intersection with the hero element
  onIntersection(hero, { threshold: 0.2 })
    .pipe(
      tap((isIntersecting) => {
        if (isIntersecting) {
          targetScale = 1.1;
          targetOpacity = 1;
          targetTitleOpacity = 1;
          targetParagraphOpacity = 1;
          targetTitleTranslateY = 0;
          targetParagraphTranslateY = 0;
        } else {
          targetScale = 1;
          targetOpacity = 0;
          targetTitleOpacity = 0;
          targetParagraphOpacity = 0;
          targetTitleTranslateY = 20;
          targetParagraphTranslateY = 20;
        }
      })
    )
    .subscribe();
}

// Posts Visibility and Caption Animation (with staggered opacity effect)
const posts = document.querySelectorAll('.post') as NodeListOf<HTMLElement>;
posts.forEach((post) => {
  let targetOpacity = 0;
  let currentOpacity = 0;
  const caption = post.querySelector('.post-content') as HTMLElement;
  let captionTargetTranslateY = 20;
  let captionCurrentTranslateY = 20;
  let captionTargetOpacity = 0;
  let captionCurrentOpacity = 0;

  onAnimationFrame()
    .pipe(
      tap(() => {
        currentOpacity = interpolate(currentOpacity, targetOpacity, 0.1);
        post.style.opacity = `${currentOpacity}`;
        captionCurrentTranslateY = interpolate(
          captionCurrentTranslateY,
          captionTargetTranslateY,
          0.1
        );
        captionCurrentOpacity = interpolate(
          captionCurrentOpacity,
          captionTargetOpacity,
          0.1
        );
        if (caption) {
          caption.style.transform = `translateY(${captionCurrentTranslateY}px)`;
          caption.style.opacity = `${captionCurrentOpacity}`;
        }
      })
    )
    .subscribe();

  onIntersection(post, { threshold: 0.3 })
    .pipe(
      tap((isIntersecting) => {
        targetOpacity = isIntersecting ? 1 : 0;
        captionTargetTranslateY = isIntersecting ? 0 : 20;
        captionTargetOpacity = isIntersecting ? 1 : 0;
      })
    )
    .subscribe();
});

// GSAP-like dynamic resize effects (adjust font size based on window width)
onResize(window.document.documentElement)
  .pipe(
    map(({ width, height }) => {
      console.log(`Window resized to ${width} x ${height}`);
      return width;
    }),
    tap((width) => {
      const hero = document.querySelector('.hero') as HTMLElement;
      if (hero) {
        if (width < 600) {
          hero.style.fontSize = '2rem';
        } else {
          hero.style.fontSize = '3rem';
        }
      }
    })
  )
  .subscribe();

// Continuous Background Animation (Pulse)
onAnimationFrame()
  .pipe(
    map((time) => Math.sin(time * 0.005) * 0.5 + 0.5),
    tap((value) => {
      const hero = document.querySelector('.hero') as HTMLElement;
      if (hero) {
        hero.style.backgroundColor = `rgba(0, 100, 200, ${value})`;
      }
    })
  )
  .subscribe();

// Example Debounce on Scroll (GSAP-like logging effect)
fromEvent(window, 'scroll')
  .pipe(
    debounce(250),
    map(() => window.scrollY),
    slidingPair(),
    filter(([prev, curr]) => prev && Math.abs(prev - curr) > 50),
    tap(([prev, curr]) => {
      console.log(`Scroll Debounced: Previous ${prev}, Current ${curr}`);
    })
  )
  .subscribe();
