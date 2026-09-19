# Plan de ejecución — Epic E0

**Épico padre:** E0 — Gobierno técnico y decisiones de producto
**Regla de cierre:** el épico no se considera terminado hasta que los tres sub-issues estén implementados, verificados y tengan su evidencia de cierre.

## Secuencia y dependencia

```text
E0-I1 ─┬─> E0-I2 ─┐
       └─> E0-I3 ─┴─> Verificación del Epic E0
```

E0-I1 fija los límites que usa la autorización. E0-I2 y E0-I3 pueden finalizar en paralelo una vez aceptadas esas decisiones.

## E0-I1 — Decisiones de arquitectura y pendientes

**Estado:** completado.

**Implementación.** Mantener ADRs versionados que describan asociaciones, columnas semánticas, validación configurable, contratos Zod, inversión de dependencias, aislamiento por PH e identidad provisional. Separar pendientes que no bloquean el frontend de los que deben resolverse antes de backend.

**Archivos.** `docs/governance/architecture-decisions.md` y `docs/governance/README.md`.

**Verificación.** Revisión de que cada decisión tenga decisión, motivo y consecuencias; revisión de enlaces al PRD y plan.

**Criterio de cierre.** Todos los temas del issue están trazables y no hay pendientes bloqueantes mezclados con los no bloqueantes.

## E0-I2 — Matriz y evaluador de capacidades

**Estado:** completado. Evidencia: `pnpm --filter @task-manager/domain typecheck` y `pnpm --filter @task-manager/domain test` (5 pruebas aprobadas).

**Implementación.**

1. Definir tipos puros para actor, acción y recurso en `packages/domain`.
2. Implementar `can(actor, action, resource)` con guard inicial de actor activo y mismo `phId`.
3. Incorporar alcance por proyecto/equipo, propiedad de tarea y validación exclusiva de administración.
4. Exportar la API desde la entrada pública del paquete y documentar la matriz de UX.
5. Añadir pruebas de permitidos, denegados y cruce entre PH.

**Archivos.** `packages/domain/src/authorization.ts`, `packages/domain/src/index.ts`, `packages/domain/test/authorization.test.ts` y `docs/governance/authorization.md`.

**Verificación.** `pnpm --filter @task-manager/domain typecheck` y `pnpm --filter @task-manager/domain test`.

**Criterio de cierre.** La API es independiente de React y persistencia, protege por PH y tiene pruebas que cubren cada rol y denegación crítica.

## E0-I3 — Definition of Done y calidad

**Estado:** completado.

**Implementación.** Establecer controles mínimos por issue, tipos de prueba, evidencia de cierre y puertas de calidad por incremento. Los comandos de CI se documentan sin afirmar que estén disponibles antes de E1-I5.

**Archivos.** `docs/governance/quality-strategy.md` y `docs/governance/README.md`.

**Verificación.** Revisión frente a requisitos de compilación, lint, tipos, pruebas, teclado, responsive, aislamiento PH y evidencia.

**Criterio de cierre.** La estrategia distingue pruebas unitarias, de componente e integración y define una evidencia repetible.

## Verificación final del épico

- Confirmar los criterios de E0-I1, E0-I2 y E0-I3 contra sus documentos y pruebas.
- Ejecutar typecheck y pruebas del evaluador de capacidades.
- Registrar resultados, archivos y cualquier límite residual en el cierre del Epic E0.

## Límite conocido fuera de E0

La validación global del workspace ejecutada el 18 de septiembre de 2026 aprobó `lint` (con una advertencia existente) y `test`, pero `typecheck` y `build` fallaron únicamente en `@task-manager/web`: no se resuelve `@task-manager/ui` y falta `tailwindcss`. Son defectos de la base E1 que deben corregirse antes de cerrar E1; no cambian el cumplimiento documental ni las pruebas del Epic E0.
