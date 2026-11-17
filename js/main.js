(() => {
'use strict';
// Malva v3 — header que se vuelve legible al scrollear, menú móvil, chips y tarjetas que preseleccionan el
// tratamiento, carrusel, reserva simple → WhatsApp, slider antes/después y barra móvil.
// Mejora progresiva: sin JS la página se lee completa, los CTA llevan a #reservar y hay links directos a WhatsApp.

const WHATSAPP = '5491100000000';

// Nombres canónicos (brief/03-copy.md): se escriben igual en la reserva y en el mensaje.
const TRATAMIENTOS = {
  'limpieza-facial-profunda': 'Limpieza facial profunda',
  'limpieza-peeling-enzimatico': 'Limpieza + peeling enzimático',
  'dermaplaning': 'Dermaplaning con higiene',
  'lifting-de-pestanas': 'Lifting de pestañas con tinte',
  'laminado-de-cejas': 'Laminado de cejas con diseño',
  'diseno-de-cejas': 'Diseño y perfilado de cejas',
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* ───────── Header y barra móvil ───────── */
function initHeader() {
  const header = $('#site-header');
  const sentinel = $('#hero-sentinel');
  const mbar = $('#mbar');
  const hero = $('#inicio');
  const reserva = $('#reservar');
  if (!header || !sentinel) return;

  // El centinela está arriba del hero: en cuanto se scrollea, el header pasa a crema con desenfoque.
  new IntersectionObserver((entries) => { const e = entries.at(-1);
    header.toggleAttribute('data-scrolled', !e.isIntersecting);
  }).observe(sentinel);

  if (!mbar || !hero || !reserva) return;
  let pasoHero = false;
  let enReserva = false;
  const sync = () => mbar.toggleAttribute('data-show', pasoHero && !enReserva);
  new IntersectionObserver((entries) => { const e = entries.at(-1);
    pasoHero = !e.isIntersecting && e.boundingClientRect.top < 0;
    sync();
  }).observe(hero);
  new IntersectionObserver((entries) => { const e = entries.at(-1); enReserva = e.isIntersecting; sync(); }, { threshold: 0.12 }).observe(reserva);
}

/* ───────── Menú móvil ───────── */
function initMenu() {
  const btn = $('.menu-btn');
  const menu = $('#menu');
  if (!btn || !menu) return;
  const fuera = [$('main'), $('.site-footer'), $('#mbar')].filter(Boolean);
  const abierto = () => btn.getAttribute('aria-expanded') === 'true';

  const set = (open, { foco = true } = {}) => {
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menu.hidden = !open;
    menu.toggleAttribute('data-open', open);
    document.documentElement.style.overflow = open ? 'hidden' : '';
    fuera.forEach((el) => { el.inert = open; });
    if (!foco) return;
    if (open) $('a', menu)?.focus();
    else btn.focus();
  };

  btn.addEventListener('click', () => set(!abierto()));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false, { foco: false }); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && abierto()) set(false); });
  matchMedia('(min-width: 1100px)').addEventListener('change', (e) => { if (e.matches && abierto()) set(false, { foco: false }); });
}

/* ───────── Chips del hero y tarjetas del carrusel: preseleccionan el tratamiento ───────── */
function preseleccionar(id) {
  const input = $(`input[name="tratamiento"][value="${CSS.escape(id)}"]`);
  if (!input) return;
  input.checked = true;
  limpiarError('trat');
}

function initPreseleccion() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-tratamiento]');
    if (link) preseleccionar(link.dataset.tratamiento);
  });
  const desdeUrl = new URLSearchParams(location.search).get('tratamiento');
  if (desdeUrl) preseleccionar(desdeUrl);
}

