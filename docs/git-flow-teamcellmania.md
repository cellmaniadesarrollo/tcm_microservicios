# Guía de Flujo de Ramas Git - Teamcellmania Backend

## Ramas principales

- **main** → Código en producción (estable)
- **dev** → Rama de integración (puente entre el equipo). Todas las features se integran aquí primero.

## Convenciones de nombrado

- **Features** (nuevas funcionalidades): `feature/nombre-descriptivo`
- **Fixes / Hotfixes** (correcciones urgentes): `fix/nombre-descriptivo` o `hotfix/nombre-descriptivo`

---

## 1. Crear una Feature Branch (desde `dev`)

```bash
# Asegurarse de estar actualizado
git checkout dev
git pull origin dev

# Crear y cambiarse a la nueva feature
git checkout -b feature/nombre-de-la-funcionalidad

# Subirla a GitHub
git push -u origin feature/nombre-de-la-funcionalidad
```

---

## 2. Crear una Fix / Hotfix Branch (desde `main`)

```bash
git checkout main
git pull origin main

git checkout -b fix/nombre-del-fix
# o
git checkout -b hotfix/nombre-del-fix

git push -u origin fix/nombre-del-fix
```

---

## 3. Guardar cambios temporalmente (Stash) — ¡Muy útil!

```bash
# Guardar cambios sin commitear
git stash

# Ver lista de stashes
git stash list

# Recuperar el último stash
git stash pop

# Recuperar un stash específico
git stash apply stash@{1}
```

---

## 4. Cambiar entre ramas

```bash
git checkout dev
git checkout feature/mi-rama
git checkout main
git checkout fix/mi-fix
```

---

## 5. Eliminar una Feature Branch (cuando ya se mergeó)

```bash
# Cambiar a una rama segura primero
git checkout dev

# Eliminar localmente
git branch -d feature/nombre-de-la-funcionalidad

# Eliminar remotamente (GitHub)
git push origin --delete feature/nombre-de-la-funcionalidad
```

---

## 6. Actualizar tu rama con los últimos cambios (Rebase o Merge)

### Opción recomendada: Rebase (historial más limpio)

```bash
git checkout feature/mi-rama
git fetch origin

# Traer cambios de dev y rebase
git rebase origin/dev
```

> Si hay conflictos, resuélvelos y continúa con `git rebase --continue`.

### Opción alternativa: Merge

```bash
git checkout feature/mi-rama
git merge dev
```

---

## 7. Flujo completo de una Feature

1. Crear la rama desde `dev`
2. Trabajar y commitear
3. Hacer Pull Request → mergear a `dev`
4. Cada desarrollador actualiza sus otras ramas de feature:

```bash
git checkout feature/otra-feature
git rebase dev
# o
git merge dev
```

---

## 8. Flujo completo de un Fix / Hotfix

1. Crear la rama desde `main`
2. Hacer el fix y commitear
3. Mergear a `main` (y hacer tag si es necesario)
4. **Importante:** Propagar el fix a `dev` y al resto de ramas:

```bash
# Mergear a main
git checkout main
git merge fix/nombre-del-fix
git push origin main

# Propagar a dev
git checkout dev
git merge main
git push origin dev

# Cada desarrollador actualiza sus ramas:
git checkout feature/su-rama
git rebase dev
# o
git merge dev
```

---

## ✅ Consejos importantes

- Siempre crea **features** desde `dev`
- Siempre crea **fixes/hotfixes** desde `main`
- Usa `git rebase` para mantener un historial limpio (en vez de `merge` cuando sea posible)
- Antes de cualquier cosa importante: `git fetch origin` y `git status`
- Usa `git stash` cuando necesites cambiar de rama rápidamente sin commitear
- Después de mergear a `dev` o `main`, actualiza tus otras ramas activas
