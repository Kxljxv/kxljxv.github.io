# Netzwerk Graph - Deployment-Paket (KORRIGIERTE VERSION)

## ✅ Was wurde korrigiert?

Diese Version wurde speziell angepasst, um das Problem mit der hängenden Simulation zu beheben:

- ✅ **Alle Pfade sind jetzt relativ** - funktioniert in jedem Ordner
- ✅ **DATA_URL verwendet relative Pfade** - graph_data.json wird korrekt geladen
- ✅ **index.html wurde korrigiert** - alle Pfade sind relativ
- ✅ **JavaScript-Dateien wurden angepasst** - keine absoluten Pfade mehr

## 🚀 Schnellstart

1. **Kopieren Sie ALLE Dateien** aus diesem Ordner
2. **Fügen Sie sie in einen neuen Ordner** in Ihrem GitHub Pages Repository ein
3. **Committen und pushen** Sie die Änderungen
4. **Fertig!** Die App sollte jetzt vollständig funktionieren

## 📁 Ordnerstruktur

Nach dem Kopieren sollte es so aussehen:

```
Ihr-Pages-Repo/
└── aea/ (oder wie Sie den Ordner nennen)
    ├── index.html
    ├── graph_data.json
    ├── static/
    │   ├── js/
    │   ├── css/
    │   └── media/
    ├── fonts/
    └── ...
```

## 🔍 Troubleshooting

### Simulation bleibt hängen?

1. Öffnen Sie die Browser-Konsole (F12)
2. Prüfen Sie, ob es Fehler gibt
3. Prüfen Sie, ob `graph_data.json` geladen wird:
   - Öffnen Sie: `https://ihr-username.github.io/repo-name/ordner-name/graph_data.json`
   - Sollte die JSON-Datei anzeigen

### App lädt nicht?

- Warten Sie 2-3 Minuten nach dem Push
- Prüfen Sie die URL (muss mit `/ordner-name/` enden)
- Stellen Sie sicher, dass `index.html` im Ordner liegt

### Daten werden nicht geladen?

- Prüfen Sie, ob `graph_data.json` im Ordner liegt
- Prüfen Sie die Browser-Konsole auf 404-Fehler
- Stellen Sie sicher, dass alle Dateien kopiert wurden

## 📝 Wichtige Hinweise

- **Alle Pfade sind relativ** - Die App funktioniert in jedem Ordner
- **Keine Anpassungen nötig** - Einfach kopieren und fertig!
- **graph_data.json** ist bereits enthalten
- **Alle Assets** (Fonts, Icons, etc.) sind enthalten

## ✅ Checkliste

- [ ] Alle Dateien wurden kopiert
- [ ] graph_data.json ist im Ordner
- [ ] index.html ist im Ordner
- [ ] static/ Ordner ist vollständig
- [ ] Änderungen wurden committed und gepusht
- [ ] 2-3 Minuten gewartet nach dem Push

---

**Nach dem Kopieren sollte die App sofort funktionieren!**
