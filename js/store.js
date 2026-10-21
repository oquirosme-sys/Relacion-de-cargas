/* Persistencia. PASO 2 (posterior): reemplazar el contenido de load()/save() por Supabase
   (tablas proyecto → sectores → deptos / servicios, y parámetros por proyecto). El resto de la app
   solo usa Store.state, Store.save(), Store.exportar(), Store.importar() y Store.ejemplo(). */
(function (g) {
  'use strict';
  const KEY = 'cargas.proyecto.v4';
  const uid = () => 's' + Math.random().toString(36).slice(2, 9);

  /** Proyecto en blanco: un sector, una vivienda "Tablero TP" (hoja de alimentadores de aptos) y los espacios de servicios del ejemplo. */
  function ejemplo() {
    const L = ids => ids.map(id => ({ id, qty: 1, kva: null }));
    const disp = L(['refrig', 'tritur', 'lavaplatos', 'micro', 'cocina', 'secad']);
    const disp53 = [1, 2, 3, 4, 5, 6, 7].map(() => ({ id: 'cal1', qty: 1, kva: null }));
    const tipoA = { id: uid(), grupo: 'Tablero TP', nombre: '1', area: 629, dens: 20, recDw: 30, extDw: 5, sac: 3000, lav: 1500, gfci: 1000,
      telecom: 1500, detect: 1000, hvacDens: 80, manej: 10, hvac: 0, coc: null, cal: null, apar: null, esp: null, divFD: 0.8, disp, disp53, incl: true };
    const sv = (grupo, nombre, area, tipo) => ({ id: uid(), grupo, nombre, area, pct: 100, tipo, dLuz: null, dUps: null, dRec: null, dHvac: null, eq: 0, esp: 0, incl: true });
    const servicios = [
      sv('PLANTA BAJA', 'PASILLO DE SERVICIO', 135.48, 'pasillos'), sv('PLANTA BAJA', 'ESCALERAS EMERGENCIA', 13.26, 'escaleras'),
      sv('PRIMER NIVEL', 'PASILLO DE SERVICIO', 27.16, 'pasillos'), sv('PRIMER NIVEL', 'ESCALERAS EMERGENCIA', 25.3, 'escaleras'),
      sv('SEGUNDO NIVEL', 'PASILLO DE SERVICIO', 278.72, 'pasillos'), sv('SEGUNDO NIVEL', 'ESCALERAS EMERGENCIA', 25.3, 'escaleras')
    ];
    const A = { id: uid(), nombre: 'Sector A', modo: 'detalle', deptos: [tipoA], servicios, elevadores: [], fdServ: {}, resumen: { depLC: 0, depAC: 0, svLC: 0, svAC: 0, svFDlc: null, svFDac: null } };
    return {
      version: 1,
      proyecto: { nombre: '', ubicacion: '', fecha: '', responsable: '' },
      params: NEC.nuevosParams('NEC2020'),
      sectores: [A],
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
      P.ocupaciones.forEach(o => {
        if (o.ash === undefined) { const b = base.ocupaciones.find(x => x.id === o.id); o.ash = b ? b.ash : null; }
      });
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
