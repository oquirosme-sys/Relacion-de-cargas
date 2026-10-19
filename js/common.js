/* Utilidades comunes: DOM, formato, encabezado/navegación. */
(function (g) {
  'use strict';

  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(x => add(el, x));
    else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  const fmtCache = {};
  function fmt(n, d) {
    if (n === null || n === undefined || isNaN(n)) return '';
    d = d === undefined ? 2 : d;
    const f = fmtCache[d] || (fmtCache[d] = new Intl.NumberFormat('es-CR', { minimumFractionDigits: d, maximumFractionDigits: d }));
    return f.format(n);
  }
  const pct = n => (n === null || n === undefined || isNaN(n)) ? '' : fmt(n * 100, 1) + ' %';

  function toast(msg) {
    const t = h('div', { class: 'toast' }, msg);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }
  function descargar(nombre, texto, tipo) {
    const a = h('a', { href: URL.createObjectURL(new Blob([texto], { type: tipo || 'text/plain;charset=utf-8' })), download: nombre });
    document.body.appendChild(a); a.click(); a.remove();
  }
  function csv(filas) {
    return '﻿' + filas.map(f => f.map(c => {
      const s = c === null || c === undefined ? '' : String(c);
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\r\n');
  }

  const PAGES = [
    ['index.html', 'Proyecto y relación completa'],
    ['departamentos.html', 'Departamentos'],
    ['servicios.html', 'Servicios'],
    ['parametros.html', 'Parámetros NEC']
  ];

  /** Dibuja encabezado y pestañas; id = archivo actual. */
  function shell(id) {
    const S = Store.state, P = S.params;
    const head = document.getElementById('head');
    head.appendChild(h('div', { class: 'brand' },
      h('span', { class: 'logo', 'aria-hidden': 'true' }, 'kVA'),
      h('div', null, h('h1', null, 'Estimación de cargas eléctricas'),
        h('small', { id: 'subtitulo' }, S.proyecto.nombre + ' · ' + P.etiqueta))));
    const inp = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { try { Store.importar(rd.result); location.reload(); } catch (err) { alert(err.message); } };
      rd.readAsText(f);
    } });
    head.appendChild(h('div', { class: 'actions no-print' },
      h('button', { class: 'btn small', onclick: () => descargar('cargas-proyecto.json', Store.exportar(), 'application/json') }, 'Exportar proyecto'),
      h('button', { class: 'btn small', onclick: () => inp.click() }, 'Importar'),
      h('button', { class: 'btn small danger', onclick: () => { if (confirm('Se reemplazará el proyecto actual por el ejemplo (Sector A de la hoja de Excel). ¿Continuar?')) { Store.ejemplo(); location.reload(); } } }, 'Cargar ejemplo'),
      inp));
    const nav = document.getElementById('tabs');
    PAGES.forEach(p => nav.appendChild(h('a', { class: 'tab', href: p[0], 'aria-current': p[0] === id ? 'page' : null }, p[1])));
  }

  /** Selector de sector compartido por Departamentos y Servicios. */
  function selectorSector(onchange) {
    const S = Store.state;
    const sel = h('select', { 'aria-label': 'Sector', onchange: () => { S.activo = sel.value; Store.save(); onchange(); } },
      S.sectores.map(s => h('option', { value: s.id, selected: s.id === S.activo }, s.nombre)));
    return sel;
  }

  g.C = { h, fmt, pct, toast, descargar, csv, shell, selectorSector, init(id, fn) { Store.load(); shell(id); fn(); } };
})(window);