/* ───────── Carrusel ───────── */
function initCarousel() {
  const track = $('#carousel-track');
  const flechas = $$('.carousel__nav .arrow');
  if (!track || flechas.length < 2) return;

  // Avanza de a UNA tarjeta: se calcula la tarjeta destino por índice y se va a su posición exacta.
  // Mientras dura el desplazamiento se apaga el scroll-snap, que si no puede "saltar" a otra tarjeta.
  const cards = [...track.children];
  const max = () => track.scrollWidth - track.clientWidth;
  const pos = (i) => Math.min(cards[i].offsetLeft - cards[0].offsetLeft, max());
  const indiceActual = () => {
    let mejor = 0;
    cards.forEach((c, i) => { if (Math.abs(pos(i) - track.scrollLeft) < Math.abs(pos(mejor) - track.scrollLeft)) mejor = i; });
    return mejor;
  };
  let destino = null;
  let fin = 0;
  const sync = () => {
    flechas[0].setAttribute('aria-disabled', String(track.scrollLeft <= 2));
    flechas[1].setAttribute('aria-disabled', String(track.scrollLeft >= max() - 2));
  };
  const terminar = () => { track.style.scrollSnapType = ''; destino = null; sync(); };

  flechas.forEach((b) => b.addEventListener('click', () => {
    if (b.getAttribute('aria-disabled') === 'true') return;
    const desde = destino ?? indiceActual();
    let i = Math.max(0, Math.min(cards.length - 1, desde + Number(b.dataset.dir)));
    // Si la tarjeta destino ya no puede quedar al inicio (final del carrusel), no se saltea ninguna.
    while (i > 0 && pos(i) === pos(i - 1) && Number(b.dataset.dir) < 0) i--;
    destino = i;
    track.style.scrollSnapType = 'none';
    track.scrollTo({ left: pos(i), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    clearTimeout(fin);
    fin = setTimeout(terminar, 700);
  }));

  let tick = 0;
  track.addEventListener('scroll', () => {
    if (tick) return;
    tick = requestAnimationFrame(() => { tick = 0; sync(); });
  }, { passive: true });
  new ResizeObserver(sync).observe(track);
  sync();
}

/* ───────── Reserva simple ───────── */
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function renderDias(cantidad = 6) {
  const cont = $('#dias');
  if (!cont) return;
  const frag = document.createDocumentFragment();
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  let n = 0;
  while (n < cantidad) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow === 0) continue; // domingo cerrado
    const label = document.createElement('label');
    label.className = 'chip';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'dia';
    input.value = `${DIAS[dow]} ${d.getDate()}/${d.getMonth() + 1}`;
    input.setAttribute('aria-label', `${DIAS[dow]} ${d.getDate()} de ${MESES[d.getMonth()]}`);
    if (n === 0) input.required = true;
    const span = document.createElement('span');
    span.innerHTML = `${DIAS_CORTOS[dow]} <b>${d.getDate()}</b>`;
    label.append(input, span);
    frag.append(label);
    n++;
  }
  cont.replaceChildren(frag);
}

const ERRORES = {
  trat: { texto: 'Elegí un tratamiento.', falta: 'elegir un tratamiento' },
  dia: { texto: 'Elegí un día. Es tu preferencia: después te confirmamos el horario.', falta: 'elegir el día' },
  franja: { texto: 'Elegí mañana o tarde.', falta: 'elegir el horario' },
  nombre: { texto: 'Escribí tu nombre, así sabemos a quién responderle.', falta: 'escribir tu nombre' },
};
const CAMPOS = { trat: '#f-trat', dia: '#f-dia', franja: '#f-franja', nombre: '#nombre' };
const ICONO_ERROR = '<svg aria-hidden="true"><use href="#i-alert"/></svg>';

function mostrarError(campo, texto) {
  const p = $(`#e-${campo}`);
  const el = $(CAMPOS[campo]);
  p.innerHTML = `${ICONO_ERROR}<span>${texto}</span>`;
  p.hidden = false;
  if (campo === 'nombre') {
    el.setAttribute('aria-invalid', 'true');
    el.setAttribute('aria-describedby', 'h-nombre e-nombre');
  } else {
    el.setAttribute('data-invalid', '');
    el.setAttribute('aria-describedby', `e-${campo}`);
  }
}

function limpiarError(campo) {
  const p = $(`#e-${campo}`);
  const el = $(CAMPOS[campo]);
  if (!p || !el || p.hidden) return;
  p.hidden = true;
  p.textContent = '';
  if (campo === 'nombre') {
    el.removeAttribute('aria-invalid');
    el.setAttribute('aria-describedby', 'h-nombre');
  } else {
    el.removeAttribute('data-invalid');
    el.removeAttribute('aria-describedby');
  }
  actualizarResumen();
}

