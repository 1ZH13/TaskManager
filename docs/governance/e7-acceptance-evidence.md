# E7 — matriz de evidencia de aceptación

Esta matriz es la fuente de cierre del épico E7. Un criterio solo pasa a
**Verificado** cuando hay prueba automatizada y, cuando corresponde, recorrido
manual en escritorio, tableta y móvil.

| #   | Criterio del PRD                            | Evidencia automatizada actual                                                 | Recorrido manual pendiente                            |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | El cambio de PH reemplaza datos visibles    | `WorkspaceContent` rechaza una URL de otra PH; repositorio prueba aislamiento | Cambiar PH con cada vista abierta                     |
| 2   | Los módulos tienen proyectos independientes | `local-repository.test.ts` consulta por módulo/PH                             | Revisar navegación de los tres módulos                |
| 3   | Una tarea se refleja en vistas e informes   | `report-selectors.test.ts`; selectores compartidos                            | Crear, mover y comprobar las cinco vistas             |
| 4   | Arrastre y alternativa accesible            | pruebas del tablero y controles de movimiento                                 | Probar teclado y lector de pantalla                   |
| 5   | CRUD y reordenamiento de columnas           | `local-repository.test.ts`                                                    | Probar panel de configuración                         |
| 6   | Se eliminan columnas iniciales              | prueba de invariantes de columnas                                             | Confirmar las cuatro opciones en UI                   |
| 7   | Columna con tareas exige destino            | `local-repository.test.ts`                                                    | Confirmar mensaje y recuperación                      |
| 8   | Informes usan los mismos datos              | `report-selectors.test.ts`                                                    | Validar filtros y series en `/informes`               |
| 9   | Filtros combinables y restablecibles        | selectores de trabajo e informes                                              | Combinar todos los filtros y restablecer              |
| 10  | Colaborador solo ve lo autorizado           | `local-repository.test.ts`                                                    | Revisar tablero, informes y recursos como colaborador |
| 11  | Cambios sobreviven recarga                  | pruebas de persistencia del repositorio                                       | Recargar navegador tras una mutación                  |
| 12  | Botones no decorativos                      | pruebas de componentes focalizadas                                            | Inventario completo de acciones visibles              |
| 13  | Escritorio y móvil utilizables              | CSS responsive y recorrido pendiente                                          | Capturas en 1440, 768 y 375 px                        |
| 14  | Vistas no dependen de persistencia local    | revisión de `WorkManagementRepository`                                        | Revisar imports de pantallas                          |
| 15  | Adaptador HTTP sustituible                  | `local-repository.test.ts` cubre HTTP                                         | Probar una vista contra un adaptador HTTP simulado    |

## Comandos de evidencia

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Además, ejecutar el recorrido manual indicado antes de cerrar #48 o el épico.
Si el entorno de pnpm exige reinstalación no interactiva, registrar esa
limitación junto con las verificaciones directas ejecutadas, pero no considerar
el build global como validado hasta resolverla.

## Ejecución registrada

- 2026-09-19: `apps/web/node_modules/.bin/next.cmd build` terminó correctamente
  con Next.js 16.3.5; compiló, verificó TypeScript y generó las diez rutas.
- 2026-09-19: revisión local de `/informes` a 375 px confirmó controles
  accesibles y ningún desbordamiento horizontal (ancho de documento 360 px).
- 2026-09-19: revisión local de `/informes` como colaborador confirmó que los
  filtros de proyecto y tablero solo exponen el alcance operativo autorizado.
- 2026-09-19: revisión local de
  `/operaciones/mantenimiento/informes` confirmó que módulo y proyecto quedan
  fijados por la ruta, y que solo el tablero Mantenimiento puede filtrarse.
- 2026-09-19: revisión local de `/operaciones/mantenimiento/tablero` a 375 px
  confirmó ancho de documento 360 px sin desbordamiento y controles accesibles
  para mover columnas antes/después, sin depender exclusivamente del arrastre.
