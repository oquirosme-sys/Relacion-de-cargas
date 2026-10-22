/* Caja de detalle de una vivienda: cargas generales, dos listas de dispositivos (100 % y factor 220.53),
   HVAC, factor de diversidad y cálculo del alimentador. */
(function () {
  'use strict';
  const h = C.h, fmt = C.fmt;
  const COPIA = ['sistema', 'dens', 'recDw', 'extDw', 'sac', 'lav', 'gfci', 'telecom', 'detect', 'hvacDens', 'manej', 'hvac', 'coc', 'cal', 'apar', 'esp', 'divFD'];

  C.abrirDetalle = function (r, sec, alCerrar) {
    const P = Store.state.params, art = P.art;
    const dlg = h('dialog', { class: 'detalle', 'aria-label': 'Detalle de la vivienda' });
    const upds = [];
    const upd = () => upds.forEach(f => f());
    const out = get => { const td = h('td', { class: 'calc r' }); upds.push(() => { td.textContent = get(NEC.calcDepto(r, P)); }); return td; };

    function draw() {
      dlg.textContent = ''; upds.length = 0;
      const gen = [
        ['Circuitos de iluminación', 'dens', 'VA/m²', P.lightVA, c => c.light],
        ['Circuitos de tomacorrientes de uso general', 'recDw', 'VA/m²', P.recDwVAm2, c => c.recDw],
        ['Circuitos de tomacorrientes exteriores', 'extDw', 'VA/m²', P.extDwVAm2, c => c.ext],
        ['Circuitos de tomacorrientes de cocina', 'sac', 'VA', P.sacN * P.sacVA, c => c.sac],
        ['Circuitos de tomacorrientes de lavandería', 'lav', 'VA', P.lavVA, c => c.lav],
        ['Circuitos de tomacorrientes de baños', 'gfci', 'VA', P.gfciVA, c => c.gfci],
        ['Circuito gabinete telecom', 'telecom', 'VA', P.telecomVA, c => c.telecom],
        ['Circuito detectores', 'detect', 'VA', P.detectVA, c => c.detect]];
      const genRows = gen.map(g => h('tr', null, h('td', null, g[0]),
        h('td', { class: 'in' }, C.numInput(r, g[1], { ph: fmt(g[3], 0), label: g[0], after: upd })), h('td', { class: 'muted' }, g[2]),
        out(c => fmt(g[4](c) / 1000, 3))));

      // Listas de dispositivos
      const cat = P.catalogo.slice().sort((a, b) => a.n.localeCompare(b.n, 'es'));
      const hayLista = () => (r.disp && r.disp.length) || (r.disp53 && r.disp53.length);
      function lista(key, titulo, ayuda) {
        const lineasDe = c => (key === 'disp' ? c.dv.lines : c.dv.lines53);
        const rows = (r[key] || []).map((d, i) => h('tr', null,
          h('td', { class: 'in' }, h('select', { 'aria-label': 'Dispositivo', onchange: e => { d.id = e.target.value; d.kva = null; Store.save(); draw(); } },
            cat.map(it => h('option', { value: it.id, selected: it.id === d.id }, it.n)))),
          h('td', { class: 'in' }, C.numInput(d, 'qty', { ph: '1', step: '1', label: 'Cantidad', after: upd })),
          h('td', { class: 'in' }, C.numInput(d, 'kva', { ph: fmt((cat.find(x => x.id === d.id) || { kva: 0 }).kva, 2), label: 'kVA c/u', after: upd })),
          out(c => { const l = lineasDe(c)[i]; return l ? fmt(l.tot / 1000, 3) : ''; }),
          h('td', null, h('button', { class: 'btn small danger', title: 'Quitar', onclick: () => { r[key].splice(i, 1); Store.save(); draw(); } }, '✕'))));
        const add = h('select', { 'aria-label': 'Agregar a ' + titulo, onchange: e => {
          if (!e.target.value) return;
          if (!hayLista()) { r.coc = r.cal = r.apar = r.esp = null; }
          if (!r[key]) r[key] = [];
          r[key].push({ id: e.target.value, qty: 1, kva: null }); Store.save(); draw();
        } }, h('option', { value: '' }, '+ Agregar dispositivo…'), cat.map(i => h('option', { value: i.id }, i.n)));
        return h('div', null,
          h('h4', null, titulo),
          h('table', { class: 'grid' }, h('thead', null, h('tr', null, h('th', { class: 'in' }, 'Dispositivo'), h('th', { class: 'in' }, 'Cant.'), h('th', { class: 'in' }, 'kVA c/u'), h('th', { class: 'calc' }, 'kVA'), h('th'))), h('tbody', null, rows)),
          h('div', { class: 'toolbar' }, add, h('span', { class: 'hint' }, ayuda)));
      }

      function selSistema() {
        return h('select', { 'aria-label': 'Sistema eléctrico de la vivienda', title: 'Por defecto el del proyecto', onchange: e => { r.sistema = e.target.value === '' ? null : e.target.value; Store.save(); draw(); } },
          h('option', { value: '', selected: !r.sistema }, 'Proyecto (' + NEC.nombreSistema(P.vUnit, P.fases) + ')'),
          NEC.SISTEMAS.map(x => h('option', { value: x.id, selected: r.sistema === x.id }, x.n)));
      }
      const res = (n, get, cls) => h('tr', { class: cls }, h('td', { colspan: 2 }, n), out(get));
      const dv0 = NEC.dispositivos(r, P);
      const copiar = h('select', { 'aria-label': 'Copiar a' },
        h('option', { value: '' }, 'Copiar esta configuración a…'),
        h('option', { value: 'grupo' }, 'las viviendas del mismo nivel / tipo'),
        h('option', { value: 'sector' }, 'todas las viviendas del nivel / sector'));
      const btnCopiar = h('button', { class: 'btn', onclick: () => {
        if (!copiar.value) return;
        const dest = sec.deptos.filter(x => x !== r && (copiar.value === 'sector' || x.grupo === r.grupo));
        if (!dest.length) { C.toast('No hay otras viviendas para copiar.'); return; }
        if (!confirm('Se reemplazarán las cargas generales, dispositivos y A/A de ' + dest.length + ' vivienda(s). El área y el nombre no cambian. ¿Continuar?')) return;
        dest.forEach(x => {
          COPIA.forEach(k => { x[k] = r[k] === undefined ? null : r[k]; });
          x.disp = JSON.parse(JSON.stringify(r.disp || [])); x.disp53 = JSON.parse(JSON.stringify(r.disp53 || []));
        });
        Store.save(); C.toast('Copiado a ' + dest.length + ' vivienda(s).');
      } }, 'Copiar');

      dlg.appendChild(h('div', { class: 'dform' },
        h('div', { class: 'dhead' },
          h('div', { class: 'dtitle' }, h('h3', null, 'Cargas de la vivienda', r.grupo ? h('small', { class: 'muted' }, ' · ' + r.grupo) : null)),
          h('div', { class: 'toolbar' },
            h('label', { class: 'inline' }, h('span', null, 'Nombre'), C.textInput(r, 'nombre', { label: 'Nombre de la vivienda', ph: 'DEPTO A1' })),
            h('label', { class: 'inline' }, h('span', null, 'Área [m²]'), C.numInput(r, 'area', { label: 'Área', after: upd })),
            h('label', { class: 'inline' }, h('span', null, 'Sistema'), selSistema()))),
        h('div', { class: 'dgrid' },
          h('div', null,
            h('h4', null, 'Cargas generales'),
            h('table', { class: 'grid' }, h('thead', null, h('tr', null, h('th', null, 'Ítem'), h('th', { class: 'in' }, 'Valor'), h('th', null, ''), h('th', { class: 'calc' }, 'kVA'))), h('tbody', null, genRows)),
            h('h4', { class: 'sp' }, 'Cargas HVAC'),
            h('table', { class: 'grid' }, h('tbody', null,
              h('tr', null, h('td', null, 'Condensadoras [VA/m²]'), h('td', { class: 'in' }, C.numInput(r, 'hvacDens', { ph: fmt(P.hvacDwVAm2, 0), label: 'Densidad condensadoras', after: upd })), out(c => fmt(c.cond / 1000, 3))),
              h('tr', null, h('td', null, 'Manejadoras [% de condensadoras]'), h('td', { class: 'in' }, C.numInput(r, 'manej', { ph: fmt(P.manejPct, 0), label: 'Manejadoras %', after: upd })), out(c => fmt(c.manejVA / 1000, 3))),
              h('tr', null, h('td', null, 'Fuerza HVAC manual [VA] (si no hay densidad)'), h('td', { class: 'in' }, C.numInput(r, 'hvac', { ph: '0', label: 'HVAC manual', vacio: 0, after: upd })), h('td')))),
            h('h4', { class: 'sp' }, 'Factor de diversidad'),
            h('table', { class: 'grid' }, h('tbody', null,
              h('tr', null, h('td', null, 'F. diversidad (vacío = por defecto)'), h('td', { class: 'in' }, C.numInput(r, 'divFD', { ph: fmt(P.divFD, 2), step: '0.05', label: 'Factor de diversidad', after: upd })), out(c => fmt(c.divFD, 2)))))),
          h('div', null,
            lista('disp', 'Otros dispositivos (se suman al 100 %)', 'La categoría del catálogo decide el factor: tomas (refrigeradora, microondas) entran en la Tabla 220.42; cocina por 220.55; secadora por 220.54.'),
            h('div', { class: 'sp' }),
            lista('disp53', 'Dispositivos con factor ' + art + '.53 (aparatos fijos)', P.appl53Min + ' o más aparatos fijos (de ambas listas): se aplica ' + fmt(P.applFD * 100, 0) + ' %. No incluya cocinas, secadoras ni A/A.'),
            h('p', { class: 'hint' }, dv0.usa ? 'Con dispositivos en alguna lista, la cocina, el calentador, los aparatos fijos y los especiales de esta vivienda se toman de las listas (no de las columnas de la tabla).'
              : 'Sin dispositivos: se usan las columnas de la tabla (cocina ' + fmt(P.cocinaVA, 0) + ' VA y calentador ' + fmt(P.calentVA, 0) + ' VA por defecto).'),
            h('h4', { class: 'sp' }, 'Resultado'),
            h('table', { class: 'grid res' }, h('tbody', null,
              res('Tomas y cargas enchufadas [kVA]' + (P.metodoViv === 'estandar' ? ' (Tabla ' + art + '.42)' : ''), c => fmt(c.tomas / 1000, 2)),
              res('Cocina eléctrica [kVA]' + (P.art15Min ? ' (mín. Art. 15)' : ''), c => fmt(c.coc / 1000, 2)),
              res('Secadora [kVA]' + (P.metodoViv === 'estandar' ? ' (' + art + '.54)' : ''), c => fmt(c.secadora / 1000, 2)),
              res('Calentador de agua faltante hasta el mínimo del Art. 15 [kVA]', c => fmt(c.calExtra / 1000, 2)),
              res('Aplicación ' + art + '.53 [kVA]', c => fmt(c.aplic53 / 1000, 2)),
              res('Sub-total [kVA]', c => fmt(c.general / 1000, 2)),
              res(P.metodoViv === 'estandar' ? 'Aplicación Tablas ' + art + '.42, .53 y .55 [kVA]' : 'Aplicación ' + art + '.82(B) [kVA]', c => fmt(c.genDem / 1000, 2)),
              res('Manejadoras [kVA]', c => fmt(c.manejVA / 1000, 2)),
              res('Condensadoras / HVAC [kVA]', c => fmt(c.cond / 1000, 2)),
              res('kVA demanda (antes de diversidad)', c => fmt(c.dem0 / 1000, 2)),
              res('kVA totales', c => fmt(c.totales / 1000, 2)),
              res('F. de uso', c => fmt(c.fUso, 2)),
              res('F. de diversidad', c => fmt(c.divFD, 2)),
              res('kVA demanda', c => fmt(c.dem / 1000, 2), 'tot'),
              res('Amperios [' + (NEC.SISTEMAS.find(x => x.id === r.sistema) ? NEC.SISTEMAS.find(x => x.id === r.sistema).v : P.vUnit) + ' V, ' + (Number((NEC.SISTEMAS.find(x => x.id === r.sistema) || { f: P.fases }).f) === 3 ? '3 fases' : '1 fase') + ']', c => fmt(c.iDem, 1)),
              res('× ' + P.protFactor + ' [A]', c => fmt(c.iProt, 1)),
              res('OCPD [A]', c => c.brk === null ? 'excede tabla' : c.brk, 'tot'),
              res('Calibre cobre', c => c.cu ? c.cu.cu : '—'),
              res('Calibre aluminio', c => c.cu ? c.cu.al : '—'))))),
        h('p', { class: 'hint' }, 'Espacio mínimo de cuartos principales (referencia): cuarto eléctrico ' + fmt(P.cuartoElecM2, 1) + ' m² · cuarto de telecomunicaciones ' + fmt(P.cuartoTelM2, 1) + ' m². Se cambian en Parámetros NEC.'),
        h('div', { class: 'dfoot' },
          h('label', { class: 'inline' }, copiar, btnCopiar), h('span', { class: 'grow' }),
          h('button', { class: 'btn primary', onclick: () => { dlg.close(); fin(); } }, 'Cerrar'))));
      upd();
    }

    let cerrado = false;
    const fin = () => { if (cerrado) return; cerrado = true; dlg.remove(); if (alCerrar) alCerrar(); };
    dlg.addEventListener('close', fin);
    document.body.appendChild(dlg);
    draw();
    dlg.showModal();
  };
})();
