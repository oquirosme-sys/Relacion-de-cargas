/* Página Proyecto: datos generales y relación de cargas completa (todos los sectores). */
(function () {
  'use strict';
  const h = C.h, fmt = C.fmt;

  function render() {
    const root = document.getElementById('view');
    root.textContent = '';
    const S = Store.state, P = S.params, art = P.art;

    root.appendChild(h('h2', null, 'Proyecto'));
    const campo = (l, k, type) => h('label', null, h('span', null, l), C.textInput(S.proyecto, k, { label: l, after: () => { document.getElementById('subtitulo').textContent = (S.proyecto.nombre || 'Proyecto sin nombre') + ' · ' + P.etiqueta; } }));
    root.appendChild(h('div', { class: 'card form' }, campo('Nombre del proyecto', 'nombre'), campo('Ubicación', 'ubicacion'), campo('Fecha', 'fecha'), campo('Elaboró', 'responsable'),
      h('label', null, h('span', null, 'Edición del NEC'), h('div', { class: 'static' }, P.etiqueta, ' ', h('a', { href: 'parametros.html' }, 'cambiar'))) ));

    // Sistema eléctrico del proyecto: lo usan los alimentadores de viviendas y servicios
    const lblSis = h('b', null, NEC.nombreSistema(P.vUnit, P.fases));
    const actual = NEC.sistemaPorVF(P.vUnit, P.fases);
    const selSis = h('select', { 'aria-label': 'Sistema eléctrico del proyecto', onchange: e => {
      const x = NEC.SISTEMAS.find(y => y.id === e.target.value);
      if (!x) return;
      P.vUnit = x.v; P.fases = x.f; Store.save(); lblSis.textContent = x.n;
    } }, actual ? null : h('option', { value: '', selected: true }, 'Personalizado: ' + NEC.nombreSistema(P.vUnit, P.fases)),
      NEC.SISTEMAS.map(x => h('option', { value: x.id, selected: !!actual && actual.id === x.id }, x.n)));
    root.appendChild(h('div', { class: 'card form' },
      h('label', null, h('span', null, 'Sistema eléctrico del proyecto'), selSis,
        h('small', { class: 'hint' }, 'Configuración de tensión y fases del alimentador. Cada vivienda puede cambiarla en su caja.')),
      h('label', null, h('span', null, 'Sistema activo'), h('div', { class: 'static' }, lblSis, ' · valor por defecto de las cajas de vivienda y de Servicios'))));

    const R = NEC.resumenProyecto(S.sectores, P), T = R.tot;

    root.appendChild(h('h2', { class: 'sp' }, 'Relación de cargas completa'));
    const th = a => h('tr', null, a.map(x => h('th', { class: 'calc' }, x)));
    const rows = [];
    R.rows.forEach(r => {
      const sn = R.rows.length > 1 ? r.sec.nombre + (r.sec.modo === 'resumen' ? ' (resumen)' : '') : '';
      rows.push(h('tr', null, h('td', null, sn ? sn + ' · Viviendas' : 'Viviendas'), nums(r.dep.ciLC, r.dep.ciAC, r.dep.ci, r.dep.cdLC, r.dep.cdAC, r.dep.cd, r.depTr)));
      rows.push(h('tr', null, h('td', null, sn ? sn + ' · Servicios' : 'Servicios'), nums(r.sv.ciLC, r.sv.ciAC, r.sv.ci, r.sv.cdLC, r.sv.cdAC, r.sv.cd, r.svTr)));
    });
    rows.push(h('tr', { class: 'tot' }, h('td', null, 'SUMA DE NIVELES / SECTORES'),
      nums(sum(R, 'ciLC'), sum(R, 'ciAC'), sum(R, 'ci'), sum(R, 'cdLC'), sum(R, 'cdAC'), sum(R, 'cd'), null)));
    root.appendChild(h('div', { class: 'tablewrap' }, h('table', { class: 'grid res' },
      h('thead', null, th(['Nivel / sector · tipo', 'C.I. alumbrado y contactos [kVA]', 'C.I. A/A [kVA]', 'C.I. total [kVA]', 'C.D. alumbrado y contactos [kVA]', 'C.D. A/A [kVA]', 'C.D. sectorial [kVA]', 'Transformador del sector'])),
      h('tbody', null, rows))));
    root.appendChild(h('p', { class: 'hint' }, 'La “suma de niveles / sectores” aplica los factores de cada uno por separado. La demanda del proyecto completo aplica la Tabla ' + art + '.42 sobre el conjunto de las viviendas' + (P.proyServSeparado ? ' y suma los servicios propios con sus propios factores.' : ' y servicios juntos (criterio de la hoja original).')));

    // Totales del proyecto
    const f = (n, ref, ci, ciKw, fd, cdKw, cd, b) => h('tr', { class: b ? 'tot' : null }, h('td', null, n), h('td', null, ref), h('td', { class: 'r' }, fmt(ci, 2)), h('td', { class: 'r' }, fmt(ciKw, 2)),
      h('td', { class: 'r' }, fd), h('td', { class: 'r' }, fmt(cdKw, 2)), h('td', { class: 'r' }, fmt(cd, 2)));
    root.appendChild(h('h3', { class: 'sp' }, 'Relación de cargas completa del proyecto'));
    root.appendChild(h('div', { class: 'tablewrap' }, h('table', { class: 'grid res' },
      h('thead', null, th(['Tipo de carga', 'Referencia', 'C.I. [kVA]', 'C.I. [kW]', 'F.D.', 'C.D. [kW]', 'C.D. [kVA]'])),
      h('tbody', null,
        f('Alumbrado y contactos', 'Tabla ' + art + '.42', T.ciLC, T.kwCiLC, C.pct(T.fdLC), T.kwCdLC, T.cdLC),
        f('A/A (HVAC)', art + '.60 / ' + art + '.50', T.ciAC, T.kwCiAC, C.pct(T.fdAC), T.kwCdAC, T.cdAC),
        f('TOTAL', '', T.ci, T.kwCi, C.pct(T.fd), T.kwCd, T.cd, true)))));

    const tr = R.trafo;
    root.appendChild(h('div', { class: 'card kpis big' },
      h('span', null, 'Carga instalada total', h('b', null, fmt(T.ci, 1) + ' kVA')),
      h('span', null, 'Carga demandada total', h('b', null, fmt(T.cd, 1) + ' kVA')),
      h('span', null, 'Factor de demanda global', h('b', null, C.pct(T.fd))),
      P.fCoinc !== 1 ? h('span', null, 'Demanda coincidente (× ' + fmt(P.fCoinc, 2) + ')', h('b', null, fmt(T.cdCoinc, 1) + ' kVA')) : null,
      h('span', null, 'Transformación mínima (' + (Number(P.fases) === 3 ? 'trifásica' : 'equivalente') + ')', h('b', null, tr.n ? (tr.n > 1 ? tr.n + ' × ' : '') + fmt(tr.size, 1) + ' kVA' + (tr.n > 1 ? ' = ' + fmt(tr.total, 0) + ' kVA' : '') : '—'))));

    root.appendChild(h('p', { class: 'hint' }, 'Referencia de diseño · espacio mínimo de cuartos principales: cuarto eléctrico ' + fmt(P.cuartoElecM2, 1) + ' m² · cuarto de telecomunicaciones ' + fmt(P.cuartoTelM2, 1) + ' m² (no entra en los cálculos).'));

    // Método opcional multifamiliar
    const M = NEC.multifamiliar(S.sectores, P);
    const chk = h('input', { type: 'checkbox', checked: !!P.aplica84, onchange: () => { P.aplica84 = chk.checked; Store.save(); render(); } });
    root.appendChild(h('div', { class: 'card' },
      h('h3', null, 'Alternativa: método opcional multifamiliar (' + art + '.84)'),
      h('label', { class: 'inline chk' }, chk, h('span', null, 'Todas las viviendas tienen cocina eléctrica y calefacción o A/A eléctricos (condición para usar ' + art + '.84)')),
      P.aplica84
        ? (M.fd === null
          ? h('p', { class: 'warn' }, 'Se necesitan al menos 3 viviendas capturadas en detalle (hay ' + M.n + ').')
          : h('p', null, M.n + ' viviendas · carga instalada ' + fmt(M.ciKva, 1) + ' kVA × factor ' + C.pct(M.fd) + ' = ', h('b', null, fmt(M.cd, 1) + ' kVA'), ' demandados (solo viviendas, sectores en detalle). Compare con el método estándar de arriba.'))
        : h('p', { class: 'hint' }, 'En el Excel original las viviendas no tienen cocina eléctrica, por lo que este método no aplica por defecto.')));

    // Imprimir / CSV
    root.appendChild(h('div', { class: 'toolbar no-print' },
      h('button', { class: 'btn primary', onclick: () => window.print() }, 'Imprimir / PDF'),
      h('button', { class: 'btn', onclick: () => exportarCSV(R) }, 'Exportar CSV')));
  }

  function nums(a, b, c, d, e, f, tr) {
    const out = [a, b, c, d, e, f].map(v => h('td', { class: 'r' }, fmt(v, 2)));
    out.push(h('td', { class: 'r' }, tr && tr.n ? (tr.n > 1 ? tr.n + ' × ' : '') + fmt(tr.size, 1) + ' kVA' : ''));
    return out;
  }
  function sum(R, k) { return R.rows.reduce((a, r) => a + r.dep[k] + r.sv[k], 0); }

  function exportarCSV(R) {
    const T = R.tot, f = x => Math.round(x * 1000) / 1000;
    const filas = [['Nivel / sector', 'Tipo', 'C.I. alumbrado y contactos kVA', 'C.I. A/A kVA', 'C.I. total kVA', 'C.D. alumbrado y contactos kVA', 'C.D. A/A kVA', 'C.D. kVA']];
    R.rows.forEach(r => {
      filas.push([r.sec.nombre, 'Viviendas', f(r.dep.ciLC), f(r.dep.ciAC), f(r.dep.ci), f(r.dep.cdLC), f(r.dep.cdAC), f(r.dep.cd)]);
      filas.push([r.sec.nombre, 'Servicios', f(r.sv.ciLC), f(r.sv.ciAC), f(r.sv.ci), f(r.sv.cdLC), f(r.sv.cdAC), f(r.sv.cd)]);
    });
    filas.push(['PROYECTO', 'Total', f(T.ciLC), f(T.ciAC), f(T.ci), f(T.cdLC), f(T.cdAC), f(T.cd)]);
    C.descargar('relacion-de-cargas.csv', C.csv(filas), 'text/csv;charset=utf-8');
  }

  C.init('index.html', render);
})();
