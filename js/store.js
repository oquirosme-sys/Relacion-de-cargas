/* Persistencia. PASO 2 (posterior): reemplazar el contenido de load()/save() por Supabase
   (tablas proyecto → sectores → deptos / servicios, y parámetros por proyecto). El resto de la app
   solo usa Store.state, Store.save(), Store.exportar(), Store.importar() y Store.ejemplo(). */
(function (g) {
  'use strict';
  const KEY = 'cargas.proyecto.v1';
  const uid = () => 's' + Math.random().toString(36).slice(2, 9);

  const HVAC = (4440 / 0.9) + 444; // equipo HVAC por vivienda en la hoja original (VA)
  const ESP = 7750 / 0.9;          // calentador jacuzzi (VA)
  function dep(grupo, nombre, area, conEsp) {
    return { id: uid(), grupo, nombre, area, dens: null, sac: null, lav: null, gfci: null, esp: conEsp ? ESP : 0, apar: 180, hvac: HVAC, incl: true };
  }
  function sv(grupo, nombre, area, tipo) {
    return { id: uid(), grupo, nombre, area, pct: 100, tipo, dLuz: null, dUps: null, dRec: null, dHvac: null, eq: 0, esp: 0, incl: true };
  }

  function ejemplo() {
    const deptos = [
      dep('PLANTA BAJA 2BD-3U', 'DEPTO A1', 243, true), dep('PLANTA BAJA 2BD-3U', 'DEPTO A2', 236, true), dep('PLANTA BAJA 2BD-3U', 'DEPTO A3', 240, true),
      dep('PRIMER NIVEL 2BD-3U', 'DEPTO A1', 255), dep('PRIMER NIVEL 2BD-3U', 'DEPTO A2', 250), dep('PRIMER NIVEL 2BD-3U', 'DEPTO A3', 258),
      dep('SEGUNDO NIVEL 2BD-3U', 'DEPTO A1', 255), dep('SEGUNDO NIVEL 2BD-3U', 'DEPTO A2', 250), dep('SEGUNDO NIVEL 2BD-3U', 'DEPTO A3', 258),
      dep('PLANTA BAJA 3BD-B', '121A', 395, true), dep('PLANTA BAJA 3BD-B', '121B', 367, true),
      dep('PRIMER NIVEL 3BD-B', '131A', 410), dep('PRIMER NIVEL 3BD-B', '131B', 390),
      dep('SEGUNDO NIVEL 3BD-B', '141A', 410), dep('SEGUNDO NIVEL 3BD-B', '141B', 360),
      dep('AZOTEA 3BD-B', 'TERRAZA A', 90), dep('AZOTEA 3BD-B', 'TERRAZA B', 90)
    ];
    const servicios = [
      sv('PLANTA BAJA', 'PASILLO DE SERVICIO', 135.48, 'pasillos'), sv('PLANTA BAJA', 'ESCALERAS EMERGENCIA', 13.26, 'escaleras'),
      sv('PRIMER NIVEL', 'PASILLO DE SERVICIO', 27.16, 'pasillos'), sv('PRIMER NIVEL', 'ESCALERAS EMERGENCIA', 25.3, 'escaleras'),
      sv('SEGUNDO NIVEL', 'PASILLO DE SERVICIO', 278.72, 'pasillos'), sv('SEGUNDO NIVEL', 'ESCALERAS EMERGENCIA', 25.3, 'escaleras')
    ];
    const A = { id: uid(), nombre: 'Sector A', modo: 'detalle', deptos, servicios, elevadores: [], fdServ: {}, resumen: { depLC: 0, depAC: 0, svLC: 0, svAC: 0, svFDlc: null, svFDac: null } };
    // Sectores B y C: la hoja "Relación Completa" solo trae totales (vínculos a otros libros), por eso van en modo resumen.
    const B = { id: uid(), nombre: 'Sector B', modo: 'resumen', deptos: [], servicios: [], elevadores: [], fdServ: {}, resumen: { depLC: 234.45012, depAC: 49.953333, svLC: 3.53654, svAC: 12.40404, svFDlc: null, svFDac: 0.9 } };
    const C = { id: uid(), nombre: 'Sector C', modo: 'resumen', deptos: [], servicios: [], elevadores: [], fdServ: {}, resumen: { depLC: 247.323, depAC: 63.353333, svLC: 3.53654, svAC: 12.40404, svFDlc: null, svFDac: 1 } };
    return {
      version: 1,
      proyecto: { nombre: 'Peninsula Residences Costa Palmas', ubicacion: '', fecha: new Date().toISOString().slice(0, 10), responsable: '' },
      params: NEC.nuevosParams('NEC2020'),
      sectores: [A, B, C],
      activo: A.id
    };
  }

  const Store = {
    state: null,
    uid,
    load() {
      try { const t = localStorage.getItem(KEY); if (t) { this.state = JSON.parse(t); } } catch (e) { /* sin almacenamiento */ }
      if (!this.state || !this.state.params || !this.state.sectores) this.state = ejemplo();
      this.migrar(this.state);
      return this.state;
    },
    /** Completa parámetros nuevos y convierte filas de servicios del formato anterior. */
    migrar(S) {
      const P = S.params, base = NEC.nuevosParams(P.perfil || 'NEC2020');
      Object.keys(base).forEach(k => { if (P[k] === undefined) P[k] = JSON.parse(JSON.stringify(base[k])); });
      if (P.ocupaciones.length && P.ocupaciones[0].luz === undefined) {
        const old = {};
        P.ocupaciones.forEach(o => { old[o.id] = o.va; });
        P.ocupaciones = base.ocupaciones;
        P.ocupaciones.forEach(o => { if (old[o.id] !== undefined) o.luz = old[o.id]; });
      }
      S.sectores.forEach(sec => {
        sec.elevadores = sec.elevadores || [];
        sec.fdServ = sec.fdServ || {};
        (sec.servicios || []).forEach(r => {
          if (r.tipo !== undefined) return;
          r.tipo = r.ocup || 'pasillos';
          r.dLuz = r.dens === undefined ? null : r.dens;
          r.dRec = r.rec === undefined ? null : r.rec;
          r.dHvac = r.hvac === undefined ? null : r.hvac;
          r.dUps = null; r.esp = 0; r.pct = 100; r.eq = (r.eq || 0) * 1000;
          ['ocup', 'dens', 'rec', 'hvac', 'fd'].forEach(k => { delete r[k]; });
        });
      });
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* ignorar */ } },
    ejemplo() { this.state = ejemplo(); this.save(); },
    sector() { const s = this.state; return s.sectores.find(x => x.id === s.activo) || s.sectores[0]; },
    exportar() { return JSON.stringify(this.state, null, 2); },
    importar(txt) {
      const o = JSON.parse(txt);
      if (!o || !o.params || !Array.isArray(o.sectores) || !o.sectores.length) throw new Error('El archivo no es un proyecto de cargas válido.');
      this.state = o; if (!o.activo) o.activo = o.sectores[0].id; this.save();
    },
    nuevoSector(nombre) {
      const s = { id: uid(), nombre, modo: 'detalle', deptos: [], servicios: [], elevadores: [], fdServ: {}, resumen: { depLC: 0, depAC: 0, svLC: 0, svAC: 0, svFDlc: null, svFDac: null } };
      this.state.sectores.push(s); this.state.activo = s.id; this.save(); return s;
    },
    nuevaFilaDepto(grupo) { return { id: uid(), grupo: grupo || '', nombre: '', area: 0, dens: null, sac: null, lav: null, gfci: null, esp: 0, apar: 0, hvac: 0, incl: true }; },
    nuevaFilaServicio(grupo) { return { id: uid(), grupo: grupo || '', nombre: '', area: 0, pct: 100, tipo: 'pasillos', dLuz: null, dUps: null, dRec: null, dHvac: null, eq: 0, esp: 0, incl: true }; }
  };
  g.Store = Store;
})(window);
