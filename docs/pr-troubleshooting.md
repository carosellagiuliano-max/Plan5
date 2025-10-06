# Pull Request Troubleshooting

## "Binärdateien werden nicht unterstützt" / "Binary files are not supported"

Wenn beim Erstellen eines Pull Requests diese Meldung erscheint, wurde mindestens eine Datei als Binärdatei erkannt. In den meisten Review-Workflows können solche Dateien nicht inline angezeigt werden, weshalb die PR-Erstellung blockiert wird.

### Ursachen
- Dateien wie `.zip`, `.png`, `.jpg`, `.pdf` oder andere Binärformate wurden hinzugefügt.
- Große generierte Artefakte (Build-Outputs, Coverage-Reports) wurden versehentlich eingecheckt.
- Textbasierte Assets (z. B. SVG) werden aufgrund falscher `gitattributes`-Konfiguration als Binärdateien erkannt.

### Lösungen
1. **Binärdatei identifizieren**: Führen Sie `git diff --cached --numstat` oder `git show --stat` aus. Spalten ohne Zeilenzahlen (stattdessen `-` oder `binary`) deuten auf Binärdateien hin. Mit `git diff --cached --name-only --diff-filter=B` listen Sie ausschließlich als binär erkannte Dateien.
2. **Datei entfernen**: Löschen Sie die betreffende Binärdatei aus dem Commit oder fügen Sie sie der `.gitignore` hinzu, damit sie nicht erneut auftaucht.
3. **Git LFS nutzen**: Wenn die Binärdatei benötigt wird, richten Sie Git LFS ein (`git lfs install`, anschließend die Datei per `git lfs track <pfad>` verfolgen`). Comitten Sie die Datei anschließend erneut.
4. **`gitattributes` anpassen**: Erzwingen Sie für eigentlich textbasierte Dateien die Text-Erkennung, z. B. mit `*.svg text`. Legen Sie die Änderungen anschließend erneut fest.
5. **Neuen Commit erstellen**: Nachdem die Binärdateien entfernt oder korrekt konfiguriert wurden, erstellen Sie einen neuen Commit und versuchen Sie erneut, den Pull Request zu öffnen.

> 💡 **Tipp**: Für ein automatisches Feedback können Sie `npx @gitlint/binary-check` oder ein eigenes Skript in CI ausführen, um versehentlich eingecheckte Binärdateien frühzeitig zu erkennen.

### Prävention
- Prüfen Sie vor dem Commit mit `git status --short`, welche Dateien geändert wurden.
- Halten Sie Build-Outputs und Abhängigkeitsordner in `.gitignore`.
- Dokumentieren Sie im Team, welche Dateitypen erlaubt sind und wie mit Binärdateien umzugehen ist.

Mit diesen Schritten lässt sich der Fehler in der Regel schnell beheben, sodass die PR-Erstellung wieder möglich ist.
