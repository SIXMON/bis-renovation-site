// BIS Rénovation — comportements du site (sans dépendance)
(() => {
  const header = document.querySelector('.header');

  // En-tête : ombre au défilement
  const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Menu mobile
  const toggle = document.querySelector('.nav-toggle');
  toggle?.addEventListener('click', () => {
    const open = header.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  // Méga-menu « Nos solutions » : ouverture au clic (et au survol sur grand écran)
  const mega = document.querySelector('.has-mega');
  if (mega) {
    const link = mega.querySelector('.nav-link');
    const set = (open) => { mega.classList.toggle('is-open', open); link.setAttribute('aria-expanded', open); };
    const desktop = () => window.matchMedia('(min-width: 981px)').matches;
    link.addEventListener('click', (e) => { e.preventDefault(); set(!mega.classList.contains('is-open')); });
    // Délai de fermeture : la souris traverse l'espace entre le lien et le panneau sans le refermer
    let closeTimer;
    mega.addEventListener('mouseenter', () => { clearTimeout(closeTimer); desktop() && set(true); });
    mega.addEventListener('mouseleave', () => { if (desktop()) closeTimer = setTimeout(() => set(false), 300); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
    document.addEventListener('click', (e) => { if (!mega.contains(e.target)) set(false); });
  }

  // Filtres (réalisations, articles) : boutons [data-filter] → cartes [data-tags]
  document.querySelectorAll('.filters').forEach((bar) => {
    const list = document.querySelector(bar.dataset.filterTarget);
    if (!list) return;
    const apply = (key) => {
      bar.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c.dataset.filter === key));
      list.querySelectorAll('.card').forEach((card) => { card.hidden = key !== '*' && !card.dataset.tags.split(' ').includes(key); });
    };
    bar.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      apply(chip.dataset.filter);
      history.replaceState(null, '', chip.dataset.filter === '*' ? location.pathname : `#${chip.dataset.filter}`);
    });
    const initial = location.hash.slice(1);
    if (initial && bar.querySelector(`[data-filter="${CSS.escape(initial)}"]`)) apply(initial);
  });

  // Visionneuse photo
  const groups = {};
  document.querySelectorAll('[data-lightbox]').forEach((a) => (groups[a.dataset.lightbox] ||= []).push(a));
  Object.values(groups).forEach((links) => links.forEach((a, i) => a.addEventListener('click', (e) => { e.preventDefault(); openBox(links, i); })));
  function openBox(links, index) {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<img alt=""><button class="lightbox-close" aria-label="Fermer">×</button>' + (links.length > 1 ? '<button class="lightbox-prev" aria-label="Photo précédente">‹</button><button class="lightbox-next" aria-label="Photo suivante">›</button>' : '');
    const im = box.querySelector('img');
    const show = (i) => { index = (i + links.length) % links.length; im.src = links[index].href; im.alt = links[index].querySelector('img')?.alt || ''; };
    const close = () => { box.remove(); document.removeEventListener('keydown', key); links[index].focus(); };
    const key = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') show(index + 1); if (e.key === 'ArrowLeft') show(index - 1); };
    box.addEventListener('click', (e) => {
      if (e.target.matches('.lightbox-next')) show(index + 1);
      else if (e.target.matches('.lightbox-prev')) show(index - 1);
      else if (e.target !== im) close();
    });
    document.addEventListener('keydown', key);
    document.body.appendChild(box);
    show(index);
    box.querySelector('.lightbox-close').focus();
  }

  // Formulaire de devis : envoi au point configuré (data-endpoint), à défaut ouverture de la messagerie (mailto)
  document.querySelectorAll('form[data-form]').forEach((form) => {
    const status = form.querySelector('.form-status');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.className = 'form-status';
      let ok = true;
      form.querySelectorAll('[required]').forEach((f) => {
        const valid = f.type === 'checkbox' ? f.checked : f.checkValidity() && f.value.trim() !== '';
        f.classList.toggle('is-invalid', !valid);
        if (!valid) ok = false;
      });
      if (!ok) { status.textContent = 'Merci de compléter les champs obligatoires (*).'; status.classList.add('is-error'); return; }
      const data = new FormData(form);
      if (data.get('website')) return; // champ piège anti-robots
      const endpoint = form.dataset.endpoint;
      if (endpoint) {
        try {
          const r = await fetch(endpoint, { method: 'POST', body: data });
          if (!r.ok) throw new Error(r.status);
          form.reset();
          status.textContent = 'Merci ! Votre demande a bien été envoyée. Nous vous recontactons très vite.';
          status.classList.add('is-ok');
        } catch {
          status.textContent = `L’envoi a échoué. Appelez-nous ou écrivez-nous à ${form.dataset.mailto}.`;
          status.classList.add('is-error');
        }
        return;
      }
      const lines = [
        `Profil : ${data.get('profil')}`, `Nom : ${data.get('nom')}`, `Téléphone : ${data.get('telephone')}`,
        `E-mail : ${data.get('email')}`, `Code postal : ${data.get('cp')}`, `Travaux : ${data.getAll('travaux').join(', ') || '—'}`,
        '', data.get('message') || '',
      ];
      location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent('Demande de devis – ' + data.get('nom'))}&body=${encodeURIComponent(lines.join('\n'))}`;
      status.textContent = 'Votre messagerie s’ouvre avec votre demande pré-remplie : il ne vous reste qu’à l’envoyer.';
      status.classList.add('is-ok');
    });
  });

  // Accueil : titre principal rotatif (pause au survol, onglet masqué ou mouvement réduit)
  document.querySelectorAll('.hero-rotator').forEach((h) => {
    const items = [...h.querySelectorAll('.hero-rotator-item')];
    if (items.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0, paused = false;
    h.addEventListener('mouseenter', () => { paused = true; });
    h.addEventListener('mouseleave', () => { paused = false; });
    setInterval(() => {
      if (paused || document.hidden) return;
      items[i].classList.remove('is-active');
      i = (i + 1) % items.length;
      items[i].classList.add('is-active');
    }, Number(h.dataset.rotate) || 4500);
  });
})();
