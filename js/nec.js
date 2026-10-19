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
  /* Tabla 220.44 (receptáculos no residenciales): primeros 10 kVA al 100 %, el resto al 50 %. */
  const TABLA_44 = [{ hasta: 10000, fd: 1 }, { hasta: null, fd: 0.5 }];
  /* Tabla 620.14 (elevadores en un mismo alimentador): n.º de elevadores → factor. */
  const TABLA_620 = [[1, 1], [2, 0.95], [3, 0.9], [4, 0.85], [5, 0.82], [6, 0.79], [7, 0.77], [8, 0.75], [9, 0.73], [9999, 0.72]].map(r => ({ hasta: r[0], fd: r[1] }));


  /* Perfiles de parámetros. El usuario puede editar cualquier valor después de aplicarlo. */
  const PERFILES = {
    NEC2026: {
      etiqueta: 'NEC 2026 (NFPA 70-2026)', art: '120', refLight: '120.41',
      lightVA: 22, sacN: 2, sacVA: 1500, lavVA: 1500, gfciVA: 0, cocinaVA: 8000, calentVA: 6000,
      tier1: 8000, restFD: 0.4, genFD: 1, hvacFD: 1, tablaIncluyeEquipos: false, applFD: 0.75,
      hvacAggFD: 1, hvacProjFD: 1, proyServSeparado: true,
      recVAm2: 1, svcFD: 1, fdLuz: 1, fdRec: 1, fdEq: 1, fdEsp: 1, fdHvac: 1, fdElev: 1, elevAuto: true, rec44: true, rec44Separado: false, fCoinc: 1, pf: 0.9, vUnit: 240, fases: 1, protFactor: 1.25, minBreaker: 20,
      aplica84: false
    },
    NEC2020: {
      etiqueta: 'NEC 2020 (NFPA 70-2020, edición en español · Costa Rica)', art: '220', refLight: '220.12',
      lightVA: 33, sacN: 2, sacVA: 1500, lavVA: 1500, gfciVA: 0, cocinaVA: 8000, calentVA: 6000,
      tier1: 10000, restFD: 0.4, genFD: 1, hvacFD: 1, tablaIncluyeEquipos: false, applFD: 0.75,
      hvacAggFD: 1, hvacProjFD: 1, proyServSeparado: true,
      recVAm2: 1, svcFD: 1, fdLuz: 1, fdRec: 1, fdEq: 1, fdEsp: 1, fdHvac: 1, fdElev: 1, elevAuto: true, rec44: true, rec44Separado: false, fCoinc: 1, pf: 0.9, vUnit: 240, fases: 1, protFactor: 1.25, minBreaker: 20,
      aplica84: false
    },
    NEC2023: {
      etiqueta: 'NEC 2023 (NFPA 70-2023)', art: '220', refLight: '220.12',
      lightVA: 33, sacN: 2, sacVA: 1500, lavVA: 1500, gfciVA: 0, cocinaVA: 8000, calentVA: 6000,
      tier1: 10000, restFD: 0.4, genFD: 1, hvacFD: 1, tablaIncluyeEquipos: false, applFD: 0.75,
      hvacAggFD: 1, hvacProjFD: 1, proyServSeparado: true,
      recVAm2: 1, svcFD: 1, fdLuz: 1, fdRec: 1, fdEq: 1, fdEsp: 1, fdHvac: 1, fdElev: 1, elevAuto: true, rec44: true, rec44Separado: false, fCoinc: 1, pf: 0.9, vUnit: 240, fases: 1, protFactor: 1.25, minBreaker: 20,
      aplica84: false
    },
    EXCEL: {
      etiqueta: 'Hoja de Excel original (referencia, NEC 2020/2023 con criterios del proyecto)', art: '220', refLight: '220.12',
      lightVA: 33, sacN: 2, sacVA: 1500, lavVA: 1500, gfciVA: 1440, cocinaVA: 0, calentVA: 0,
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
    p.ocupaciones = JSON.parse(JSON.stringify(OCUP_NEC));
    if (id === 'EXCEL') { p.ocupaciones[0].luz = 6; p.ocupaciones[1].luz = 6; }
    return p;
  }

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

  function corriente(va, P) { return va / (P.vUnit * (Number(P.fases) === 3 ? Math.sqrt(3) : 1)); }

  /** Vivienda. Alimentador por método opcional (220.82(B) / 120.82). */
  function calcDepto(r, P) {
    const area = num(r.area);
    const dens = dflt(r.dens, P.lightVA);
    const light = area * dens;
    const sac = dflt(r.sac, P.sacN * P.sacVA);
    const lav = dflt(r.lav, P.lavVA);
    const gfci = dflt(r.gfci, P.gfciVA);
    const esp = num(r.esp), apar = num(r.apar), hvac = num(r.hvac);
    const coc = dflt(r.coc, P.cocinaVA), cal = dflt(r.cal, P.calentVA);
    const gLC = light + sac + lav + gfci;
    const gEq = esp + apar + cal;
    const general = gLC + gEq + coc;
    const genDem = (Math.min(general, P.tier1) + Math.max(0, general - P.tier1) * P.restFD) * P.genFD;
    const hvacDem = hvac * P.hvacFD;
    const dem = genDem + hvacDem;
    const ci = general + hvac;
    const iInst = corriente(ci, P), iDem = corriente(dem, P), iProt = iDem * P.protFactor;
    const std = siguiente(iProt, P.breakers);
    const brk = std === null ? null : Math.max(std, P.minBreaker);
    return { area, light, sac, lav, gfci, coc, cal, gLC, gEq, general, genDem, hvac, hvacDem, ci, dem, iInst, iDem, iProt, brk };
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
    return kw * 1000 * (prom > 12 ? 1 + 0.05 * Math.ceil(prom - 12) : 1);
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

  g.NEC = { PERFILES, nuevosParams, escalonada, siguiente, calcDepto, calcServicio, calcElevadores, resumenDeptos, resumenServicios,
    resumenProyecto, transformador, multifamiliar, TABLA_42, TABLA_84, TABLA_44, TABLA_620, OCUP_NEC, BRK_NEC, BRK_EXCEL, TRAFOS_3F };
})(typeof window !== 'undefined' ? window : globalThis);
