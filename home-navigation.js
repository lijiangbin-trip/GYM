(() => {
  const sections = [...document.querySelectorAll('.long-home-hero[id], .long-home-section[id]')];
  const links = [...document.querySelectorAll('.home-section-nav a[data-section]')];
  if (!sections.length || !links.length) return;

  const nav = document.querySelector('.home-section-nav');
  const glow = nav ? nav.querySelector('.dock-glow') : null;
  let scheduled = false;

  // 将荧光胶囊滑动到当前激活项下方
  // 注意：.home-section-nav 带有 transform: translateX(50%) 用于水平居中，
  // 若用 getBoundingClientRect() 计算偏移会因坐标系不一致导致胶囊错位。
  // 这里改用 offsetLeft / offsetWidth（相对定位父级的布局值，不受 transform 影响），
  // 并扣除导航内边距，使胶囊精确对齐当前激活项。
  function moveGlow(activeLink) {
    if (!glow || !nav || !activeLink) return;
    const styles = window.getComputedStyle(nav);
    const padLeft = parseFloat(styles.paddingLeft) || 0;
    const padTop = parseFloat(styles.paddingTop) || 0;
    const padBottom = parseFloat(styles.paddingBottom) || 0;
    // 胶囊基准点与导航内边距保持一致，避免硬编码 left/top 与 padding 不同步导致错位
    glow.style.left = `${padLeft}px`;
    glow.style.top = `${padTop}px`;
    glow.style.height = `${nav.clientHeight - padTop - padBottom}px`;
    // offsetLeft 相对导航边框盒（含 padding-left），扣除后得到相对内容区的偏移
    const offset = activeLink.offsetLeft - padLeft;
    glow.style.width = `${activeLink.offsetWidth}px`;
    glow.style.transform = `translateX(${offset}px)`;
    glow.style.opacity = '1';
  }

  function updateActiveSection() {
    scheduled = false;
    const threshold = window.innerHeight * 0.35;
    let activeId = sections[0].id;

    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= threshold) activeId = section.id;
    });

    let activeLink = null;
    links.forEach((link) => {
      const isActive = link.dataset.section === activeId;
      link.classList.toggle('is-active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'location');
        activeLink = link;
      } else {
        link.removeAttribute('aria-current');
      }
    });

    moveGlow(activeLink);
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(updateActiveSection);
  }

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  // 字体/语言切换后重新测量胶囊位置
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleUpdate);
  }
  window.addEventListener('load', scheduleUpdate);
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

