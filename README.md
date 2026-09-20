# TaskManager

Frontend demostrable para gestionar el trabajo de propiedades horizontales. Cada
propiedad horizontal (PH) es un contexto aislado: los proyectos, personas,
equipos, tareas, documentos, proveedores e informes no se comparten entre PH.

## Inicio rápido

Requiere Node.js 24 o posterior y pnpm 11.

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Abre la URL indicada por Next.js. La aplicación incluye dos PH y usuarios de
demostración; usa los selectores del encabezado para cambiar de contexto o de
rol. Para borrar los cambios persistidos durante una demostración, usa el botón
de restablecimiento del encabezado y confirma la operación.

## Recorrido de demostración

1. Abre `/operaciones/mantenimiento/tablero` para crear, mover y revisar
   tareas en el tablero operativo.
2. Cambia a `/operaciones/mantenimiento/informes` para ver los indicadores del
   proyecto; `/informes` muestra los informes generales permitidos de la PH.
3. Cambia entre administrador y colaborador: el colaborador solo recibe sus
   proyectos, equipos, tableros y tareas autorizados.
4. Prueba las rutas independientes `/solicitudes/cita` y
   `/solicitudes/factura`, después documentos, proveedores, actividad y
   notificaciones desde la navegación.
5. Cambia de PH y verifica que los datos visibles se reemplazan por completo.

## Verificación

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

En entornos donde el envoltorio de pnpm intente reinstalar dependencias de
forma no interactiva, se pueden ejecutar temporalmente los binarios locales:

```powershell
node_modules\.bin\tsc.cmd -p apps\web\tsconfig.json --noEmit
node_modules\.bin\tsc.cmd -p packages\data\tsconfig.json --noEmit
packages\domain\node_modules\.bin\vitest.cmd run --config apps\web\vitest.config.mts
```

## Arquitectura y preparación HTTP

Las pantallas usan `WorkManagementRepository`, nunca `localStorage` o `fetch`
directamente. `LocalWorkManagementRepository` simula persistencia para la demo;
`createHttpRepository` conserva la misma interfaz como punto de sustitución
para el backend. Los contratos, errores, concurrencia e idempotencia están en
[docs/architecture/http-api-contract.md](docs/architecture/http-api-contract.md).

Los esquemas Zod y tipos compartidos viven en `packages/shared`; las reglas,
permisos y selectores puros en `packages/domain`; los adaptadores en
`packages/data`; y las pantallas Next.js en `apps/web`.

## Límites intencionales de esta fase

- Los archivos, notificaciones y sincronización de proveedores son
  simulaciones persistentes en el navegador.
- La autenticación y autorización reales deberán aplicarse en el backend; el
  frontend mantiene los mismos límites de `phId` y rol como defensa de demo.
- ITBMS, disponibilidad de citas y almacenamiento privado de adjuntos quedan
  configurables hasta que se incorporen las políticas y servicios reales.
