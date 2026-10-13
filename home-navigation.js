(() => {
  const sections = [...document.querySelectorAll('.long-home-hero[id], .long-home-section[id]')];
  const links = [...document.querySelectorAll('.home-section-nav a[data-section]')];
  if (!sections.length || !links.length) return;

  let scheduled = false;

  function updateActiveSection() {
    scheduled = false;
    const threshold = window.innerHeight * 0.35;
    let activeId = sections[0].id;

    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= threshold) activeId = section.id;
    });

    links.forEach((link) => {
      const isActive = link.dataset.section === activeId;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(updateActiveSection);
  }

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  updateActiveSection();
})();

/* 底部社交按钮：点击时触发回弹动画 */
(() => {
  const socialButtons = [...document.querySelectorAll('.social-actions .social-cta')];
  if (!socialButtons.length) return;

  socialButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.remove('is-tapped');
      // 强制重排，保证动画可重复触发
      void btn.offsetWidth;
      btn.classList.add('is-tapped');
    });
    btn.addEventListener('animationend', () => {
      btn.classList.remove('is-tapped');
    });
  });
})();