/* 滚动触发展现：水波流光 / 浪花波浪 入场微动效
   - 使用 IntersectionObserver 监听视口滚动
   - 卡片 1 -> 2 -> 3 -> 4 依次带水波微动效淡入上浮（逐层涟漪扩散）
   - 标题单独涟漪扩散入场
*/
(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 收集需要入场动效的元素
  const revealItems = [...document.querySelectorAll('.reveal-item')];
  const revealHeadings = [...document.querySelectorAll('.reveal-heading')];
  const targets = [...revealHeadings, ...revealItems];

  if (!targets.length) return;

  // 无障碍：用户偏好减少动效时，直接呈现，不做滚动动画
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  // 为同一容器内的卡片分配逐层递增的延迟（涟漪级联）
  const groups = new Map();
  revealItems.forEach((el) => {
    const parent = el.parentElement;
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push(el);
  });
  groups.forEach((items) => {
    items.forEach((el, index) => {
      el.style.setProperty('--reveal-delay', `${index * 130}ms`);
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        // 只触发一次，触发后即取消观察
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.18,
      rootMargin: '0px 0px -8% 0px'
    }
  );

  targets.forEach((el) => observer.observe(el));

  // 安全兜底：无论滚动与否，加载后短暂延时强制揭示所有元素，
  // 确保卡片 100% 稳定存在，绝不因观察器异常或误触而永久隐藏。
  window.setTimeout(() => {
    targets.forEach((el) => {
      if (!el.classList.contains('is-revealed')) {
        el.classList.add('is-revealed');
        observer.unobserve(el);
      }
    });
  }, 1200);
})();

/* ISSN 科学餐盘：图文一体机能卡片
   - 采用原生横向 scroll-snap 轮播，无需额外切换脚本
*/

/* =====================================================================
   模块一：#plans-and-pricing 人群 Tab 切换
   - 点击 Tab 平滑切换对应人群面板（opacity + transform 过渡）
   - 同步 aria-selected / hidden，保证无障碍
   ===================================================================== */
(() => {
  const tabs = [...document.querySelectorAll('.plan-tab[data-plan-tab]')];
  const panels = [...document.querySelectorAll('.plan-panel[data-plan-panel]')];
  if (!tabs.length || !panels.length) return;

  function activate(key) {
    tabs.forEach((tab) => {
      const isActive = tab.dataset.planTab === key;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    panels.forEach((panel) => {
      const isActive = panel.dataset.planPanel === key;
      if (isActive) {
        panel.hidden = false;
        // 强制重排后再加 is-active，确保过渡动画可重复触发
        void panel.offsetWidth;
        panel.classList.add('is-active');
      } else {
        panel.classList.remove('is-active');
        panel.hidden = true;
      }
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activate(tab.dataset.planTab));
  });
})();

/* =====================================================================
   模块二：#intake-form-section 表单交互
   - 胶囊选项：单选 / 多选切换 .selected
   - 提交：拼装评估档案 → 复制剪贴板 → 弹出直达发送弹窗
   ===================================================================== */
(() => {
  const form = document.getElementById('intake-form');
  if (!form) return;

  // 教练微信号（用于「复制微信号并前往微信」）
  const COACH_WECHAT_ID = 'Kiyama_Seiji';

  // 胶囊选项组：单选 / 多选
  const groups = [...form.querySelectorAll('.chip-group[data-chip-group]')];
  groups.forEach((group) => {
    const mode = group.dataset.chipMode === 'multi' ? 'multi' : 'single';
    const chips = [...group.querySelectorAll('.chip')];
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        if (mode === 'single') {
          chips.forEach((c) => {
            const on = c === chip;
            c.classList.toggle('selected', on);
            c.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        } else {
          const on = !chip.classList.contains('selected');
          chip.classList.toggle('selected', on);
          chip.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
      });
    });
  });

  // 读取某个胶囊组已选中的文案（返回数组）
  function readChips(groupName) {
    const group = form.querySelector(`.chip-group[data-chip-group="${groupName}"]`);
    if (!group) return [];
    return [...group.querySelectorAll('.chip.selected')].map((chip) => chip.textContent.trim());
  }

  // 通用剪贴板写入（含旧设备兜底）
  function copyText(text) {
    return new Promise((resolve) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => resolve(true)).catch(() => resolve(fallbackCopy(text)));
      } else {
        resolve(fallbackCopy(text));
      }
    });
  }
  function fallbackCopy(text) {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-9999px';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch (error) {
      return false;
    }
  }

  // 拼装评估档案文本
  function buildDossier() {
    const name = (document.getElementById('intake-name')?.value || '').trim();
    const contact = (document.getElementById('intake-contact')?.value || '').trim();
    const injury = (document.getElementById('intake-injury')?.value || '').trim();
    const identity = readChips('identity').join('、') || '未填写';
    const age = readChips('age').join('、') || '未填写';
    const issues = readChips('issues').join('、') || '未填写';
    const goal = readChips('goal').join('、') || '未填写';
    const habit = readChips('habit').join('、') || '未填写';
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const line = '----------------------------------------';
    return [
      line,
      '📋【木山·青司 初回身体机能评估档案】',
      `· 客户称呼：${name || '未填写'}（${contact || '未填写联系方式'}）`,
      `· 受训身份：${identity} | 年龄：${age}`,
      `· 核心痛点：${issues}`,
      `· 核心目标：${goal}`,
      `· 运动习惯：${habit}`,
      `· 旧伤受限：${injury || '无特别受限'}`,
      `· 申请时间：${stamp}`,
      line,
    ].join('\n');
  }

  // 弹窗元素
  const modal = document.getElementById('dossier-modal');
  const preview = document.getElementById('dossier-preview');
  const whatsappBtn = document.getElementById('dossier-whatsapp');
  const wechatBtn = document.getElementById('dossier-wechat');
  const toast = document.getElementById('dossier-toast');
  const feedback = document.getElementById('intake-feedback');

  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    toast.style.animation = 'none';
    void toast.offsetWidth;
    toast.style.animation = '';
  }

  // 关闭交互：× 按钮 / 遮罩空白处 / Esc
  if (modal) {
    modal.querySelectorAll('[data-dossier-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) closeModal();
    });
  }

  // 提交：生成档案 → 复制 → 弹窗
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const dossierText = buildDossier();

    if (feedback) {
      feedback.hidden = false;
      feedback.style.animation = 'none';
      void feedback.offsetWidth;
      feedback.style.animation = '';
    }

    if (preview) preview.textContent = dossierText;
    if (whatsappBtn) {
      whatsappBtn.setAttribute('href', `https://api.whatsapp.com/send?text=${encodeURIComponent(dossierText)}`);
    }
    if (toast) toast.hidden = true;

    copyText(dossierText).then((ok) => {
      if (!ok && toast) {
        showToast('自动复制未成功，请长按上方档案文本手动复制。');
      }
    });

    openModal();
  });

  // WhatsApp 直达（href 已带 text，无需额外处理）

  // 微信：复制微信号 + 尝试唤起微信
  if (wechatBtn) {
    wechatBtn.addEventListener('click', () => {
      copyText(COACH_WECHAT_ID).then(() => {
        showToast(`微信号 ${COACH_WECHAT_ID} 及档案均已复制，添加好友后直接粘贴发送即可！`);
      });
      // 尝试唤起微信（移动端）
      try {
        window.location.href = 'weixin://';
      } catch (error) {
        /* 桌面端或未安装微信时静默忽略 */
      }
    });
  }
})();

