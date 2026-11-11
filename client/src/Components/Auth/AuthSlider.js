'use client';

import { useState, useEffect } from 'react';
import styles from './Auth.module.css';

const SLIDES = [
  {
    image: '/slider_1.png',
    title: 'Get more with less',
    subtitle: 'Answers judged by meaning, not exact wording. Partial marks awarded for near-correct responses.',
  },
  {
    image: '/slider_2.png',
    title: 'Learn at your own pace',
    subtitle: 'Access courses anytime, anywhere. Track your progress and pick up right where you left off.',
  },
  {
    image: '/slider_3.png',
    title: 'Earn recognised certificates',
    subtitle: 'Complete courses and quizzes to earn certificates that validate your skills and knowledge.',
  },
  {
    image: '/slider_4.png',
    title: 'Practice with live sessions',
    subtitle: 'Join instructor-led live sessions, ask questions and interact with peers in real time.',
  },
  {
    image: '/slider_5.png',
    title: 'Track your progress in real time',
    subtitle: 'See exactly how far you’ve come with detailed analytics and progress tracking.',
  },
];

export default function AuthSlider() {
  const [active, setActive] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  function goTo(i) {
    if (i === active) return;
    setActive(i);
    setAnimKey((k) => k + 1);
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % SLIDES.length;
        setAnimKey((k) => k + 1);
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.sliderPanel}>
      <div className={styles.sliderBg} />

      {/* Large slide image, photo showing above/around it */}
      <div className={styles.imageWrap}>
        <div key={animKey} className={styles.slideUnit}>
          <img src={SLIDES[active].image} alt={SLIDES[active].title} className={styles.slideImage} />
        </div>
      </div>

      {/* Solid caption band pinned to the bottom — only the text fades between slides */}
      <div className={styles.captionBand}>
        <div key={animKey} className={styles.captionAnim}>
          <div className={styles.sliderCaption}>
            <h2>{SLIDES[active].title}</h2>
            <p>{SLIDES[active].subtitle}</p>
          </div>
        </div>

        <div className={styles.sliderDots}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === active ? styles.dotActive : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
