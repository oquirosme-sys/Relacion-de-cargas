# Relación de cargas eléctricas (web)

Herramienta HTML para estimar cargas de baja tensión (viviendas y servicios) con el NEC 2020 en español (Costa Rica). Sin dependencias ni compilación; se publica tal cual en **GitHub Pages** (*Settings ▸ Pages ▸ GitHub Actions*) o abriendo `index.html`.

| Página | Qué hace |
|---|---|
| `index.html` | Proyecto y relación de cargas completa, demanda total y transformador |
| `departamentos.html` | Viviendas: alumbrado, contactos, cocina, calentador, A/A; alimentador por vivienda |
| `servicios.html` | Espacios (área × % × densidades VA/m²), elevadores y cuadro de cargas |
| `parametros.html` | Perfil NEC 2020 / 2023 / 2026 / Excel original, factores y tablas editables |

Los datos se guardan en `localStorage`; use *Exportar proyecto* / *Importar* para respaldar. El acceso a datos está aislado en `js/store.js` para el paso 2 (Supabase).
Resultados preliminares: verifique tablas y secciones contra el texto oficial del NEC adoptado.
