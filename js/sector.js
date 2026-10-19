/* Controles compartidos de sector y celdas editables. */
(function (g) {
  'use strict';
  const h = C.h;

  /** Input numérico enlazado a obj[key]; vacío = null (usa el valor por defecto del parámetro). */
  C.numInput = function (obj, key, opts) {
    opts = opts || {};
    const el = h('input', { type: 'number', step: opts.step || 'any', min: opts.min === undefined ? 0 : opts.min, class: 'num', 'aria-label': opts.label || key,
      placeholder: opts.ph === undefined ? '' : opts.ph, value: obj[key] === null || obj[key] === undefined ? '' : obj[key] });
    el.addEventListener('input', () => {
      obj[key] = el.value === '' ? (opts.vacio === undefined ? null : opts.vacio) : Number(el.value);
      Store.save(); if (opts.after) opts.after();
    });
    return el;
  };
  C.textInput = function (obj, key, opts) {
    opts = opts || {};
    const el = h('input', { type: 'text', class: 'txt', list: opts.list, 'aria-label': opts.label || key, placeholder: opts.ph || '', value: obj[key] || '' });
    el.addEventListener('input', () => { obj[key] = el.value; Store.save(); if (opts.after) opts.after(); });
    return el;
  };


  /** Relleno hacia abajo estilo Excel: arrastrar el cuadro de la celda activa, doble clic (hasta el final) o Ctrl+D. */
  C.fillDown = function (table) {
    const handle = h('div', { class: 'fill-handle', title: 'Arrastre hacia abajo para copiar el valor · doble clic: hasta el final · Ctrl+D copia la celda de arriba' });
    const rowsOf = () => [...table.tBodies[0].rows];
    const ctl = td => td && td.querySelector('input,select');
    function setVal(src, dst) {
      if (src.type === 'checkbox') { dst.checked = src.checked; dst.dispatchEvent(new Event('change', { bubbles: true })); }
      else if (src.tagName === 'SELECT') { dst.value = src.value; dst.dispatchEvent(new Event('change', { bubbles: true })); }
      else { dst.value = src.value; dst.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    function fill(td, hasta) {
      const rows = rowsOf(), from = rows.indexOf(td.parentNode), col = td.cellIndex, src = ctl(td);
      if (!src || from < 0) return;
      for (let i = from + 1; i <= hasta && i < rows.length; i++) { const d = ctl(rows[i].cells[col]); if (d) setVal(src, d); }
    }
    let cur = null;
    table.addEventListener('focusin', e => {
      const td = e.target.closest && e.target.closest('td.in');
      if (!td || !ctl(td)) return;
      cur = td; td.appendChild(handle);
    });
    table.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'd') return;
      const td = e.target.closest && e.target.closest('td.in'); if (!td) return;
      e.preventDefault();
      const rows = rowsOf(), i = rows.indexOf(td.parentNode);
      if (i < 1) return;
      const src = ctl(rows[i - 1].cells[td.cellIndex]), dst = ctl(td);
      if (src && dst) setVal(src, dst);
    });
    handle.addEventListener('mousedown', e => e.preventDefault());
    handle.addEventListener('dblclick', () => { if (cur) fill(cur, Infinity); });
    handle.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const td = cur; if (!td) return;
      const rows = rowsOf(), from = rows.indexOf(td.parentNode), col = td.cellIndex; let to = from;
      handle.setPointerCapture(e.pointerId);
      const mark = () => rows.forEach((r, i) => r.cells[col].classList.toggle('fill-sel', i > from && i <= to));
      const move = ev => {
        const el = document.elementFromPoint(ev.clientX, ev.clientY), tr = el && el.closest && el.closest('tr'), i = tr ? rows.indexOf(tr) : -1;
        if (i >= from) { to = i; mark(); }
      };
      const up = () => {
        handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
        rows.forEach(r => r.cells[col].classList.remove('fill-sel'));
        fill(td, to);
      };
      handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
    });
  };

  /** Barra de sector: selector, alta, renombre, baja y modo de captura. */
  C.barraSector = function (rerender) {
    const S = Store.state, sec = Store.sector();
    const sel = C.selectorSector(rerender);
    return h('div', { class: 'toolbar no-print' },
      h('label', { class: 'inline' }, h('span', null, 'Sector'), sel),
      h('button', { class: 'btn small', onclick: () => { const n = prompt('Nombre del nuevo sector:', 'Sector ' + String.fromCharCode(65 + S.sectores.length)); if (n && n.trim()) { Store.nuevoSector(n.trim()); rerender(); } } }, '+ Sector'),
      h('button', { class: 'btn small', onclick: () => { const n = prompt('Nuevo nombre:', sec.nombre); if (n && n.trim()) { sec.nombre = n.trim(); Store.save(); rerender(); } } }, 'Renombrar'),
      h('button', { class: 'btn small danger', disabled: S.sectores.length < 2, onclick: () => {
        if (!confirm('¿Eliminar el sector "' + sec.nombre + '" con todos sus datos?')) return;
        S.sectores = S.sectores.filter(x => x !== sec); S.activo = S.sectores[0].id; Store.save(); rerender();
      } }, 'Eliminar'),
      h('span', { class: 'grow' }),
      h('label', { class: 'inline' }, h('span', null, 'Captura'),
        h('select', { 'aria-label': 'Modo de captura', onchange: e => { sec.modo = e.target.value; Store.save(); rerender(); } },
          h('option', { value: 'detalle', selected: sec.modo !== 'resumen' }, 'Detalle por vivienda / área'),
          h('option', { value: 'resumen', selected: sec.modo === 'resumen' }, 'Solo totales (resumen)'))));
  };
})(window);