const listar = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`);

function faltantes() {
  const f = $('#rform');
  const out = [];
  if (!f.elements.tratamiento.value) out.push(['trat', ERRORES.trat.texto]);
  if (!f.elements.dia?.value) out.push(['dia', ERRORES.dia.texto]);
  if (!f.elements.franja.value) out.push(['franja', ERRORES.franja.texto]);
  const nombre = f.elements.nombre.value.trim();
  if (!nombre) out.push(['nombre', ERRORES.nombre.texto]);
  else if (!/\p{L}/u.test(nombre)) out.push(['nombre', 'Escribí tu nombre con letras.']);
  return out;
}

function actualizarResumen() {
  const resumen = $('#rform-summary');
  if (!resumen || !resumen.textContent) return;
  const f = faltantes();
  resumen.textContent = f.length ? `Te falta ${listar(f.map(([c]) => ERRORES[c].falta))}.` : '';
}

function enfocarCampo(campo) {
  const el = $(CAMPOS[campo]);
  if (campo === 'nombre') { el.focus(); return; }
  const radio = $('input:checked', el) || $('input', el);
  radio?.focus();
}

function initReserva() {
  const form = $('#rform');
  if (!form) return;
  renderDias();

  const done = $('#rform-done');
  const fallback = $('#rform-fallback');
  const resumen = $('#rform-summary');

  form.addEventListener('change', (e) => {
    const n = e.target.name;
    if (n === 'tratamiento') limpiarError('trat');
    else if (n === 'dia' || n === 'franja') limpiarError(n);
    done.hidden = true;
  });
  form.elements.nombre.addEventListener('input', () => {
    if (!$('#e-nombre').hidden && form.elements.nombre.value.trim()) limpiarError('nombre');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    Object.keys(CAMPOS).forEach(limpiarError);
    const f = faltantes();
    if (f.length) {
      f.forEach(([campo, texto]) => mostrarError(campo, texto));
      resumen.textContent = `Te falta ${listar(f.map(([c]) => ERRORES[c].falta))}.`;
      enfocarCampo(f[0][0]);
      return;
    }
    resumen.textContent = '';

    const tratamiento = TRATAMIENTOS[form.elements.tratamiento.value];
    const dia = form.elements.dia.value;
    const franja = form.elements.franja.value;
    const nombre = form.elements.nombre.value.trim().replace(/\s+/g, ' ');
    const mensaje = `Hola Malva, soy ${nombre}. Quiero reservar ${tratamiento} el ${dia} a la ${franja}. ¿Tienen lugar?`;
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;

    fallback.href = url;
    done.hidden = false;
    const win = window.open(url, '_blank');
    if (win) win.opener = null;
    else location.href = url;
    done.focus();
  });
}

/* ───────── Slider antes / después ───────── */
function initSlider() {
  const ba = $('#ba');
  const stage = $('#ba-stage');
  const range = $('#ba-range');
  if (!ba || !stage || !range) return;

  const set = (valor) => {
    const v = Math.round(Math.min(100, Math.max(0, valor)));
    range.value = String(v);
    ba.style.setProperty('--pos', `${v}%`);
    range.setAttribute('aria-valuetext', `Mostrando ${v} % antes y ${100 - v} % después`);
  };
  const desdeX = (x) => {
    const r = stage.getBoundingClientRect();
    set(((x - r.left) / r.width) * 100);
  };

  range.addEventListener('input', () => set(Number(range.value)));

  // Arrastre en toda la imagen. Con mouse salta al click; con el dedo sigue el arrastre horizontal
  // (touch-action: pan-y deja el scroll vertical al navegador) y salta al tocar.
  let activo = false;
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    activo = true;
    stage.setPointerCapture(e.pointerId);
    if (e.pointerType !== 'touch') { e.preventDefault(); desdeX(e.clientX); range.focus({ preventScroll: true }); }
  });
  stage.addEventListener('pointermove', (e) => { if (activo) desdeX(e.clientX); });
  stage.addEventListener('pointerup', (e) => {
    if (activo && e.pointerType === 'touch') desdeX(e.clientX);
    activo = false;
  });
  stage.addEventListener('pointercancel', () => { activo = false; });
  stage.addEventListener('lostpointercapture', () => { activo = false; });

  set(Number(range.value));
}

/* ───────── Init ───────── */
initHeader();
initMenu();
initPreseleccion();
initCarousel();
initReserva();
initSlider();

/* ───────── Aparición de bloques al scrollear ───────── */
function initReveal() {
  if (reduceMotion.matches || !('IntersectionObserver' in window)) return;
  const grupos = ['.sec-head', '.collage', '.verdad__text', '.dolores__grid > *', '.dolores__close', '.bento > *', '.giant', '.arch', '.gains > *', '.tcard', '.carousel__foot', '.reserva__card', '.ba', '.team', '.qa', '.footer__grid > *'];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
  for (const sel of grupos) {
    $$(sel).forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--i', String(i % 6));
      io.observe(el);
    });
  }
}

/* ───────── Preguntas frecuentes: abrir y cerrar con animación suave ───────── */
function initFaq() {
  const items = $$('.qa');
  if (!items.length || !Element.prototype.animate) return;
  const anim = (d, cuadros, fin) => {
    const body = $('.qa__body', d);
    d.dataset.anim = '1';
    const a = body.animate(cuadros, { duration: 450, easing: 'cubic-bezier(.22,1,.36,1)' });
    a.onfinish = a.oncancel = () => { fin(); delete d.dataset.anim; };
  };
  const abrir = (d) => {
    d.open = true;
    const h = $('.qa__body', d).scrollHeight;
    anim(d, [{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], () => {});
  };
  const cerrar = (d) => {
    if (reduceMotion.matches) { d.open = false; return; }
    const h = $('.qa__body', d).scrollHeight;
    d.dataset.closing = '';
    anim(d, [{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], () => { d.open = false; delete d.dataset.closing; });
  };
  items.forEach((d) => {
    const p = $(':scope > p', d);
    if (!p) return;
    const body = document.createElement('div');
    body.className = 'qa__body';
    p.replaceWith(body);
    body.append(p);
    d.removeAttribute('name'); // la exclusividad la maneja el script, para poder animar el cierre
    $('summary', d).addEventListener('click', (ev) => {
      ev.preventDefault();
      if (d.dataset.anim) return;
      if (d.open) { cerrar(d); return; }
      items.filter((o) => o !== d && o.open && !o.dataset.anim).forEach(cerrar);
      if (reduceMotion.matches) { d.open = true; return; }
      abrir(d);
    });
  });
}

/* ───────── Pausar animaciones (WCAG 2.2.2) ───────── */
function initPausa() {
  const btn = $('.motion-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const pausado = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(pausado));
    btn.textContent = pausado ? 'Reanudar' : 'Pausar';
    document.documentElement.toggleAttribute('data-paused', pausado);
  });
}
initPausa();
initReveal();
initFaq();

})();
