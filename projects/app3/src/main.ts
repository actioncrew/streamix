import {
  map,
  onAnimationFrame,
  onIntersection,
  onMediaQuery,
  onResize,
} from '@actioncrew/streamix';

  // Helper function for smooth interpolation
  const interpolate = (
    current: number,
    target: number,
    speed: number
  ): number => {
    return current + (target - current) * speed;
  };

  // Hero Section Animation
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
    let targetTitleTranslateY = 20; // Start 20px below
    let currentTitleTranslateY = 20;
    let targetParagraphTranslateY = 20; // Start 20px below
    let currentParagraphTranslateY = 20;

    // Add 'will-change' for optimization
    hero.style.willChange = 'opacity, transform';
    heroTitle.style.willChange = 'opacity, transform';
    heroParagraph.style.willChange = 'opacity, transform';

    // Smoothly animate hero section on every frame
    onAnimationFrame().subscribe(() => {
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

      // Update styles
      hero.style.transform = `scale(${currentScale})`;
      hero.style.opacity = `${currentOpacity}`;
      heroTitle.style.opacity = `${currentTitleOpacity}`;
      heroTitle.style.transform = `translateY(${currentTitleTranslateY}px)`;
      heroParagraph.style.opacity = `${currentParagraphOpacity}`;
      heroParagraph.style.transform = `translateY(${currentParagraphTranslateY}px)`;
    });

    // Trigger animation when hero section comes into view
    onIntersection(hero, { threshold: 0.2 }).subscribe((isIntersecting) => {
      if (isIntersecting) {
        targetScale = 1.1;
        targetOpacity = 1;
        targetTitleOpacity = 1;
        targetParagraphOpacity = 1;
        targetTitleTranslateY = 0; // Slide up to original position
        targetParagraphTranslateY = 0; // Slide up to original position
      } else {
        targetScale = 1;
        targetOpacity = 0;
        targetTitleOpacity = 0;
        targetParagraphOpacity = 0;
        targetTitleTranslateY = 20; // Reset to below
        targetParagraphTranslateY = 20; // Reset to below
      }
    });
  }


  // Posts Visibility Animation
  const posts = document.querySelectorAll('.post') as NodeListOf<HTMLElement>;
  posts.forEach((post) => {
    let targetOpacity = 0;
    let currentOpacity = 0;

    // Smoothly animate post opacity on every frame
    onAnimationFrame().subscribe(() => {
      currentOpacity = interpolate(currentOpacity, targetOpacity, 0.1);
      post.style.opacity = `${currentOpacity}`;
    });

    // Trigger animation when post comes into view
    onIntersection(post, { threshold: 0.3 }).subscribe((isIntersecting) => {
      targetOpacity = isIntersecting ? 1 : 0;
    });
  });

  // Window Resize Effects
  onResize(window.document.documentElement)
    .pipe(
      map(({ width, height }) => {
        console.log(`Window resized to ${width} x ${height}`);
        return width;
      })
    )
    .subscribe((width) => {
      if (width < 600) {
        // Adjust layout for small screens
        const hero = document.querySelector('.hero') as HTMLElement;
        if (hero) {
          hero.style.fontSize = '2rem'; // Example: Adjust font size for small screens
        }
      } else {
        // Reset layout for larger screens
        const hero = document.querySelector('.hero') as HTMLElement;
        if (hero) {
          hero.style.fontSize = '3rem'; // Example: Reset font size
        }
      }
    });

  // Media Query Effects
  onMediaQuery('(max-width: 600px)').subscribe((matches) => {
    const hero = document.querySelector('.hero') as HTMLElement;
    if (hero) {
      hero.style.backgroundImage = matches
        ? "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600')"
        : "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e')";
    }
  });

  // Continuous Animation Example (e.g., Background Color Pulse)
  onAnimationFrame()
    .pipe(
      map((time) => Math.sin(time * 0.005) * 0.5 + 0.5) // Generate a sine wave for smooth pulsing
    )
    .subscribe((value) => {
      const hero = document.querySelector('.hero') as HTMLElement;
      if (hero) {
        hero.style.backgroundColor = `rgba(0, 100, 200, ${value})`; // Example: Pulsing background color
      }
    });
