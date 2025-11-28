# Netzwerk Graph - Deployment-Paket

Dieser Ordner enthält alle Dateien, die Sie direkt in Ihr GitHub Pages Repository kopieren können.

## 📦 Was ist enthalten?

- `index.html` - Haupt-HTML-Datei (mit relativen Pfaden)
- `static/` - Alle JavaScript- und CSS-Dateien
- `fonts/` - Schriftarten
- `graph_data.json` - Die Daten für den Graph
- Alle anderen Assets (Icons, Manifest, etc.)

## 🚀 So verwenden Sie es:

### Option 1: Als Unterordner in Ihrem Pages Repo

1. **Kopieren Sie den gesamten Inhalt** dieses Ordners (`pages-deploy/`)
2. **Erstellen Sie einen neuen Ordner** in Ihrem GitHub Pages Repository (z.B. `aea` oder `netzwerk-graph`)
3. **Fügen Sie alle Dateien** in diesen neuen Ordner ein
4. **Commiten und pushen** Sie die Änderungen
5. **Die App ist erreichbar unter**: `https://ihr-username.github.io/repo-name/ordner-name/`

### Option 2: Als Root-Verzeichnis

1. **Kopieren Sie den gesamten Inhalt** dieses Ordners (`pages-deploy/`)
2. **Fügen Sie alle Dateien** direkt in das Root-Verzeichnis Ihres GitHub Pages Repository ein
3. **Commiten und pushen** Sie die Änderungen
4. **Die App ist erreichbar unter**: `https://ihr-username.github.io/repo-name/`

## ✅ Wichtige Hinweise:

- **Alle Pfade sind relativ** - Die App funktioniert in jedem Ordner
- **Keine Anpassungen nötig** - Einfach kopieren und fertig!
- **graph_data.json** ist bereits enthalten
- **Alle Assets** (Fonts, Icons, etc.) sind enthalten

## 📁 Ordnerstruktur nach dem Kopieren:

```
Ihr-Pages-Repo/
├── index.html (Ihr Haupt-Index, falls vorhanden)
└── aea/ (oder wie Sie den Ordner nennen)
    ├── index.html
    ├── graph_data.json
    ├── fonts/
    ├── static/
    └── ...
```

## 🔍 Troubleshooting:

- **App lädt nicht**: Stellen Sie sicher, dass alle Dateien kopiert wurden
- **Daten werden nicht geladen**: Prüfen Sie, ob `graph_data.json` im richtigen Ordner liegt
- **Styles fehlen**: Prüfen Sie, ob der `static/` Ordner vollständig kopiert wurde

## 📝 Beispiel-URLs:

- Als Unterordner: `https://kxljxv.github.io/mein-repo/aea/`
- Als Root: `https://kxljxv.github.io/mein-repo/`

---

**Fertig!** Nach dem Kopieren und Pushen sollte die App sofort funktionieren.