/* =====================================================================
   #footprints 四大支柱照片：暗黑机能风灯箱（Lightbox）
   - 点击 .pillar-media 平滑弹出全屏毛玻璃模态框
   - 动态读取当前卡片的标题与认证标签作为图注
   - 关闭：× 按钮 / 点击空白遮罩 / 点击图片本身 / ESC 键
   - 打开时禁止背景页面滚动
   ===================================================================== */
(() => {
  const modal = document.getElementById('photo-modal');
  if (!modal) return;

  const modalImg = document.getElementById('photo-modal-img');
  const modalTitle = document.getElementById('photo-modal-title');
  const modalCredential = document.getElementById('photo-modal-credential');
  const medias = [...document.querySelectorAll('.pillar-media')];
  if (!medias.length) return;

  let lastFocused = null;

  function openModal(media) {
    const img = media.querySelector('img');
    if (!img) return;
    const card = media.closest('.pillar-card');
    const titleEl = card ? card.querySelector('.pillar-title') : null;
    const tagEl = card ? card.querySelector('.pillar-tag') : null;
    const credEl = card ? card.querySelector('.pillar-credential') : null;

    modalImg.src = img.currentSrc || img.src;
    modalImg.alt = img.alt || '';
    modalTitle.textContent = titleEl ? titleEl.textContent.trim() : (img.alt || '');
    const credText = credEl ? credEl.textContent.trim() : '';
    const tagText = tagEl ? tagEl.textContent.trim() : '';
    modalCredential.textContent = credText || tagText;
    modalCredential.hidden = !(credText || tagText);

    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('photo-modal-open');
    // 强制重排后加 is-open，确保过渡动画可重复触发
    void modal.offsetWidth;
    modal.classList.add('is-open');
    modal.querySelector('.photo-modal-close')?.focus();
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('photo-modal-open');
    const finish = () => {
      modal.hidden = true;
      modalImg.src = '';
      modal.removeEventListener('transitionend', finish);
    };
    // 等待淡出过渡结束再隐藏；兜底 500ms
    modal.addEventListener('transitionend', finish);
    window.setTimeout(finish, 500);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  medias.forEach((media) => {
    media.addEventListener('click', () => openModal(media));
    media.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openModal(media);
      }
    });
  });

  // 关闭交互：× 按钮 / 遮罩空白处 / 图片本身
  modal.querySelectorAll('[data-photo-close]').forEach((el) => {
    el.addEventListener('click', closeModal);
  });
  modalImg.addEventListener('click', closeModal);

  // ESC 键关闭
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });
})();

/* =====================================================================
   #honors 身体指标：横向单排 4 联胶囊按键 + 下方详情切换
   - 点击 .metric-tab-btn 切换 active 状态
   - 同步显示对应 data-metric 的 .metric-detail-item
   - 支持键盘左右方向键切换
   ===================================================================== */
(() => {
  const strip = document.querySelector('.metrics-horizontal-strip');
  if (!strip) return;

  const tabs = [...strip.querySelectorAll('.metric-tab-btn')];
  const details = [...strip.querySelectorAll('.metric-detail-item')];
  if (!tabs.length || !details.length) return;

  function activate(index) {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    details.forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(index));
    tab.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const dir = event.key === 'ArrowRight' ? 1 : -1;
        const next = (index + dir + tabs.length) % tabs.length;
        tabs[next].focus();
        activate(next);
      }
    });
  });
})();

/* =====================================================================
   #footprints 数据面板：2×2 极简机能四宫格 + 下方动态展开解析
   - 点击 .stat-btn 切换 active 状态
   - 同步显示对应 data-stat 的 .stat-detail-content
   - 支持键盘左右方向键切换
   ===================================================================== */
(() => {
  const wrap = document.querySelector('.stats-matrix-wrap');
  if (!wrap) return;

  const btns = [...wrap.querySelectorAll('.stat-btn')];
  const contents = [...wrap.querySelectorAll('.stat-detail-content')];
  if (!btns.length || !contents.length) return;

  function activate(index) {
    btns.forEach((btn, i) => {
      const on = i === index;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    contents.forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });
  }

  btns.forEach((btn, index) => {
    btn.addEventListener('click', () => activate(index));
    btn.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const dir = event.key === 'ArrowRight' ? 1 : -1;
        const next = (index + dir + btns.length) % btns.length;
        btns[next].focus();
        activate(next);
      }
    });
  });
})();
