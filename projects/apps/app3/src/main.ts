import {
  concatMap,
  debounce,
  filter,
  fromEvent,
  map,
  merge,
  onAnimationFrame,
  onIntersection,
  Stream,
  tap,
} from '@actioncrew/streamix';

// Text animation setup with Streamix
const setupTextAnimation = (element: HTMLElement): Stream<void> => {
  const text = element.textContent || '';
  element.innerHTML = '';

  const spans = text.split('').map((char, i) => {
    const span = document.createElement('span');
    span.textContent = char === ' ' ? '\u00A0' : char;
    span.style.display = 'inline-block';
    span.style.opacity = '0';
    span.style.transform = 'translateY(20px)';
    span.style.transition = `all 0.5s ease ${i * 0.01}s`;
    element.appendChild(span);
    return span;
  });

  let isVisible = false;

  return onIntersection(element, { threshold: 0.5 }).pipe(
    map((intersecting) => intersecting && !isVisible),
    filter((shouldAnimate) => shouldAnimate),
    tap(() => {
      isVisible = true;
      spans.forEach((span) => {
        span.style.opacity = '1';
        span.style.transform = 'translateY(0)';
      });
    }),
    debounce(1000), // Add debounce to control frequent changes
    filter(() => !isVisible),
    tap(() => {
      isVisible = false;
      spans.forEach((span) => {
        span.style.opacity = '0';
        span.style.transform = 'translateY(20px)';
      });
    })
  );
};

// Breathing effect with Streamix operators
const setupBreathingEffect = (element: HTMLElement): Stream<number> => {
  let targetScale = 1.05;
  let currentScale = 1;
  let direction = 1;

  return onAnimationFrame().pipe(
    map(() => {
      currentScale = interpolate(currentScale, targetScale, 0.05);

      if (currentScale >= targetScale) {
        direction = -1;
      } else if (currentScale <= 1) {
        direction = 1;
      }

      element.style.transform = `scale(${currentScale})`;

      targetScale = direction === 1 ? 1.05 : 0.95;
    }),
    concatMap(() =>
      merge(
        fromEvent(element, 'mouseenter').pipe(
          map(() => (targetScale = 1.1)) // Trigger scale increase on mouse enter
        ),
        fromEvent(element, 'mouseleave').pipe(
          map(() => (targetScale = 1.05)) // Reset scale on mouse leave
        )
      )
    )
  );
};

const paragraph = document.querySelector('.breathe-paragraph') as HTMLElement;
if (paragraph) {
  setupBreathingEffect(paragraph).subscribe();
}

document.querySelectorAll('.animate-text').forEach((element) => {
  if (element instanceof HTMLElement) {
    setupTextAnimation(element).subscribe();
  }
});

// Helper function for smooth interpolation
const interpolate = (current: number, target: number, speed: number): number =>
  current + (target - current) * speed;

// Hero Section Animation using Streamix
const hero = document.querySelector('.hero') as HTMLElement;
if (hero) {
  const heroTitle = hero.querySelector('h1') as HTMLElement;
  const heroParagraph = hero.querySelector('p') as HTMLElement;

  let state = {
    scale: 1,
    opacity: 0,
    titleOpacity: 0,
    titleTranslateY: 20,
  };

  hero.style.willChange = 'opacity, transform';
  heroTitle.style.willChange = 'opacity, transform';
  heroParagraph.style.willChange = 'opacity, transform';

  onAnimationFrame()
    .pipe(
      map(() => {
        state = {
          scale: interpolate(
            state.scale,
            hero.dataset['active'] ? 1.1 : 1,
            0.1
          ),
          opacity: interpolate(
            state.opacity,
            hero.dataset['active'] ? 1 : 0,
            0.1
          ),
          titleOpacity: interpolate(
            state.titleOpacity,
            hero.dataset['active'] ? 1 : 0,
            0.1
          ),
          titleTranslateY: interpolate(
            state.titleTranslateY,
            hero.dataset['active'] ? 0 : 20,
            0.1
          ),
        };

        hero.style.transform = `scale(${state.scale})`;
        hero.style.opacity = `${state.opacity}`;
        heroTitle.style.opacity = `${state.titleOpacity}`;
        heroTitle.style.transform = `translateY(${state.titleTranslateY}px)`;
      })
    )
    .subscribe();

  onIntersection(hero, { threshold: 0.2 })
    .pipe(
      map((isIntersecting) => (isIntersecting ? 'true' : 'false')),
      tap((activeState) => {
        hero.dataset['active'] = activeState;
      })
    )
    .subscribe();
}

