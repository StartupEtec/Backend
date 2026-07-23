# Guía de Contribución

¡Gracias por contribuir a nuestra plataforma digital on-demand! Para mantener la consistencia y la calidad en el código, por favor sigue estas directrices.

## 🛠️ Flujo de Trabajo para el Desarrollo

1. **Crear una rama**: Utiliza nombres descriptivos basados en el tipo de cambio y el ID del issue.
   - Ejemplo: `feature/2312-setup-proyecto` o `bugfix/123-fix-auth`
2. **Escribir Código Limpio**:
   - Mantén una única responsabilidad para cada función.
   - Sigue los principios SOLID.
   - No dejes variables ni logs huérfanos sin formatear.
3. **Formateo**:
   - El formateo automático al guardar ("Format on Save") está habilitado mediante VSCode y Prettier.
   - Ejecuta `npm run format` antes de subir tus cambios para asegurar el estándar de estilo.
4. **Testing**:
   - Cada nueva funcionalidad o lógica en servicios debe acompañarse de sus pruebas unitarias en el directorio `tests/`.
   - Cobertura mínima requerida del 70%.

## 📝 Reglas de Commits

Utiliza especificaciones de commits convencionales (Conventional Commits):
- `feat: ...` para nuevas características.
- `fix: ...` para parches y bugs.
- `docs: ...` para cambios de documentación.
- `style: ...` para formateo o cambios de estilo sin impacto funcional.
- `refactor: ...` para mejoras de código que no corrigen bugs ni añaden features.
