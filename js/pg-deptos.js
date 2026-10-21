/* Página Departamentos: cargas preliminares de baja tensión por vivienda. */
(function () {
  'use strict';
  const h = C.h, fmt = C.fmt;

  function render() {
    const root = document.getElementById('view');
    root.textContent = '';
    const P = Store.state.params, sec = Store.sector(), art = P.art;
    root.appendChild(C.barraSector(render));
    root.appendChild(h('h2', null, 'Cargas preliminares de baja tensión · viviendas · ' + sec.nombre));

    if (sec.modo === 'resumen') return resumen(root, sec, P);

    root.appendChild(h('p', { class: 'hint' },
      'Haga clic en el nombre de una vivienda (DEPTO A1…) para abrir su caja: cargas generales, dispositivos de una lista y resultado del alimentador. Celdas en verde = datos de entrada. Alumbrado ' + P.lightVA + ' VA/m² (' + P.refLight + '), contactos de aparatos pequeños ' + P.sacN + '×' + P.sacVA + ' VA (' + art + '.52(A)), lavandería ' + P.lavVA + ' VA (' + art + '.52(B)), cocina eléctrica ' + P.cocinaVA + ' VA y calentador de agua ' + P.calentVA + ' VA (mínimos del Art. 15 del reglamento de Costa Rica). ' +
      'Alimentador por vivienda con el método opcional ' + art + '.82(B): primeros ' + fmt(P.tier1, 0) + ' VA al 100 % y el resto al ' + fmt(P.restFD * 100, 0) + ' %, más A/A. ' +
      'Las celdas vacías usan el valor por defecto de Parámetros NEC.'));

    const dl = h('datalist', { id: 'grupos' });
    const sync = () => { dl.textContent = ''; [...new Set(sec.deptos.map(r => r.grupo).filter(Boolean))].forEach(g => dl.appendChild(h('option', { value: g }))); };
    sync();

    const cols = [
      ['Nivel / tipo', ''], ['Vivienda', ''], ['Área [m²]', ''], ['Alumbrado [VA/m²]', ''], ['Contactos aparatos peq. [VA]', art + '.52(A)'],
      ['Lavandería [VA]', art + '.52(B)'], ['Baño GFCI [VA]', '210.11(C)(3)'], ['Equipos especiales [VA]', 'jacuzzi, etc.'], ['Aparatos fijos [VA]', art + '.53'],
      ['Cocina eléctrica [VA]', art + '.55'], ['Calentador de agua [VA]', art + '.53'],
      ['Fuerza HVAC [VA]', ''], ['Incluir', ''],
      ['Alumbrado [VA]', ''], ['Carga instalada [kVA]', ''], ['Demanda gral. [VA]', 'opcional ' + art + '.82'], ['Demanda total [kVA]', ''],
      ['I inst. [A]', ''], ['I dem. [A]', ''], ['I prot. [A]', '×' + P.protFactor], ['Interruptor 2P [A]', ''], ''
    ];
    const thead = h('thead', null, h('tr', null, cols.map((c, i) => h('th', { class: i < 13 ? 'in' : (i === 21 ? 'no-print' : 'calc') }, c[0] || '', c[1] ? h('small', null, c[1]) : null))));
    const tbody = h('tbody');
    const tfoot = h('tfoot');
    const refs = [];

    function fila(r) {
      const out = {};
      const ins = {};
      const num = (k, ph, label) => h('td', { class: 'in' }, (ins[k] = C.numInput(r, k, { ph, label, after: refresh })));
      const cell = k => (out[k] = h('td', { class: 'calc r' }));
      const tr = h('tr', null,
        h('td', { class: 'in' }, C.textInput(r, 'grupo', { list: 'grupos', label: 'Nivel / tipo', after: () => { sync(); refresh(); } })),
        h('td', { class: 'name' }, (out.btn = h('button', { class: 'namebtn', title: 'Clic para abrir la caja de cargas y dispositivos de esta vivienda',
          onclick: () => C.abrirDetalle(r, sec, refresh) }, ''))),
        num('area', '', 'Área'),
        num('dens', fmt(P.lightVA, 0), 'Densidad alumbrado'),
        num('sac', fmt(P.sacN * P.sacVA, 0), 'Contactos aparatos pequeños'),
        num('lav', fmt(P.lavVA, 0), 'Lavandería'),
        num('gfci', fmt(P.gfciVA, 0), 'GFCI'),
        num('esp', '0', 'Equipos especiales'),
        num('apar', '0', 'Aparatos fijos'),
        num('coc', fmt(P.cocinaVA, 0), 'Cocina eléctrica'),
        num('cal', fmt(P.calentVA, 0), 'Calentador de agua'),
        num('hvac', '0', 'HVAC'),
        h('td', { class: 'in c' }, h('input', { type: 'checkbox', checked: r.incl !== false, 'aria-label': 'Incluir en totales', onchange: e => { r.incl = e.target.checked; Store.save(); refresh(); } })),
        cell('light'), cell('ci'), cell('genDem'), cell('dem'), cell('iInst'), cell('iDem'), cell('iProt'), cell('brk'),
        h('td', { class: 'no-print nowrap' },
          h('button', { class: 'btn small', title: 'Duplicar', onclick: () => { const i = sec.deptos.indexOf(r); const c = JSON.parse(JSON.stringify(r)); c.id = Store.uid(); sec.deptos.splice(i + 1, 0, c); Store.save(); render(); } }, '⧉'),
          h('button', { class: 'btn small danger', title: 'Eliminar', onclick: () => { sec.deptos.splice(sec.deptos.indexOf(r), 1); Store.save(); render(); } }, '✕')));
      refs.push({ r, tr, out, ins });
      return tr;
    }
    sec.deptos.forEach(r => tbody.appendChild(fila(r)));

    function refresh() {
      sync();
      let prev = null;
      refs.forEach(x => {
        const c = NEC.calcDepto(x.r, P);
        const o = x.out;
        o.btn.textContent = (x.r.nombre || '(sin nombre)') + (c.dv.usa ? '  ▸ ' + c.dv.lines.length + ' disp.' : '  ▸');
        o.btn.classList.toggle('usa', c.dv.usa);
        ['esp', 'apar', 'coc', 'cal'].forEach(k => {
          const el = x.ins[k]; el.disabled = c.dv.usa;
          if (c.dv.usa) el.placeholder = fmt(c[k], 0);
        });
        const hd = x.r.hvacDens !== null && x.r.hvacDens !== undefined && x.r.hvacDens !== '' ? x.r.hvacDens : P.hvacDwVAm2;
        x.ins.hvac.disabled = hd > 0; if (hd > 0) x.ins.hvac.placeholder = fmt(c.hvac, 0);
        o.light.textContent = fmt(c.light, 0);
        o.ci.textContent = fmt(c.ci / 1000, 3);
        o.genDem.textContent = fmt(c.genDem, 0);
        o.dem.textContent = fmt(c.dem / 1000, 3);
        o.iInst.textContent = fmt(c.iInst, 1);
        o.iDem.textContent = fmt(c.iDem, 1);
        o.iProt.textContent = fmt(c.iProt, 1);
        o.brk.textContent = c.brk === null ? 'excede tabla' : c.brk;
        x.tr.classList.toggle('off', x.r.incl === false);
        x.tr.classList.toggle('newgrp', x.r.grupo !== prev);
        prev = x.r.grupo;
      });
      const d = NEC.resumenDeptos(sec, P);
      tfoot.textContent = '';
      tfoot.appendChild(h('tr', { class: 'tot' },
        h('td', { colspan: 2 }, 'TOTAL (' + d.n + ' viviendas incluidas)'),
        h('td', { class: 'r' }, fmt(sec.deptos.reduce((a, r) => a + (r.incl === false ? 0 : (+r.area || 0)), 0), 2)),
        h('td', { colspan: 10 }),
        h('td', null, ''), h('td', { class: 'r' }, fmt(d.ci, 3)),
        h('td', { colspan: 7 })));
      resumenBox.textContent = '';
      resumenBox.appendChild(tablaResumen(d, P, art));
    }

    const resumenBox = h('div', { class: 'card' });
    const tabla = h('table', { class: 'grid freeze2' }, thead, tbody, tfoot);
    C.fillDown(tabla);
    const envol = h('div', { class: 'tablewrap big' }, tabla);
    root.appendChild(C.scrollSuperior(envol));
    root.appendChild(envol);
    root.appendChild(dl);
    root.appendChild(h('div', { class: 'toolbar no-print' },
      h('button', { class: 'btn primary', onclick: () => { const last = sec.deptos[sec.deptos.length - 1]; sec.deptos.push(Store.nuevaFilaDepto(last && last.grupo)); Store.save(); render(); } }, '+ Agregar vivienda'),
      h('span', { class: 'hint' }, 'Para copiar un valor hacia abajo como en Excel: arrastre el cuadrito de la esquina de la celda activa (doble clic = hasta el final) o use Ctrl+D.')));
    root.appendChild(h('h3', { class: 'sp' }, 'Resumen de relación de cargas del ' + sec.nombre + ' (viviendas)'));
    root.appendChild(resumenBox);
    root.appendChild(notas(P, art));
    refresh();
  }

  function tablaResumen(d, P, art) {
    const fila = (n, ref, ci, ciKw, fd, cdKw, cdKva, bold) => h('tr', { class: bold ? 'tot' : null },
      h('td', null, n), h('td', null, ref), h('td', { class: 'r' }, fmt(ci, 2)), h('td', { class: 'r' }, fmt(ciKw, 2)),
      h('td', { class: 'r' }, fd), h('td', { class: 'r' }, fmt(cdKw, 2)), h('td', { class: 'r' }, fmt(cdKva, 2)));
    const fdLC = d.ciLC ? d.cdLC / d.ciLC : 0, fdT = d.ci ? d.cd / d.ci : 0;
    const tr = NEC.transformador(d.cd, P);
    return h('div', null,
      h('table', { class: 'grid res' },
        h('thead', null, h('tr', null, ['Tipo de carga', 'Referencia', 'C.I. [kVA]', 'C.I. [kW]', 'F.D.', 'C.D. [kW]', 'C.D. [kVA]'].map(x => h('th', { class: 'calc' }, x)))),
        h('tbody', null,
          fila('Alumbrado y contactos', 'Tabla ' + art + '.42', d.ciLC, d.kwCiLC, C.pct(fdLC), d.kwCdLC, d.cdLC),
          fila('A/A (HVAC)', art + '.60 / ' + art + '.50', d.ciAC, d.kwCiAC, C.pct(P.hvacAggFD), d.kwCdAC, d.cdAC),
          fila('TOTAL', '', d.ci, d.kwCi, C.pct(fdT), d.kwCd, d.cd, true))),
      h('p', { class: 'kpis' },
        h('span', null, 'Carga instalada: ', h('b', null, fmt(d.ci, 2) + ' kVA')),
        h('span', null, 'Carga demandada: ', h('b', null, fmt(d.cd, 2) + ' kVA')),
        h('span', null, 'Transformador mínimo: ', h('b', null, tr.n ? (tr.n > 1 ? tr.n + ' × ' : '') + fmt(tr.size, 1) + ' kVA' : '—'))));
  }

  function resumen(root, sec, P) {
    const art = P.art;
    root.appendChild(h('p', { class: 'hint' }, 'Modo resumen: capture los totales instalados de las viviendas de este sector (por ejemplo, tomados de otra hoja). La demanda se calcula con los mismos factores de Parámetros NEC.'));
    const box = h('div', { class: 'card' });
    const upd = () => { box.textContent = ''; box.appendChild(tablaResumen(NEC.resumenDeptos(sec, P), P, art)); };
    root.appendChild(h('div', { class: 'card form' },
      h('label', null, h('span', null, 'C.I. alumbrado y contactos [kVA]'), C.numInput(sec.resumen, 'depLC', { vacio: 0, after: upd, label: 'C.I. alumbrado y contactos' })),
      h('label', null, h('span', null, 'C.I. A/A (HVAC) [kVA]'), C.numInput(sec.resumen, 'depAC', { vacio: 0, after: upd, label: 'C.I. A/A' }))));
    root.appendChild(box); upd();
    root.appendChild(notas(P, art));
  }

  function notas(P, art) {
    return h('details', { class: 'notas' }, h('summary', null, 'Criterios de cálculo aplicados'),
      h('ul', null,
        h('li', null, 'Carga instalada de la vivienda = alumbrado general + contactos de aparatos pequeños + lavandería + baño GFCI + equipos especiales + aparatos fijos + HVAC.'),
        h('li', null, 'Demanda por vivienda (alimentador): método opcional ' + art + '.82(B): [mín(carga general; ' + fmt(P.tier1, 0) + ' VA) + resto × ' + P.restFD + '] × ' + P.genFD + ' + HVAC × ' + P.hvacFD + '. Se corrige la hoja original para que una vivienda con carga general menor al primer escalón no reciba un descuento negativo.'),
        h('li', null, 'Demanda del sector (transformador): Tabla ' + art + '.42 sobre alumbrado y contactos de todas las viviendas' + (P.tablaIncluyeEquipos ? ' (incluye equipos especiales y aparatos fijos, como la hoja original)' : '; aparatos fijos, equipos especiales y calentadores al ' + fmt(P.applFD * 100, 0) + ' % (' + art + '.53) y cocinas por Tabla ' + art + '.55') + '; HVAC × ' + P.hvacAggFD + '.'),
        h('li', null, 'Interruptor: corriente de protección = ' + P.protFactor + ' × I demandada, siguiente valor normalizado (240.6(A)), mínimo ' + P.minBreaker + ' A. Tensión ' + P.vUnit + ' V, ' + (Number(P.fases) === 3 ? 'trifásico' : 'monofásico') + '.'),
        h('li', null, 'Los resultados son estimaciones preliminares; confirme secciones y valores contra el texto oficial de la edición del NEC adoptada en el proyecto.')));
  }

  C.init('departamentos.html', render);
})();
