# Publicar una versión

La app se publica en GitHub Pages: <https://vidanj.github.io/InvestFollowCalc/>. Cada paso de este
proceso que toca git o GitHub (merge, push, tag, deploy) se hace **sólo con orden explícita** del
dueño del proyecto (ver [CLAUDE.md](../CLAUDE.md)).

## 1. Verificar localmente

```sh
npm run lint && npm run format:check && npm run typecheck
npm run test:coverage
npm run test:e2e        # escritorio, Pixel 7 e iPhone 14 (WebKit)
```

Todo en verde. Actualizar `version` en `package.json` y una entrada en [CHANGELOG.md](../CHANGELOG.md).

## 2. Integrar a `main`

Con orden explícita: merge de la rama (o PR) y push. El workflow de CI corre lint, pruebas, build y
e2e en cada push a `main` y en cada PR. **Un push a `main` no publica nada.**

## 3. Habilitar GitHub Pages (sólo la primera vez)

_Settings → Pages → Build and deployment → Source: **GitHub Actions**._ O con la CLI:

```sh
gh api -X POST repos/vidanj/InvestFollowCalc/pages -f build_type=workflow
```

## 4. Publicar (manual)

_Actions → Deploy to GitHub Pages → Run workflow_ (rama `main`), o:

```sh
gh workflow run deploy.yml --ref main
gh run watch
```

El workflow vuelve a correr lint, typecheck, pruebas y build antes de publicar, y se niega a publicar
desde otra rama que no sea `main`.

## 5. Etiquetar (opcional)

```sh
git tag -a v1.0.0 -m "v1.0.0" && git push origin v1.0.0
```

## 6. Verificación manual en dispositivos

Las pruebas automáticas cubren Chromium (escritorio y Android) y WebKit (iPhone), pero instalar la
app sólo se puede comprobar en dispositivos reales:

- [ ] **Android (Chrome):** instalar desde _Ajustes → Instalar_; abre como app; modo avión → abre y
      muestra los datos.
- [ ] **iPhone (Safari):** _Compartir → Agregar a inicio_; abre a pantalla completa; modo avión.
- [ ] **Windows o Mac (Chrome/Edge):** instalar; abre en su propia ventana.
- [ ] **Respaldo entre dispositivos:** crear respaldo en uno, importarlo en otro, mismos números.
- [ ] **Actualización:** tras publicar una versión nueva, la app instalada muestra "Hay una nueva
      versión" y al aceptar carga la nueva.
- [ ] **Tema:** Sistema / Claro / Oscuro se ven bien en cada dispositivo.
