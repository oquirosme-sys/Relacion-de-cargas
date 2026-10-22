/* Página Servicios: cargas preliminares de servicios propios / áreas no residenciales.
   Cada espacio = área × % aplicado × densidades (VA/m²) por tipo de carga + cargas fijas (VA). */
(function () {
  'use strict';
  const h = C.h, fmt = C.fmt;
  let elevRefs = [], elevTot = null;

  function render() {
    const root = document.getElementById('view');
    root.textContent = '';
    elevTot = null;
    const P = Store.state.params, sec = Store.sector(), art = P.art;
    root.appendChild(C.barraSector(render));
    root.appendChild(h('h2', null, 'Cargas preliminares de baja tensión · servicios'));
    root.appendChild(h('p', { class: 'hint' }, 'Sistema del proyecto: ' + P.vUnit + ' V · ' + (Number(P.fases) === 3 ? 'trifásico' : 'monofásico') + ' (se cambia en la página Proyecto).'));

    if (sec.modo === 'resumen') return resumen(root, sec, P);

    root.appendChild(h('p', { class: 'hint' },
      'Cada renglón es un espacio: área × % aplicado × densidad de carga (VA/m²) de alumbrado, contactos UPS, contactos y A/A. Elija el tipo de espacio para cargar sus densidades por defecto (editables en Parámetros NEC) o escriba un valor propio en la celda. ' +
      '“% aplicado” escala el área o la densidad del espacio (100 % = completa). Equipos y especiales se capturan en VA. Los elevadores van en su propia tabla.'));

    const dl = h('datalist', { id: 'grupos' });
    const sync = () => { dl.textContent = ''; [...new Set(sec.servicios.map(r => r.grupo).filter(Boolean))].forEach(g => dl.appendChild(h('option', { value: g }))); };
    sync();

    const cols = [['Nivel', 'in'], ['Espacio / servicio', 'in'], ['Área [m²]', 'in'], ['% aplicado', 'in'], ['Tipo de espacio', 'in'],
      ['Alumbrado [VA/m²]', 'in'], ['Contactos UPS [VA/m²]', 'in'], ['Contactos [VA/m²]', 'in'], ['HVAC [VA/m²]', 'in'], ['Equipos [VA]', 'in'], ['Especiales [VA]', 'in'], ['Incluir', 'in'],
      ['Alumbrado [kVA]', 'calc'], ['Contactos UPS [kVA]', 'calc'], ['Contactos [kVA]', 'calc'], ['HVAC [kVA]', 'calc'], ['Equipos y esp. [kVA]', 'calc'], ['C. instalada [kVA]', 'calc'],
      ['I inst. [A]', 'calc'], ['I prot. ×' + P.protFactor + ' [A]', 'calc'], ['Interruptor [A]', 'calc'], ['', 'no-print']];
    const thead = h('thead', null, h('tr', null, cols.map(c => h('th', { class: c[1] }, c[0]))));
    const tbody = h('tbody'), tfoot = h('tfoot'), refs = [];

    function fila(r) {
      const out = {}, ins = {};
      const cell = k => (out[k] = h('td', { class: 'calc r' }));
      const dens = (k, label) => (ins[k] = C.numInput(r, k, { label, after: refresh }));
      const ocSel = h('select', { 'aria-label': 'Tipo de espacio', onchange: e => { r.tipo = e.target.value; Store.save(); refresh(); } },
        P.ocupaciones.map(o => h('option', { value: o.id, selected: o.id === r.tipo }, o.n)));
      const tr = h('tr', null,
        h('td', { class: 'in' }, C.textInput(r, 'grupo', { list: 'grupos', label: 'Nivel', after: () => { sync(); refresh(); } })),
        h('td', { class: 'in' }, C.textInput(r, 'nombre', { label: 'Espacio / servicio' })),
        h('td', { class: 'in' }, C.numInput(r, 'area', { label: 'Área', after: refresh })),
        h('td', { class: 'in' }, C.numInput(r, 'pct', { ph: '100', label: '% aplicado', after: refresh })),
        h('td', { class: 'in' }, ocSel),
        h('td', { class: 'in' }, dens('dLuz', 'Alumbrado')), h('td', { class: 'in' }, dens('dUps', 'Contactos UPS')),
        h('td', { class: 'in' }, dens('dRec', 'Contactos')), h('td', { class: 'in' }, dens('dHvac', 'HVAC')),
        h('td', { class: 'in' }, C.numInput(r, 'eq', { ph: '0', label: 'Equipos', vacio: 0, after: refresh })),
        h('td', { class: 'in' }, C.numInput(r, 'esp', { ph: '0', label: 'Especiales', vacio: 0, after: refresh })),
        h('td', { class: 'in c' }, h('input', { type: 'checkbox', checked: r.incl !== false, 'aria-label': 'Incluir en totales', onchange: e => { r.incl = e.target.checked; Store.save(); refresh(); } })),
        cell('luz'), cell('ups'), cell('rec'), cell('hvac'), cell('eqesp'), cell('ci'), cell('iInst'), cell('iProt'), cell('brk'),
        h('td', { class: 'no-print nowrap' },
          h('button', { class: 'btn small', title: 'Duplicar', onclick: () => { const c = JSON.parse(JSON.stringify(r)); c.id = Store.uid(); sec.servicios.splice(sec.servicios.indexOf(r) + 1, 0, c); Store.save(); render(); } }, '⧉'),
          h('button', { class: 'btn small danger', title: 'Eliminar', onclick: () => { sec.servicios.splice(sec.servicios.indexOf(r), 1); Store.save(); render(); } }, '✕')));
      refs.push({ r, tr, out, ins });
      return tr;
    }
    sec.servicios.forEach(r => tbody.appendChild(fila(r)));

    const box = h('div', { class: 'card' });
    function refresh() {
      sync();
      const T = { area: 0, luz: 0, ups: 0, rec: 0, hvac: 0, eqesp: 0, ci: 0 };
      refs.forEach(x => {
        const c = NEC.calcServicio(x.r, P), o = x.out;
        o.luz.textContent = fmt(c.luz / 1000, 3); o.ups.textContent = fmt(c.ups / 1000, 3); o.rec.textContent = fmt(c.rec / 1000, 3);
        o.hvac.textContent = fmt(c.hvac / 1000, 3); o.eqesp.textContent = fmt((c.eq + c.esp) / 1000, 3); o.ci.textContent = fmt(c.ci / 1000, 3);
        o.iInst.textContent = fmt(c.iInst, 1); o.iProt.textContent = fmt(c.iProt, 1); o.brk.textContent = c.brk === null ? 'excede tabla' : c.brk;
        x.ins.dLuz.placeholder = fmt(c.dLuz, 1); x.ins.dUps.placeholder = fmt(c.dUps, 1); x.ins.dRec.placeholder = fmt(c.dRec, 1); x.ins.dHvac.placeholder = fmt(c.dHvac, 1);
        x.tr.classList.toggle('off', x.r.incl === false);
        if (x.r.incl !== false) { T.area += c.area; T.luz += c.luz; T.ups += c.ups; T.rec += c.rec; T.hvac += c.hvac; T.eqesp += c.eq + c.esp; T.ci += c.ci; }
      });
      tfoot.textContent = '';
      tfoot.appendChild(h('tr', { class: 'tot' }, h('td', { colspan: 2 }, 'TOTAL'), h('td', { class: 'r' }, fmt(T.area, 2)), h('td', { colspan: 9 }),
        ['luz', 'ups', 'rec', 'hvac', 'eqesp', 'ci'].map(k => h('td', { class: 'r' }, fmt(T[k] / 1000, 3))), h('td', { colspan: 4 })));
      refElev();
      box.textContent = '';
      box.appendChild(cuadro(NEC.resumenServicios(sec, P), P));
    }

    const tabla = h('table', { class: 'grid freeze2' }, thead, tbody, tfoot);
    C.fillDown(tabla);
    const envol = h('div', { class: 'tablewrap big' }, tabla);
    root.appendChild(C.scrollSuperior(envol));
    root.appendChild(envol);
    root.appendChild(dl);
    root.appendChild(h('div', { class: 'toolbar no-print' },
      h('button', { class: 'btn primary', onclick: () => { const l = sec.servicios[sec.servicios.length - 1]; const n = Store.nuevaFilaServicio(l && l.grupo); if (l) n.tipo = l.tipo; sec.servicios.push(n); Store.save(); render(); } }, '+ Agregar espacio'),
      h('span', { class: 'hint' }, 'Para copiar un valor hacia abajo como en Excel: arrastre el cuadrito de la esquina de la celda activa (doble clic = hasta el final) o use Ctrl+D.')));

    // Factores de demanda del sector
    const f = (k, l, hint) => h('label', null, h('span', null, l), C.numInput(sec.fdServ, k, { ph: fmt(P[k], 2), step: '0.05', label: l, after: refresh }), h('small', { class: 'hint' }, hint));
    root.appendChild(h('h3', { class: 'sp' }, 'Factores de demanda de este nivel / sector'));
    root.appendChild(h('div', { class: 'card form' },
      f('fdLuz', 'Alumbrado', 'Tabla ' + art + '.42: 100 % salvo ocupaciones listadas'),
      P.rec44 ? h('label', null, h('span', null, 'Contactos'), h('div', { class: 'static' }, 'Tabla ' + art + '.44 (10 kVA al 100 %, resto al 50 %)')) : f('fdRec', 'Contactos (generales y UPS)', 'criterio de proyecto'),
      f('fdEq', 'Equipos', '430.24 / 430.26'), f('fdEsp', 'Equipos especiales', 'placa de datos'), f('fdHvac', 'Fuerza (sistema de A/A)', art + '.60 / 430.26')));
    root.appendChild(h('p', { class: 'hint' }, 'Vacío = valor por defecto del perfil activo (Parámetros NEC). Los valores escritos aquí solo afectan a este nivel / sector.'));

    root.appendChild(h('h3', { class: 'sp' }, 'Elevadores · Tabla 620.14'));
    root.appendChild(elevadores(sec, P, refresh));

    root.appendChild(h('h3', { class: 'sp' }, 'Cuadro de cargas (servicios)'));
    root.appendChild(box);
    refresh();
  }

  function refElev() {
    if (!elevTot) return;
    const sec = Store.sector(), P = Store.state.params, E = NEC.calcElevadores(sec, P);
    E.rows.forEach((r, i) => {
      const o = elevRefs[i]; if (!o) return;
      o.kwU.textContent = fmt(r.kwU, 2); o.kw.textContent = fmt(r.kw, 2); o.kva.textContent = fmt(r.kva, 2);
      o.fd.placeholder = fmt(E.fdBase, 2); o.cdKw.textContent = fmt(r.cdKw, 2); o.cdKva.textContent = fmt(r.cdKva, 2);
    });
    elevTot.textContent = E.rows.length ? 'Total: ' + E.nTot + ' elevadores · ' + fmt(E.kw, 2) + ' kW · ' + fmt(E.kva, 2) + ' kVA instalados · demanda ' + fmt(E.cdKva, 2) + ' kVA (' + fmt(E.cdKw, 2) + ' kW)' : 'Sin elevadores en este sector.';
  }

  function elevadores(sec, P, refresh) {
    elevRefs = [];
    const tb = h('tbody');
    sec.elevadores.forEach(e => {
      const o = {}, c = k => (o[k] = h('td', { class: 'calc r' }));
      elevRefs.push(o);
      o.fd = C.numInput(e, 'fd', { step: '0.05', label: 'Factor de demanda', after: refresh });
      tb.appendChild(h('tr', null,
        h('td', { class: 'in' }, C.textInput(e, 'desc', { label: 'Descripción' })),
        h('td', { class: 'in' }, C.numInput(e, 'hp', { label: 'Capacidad [HP]', after: refresh })),
        h('td', { class: 'in' }, C.numInput(e, 'qty', { label: 'Cantidad', step: '1', after: refresh })),
        c('kwU'), c('kw'), c('kva'), h('td', { class: 'in' }, o.fd), c('cdKw'), c('cdKva'),
        h('td', { class: 'no-print' }, h('button', { class: 'btn small danger', title: 'Eliminar', onclick: () => { sec.elevadores.splice(sec.elevadores.indexOf(e), 1); Store.save(); render(); } }, '✕'))));
    });
    elevTot = h('p', { class: 'hint' });
    const thead = h('thead', null, h('tr', null, [['Descripción', 'in'], ['Capacidad [HP]', 'in'], ['Cantidad', 'in'], ['kW c/u', 'calc'], ['Carga total [kW]', 'calc'], ['Carga total [kVA]', 'calc'], ['F.D.', 'in'], ['Demandada [kW]', 'calc'], ['Demandada [kVA]', 'calc'], ['', 'no-print']].map(x => h('th', { class: x[1] }, x[0]))));
    return h('div', null,
      h('div', { class: 'tablewrap' }, h('table', { class: 'grid' }, thead, tb)),
      h('div', { class: 'toolbar no-print' },
        h('button', { class: 'btn', onclick: () => { sec.elevadores.push({ desc: '', hp: 0, qty: 1, fd: null }); Store.save(); render(); } }, '+ Agregar elevadores'),
        h('span', { class: 'hint' }, 'kW = HP × 0,746. F.D. vacío = ' + (P.elevAuto ? 'Tabla 620.14 según el n.º de elevadores' : 'el valor del perfil (' + fmt(P.fdElev, 2) + ')') + '.')),
      elevTot);
  }

  function cuadro(s, P) {
    const tr = NEC.transformador(s.cd, P);
    const rows = s.cats.map(c => h('tr', null, h('td', null, c.n), h('td', null, c.ref), h('td', { class: 'r' }, fmt(c.ci, 2)), h('td', { class: 'r' }, fmt(c.ci * P.pf, 2)),
      h('td', { class: 'r' }, C.pct(c.fd)), h('td', { class: 'r' }, fmt(c.cd, 2)), h('td', { class: 'r' }, fmt(c.cd * P.pf, 2))));
    rows.push(h('tr', { class: 'tot' }, h('td', null, 'TOTAL'), h('td'), h('td', { class: 'r' }, fmt(s.ci, 2)), h('td', { class: 'r' }, fmt(s.kwCi, 2)),
      h('td', { class: 'r' }, C.pct(s.ci ? s.cd / s.ci : 0)), h('td', { class: 'r' }, fmt(s.cd, 2)), h('td', { class: 'r' }, fmt(s.kwCd, 2))));
    return h('div', null,
      h('table', { class: 'grid res' },
        h('thead', null, h('tr', null, ['Tipo de carga', 'Norma', 'C.I. [kVA]', 'C.I. [kW]', 'F.D.', 'C.D. [kVA]', 'C.D. [kW]'].map(x => h('th', { class: 'calc' }, x)))),
        h('tbody', null, rows)),
      h('p', { class: 'kpis' },
        h('span', null, 'Factor de potencia: ', h('b', null, fmt(P.pf, 2))),
        h('span', null, 'Carga instalada: ', h('b', null, fmt(s.ci, 2) + ' kVA')),
        h('span', null, 'Carga demandada: ', h('b', null, fmt(s.cd, 2) + ' kVA / ' + fmt(s.kwCd, 2) + ' kW')),
        h('span', null, 'Transformador mínimo: ', h('b', null, tr.n ? (tr.n > 1 ? tr.n + ' × ' : '') + fmt(tr.size, 1) + ' kVA' : '—'))));
  }

  function resumen(root, sec, P) {
    root.appendChild(h('p', { class: 'hint' }, 'Modo resumen: capture los totales instalados de servicios y su factor de demanda. Vacío = F.D. por defecto (' + C.pct(P.svcFD) + ').'));
    const box = h('div', { class: 'card' });
    const upd = () => {
      const s = NEC.resumenServicios(sec, P), tr = NEC.transformador(s.cd, P);
      box.textContent = '';
      box.appendChild(h('p', { class: 'kpis' }, h('span', null, 'Carga instalada: ', h('b', null, fmt(s.ci, 2) + ' kVA')),
        h('span', null, 'Carga demandada: ', h('b', null, fmt(s.cd, 2) + ' kVA / ' + fmt(s.kwCd, 2) + ' kW')),
        h('span', null, 'Transformador mínimo: ', h('b', null, tr.n ? (tr.n > 1 ? tr.n + ' × ' : '') + fmt(tr.size, 1) + ' kVA' : '—'))));
    };
    const r = sec.resumen;
    root.appendChild(h('div', { class: 'card form' },
      h('label', null, h('span', null, 'C.I. alumbrado, contactos y equipos [kVA]'), C.numInput(r, 'svLC', { vacio: 0, after: upd, label: 'C.I. alumbrado y contactos' })),
      h('label', null, h('span', null, 'F.D. alumbrado, contactos y equipos'), C.numInput(r, 'svFDlc', { ph: fmt(P.svcFD, 2), step: '0.05', after: upd, label: 'FD alumbrado' })),
      h('label', null, h('span', null, 'C.I. A/A (HVAC) [kVA]'), C.numInput(r, 'svAC', { vacio: 0, after: upd, label: 'C.I. A/A' })),
      h('label', null, h('span', null, 'F.D. A/A'), C.numInput(r, 'svFDac', { ph: fmt(P.svcFD, 2), step: '0.05', after: upd, label: 'FD A/A' }))));
    root.appendChild(box); upd();
  }

  C.init('servicios.html', render);
})();
