/* Página Parámetros NEC: perfil de edición, factores y tablas (todo editable). */
(function () {
  'use strict';
  const h = C.h, fmt = C.fmt;

  function render() {
    const root = document.getElementById('view');
    root.textContent = '';
    const P = Store.state.params, art = P.art;

    root.appendChild(h('h2', null, 'Parámetros de cálculo NEC'));
    const sel = h('select', { 'aria-label': 'Perfil' }, Object.keys(NEC.PERFILES).map(k => h('option', { value: k, selected: k === P.perfil }, NEC.PERFILES[k].etiqueta)));
    root.appendChild(h('div', { class: 'card' },
      h('div', { class: 'toolbar' }, h('label', { class: 'inline' }, h('span', null, 'Perfil base'), sel),
        h('button', { class: 'btn', onclick: () => {
          if (!confirm('Se reemplazan TODOS los parámetros y tablas por los del perfil seleccionado. Los datos de viviendas y servicios no cambian. ¿Continuar?')) return;
          Store.state.params = NEC.nuevosParams(sel.value); Store.save(); render(); document.getElementById('subtitulo').textContent = Store.state.proyecto.nombre + ' · ' + Store.state.params.etiqueta;
        } }, 'Aplicar perfil')),
      h('p', { class: 'hint' }, 'Costa Rica adopta el NEC 2020 en español (perfil por defecto). NEC 2026 reorganizó el Artículo 220 como Artículo 120 y redujo el alumbrado general de vivienda a 2 VA/ft² (≈ 22 VA/m²) y el primer escalón del método opcional a 8 kVA. ',
        'Los valores del perfil 2026 provienen de resúmenes secundarios: verifíquelos contra el texto oficial. ',
        'El perfil “Hoja de Excel original” reproduce los factores de la hoja para poder comparar resultados.')));

    const METODOS = [['estandar', 'Estándar NEC 2020 (Parte II): Tablas 220.42, 220.53, 220.55'], ['opcional', 'Opcional 220.82(B): todo al 100 % (sin 220.53)'], ['luah', 'Criterio LUAH: 220.53 al 75 % y luego 220.82(B)']];
    const selM = h('select', { 'aria-label': 'Método del alimentador de vivienda', onchange: e => { P.metodoViv = e.target.value; Store.save(); } },
      METODOS.map(m => h('option', { value: m[0], selected: m[0] === P.metodoViv }, m[1])));
    const chk15 = h('input', { type: 'checkbox', checked: !!P.art15Min, onchange: e => { P.art15Min = e.target.checked ? 1 : 0; Store.save(); } });
    root.appendChild(h('div', { class: 'card' },
      h('label', { class: 'inline' }, h('span', null, 'Método del alimentador de cada vivienda'), selM),
      h('label', { class: 'inline chk' }, chk15, h('span', null, 'Aplicar los mínimos del Art. 15 (CFIA, Decreto 36979-MEIC): cocina eléctrica no menor que ' + fmt(P.cocinaVA, 0) + ' VA y calentador de agua no menor que ' + fmt(P.calentVA, 0) + ' VA'),
        h('small', { class: 'hint' }, 'También exige 2 circuitos de iluminación y tomacorrientes, 2 circuitos de aparatos pequeños de 1 500 VA, 1 de lavandería de 1 500 VA, 1 de baños (sin carga adicional) y la acometida de telecomunicaciones.'))));
    const grupos = [
      ['Vivienda: cargas generales', [
        ['lightVA', 'Alumbrado general de vivienda', 'VA/m²', P.refLight],
        ['sacN', 'Circuitos de aparatos pequeños', 'n.º', art + '.52(A) (mín. 2)'],
        ['sacVA', 'Carga por circuito de aparatos pequeños', 'VA', art + '.52(A)'],
        ['lavVA', 'Circuito de lavandería', 'VA', art + '.52(B)'],
        ['gfciVA', 'Circuito de baño (0 = sin carga adicional, Art. 15)', 'VA', '210.11(C)(3)'],
        ['recDwVAm2', 'Tomacorrientes de uso general (0 = incluidos en el alumbrado)', 'VA/m²', art + '.14'],
        ['extDwVAm2', 'Tomacorrientes exteriores', 'VA/m²', ''],
        ['telecomVA', 'Circuito gabinete telecom', 'VA', ''],
        ['detectVA', 'Circuito de detectores', 'VA', ''],
        ['hvacDwVAm2', 'Condensadoras (0 = captura manual en VA)', 'VA/m²', ''],
        ['manejPct', 'Manejadoras, % de las condensadoras', '%', ''],
        ['cocinaVA', 'Cocina eléctrica por vivienda (0 = no hay)', 'VA', 'Art. 15 CR: no menos de 8 000 VA · ' + art + '.55'],
        ['calentVA', 'Calentador de agua eléctrico por vivienda', 'VA', 'Art. 15 CR: no menos de 6 000 VA · ' + art + '.53']]],
      ['Vivienda: factores de demanda (alimentador, método opcional)', [
        ['tier1', 'Primer escalón al 100 %', 'VA', art + '.82(B)'],
        ['restFD', 'Factor del resto', '', art + '.82(B)'],
        ['genFD', 'Factor adicional carga general', '', 'criterio de proyecto (NEC = 1)'],
        ['hvacFD', 'Factor HVAC por vivienda', '', art + '.82(C) / ' + art + '.60 (NEC = 1)'],
        ['divFD', 'Factor de diversidad del alimentador de vivienda', '', 'criterio de proyecto (1 = sin reducción)'],
        ['appl53Min', 'N.º mínimo de aparatos fijos para aplicar ' + art + '.53', 'n.º', art + '.53 (4 o más)']]],
      ['Nivel / sector y proyecto (transformador)', [
        ['applFD', 'Aparatos fijos y equipos especiales', '', art + '.53 (75 % con 4 o más)'],
        ['hvacAggFD', 'Factor HVAC de nivel / sector', '', art + '.60'],
        ['hvacProjFD', 'Factor HVAC de proyecto', '', art + '.60'],
        ['svcFD', 'Factor de demanda de servicios en modo resumen', '', 'solo niveles / sectores capturados como totales'],
        ['fCoinc', 'Factor de coincidencia entre niveles / sectores', '', 'criterio de proyecto (1 = sin reducción)'],
        ['pf', 'Factor de potencia', '', 'kW = kVA × FP']]],
      ['Servicios: factores de demanda por tipo de carga (valor por defecto)', [
        ['fdLuz', 'Alumbrado', '', 'Tabla ' + art + '.42 (otros = 100 %)'],
        ['fdRec', 'Contactos (si no se usa la Tabla ' + art + '.44)', '', 'criterio de proyecto'],
        ['fdEq', 'Equipos', '', '430.24 / 430.26'],
        ['fdEsp', 'Equipos especiales', '', 'placa de datos'],
        ['fdHvac', 'Fuerza (sistema de A/A)', '', art + '.60 / 430.26'],
        ['fdElev', 'Elevadores (si no es automático)', '', '620.14']]],
      ['Referencia (no entra en los cálculos)', [
        ['cuartoElecM2', 'Espacio mínimo del cuarto eléctrico', 'm²', 'referencia de diseño'],
        ['cuartoTelM2', 'Espacio mínimo del cuarto de telecomunicaciones', 'm²', 'referencia de diseño']]],
      ['Alimentadores e interruptores', [
        ['vUnit', 'Tensión del alimentador de vivienda', 'V', ''],
        ['fases', 'Fases (1 o 3)', '', ''],
        ['protFactor', 'Factor sobre corriente demandada', '', '215.3 / 125 %'],
        ['minBreaker', 'Interruptor mínimo', 'A', '']]]
    ];
    grupos.forEach(g => {
      root.appendChild(h('h3', { class: 'sp' }, g[0]));
      root.appendChild(h('div', { class: 'card form' }, g[1].map(f => h('label', null,
        h('span', null, f[1] + (f[2] ? ' [' + f[2] + ']' : '')), C.numInput(P, f[0], { vacio: 0, step: 'any', label: f[1] }), f[3] ? h('small', { class: 'hint' }, f[3]) : null))));
    });
    const bool = (k, l, hint) => h('label', { class: 'inline chk' }, h('input', { type: 'checkbox', checked: !!P[k], onchange: e => { P[k] = e.target.checked; Store.save(); } }), h('span', null, l), h('small', { class: 'hint' }, hint));
    root.appendChild(h('div', { class: 'card' },
      bool('tablaIncluyeEquipos', 'Aplicar la Tabla ' + art + '.42 también a aparatos fijos y equipos especiales', 'Criterio de la hoja original. El NEC aplica la tabla solo a alumbrado, contactos y lavandería.'),
      bool('rec44', 'Contactos de servicios por Tabla ' + art + '.44 (10 kVA al 100 %, resto al 50 %)', 'Desactivado = se usa el factor fijo de contactos.'),
      bool('rec44Separado', 'Aplicar la Tabla ' + art + '.44 por separado a contactos UPS y contactos', 'Como la hoja original; el NEC la aplica al total de receptáculos.'),
      bool('elevAuto', 'Factor de elevadores automático por Tabla 620.14', 'Según el número de elevadores; se puede forzar por renglón.'),
      bool('proyServSeparado', 'Servicios propios con factores propios (sin Tabla ' + art + '.42)', 'Desactivado = la tabla se aplica a viviendas y servicios juntos, como la hoja original.')));

    // Tabla 220.42
    root.appendChild(h('h3', { class: 'sp' }, 'Tabla ' + art + '.42 · factores de demanda de alumbrado y contactos (vivienda)'));
    root.appendChild(tablaEscalones(P.tabla42, 'Hasta [VA]', '(vacío = resto)'));
    root.appendChild(h('h3', { class: 'sp' }, 'Tabla ' + art + '.84 · multifamiliar (método opcional)'));
    root.appendChild(tablaEscalones(P.tabla84, 'Hasta n.º de viviendas', '', true));

    root.appendChild(h('h3', { class: 'sp' }, 'Tabla ' + art + '.44 · receptáculos no residenciales'));
    root.appendChild(tablaEscalones(P.tabla44, 'Hasta [VA]', '(vacío = resto)'));
    root.appendChild(h('h3', { class: 'sp' }, 'Tabla 620.14 · elevadores en un mismo alimentador'));
    root.appendChild(tablaEscalones(P.tabla620, 'Hasta n.º de elevadores', ''));

    // Listas
    root.appendChild(h('h3', { class: 'sp' }, 'Listas normalizadas'));
    const lista = (l, k, ayuda) => h('label', { class: 'block' }, h('span', null, l), h('textarea', { rows: 2, 'aria-label': l, onchange: e => {
      const v = e.target.value.split(/[\s,;]+/).map(Number).filter(x => x > 0);
      if (v.length) { P[k] = v; Store.save(); } else e.target.value = P[k].join(', ');
    } }, P[k].join(', ')), h('small', { class: 'hint' }, ayuda));
    root.appendChild(h('div', { class: 'card' },
      lista('Interruptores normalizados [A]', 'breakers', '240.6(A). El perfil Excel usa la lista de la hoja “.” (incluye 1400, 1800 y 3200 A).'),
      lista('Generadores normalizados [kVA] (a FP 0,8)', 'generadores', 'Potencia continua; ajuste según el catálogo del proveedor.'),
      lista('Transformadores normalizados [kVA]', 'trafos', 'Trifásicos de uso común; ajuste según el catálogo de la compañía distribuidora.')));

    // Catálogo de dispositivos
    root.appendChild(h('h3', { class: 'sp' }, 'Catálogo de dispositivos de vivienda (lista de selección)'));
    const tc = h('tbody');
    const CATS = [['toma', 'Toma / carga enchufada (Tabla ' + art + '.42)'], ['fijo', 'Aparato fijo (75 % con 4 o más)'], ['secadora', 'Secadora (' + art + '.54, mín. 5 kW)'], ['cocina', 'Cocina / horno (Tabla ' + art + '.55)'], ['calentador', 'Calentador de agua'], ['esp', 'Equipo especial']];
    P.catalogo.forEach(it => tc.appendChild(h('tr', null,
      h('td', { class: 'in' }, C.textInput(it, 'n', { label: 'Dispositivo' })),
      h('td', { class: 'in' }, C.numInput(it, 'kva', { vacio: 0, step: 'any', label: 'kVA' })),
      h('td', { class: 'in' }, h('select', { 'aria-label': 'Categoría', onchange: e => { it.cat = e.target.value; Store.save(); } }, CATS.map(c => h('option', { value: c[0], selected: c[0] === it.cat }, c[1])))),
      h('td', null, h('button', { class: 'btn small danger', title: 'Quitar', onclick: () => { P.catalogo.splice(P.catalogo.indexOf(it), 1); Store.save(); render(); } }, '✕')))));
    root.appendChild(h('div', { class: 'tablewrap narrow' }, h('table', { class: 'grid' },
      h('thead', null, h('tr', null, h('th', { class: 'in' }, 'Dispositivo'), h('th', { class: 'in' }, 'kVA'), h('th', { class: 'in' }, 'Categoría'), h('th'))), tc)));
    root.appendChild(h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => { P.catalogo.push({ id: 'u' + Store.uid(), n: 'Nuevo dispositivo', kva: 0, cat: 'fijo' }); Store.save(); render(); } }, '+ Agregar dispositivo')));
    root.appendChild(h('p', { class: 'hint' }, 'Valores iniciales de la hoja “918 Calculo alimentadores Aptos”. La categoría decide cómo se suma el dispositivo en la demanda del sector.'));

    // Tipos de espacio
    root.appendChild(h('h3', { class: 'sp' }, 'Tipos de espacio y densidades de carga [VA/m²]'));
    const tb = h('tbody');
    P.ocupaciones.forEach(o => {
      const ratio = h('td', { class: 'calc r' });
      const upd = () => {
        const asw = Number(o.ash), luz = Number(o.luz);
        ratio.textContent = asw > 0 ? C.fmt(luz / asw, 1) + ' ×' : '';
        ratio.title = asw > 0 && luz / asw > 3 ? 'La densidad de diseño supera 3 veces la de ASHRAE: confirme que es intencional.' : '';
      };
      upd();
      tb.appendChild(h('tr', null,
        h('td', { class: 'in' }, C.textInput(o, 'n', { label: 'Tipo de espacio' })),
        ['luz', 'ups', 'rec', 'hvac'].map(k => h('td', { class: 'in' }, C.numInput(o, k, { vacio: 0, label: k, after: upd }))),
        h('td', { class: 'in' }, C.numInput(o, 'ash', { label: 'ASHRAE 90.1 W/m²', after: upd })), ratio));
    });
    root.appendChild(h('div', { class: 'tablewrap' }, h('table', { class: 'grid' },
      h('thead', null, h('tr', null, h('th', { class: 'in' }, 'Tipo de espacio'), h('th', { class: 'in' }, 'Alumbrado (' + P.refLight + ')'), h('th', { class: 'in' }, 'Contactos UPS'), h('th', { class: 'in' }, 'Contactos'), h('th', { class: 'in' }, 'HVAC'),
        h('th', { class: 'in' }, 'ASHRAE 90.1-2019 alumbrado [W/m²]'), h('th', { class: 'calc' }, 'Diseño / ASHRAE'))), tb)));
    root.appendChild(h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => { P.ocupaciones.push({ id: 'u' + Store.uid(), n: 'Nuevo tipo', luz: 10, ups: 0, rec: 1, hvac: 0 }); Store.save(); render(); } }, '+ Agregar tipo de espacio')));
    root.appendChild(h('div', { class: 'card' }, h('h4', null, 'Revisión frente a ASHRAE'),
      h('ul', { class: 'notes-list' },
        h('li', null, 'Alumbrado: la referencia es ASHRAE/IES 90.1-2019, Tabla 9.5.2.1-1 (espacio por espacio), valores SI del addendum ba: pasillo 4,4 · escalera 5,3 · eléctrico/mecánico 4,6 (más 5,6 si el extra se controla aparte) · cuarto de huéspedes 4,4 · estacionamiento interior 1,6 · almacén ≥ 13,9 m² 4,1 · baños 6,8 · lobby 9,0 (hotel 5,4) W/m². El addendum rebaja algunos valores un 4 %.'),
        h('li', null, 'Esos valores son el máximo de potencia instalada de un código de energía. El NEC (' + P.refLight + ') usa densidades mayores para dimensionar el alimentador, y solo permite usar las del código de energía si hay monitoreo de carga. Por eso la columna “Alumbrado” se mantiene en valores NEC o de proyecto y la de ASHRAE es solo referencia.'),
        h('li', null, 'Los 15 y 12 VA/m² de cuartos técnicos y áreas de servicio vienen de sus hojas de Excel: duplican o triplican lo de ASHRAE (4,6 W/m²). Son razonables como capacidad de diseño, pero conviene saber que son holgados.'),
        h('li', null, 'Contactos UPS, contactos y HVAC: ASHRAE no fija valores de código. Como orientación, el manual de usuario de 90.1 cita unos 8 W/m² (0,75 W/ft²) de carga de enchufes en oficinas (fuente secundaria). Las densidades de la herramienta son de capacidad de circuito y por eso son mucho mayores; no se comparan.'))),
    h('p', { class: 'hint' }, 'Alumbrado según la Tabla 220.12 (NEC 2020/2023). Contactos UPS, contactos y HVAC de los cuartos técnicos y áreas de servicio provienen de las hojas de Excel del proyecto: ajústelos a su criterio.'));
  }

  function tablaEscalones(t, titulo, pista, entero) {
    const tb = h('tbody');
    t.forEach(r => {
      const hasta = h('input', { type: 'number', class: 'num', min: 0, value: r.hasta === null ? '' : r.hasta, placeholder: pista, 'aria-label': titulo, onchange: e => { r.hasta = e.target.value === '' ? null : Number(e.target.value); Store.save(); } });
      const fd = h('input', { type: 'number', class: 'num', min: 0, max: 100, step: 'any', value: Math.round(r.fd * 10000) / 100, 'aria-label': 'Factor %', onchange: e => { r.fd = Number(e.target.value) / 100; Store.save(); } });
      tb.appendChild(h('tr', null, h('td', { class: 'in' }, hasta), h('td', { class: 'in' }, fd)));
    });
    return h('div', { class: 'tablewrap narrow' }, h('table', { class: 'grid' }, h('thead', null, h('tr', null, h('th', null, titulo), h('th', null, 'Factor [%]'))), tb));
  }

  C.init('parametros.html', render);
})();
