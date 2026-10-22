/* Motor de cálculo de cargas (sin DOM). Todo parámetro sale de P (ver perfiles).
   Convención: VA/W en unidades base; resultados de resumen en kVA/kW. */
(function (g) {
  'use strict';

  const BRK_NEC = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000];
  const BRK_EXCEL = [15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 225, 250, 300, 350, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000, 3000, 3200, 4000, 5000];
  const TRAFOS_3F = [15, 30, 45, 75, 112.5, 150, 225, 300, 500, 750, 1000, 1500, 2000, 2500, 3000];

  /* Tabla 220.42 / 120.42 (vivienda): primeros 3 000 VA al 100 %, hasta 120 000 VA al 35 %, el resto al 25 %. */
  const TABLA_42 = [{ hasta: 3000, fd: 1 }, { hasta: 120000, fd: 0.35 }, { hasta: null, fd: 0.25 }];
  /* Tabla 220.84 / 120.84 (multifamiliar, método opcional): { hasta (n.º de viviendas), fd }. */
  const TABLA_84 = [[5, 45], [7, 44], [10, 43], [11, 42], [13, 41], [15, 40], [17, 39], [19, 38], [20, 37], [21, 36], [23, 35], [25, 34], [27, 33], [30, 32], [31, 31], [33, 30], [36, 29], [38, 28], [42, 27], [45, 26], [50, 25], [55, 24], [61, 23], [9999, 22]]
    .map(r => ({ hasta: r[0], fd: r[1] / 100 }));

  /* Tipos de espacio: densidades en VA/m². luz = Tabla 220.12 (NEC 2020/2023); ups, rec y hvac son valores de partida
     tomados de las hojas de Excel del proyecto; todos son editables en Parámetros NEC. */
  const OCUP_NEC = [
    { id: 'pasillos', n: 'Pasillos y closets (áreas comunes)', luz: 5, ups: 0, rec: 1, hvac: 4 },
    { id: 'escaleras', n: 'Escaleras de emergencia', luz: 5, ups: 0, rec: 1, hvac: 10 },
    { id: 'cuarto_tec', n: 'Cuarto eléctrico / cuarto de torres (service yard)', luz: 15, ups: 10, rec: 30, hvac: 150 },
    { id: 'bombas', n: 'Cuarto de bombas', luz: 15, ups: 10, rec: 30, hvac: 70 },
    { id: 'serv_nivel', n: 'Áreas de servicio por nivel (hotel / edificio)', luz: 12, ups: 1, rec: 15, hvac: 50 },
    { id: 'hotel', n: 'Hoteles / moteles / apartamentos sin cocina', luz: 22, ups: 0, rec: 1, hvac: 0 },
    { id: 'oficina', n: 'Oficinas', luz: 39, ups: 0, rec: 11, hvac: 0 },
    { id: 'tienda', n: 'Tiendas / comercio', luz: 33, ups: 0, rec: 1, hvac: 0 },
    { id: 'estac', n: 'Estacionamiento comercial', luz: 5, ups: 0, rec: 1, hvac: 0 },
    { id: 'bodega', n: 'Bodegas', luz: 3, ups: 0, rec: 1, hvac: 0 },
    { id: 'salones', n: 'Salones de reunión / auditorios', luz: 11, ups: 0, rec: 1, hvac: 0 },
    { id: 'rest', n: 'Restaurantes', luz: 22, ups: 0, rec: 1, hvac: 0 },
    { id: 'escuela', n: 'Escuelas', luz: 33, ups: 0, rec: 1, hvac: 0 },
    { id: 'hospital', n: 'Hospitales', luz: 22, ups: 0, rec: 1, hvac: 0 },
    { id: 'almacen', n: 'Almacenamiento', luz: 3, ups: 0, rec: 1, hvac: 0 },
    { id: 'otro', n: 'Otro (valores manuales)', luz: 10, ups: 0, rec: 1, hvac: 0 }
  ];
  /* Referencia ASHRAE/IES 90.1-2019, Tabla 9.5.2.1-1 (método espacio por espacio), densidad de potencia de alumbrado en W/m²
     (valores SI del addendum ba: pasillo 4,4; escalera 5,3; eléctrico/mecánico 4,6; cuarto de huéspedes 4,4; estacionamiento interior 1,6;
     almacén ≥ 13,9 m² 4,1). Es un máximo del código de energía, no una carga de diseño del alimentador. */
  const ASHRAE_LPD = { pasillos: 4.4, escaleras: 5.3, cuarto_tec: 4.6, bombas: 4.6, hotel: 4.4, estac: 1.6, bodega: 4.1, almacen: 4.1 };
  /* Tabla 220.44 (receptáculos no residenciales): primeros 10 kVA al 100 %, el resto al 50 %. */
  const TABLA_44 = [{ hasta: 10000, fd: 1 }, { hasta: null, fd: 0.5 }];
  /* Tabla 620.14 (elevadores en un mismo alimentador): n.º de elevadores → factor. */
  const TABLA_620 = [[1, 1], [2, 0.95], [3, 0.9], [4, 0.85], [5, 0.82], [6, 0.79], [7, 0.77], [8, 0.75], [9, 0.73], [9999, 0.72]].map(r => ({ hasta: r[0], fd: r[1] }));

  /* Catálogo de dispositivos de vivienda (lista de selección). cat: cocina | calentador | fijo | esp.
     Valores iniciales tomados de la hoja "918 Calculo alimentadores Aptos". */
  const CATALOGO = [
    { id: 'refrig', n: 'Refrig', kva: 1.2, cat: 'fijo' },
    { id: 'cal1', n: 'Calentador paso 1', kva: 10.8, cat: 'calentador' },
    { id: 'cal2', n: 'Calentador paso 2', kva: 10.8, cat: 'calentador' },
    { id: 'tritur', n: 'Triturador', kva: 0.18, cat: 'fijo' },
    { id: 'secad', n: 'Secadora', kva: 5, cat: 'fijo' },
    { id: 'lavaplatos', n: 'Lavaplatos', kva: 1.2, cat: 'fijo' },
    { id: 'micro', n: 'Microondas', kva: 1.1, cat: 'fijo' },
    { id: 'cocina', n: 'Cocina', kva: 4, cat: 'cocina' },
    { id: 'horno', n: 'Horno', kva: 4, cat: 'cocina' },
    { id: 'cochorno', n: 'Cocina/Horno', kva: 8, cat: 'cocina' },
    { id: 'extractor', n: 'Extractor cocina', kva: 0.5, cat: 'fijo' },
    { id: 'bombas', n: 'Bombas potable', kva: 1.5, cat: 'fijo' },
    { id: 'piscina', n: 'Tablero piscina', kva: 10, cat: 'esp' },
    { id: 'telecomres', n: 'Gabinete residencial telecom', kva: 1, cat: 'fijo' },
    { id: 'telecompared', n: 'Gabinete pared telecom', kva: 2.8, cat: 'fijo' },
    { id: 'lavadora', n: 'Lavadora', kva: 1, cat: 'fijo' },
    { id: 'detector', n: 'Detector de humo', kva: 0.1, cat: 'fijo' },
    { id: 'calagua', n: 'Calentador de agua eléctrico (Art. 15 CR)', kva: 6, cat: 'calentador' },
    { id: 'cocelec', n: 'Cocina eléctrica (Art. 15 CR)', kva: 8, cat: 'cocina' }
  ];
  /* Conductor por interruptor (hoja de alimentadores de aptos; verificar con la Tabla 310.16). */
  const CONDUCTORES = [[30, '10', '10'], [40, '8', '6'], [50, '6', '4'], [60, '4', '2'], [70, '4', '2'], [80, '2', '1/0'], [90, '2', '1/0'],
    [100, '1/0', '1/0'], [125, '1/0', '2/0'], [150, '1/0', '3/0'], [175, '2/0', '4/0'], [200, '3/0', '250'], [225, '4/0', '300'], [250, '250', '350'],
    [300, '350', '500'], [350, '350', '700'], [400, '600', '900'], [500, '700', '1250'], [600, '900', '900'], [700, '1500', '1250']]
    .map(r => ({ ocpd: r[0], cu: r[1], al: r[2] }));

  /* Perfiles de parámetros. El usuario puede editar cualquier valor después de aplicarlo. */
  const PERFILES = {
    NEC2026: {
      etiqueta: 'NEC 2026 (NFPA 70-2026)', art: '120', refLight: '120.41',
      lightVA: 22, sacN: 2, sacVA: 1500, lavVA: 1500, gfciVA: 0, cocinaVA: 8000, calentVA: 6000, recDwVAm2: 0, extDwVAm2: 0, telecomVA: 0, detectVA: 0, hvacDwVAm2: 0, manejPct: 0, divFD: 1, appl53Min: 4, metodoViv: 'opcional', art15Min: 0, cuartoElecM2: 5.8, cuartoTelM2: 5, metodoViv: 'estandar', art15Min: 1, cuartoElecM2: 5.8, cuartoTelM2: 5,
      tier1: 8000, restFD: 0.4, genFD: 1, hvacFD: 1, tablaIncluyeEquipos: false, applFD: 0.75,
      hvacAggFD: 1, hvacProjFD: 1, proyServSeparado: true,
      recVAm2: 1, svcFD: 1, fdLuz: 1, fdRec: 1, fdEq: 1, fdEsp: 1, fdHvac: 1, fdElev: 1, elevAuto: true, rec44: true, rec44Separado: false, fCoinc: 1, pf: 0.9, vUnit: 240, fases: 1, protFactor: 1.25, minBreaker: 20,
      aplica84: false
    },
    NEC2020: {
      etiqueta: 'NEC 2020 (NFPA 70-2020, edición en español · Costa Rica)', art: '220', refLight: '220.12',
      lightVA: 33, sacN: 2, sacVA: 1500, lavVA: 1500, gfciVA: 0, cocinaVA: 8000, calentVA: 6000, recDwVAm2: 0, extDwVAm2: 0, telecomVA: 0, detectVA: 0, hvacDwVAm2: 0, manejPct: 0, divFD: 1, appl53Min: 4, metodoViv: 'estandar', art15Min: 1, cuartoElecM2: 5.8, cuartoTelM2: 5,
      tier1: 10000, restFD: 0.4, genFD: 1, hvacFD: 1, tablaIncluyeEquipos: false, applFD: 0.75,
      hvacAggFD: 1, hvacProjFD: 1, proyServSeparado: true,
      recVAm2: 1, svcFD: 1, fdLuz: 1, fdRec: 1, fdEq: 1, fdEsp: 1, fdHvac: 1, fdElev: 1, elevAuto: true, rec44: true, rec44Separado: false, fCoinc: 1, pf: 0.9, vUnit: 240, fases: 1, protFactor: 1.25, minBreaker: 20,
      aplica84: false
    },
    NEC2023: {
      etiqueta: 'NEC 2023 (NFPA 70-2023)', art: '220', refLight: '220.12',
      lightVA: 33, sacN: 2, sacVA: 1500, lavVA: 1500, gfciVA: 0, cocinaVA: 8000, calentVA: 6000, recDwVAm2: 0, extDwVAm2: 0, telecomVA: 0, detectVA: 0, hvacDwVAm2: 0, manejPct: 0, divFD: 1, appl53Min: 4, metodoViv: 'estandar', art15Min: 1, cuartoElecM2: 5.8, cuartoTelM2: 5,
      tier1: 10000, restFD: 0.4, genFD: 1, hvacFD: 1, tablaIncluyeEquipos: false, applFD: 0.75,
      hvacAggFD: 1, hvacProjFD: 1, proyServSeparado: true,
      recVAm2: 1, svcFD: 1, fdLuz: 1, fdRec: 1, fdEq: 1, fdEsp: 1, fdHvac: 1, fdElev: 1, elevAuto: true, rec44: true, rec44Separado: false, fCoinc: 1, pf: 0.9, vUnit: 240, fases: 1, protFactor: 1.25, minBreaker: 20,
      aplica84: false
    },
    LUAH: {
      etiqueta: 'LUAH · hoja de alimentadores de apartamentos (208 V, 3 fases)', art: '220', refLight: '220.12',
      lightVA: 20, sacN: 1, sacVA: 3000, lavVA: 1500, gfciVA: 1000, cocinaVA: 0, calentVA: 0, recDwVAm2: 30, extDwVAm2: 5, telecomVA: 1500, detectVA: 1000, hvacDwVAm2: 80, manejPct: 10, divFD: 0.8, appl53Min: 4, metodoViv: 'luah', art15Min: 0, cuartoElecM2: 5.8, cuartoTelM2: 5,
      tier1: 10000, restFD: 0.4, genFD: 1, hvacFD: 1, tablaIncluyeEquipos: false, applFD: 0.75,
      hvacAggFD: 1, hvacProjFD: 1, proyServSeparado: true,
      recVAm2: 1, svcFD: 1, fdLuz: 1, fdRec: 1, fdEq: 1, fdEsp: 1, fdHvac: 1, fdElev: 1, elevAuto: true, rec44: true, rec44Separado: false, fCoinc: 1, pf: 0.9, vUnit: 208, fases: 3, protFactor: 1.25, minBreaker: 20,
      aplica84: false
    },
    EXCEL: {
      etiqueta: 'Hoja de Excel original (referencia, NEC 2020/2023 con criterios del proyecto)', art: '220', refLight: '220.12',
      lightVA: 33, sacN: 2, sacVA: 1500, lavVA: 1500, gfciVA: 1440, cocinaVA: 0, calentVA: 0, recDwVAm2: 0, extDwVAm2: 0, telecomVA: 0, detectVA: 0, hvacDwVAm2: 0, manejPct: 0, divFD: 1, appl53Min: 4,
      tier1: 10000, restFD: 0.4, genFD: 0.7, hvacFD: 0.7, tablaIncluyeEquipos: true, applFD: 1,
      hvacAggFD: 0.7, hvacProjFD: 0.82, proyServSeparado: false,
      recVAm2: 1, svcFD: 0.8, fdLuz: 0.8, fdRec: 0.8, fdEq: 0.8, fdEsp: 0.8, fdHvac: 0.8, fdElev: 0.8, elevAuto: false, rec44: false, rec44Separado: false, fCoinc: 1, pf: 0.9, vUnit: 220, fases: 1, protFactor: 1.25, minBreaker: 20,
      aplica84: false
    }
  };

  function nuevosParams(id) {
    const p = JSON.parse(JSON.stringify(PERFILES[id] || PERFILES.NEC2020));
    p.perfil = PERFILES[id] ? id : 'NEC2020';
    p.tabla42 = JSON.parse(JSON.stringify(TABLA_42));
    p.tabla84 = JSON.parse(JSON.stringify(TABLA_84));
    p.breakers = (id === 'EXCEL' ? BRK_EXCEL : BRK_NEC).slice();
    p.trafos = TRAFOS_3F.slice();
    p.tabla44 = JSON.parse(JSON.stringify(TABLA_44));
    p.tabla620 = JSON.parse(JSON.stringify(TABLA_620));
    p.catalogo = JSON.parse(JSON.stringify(CATALOGO));
    p.conductores = JSON.parse(JSON.stringify(CONDUCTORES));
    p.ocupaciones = JSON.parse(JSON.stringify(OCUP_NEC));
    p.ocupaciones.forEach(o => { o.ash = ASHRAE_LPD[o.id] === undefined ? null : ASHRAE_LPD[o.id]; });
    if (id === 'EXCEL') { p.ocupaciones[0].luz = 6; p.ocupaciones[1].luz = 6; }
    return p;
  }

  /* Sistemas eléctricos normalizados: tensión de línea (V) y fases que usan los alimentadores. */
  const SISTEMAS = [
    { id: '240-1', n: '120/240 V · monofásico, 3 hilos', v: 240, f: 1 },
    { id: '240-3', n: '120/240 V · trifásico, 4 hilos (delta)', v: 240, f: 3 },
    { id: '208-3', n: '120/208 V · trifásico, 4 hilos', v: 208, f: 3 },
    { id: '208-1', n: '120/208 V · monofásico, 3 hilos', v: 208, f: 1 },
    { id: '480-3', n: '277/480 V · trifásico, 4 hilos', v: 480, f: 3 },
    { id: '480-1', n: '277/480 V · monofásico, 3 hilos', v: 480, f: 1 }
  ];
  const sistemaPorVF = (v, f) => SISTEMAS.find(x => x.v === Number(v) && x.f === Number(f)) || null;
  const nombreSistema = (v, f) => { const x = sistemaPorVF(v, f); return x ? x.n : v + ' V · ' + (Number(f) === 3 ? 'trifásico' : 'monofásico'); };

  const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? 0 : Number(v);
  const dflt = (v, d) => (v === null || v === undefined || v === '') ? d : Number(v);

  /** Aplica una tabla escalonada [{hasta, fd}] a una carga (VA). */
  function escalonada(va, tabla) {
    let prev = 0, tot = 0;
    for (const t of tabla) {
      const top = t.hasta === null || t.hasta === undefined ? Infinity : t.hasta;
      if (va > prev) tot += (Math.min(va, top) - prev) * t.fd;
      prev = top;
      if (va <= top) break;
    }
    return tot;
  }

  /** Menor valor normalizado >= x. Si x excede la lista, devuelve null. */
  function siguiente(x, lista) {
    const l = lista.slice().sort((a, b) => a - b);
    for (const v of l) if (v >= x - 1e-9) return v;
    return null;
  }

  function corriente(va, P, v, f) { v = v || P.vUnit; f = f || P.fases; return va / (v * (Number(f) === 3 ? Math.sqrt(3) : 1)); }

  /** Dispositivos elegidos de las listas de la caja de la vivienda.
      disp = lista a 100 %; disp53 = aparatos con factor 220.53 (75 % si son 4 o más).
      Si hay alguno, sustituyen cocina, calentador, aparatos y especiales de la fila. */
  function lineas(lista, P) {
    const cat = P.catalogo || [];
    return (lista || []).map(d => {
      const it = cat.find(c => c.id === d.id) || { n: '(sin definir)', kva: 0, cat: 'fijo' };
      const kva = dflt(d.kva, it.kva), q = dflt(d.qty, 1);
      return { d, it, kva, q, tot: kva * q * 1000, cat: it.cat };
    });
  }
  function dispositivos(r, P) {
    const A = lineas(r.disp, P), B = lineas(r.disp53, P);
    const all = A.concat(B);
    const S = c => all.filter(l => l.cat === c).reduce((a, l) => a + l.tot, 0);
    const sum = arr => arr.reduce((a, l) => a + l.tot, 0);
    const otros = arr => arr.filter(l => l.cat !== 'cocina');
    const nB = otros(B).reduce((a, l) => a + l.q, 0);
    const f53 = nB >= P.appl53Min ? P.applFD : 1;
    return { lines: A, lines53: B, usa: all.length > 0, coc: S('cocina'), cal: S('calentador'), apar: S('fijo'), esp: S('esp'),
      tot: sum(all), totA: sum(A), totB: sum(B), otrosA: sum(otros(A)), otrosB: sum(otros(B)), nB, f53, aplic53: sum(otros(B)) * f53 };
  }

  /** Conductor (Cu / Al) para un interruptor dado. */
  function conductor(brk, P) {
    if (brk === null || brk === undefined) return null;
    const l = (P.conductores || []).slice().sort((x, y) => x.ocpd - y.ocpd);
    let it = null;
    for (const c of l) if (c.ocpd <= brk) it = c;
    return it;
  }

  /** Vivienda. Alimentador por método opcional (220.82(B) / 120.82). */
  function calcDepto(r, P) {
    const area = num(r.area);
    const dens = dflt(r.dens, P.lightVA);
    const light = area * dens;
    const recDw = area * dflt(r.recDw, P.recDwVAm2), ext = area * dflt(r.extDw, P.extDwVAm2);
    const telecom = dflt(r.telecom, P.telecomVA), detect = dflt(r.detect, P.detectVA);
    const sac = dflt(r.sac, P.sacN * P.sacVA);
    const lav = dflt(r.lav, P.lavVA);
    const gfci = dflt(r.gfci, P.gfciVA);
    const dv = dispositivos(r, P);
    const esp = dv.usa ? dv.esp : num(r.esp), apar = dv.usa ? dv.apar : num(r.apar);
    const cocLista = dv.usa ? dv.coc : dflt(r.coc, P.cocinaVA), calLista = dv.usa ? dv.cal : dflt(r.cal, P.calentVA);
    // Art. 15 (CFIA, Decreto 36979): cocina eléctrica no menor que 8 000 VA y calentador de agua no menor que 6 000 VA
    const coc = P.art15Min ? Math.max(cocLista, P.cocinaVA) : cocLista;
    const calExtra = P.art15Min ? Math.max(0, P.calentVA - calLista) : 0;
    const cal = calLista;
    const hd = dflt(r.hvacDens, P.hvacDwVAm2), manejPct = dflt(r.manej, P.manejPct);
    const cond = hd > 0 ? area * hd : num(r.hvac), manejVA = hd > 0 ? cond * manejPct / 100 : 0;
    const hvac = cond + manejVA;
    const gLC = light + recDw + ext + sac + lav + gfci + telecom + detect;
    const gEq = esp + apar + cal + calExtra;
    // aparatos que no son cocina: lista a 100 %, lista 220.53 con su factor (75 % si son 4 o más)
    const aOtros = (dv.usa ? dv.otrosA : esp + apar + cal) + calExtra;
    const bOtros = dv.usa ? dv.otrosB : 0;
    const f53 = dv.nB >= P.appl53Min ? P.applFD : 1;
    const aplic53 = bOtros * f53;
    const metodo = P.metodoViv || 'opcional';
    const general = gLC + coc + aOtros + (metodo === 'opcional' ? bOtros : aplic53);
    let genDem;
    if (metodo === 'estandar') {
      // Parte II: Tabla 220.42 a alumbrado, contactos y lavandería; 220.55 cocina; 220.53 aparatos fijos
      genDem = (escalonada(gLC, P.tabla42) + demCocina(coc > 0 ? 1 : 0, coc) + aOtros + aplic53) * P.genFD;
    } else {
      genDem = (Math.min(general, P.tier1) + Math.max(0, general - P.tier1) * P.restFD) * P.genFD;   // 220.82(B)
    }
    const hvacDem = hvac * P.hvacFD;
    const dem0 = genDem + hvacDem;
    const divFD = dflt(r.divFD, P.divFD);
    const dem = dem0 * divFD;
    const ci = gLC + gEq + coc + hvac;           // instalada sin factores
    const totales = general + hvac;              // sub-total + HVAC
    const fUso = totales ? dem0 / totales : 0;
    const sis = SISTEMAS.find(x => x.id === r.sistema) || null;
    const vUnit = sis ? sis.v : P.vUnit, fases = sis ? sis.f : P.fases;
    const iInst = corriente(ci, P, vUnit, fases), iDem = corriente(dem, P, vUnit, fases), iProt = iDem * P.protFactor;
    const std = siguiente(iProt, P.breakers);
    const brk = std === null ? null : Math.max(std, P.minBreaker);
    return { vUnit, fases, area, light, recDw, ext, telecom, detect, sac, lav, gfci, coc, cocLista, cal, calExtra, esp, apar, gLC, gEq, general, genDem, cond, manejVA, hvac, hvacDem, dem0, divFD, totales, fUso, ci, dem, iInst, iDem, iProt, brk, dv, metodo, aplic53, cu: conductor(brk, P) };
  }

  /** Espacio de servicios: área × % aplicado × densidades (VA/m²) + cargas fijas (VA). */
  function calcServicio(r, P) {
    const t = P.ocupaciones.find(o => o.id === r.tipo) || P.ocupaciones[0];
    const pct = dflt(r.pct, 100) / 100, area = num(r.area), ae = area * pct;
    const dLuz = dflt(r.dLuz, t.luz), dUps = dflt(r.dUps, t.ups), dRec = dflt(r.dRec, t.rec), dHvac = dflt(r.dHvac, t.hvac);
    const luz = ae * dLuz, ups = ae * dUps, rec = ae * dRec, hvac = ae * dHvac, eq = num(r.eq), esp = num(r.esp);
    const ci = luz + ups + rec + hvac + eq + esp;
    const iInst = corriente(ci, P), iProt = iInst * P.protFactor, std = siguiente(iProt, P.breakers);
    return { area, ae, dLuz, dUps, dRec, dHvac, luz, ups, rec, hvac, eq, esp, ci, iInst, iProt, brk: std === null ? null : Math.max(std, P.minBreaker) };
  }

  /** Elevadores del sector: kW = HP × 0,746; factor por Tabla 620.14 según el n.º total (o el de la hoja). */
  function calcElevadores(sec, P) {
    const list = sec.elevadores || [];
    const nTot = list.reduce((a, e) => a + num(e.qty), 0);
    const t = P.tabla620.find(x => nTot <= x.hasta) || P.tabla620[P.tabla620.length - 1];
    const fdBase = P.elevAuto ? (nTot ? t.fd : 1) : P.fdElev;
    const rows = list.map(e => {
      const kwU = num(e.hp) * 0.746, kw = kwU * num(e.qty), fd = dflt(e.fd, fdBase);
      return { e, kwU, kw, kva: kw / P.pf, fd, cdKw: kw * fd, cdKva: kw * fd / P.pf };
    });
    const S = k => rows.reduce((a, r) => a + r[k], 0);
    return { rows, nTot, fdBase, kw: S('kw'), kva: S('kva'), cdKw: S('cdKw'), cdKva: S('cdKva') };
  }

  /** Resumen de servicios de un sector. Todo en kVA. cats: renglones del cuadro de cargas por tipo. */
  function resumenServicios(sec, P) {
    if (sec.modo === 'resumen') {
      const s = sec.resumen;
      const ciLC = num(s.svLC), ciAC = num(s.svAC);
      const cdLC = ciLC * dflt(s.svFDlc, P.svcFD), cdAC = ciAC * dflt(s.svFDac, P.svcFD);
      return { area: 0, ciLC, ciAC, ci: ciLC + ciAC, cdLC, cdAC, cd: cdLC + cdAC, kwCi: (ciLC + ciAC) * P.pf, kwCd: (cdLC + cdAC) * P.pf, cats: [], elev: null };
    }
    const T = { area: 0, luz: 0, ups: 0, rec: 0, hvac: 0, eq: 0, esp: 0 };
    (sec.servicios || []).forEach(r => {
      if (r.incl === false) return;
      const c = calcServicio(r, P);
      T.area += c.area;
      ['luz', 'ups', 'rec', 'hvac', 'eq', 'esp'].forEach(k => { T[k] += c[k]; });
    });
    const fdv = k => dflt((sec.fdServ || {})[k], P[k]);
    const cats = [];
    const add = (k, n, ref, ciVA, cdVA, fd) => cats.push({ k, n, ref, ci: ciVA / 1000, cd: cdVA / 1000, fd: fd === undefined ? (ciVA ? cdVA / ciVA : 0) : fd });
    const art = P.art;
    add('luz', 'Alumbrado', 'Tabla ' + art + '.12 / ' + art + '.42', T.luz, T.luz * fdv('fdLuz'), fdv('fdLuz'));
    if (P.rec44 && P.rec44Separado) {
      add('ups', 'Contactos UPS', 'Tabla ' + art + '.44', T.ups, escalonada(T.ups, P.tabla44));
      add('rec', 'Contactos', 'Tabla ' + art + '.44', T.rec, escalonada(T.rec, P.tabla44));
    } else if (P.rec44) {
      add('rec', 'Contactos (generales y UPS)', 'Tabla ' + art + '.44', T.ups + T.rec, escalonada(T.ups + T.rec, P.tabla44));
    } else {
      add('rec', 'Contactos (generales y UPS)', 'criterio de proyecto', T.ups + T.rec, (T.ups + T.rec) * fdv('fdRec'), fdv('fdRec'));
    }
    add('eq', 'Equipos', '430.24 / 430.26', T.eq, T.eq * fdv('fdEq'), fdv('fdEq'));
    add('esp', 'Equipos especiales', art + '.50 / placa', T.esp, T.esp * fdv('fdEsp'), fdv('fdEsp'));
    const el = calcElevadores(sec, P);
    add('elev', 'Elevadores', '620.14', el.kva * 1000, el.cdKva * 1000);
    add('hvac', 'Fuerza (sistema de A/A)', art + '.60 / 430.26', T.hvac, T.hvac * fdv('fdHvac'), fdv('fdHvac'));
    const sum = (arr, k) => arr.reduce((a, c) => a + c[k], 0);
    const lc = cats.filter(c => c.k !== 'hvac'), ac = cats.filter(c => c.k === 'hvac');
    const ciLC = sum(lc, 'ci'), ciAC = sum(ac, 'ci'), cdLC = sum(lc, 'cd'), cdAC = sum(ac, 'cd');
    return { area: T.area, ciLC, ciAC, ci: ciLC + ciAC, cdLC, cdAC, cd: cdLC + cdAC, kwCi: (ciLC + ciAC) * P.pf, kwCd: (cdLC + cdAC) * P.pf, cats, elev: el };
  }

  /** Resumen de viviendas de un sector. Devuelve VA para gLC/gEq y kVA para el resto. */
  function resumenDeptos(sec, P) {
    if (sec.modo === 'resumen') {
      const lc = num(sec.resumen.depLC) * 1000, ac = num(sec.resumen.depAC) * 1000;
      return armarDep(lc, 0, 0, 0, ac, 0, P);
    }
    let gLC = 0, gEq = 0, gCoc = 0, nCoc = 0, ac = 0, n = 0;
    sec.deptos.forEach(r => {
      if (r.incl === false) return;
      const c = calcDepto(r, P);
      gLC += c.gLC; gEq += c.gEq; ac += c.hvac; n++;
      if (c.coc > 0) { gCoc += c.coc; nCoc++; }
    });
    return armarDep(gLC, gEq, gCoc, nCoc, ac, n, P);
  }
  /* Tabla 220.55 columna C (estufas hasta 12 kW): kW demandados según n.º de estufas; +5 % por cada kW sobre 12. */
  function demCocina(n, gCoc) {
    if (!n) return 0;
    const kw = n <= 5 ? [8, 11, 14, 17, 20][n - 1] : (n <= 30 ? 15 + n : 25 + 0.75 * n);
    const prom = gCoc / n / 1000;
    return Math.min(gCoc, kw * 1000 * (prom > 12 ? 1 + 0.05 * Math.ceil(prom - 12) : 1));
  }
  function demLC(gLC, gEq, gCoc, nCoc, P) {
    return P.tablaIncluyeEquipos ? escalonada(gLC + gEq + gCoc, P.tabla42) : escalonada(gLC, P.tabla42) + gEq * P.applFD + demCocina(nCoc, gCoc);
  }
  function armarDep(gLC, gEq, gCoc, nCoc, ac, n, P) {
    const ciLC = (gLC + gEq + gCoc) / 1000, ciAC = ac / 1000;
    const cdLC = demLC(gLC, gEq, gCoc, nCoc, P) / 1000, cdAC = ciAC * P.hvacAggFD;
    return { n, gLC, gEq, gCoc, nCoc, ciLC, ciAC, ci: ciLC + ciAC, cdLC, cdAC, cd: cdLC + cdAC, pf: P.pf,
      kwCiLC: ciLC * P.pf, kwCiAC: ciAC * P.pf, kwCdLC: cdLC * P.pf, kwCdAC: cdAC * P.pf, kwCi: (ciLC + ciAC) * P.pf, kwCd: (cdLC + cdAC) * P.pf };
  }

  /** Transformador: menor tamaño normalizado >= kVA; si no hay, varios del mayor. */
  function transformador(kva, P) {
    if (!(kva > 0)) return { n: 0, size: 0, total: 0 };
    const s = siguiente(kva, P.trafos);
    if (s !== null) return { n: 1, size: s, total: s };
    const mx = Math.max.apply(null, P.trafos), n = Math.ceil(kva / mx);
    return { n, size: mx, total: n * mx };
  }

  /** Relación completa del proyecto (todos los sectores). */
  function resumenProyecto(sectores, P) {
    const rows = sectores.map(sec => {
      const dep = resumenDeptos(sec, P), sv = resumenServicios(sec, P);
      return { sec, dep, sv, depTr: transformador(dep.cd, P), svTr: transformador(sv.cd, P), totTr: transformador(dep.cd + sv.cd, P) };
    });
    const S = k => rows.reduce((a, r) => a + r.dep[k], 0);
    const V = k => rows.reduce((a, r) => a + r.sv[k], 0);
    const gLC = S('gLC'), gEq = S('gEq'), gCoc = S('gCoc'), nCoc = S('nCoc'), depAC = S('ciAC');
    const depLC = S('ciLC');
    let cdLC, cdAC, ciLC, ciAC;
    ciLC = depLC + V('ciLC'); ciAC = depAC + V('ciAC');
    if (P.proyServSeparado) {
      cdLC = demLC(gLC, gEq, gCoc, nCoc, P) / 1000 + V('cdLC');
      cdAC = depAC * P.hvacProjFD + V('cdAC');
    } else {
      cdLC = demLC(gLC + V('ciLC') * 1000, gEq, gCoc, nCoc, P) / 1000;
      cdAC = ciAC * P.hvacProjFD;
    }
    const ci = ciLC + ciAC, cd = cdLC + cdAC;
    const tot = {
      ciLC, ciAC, ci, cdLC, cdAC, cd,
      kwCiLC: ciLC * P.pf, kwCiAC: ciAC * P.pf, kwCi: ci * P.pf,
      kwCdLC: cdLC * P.pf, kwCdAC: cdAC * P.pf, kwCd: cd * P.pf,
      fdLC: ciLC ? cdLC / ciLC : 0, fdAC: ciAC ? cdAC / ciAC : 0, fd: ci ? cd / ci : 0,
      nViv: S('n')
    };
    tot.cdCoinc = cd * P.fCoinc; tot.kwCdCoinc = tot.cdCoinc * P.pf;
    return { rows, tot, trafo: transformador(tot.cdCoinc, P) };
  }

  /** Método opcional multifamiliar 220.84 / 120.84, informativo. */
  function multifamiliar(sectores, P) {
    let n = 0, ciKva = 0;
    sectores.forEach(sec => {
      if (sec.modo === 'resumen') return;
      sec.deptos.forEach(r => { if (r.incl === false) return; n++; ciKva += calcDepto(r, P).ci / 1000; });
    });
    const t = P.tabla84.find(x => n <= x.hasta);
    const fd = n < 3 ? null : (t ? t.fd : null);
    return { n, ciKva, fd, cd: fd === null ? null : ciKva * fd };
  }

  g.NEC = { PERFILES, nuevosParams, escalonada, siguiente, calcDepto, calcServicio, dispositivos, lineas, conductor, SISTEMAS, sistemaPorVF, nombreSistema, calcElevadores, resumenDeptos, resumenServicios,
    resumenProyecto, transformador, multifamiliar, TABLA_42, TABLA_84, TABLA_44, TABLA_620, OCUP_NEC, BRK_NEC, BRK_EXCEL, TRAFOS_3F };
})(typeof window !== 'undefined' ? window : globalThis);
