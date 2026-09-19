# Definition of Done y estrategia de calidad

**Estado:** aplicable a todos los issues
**Alcance:** E0-I3
**Referencia:** [PRD, secciones 14, 15 y 19](../../PRD.md)

## Definition of Done por issue

Un issue está terminado cuando:

- El alcance y criterios de aceptación están implementados, sin controles principales decorativos.
- TypeScript estricto, lint, pruebas relevantes y build pasan en el workspace.
- Se agregan o ajustan pruebas para reglas, errores o regresiones introducidas.
- La interfaz aplicable es operable por teclado, conserva foco visible, texto alternativo y contraste suficiente.
- La vista se verifica en escritorio, tableta y móvil cuando cambia interfaz.
- Las consultas y mutaciones preservan el aislamiento por `phId` y validan permiso en la capa de datos.
- Se cubren estados aplicables: carga, vacío, sin resultados, error, acceso denegado y conflicto.
- Se actualiza documentación de contratos o decisiones si el cambio altera una frontera pública.

## Pirámide de pruebas

| Nivel | Qué protege | Evidencia esperada |
| --- | --- | --- |
| Unitarias | Esquemas Zod, `can`, selectores, transiciones, recurrencias y métricas | Casos normales, límites y denegados deterministas. |
| Componentes | Formularios, foco, mensajes, acciones alternativas al arrastre y estados | Testing Library; aserciones de rol, nombre y teclado. |
| Integración | Repositorio, persistencia, rutas y sincronización de vistas | Flujos con el mismo `WorkItem`, recuperación y cruce de PH rechazado. |
| Recorrido de aceptación | Criterios del PRD que cruzan módulos | Checklist con URL/flujo, resultado y fecha. |

Las pruebas que involucren fechas fijan reloj y zona horaria. Ninguna prueba puede depender de datos locales previos, orden incidental o zona horaria del equipo.

## Controles automáticos previstos

El CI de E1-I5 ejecutará, en este orden, `lint`, `typecheck`, `test` y `build`. Un fallo bloquea la integración. Formateo, dependencias y análisis de accesibilidad se incorporan como verificaciones adicionales cuando se habiliten sus herramientas.

## Evidencia para cierre

Cada cierre debe incluir el resumen de cambio, criterios cubiertos, comandos ejecutados y su resultado, pruebas añadidas o actualizadas, y limitaciones conocidas. Para cambios visuales, se adjunta captura o recorrido reproducible en los tres tamaños relevantes. Para permisos, persistencia o aislamiento, se cita la prueba de rechazo además de la permitida.

## Puertas por incremento

- **E1:** workspace reproducible, contratos iniciales y CI funcionando.
- **E2:** persistencia determinista, recuperación y pruebas de aislamiento PH.
- **E3–E6:** mutaciones autorizadas, navegación responsive y vistas consistentes.
- **E7:** los 15 criterios generales del PRD cuentan con evidencia y el build de producción termina sin errores.