// Post Cards Animation with Streamix operators
const posts = document.querySelectorAll('.post') as NodeListOf<HTMLElement>;
posts.forEach((post) => {
  const caption = post.querySelector('.post-content') as HTMLElement;

  let state = {
    opacity: 0,
    captionOpacity: 0,
    captionTranslateY: 0,
  };

  onAnimationFrame()
    .pipe(
      map(() => {
        state = {
          opacity: interpolate(
            state.opacity,
            post.dataset['active'] ? 1 : 0,
            0.1
          ),
          captionOpacity: interpolate(
            state.captionOpacity,
            post.dataset['active'] ? 1 : 0,
            0.1
          ),
          captionTranslateY: interpolate(
            state.captionTranslateY,
            post.dataset['active'] ? 0 : 20,
            0.1
          ),
        };

        post.style.opacity = `${state.opacity}`;
        if (caption) {
          caption.style.opacity = `${state.captionOpacity}`;
          caption.style.transform = `translateY(${state.captionTranslateY}px)`;
        }
      })
    )
    .subscribe();

  onIntersection(post, { threshold: 0.3 })
    .pipe(
      map((isIntersecting) => (isIntersecting ? 'true' : 'false')),
      tap((activeState) => {
        post.dataset['active'] = activeState;
      })
    )
    .subscribe();
});

// Canvas animation for featured destinations with Streamix
document.addEventListener('DOMContentLoaded', function () {
  const featuredDestinations = document.querySelector(
    '.featured-destinations'
  ) as HTMLElement;
  const imageWrappers = featuredDestinations.querySelectorAll('.image-wrapper');
  const canvas = featuredDestinations.querySelector(
    '.overlay-canvas'
  ) as HTMLCanvasElement;
  const ctx = canvas.getContext('2d') as any;

  let activeIndex = 0;

  const updateCanvasSize = () => {
    canvas.width = featuredDestinations.clientWidth;
    canvas.height = featuredDestinations.clientHeight;
  };

  const drawParticles = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 50; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 2;
      const opacity = Math.random() * 0.5;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.fill();
    }
  };

  const changeDestination = () => {
    imageWrappers[activeIndex].classList.remove('active');
    activeIndex = (activeIndex + 1) % imageWrappers.length;
    imageWrappers[activeIndex].classList.add('active');
  };

  updateCanvasSize();
  window.addEventListener('resize', updateCanvasSize);

  onAnimationFrame()
    .pipe(
      tap(drawParticles),
      concatMap(() =>
        merge(
          fromEvent(window, 'resize').pipe(
            debounce(200), // Debounce resize events
            map(updateCanvasSize)
          )
        )
      )
    )
    .subscribe();

  setInterval(changeDestination, 5000); // Change destination every 5 seconds
});

// Reveal on scroll effect with Streamix
const revealOnScroll = (selector: string) => {
  const elements = document.querySelectorAll(
    selector
  ) as NodeListOf<HTMLElement>;
  elements.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = `all 0.5s ease ${index * 0.1}s`;

    onIntersection(el, { threshold: 0.5 })
      .pipe(
        tap((isIntersecting) => {
          el.style.opacity = isIntersecting ? '1' : '0';
          el.style.transform = isIntersecting
            ? 'translateY(0)'
            : 'translateY(20px)';
        })
      )
      .subscribe();
  });
};

revealOnScroll('.travel-tips li');
revealOnScroll('.latest-updates .update-item');

// Newsletter Section Animation with Streamix
const newsletter = document.querySelector('.newsletter') as HTMLElement;
if (newsletter) {
  const input = newsletter.querySelector('input') as HTMLInputElement;
  const button = newsletter.querySelector('button') as HTMLButtonElement;

  fromEvent(input, 'focus')
    .pipe(
      tap(() => {
        input.style.borderColor = '#007BFF';
        input.style.boxShadow = '0 0 5px rgba(0, 123, 255, 0.5)';
      })
    )
    .subscribe();

  fromEvent(input, 'blur')
    .pipe(
      tap(() => {
        input.style.borderColor = '#ccc';
        input.style.boxShadow = 'none';
      })
    )
    .subscribe();

  fromEvent(button, 'mouseenter')
    .pipe(tap(() => (button.style.transform = 'scale(1.01)')))
    .subscribe();
  fromEvent(button, 'mouseleave')
    .pipe(tap(() => (button.style.transform = 'scale(1)')))
    .subscribe();
}
