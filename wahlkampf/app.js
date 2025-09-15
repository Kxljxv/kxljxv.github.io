// App-Konfiguration
const CONFIG = {
    defaultFile: 'Wahlprogramm.md',
    contentElement: document.getElementById('content'),
    navList: document.getElementById('nav-menu'),
    navToggle: document.getElementById('nav-toggle')
};

// Utility-Funktionen
const utils = {
    // Extrahiere Titel aus Dateiname
    getTitleFromFilename: (filename) => {
        return filename
            .replace('.md', '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    },

    // Erstelle Navigation-Item
    createNavItem: (filename, title) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = title;
        a.dataset.file = filename;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            app.loadMarkdown(filename);
            app.setActiveNavItem(a);
            if (window.innerWidth <= 768) {
                CONFIG.navList.classList.remove('active');
            }
        });
        li.appendChild(a);
        return li;
    },

    // Zeige Loading-Spinner
    showLoading: () => {
        CONFIG.contentElement.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Lade Inhalt...</p>
            </div>
        `;
    },

    // Zeige Fehler
    showError: (message) => {
        CONFIG.contentElement.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle" style="color: #e74c3c; font-size: 2rem; margin-bottom: 1rem;"></i>
                <h2>Fehler beim Laden</h2>
                <p>${message}</p>
            </div>
        `;
    }
};

// Markdown-Parser mit erweiterten Features
const markdownParser = {
    // Konfiguriere marked.js
    init: () => {
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: true,
            mangle: false
        });

        // Erweiterter Renderer für bessere Formatierung
        const renderer = new marked.Renderer();
        
        // Custom Link-Renderer
        renderer.link = (href, title, text) => {
            const isExternal = href.startsWith('http');
            const target = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
            return `<a href="${href}" ${target} title="${title || text}">${text}</a>`;
        };

        // Custom Image-Renderer
        renderer.image = (href, title, text) => {
            return `<img src="${href}" alt="${text}" title="${title || text}" loading="lazy" style="max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0;">`;
        };

        // Custom Table-Renderer
        renderer.table = (header, body) => {
            return `<div style="overflow-x: auto;"><table class="markdown-table">${header}${body}</table></div>`;
        };

        marked.use({ renderer });
    },

    // Konvertiere Markdown zu HTML
    parse: (markdown) => {
        try {
            return marked.parse(markdown);
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return `<pre style="color: red;">Fehler beim Parsen des Markdown: ${error.message}</pre>`;
        }
    }
};

// Haupt-App
const app = {
    // Initialisierung
    init: async () => {
        console.log('🚀 Initialisiere Wahlkampf Blog...');
        
        markdownParser.init();
        await app.loadNavigation();
        app.setupMobileMenu();
        app.handleRouting();
        
        console.log('✅ App initialisiert');
    },

    // Lade Navigation aus verfügbaren Markdown-Dateien
    loadNavigation: async () => {
        const files = ['Wahlprogramm.md', 'Wer_wir_sind.md'];
        const existingFiles = [];
        
        for (const file of files) {
            try {
                const response = await fetch(file);
                if (response.ok) {
                    existingFiles.push(file);
                }
            } catch (error) {
                console.warn(`Datei ${file} nicht gefunden`);
            }
        }
        
        if (existingFiles.length === 0) {
            existingFiles.push('Wahlprogramm.md');
        }
        
        app.populateNavigation(existingFiles);
    },

    // Navigation befüllen
    populateNavigation: (files) => {
        CONFIG.navList.innerHTML = '';
        
        // Füge Home-Link hinzu
        const homeLink = document.createElement('a');
        homeLink.href = '#';
        homeLink.dataset.file = 'home';
        homeLink.textContent = 'Startseite';
        homeLink.className = 'nav-link';
        CONFIG.navList.appendChild(homeLink);
        
        // Füge Links für Markdown-Dateien hinzu
        files.forEach(file => {
            const link = document.createElement('a');
            link.href = '#';
            link.dataset.file = file;
            link.textContent = utils.getTitleFromFilename(file);
            link.className = 'nav-link';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                app.loadMarkdown(file);
                
                // Aktualisiere aktiven Link
                CONFIG.navList.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                // Schließe mobile Menu
                CONFIG.navList.classList.remove('active');
            });
            CONFIG.navList.appendChild(link);
        });

        // Lade erste Datei
        const firstFile = files[0] || CONFIG.defaultFile;
        app.loadMarkdown(firstFile);
    },

    // Lade Markdown-Datei
    loadMarkdown: async (filename) => {
        utils.showLoading();
        
        try {
            const response = await fetch(filename);
            if (!response.ok) {
                // Versuche alternative Schreibweisen
                const alternatives = [filename, filename.toLowerCase(), filename.toUpperCase()];
                for (const altFile of alternatives) {
                    const altResponse = await fetch(altFile);
                    if (altResponse.ok) {
                        const markdown = await altResponse.text();
                        const html = markdownParser.parse(markdown);
                        CONFIG.contentElement.innerHTML = html;
                        window.history.pushState({ file: altFile }, '', `#${altFile}`);
                        app.setActiveNavItemFromFile(altFile);
                        console.log(`✅ Geladen: ${altFile}`);
                        return;
                    }
                }
                throw new Error(`Datei ${filename} nicht gefunden`);
            }
            
            const markdown = await response.text();
            const html = markdownParser.parse(markdown);
            
            CONFIG.contentElement.innerHTML = html;
            
            // Aktualisiere URL ohne Reload
            window.history.pushState({ file: filename }, '', `#${filename}`);
            
            // Aktualisiere aktiven Navigationspunkt
            app.setActiveNavItemFromFile(filename);
            
            console.log(`✅ Geladen: ${filename}`);
            
        } catch (error) {
            console.error('Fehler beim Laden:', error);
            utils.showError(`Die Datei "${filename}" konnte nicht geladen werden. Bitte überprüfen Sie, ob die Datei existiert.`);
        }
    },

    // Setze aktiven Navigationspunkt
    setActiveNavItem: (activeLink) => {
        const links = CONFIG.navList.querySelectorAll('a');
        links.forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
    },

    // Setze aktiven Navigationspunkt basierend auf Dateiname
    setActiveNavItemFromFile: (filename) => {
        const link = CONFIG.navList.querySelector(`[data-file="${filename}"]`);
        if (link) {
            app.setActiveNavItem(link);
        }
    },

    // Setup für Mobile-Navigation
    setupMobileMenu: () => {
        CONFIG.navToggle.addEventListener('click', () => {
            CONFIG.navList.classList.toggle('active');
        });

        // Schließe Menu bei Klick außerhalb
        document.addEventListener('click', (e) => {
            if (!CONFIG.navMenu.contains(e.target) && !CONFIG.navToggle.contains(e.target)) {
                CONFIG.navList.classList.remove('active');
            }
        });
    },

    // Routing basierend auf URL-Hash
    handleRouting: () => {
        const loadFromHash = () => {
            const hash = window.location.hash.slice(1);
            if (hash && hash.endsWith('.md')) {
                app.loadMarkdown(hash);
            } else {
                // Lade Standarddatei
                app.loadMarkdown(CONFIG.defaultFile);
            }
        };

        // Beim Laden
        loadFromHash();

        // Bei Hash-Änderung
        window.addEventListener('hashchange', loadFromHash);

        // Browser Back/Forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.file) {
                app.loadMarkdown(e.state.file);
            }
        });
    }
};

// Fallback für Dateiliste (wenn kein Server vorhanden)
if (!window.location.pathname.includes('/api/')) {
    // Erstelle eine einfache Dateiliste aus vorhandenen Dateien
    const checkFileExists = async (filename) => {
        try {
            const response = await fetch(filename, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    };

    // Überprüfe vorhandene Dateien
    const discoverFiles = async () => {
        const potentialFiles = ['Wahlprogramm.md', 'Wer_wir_sind.md', 'Wahlprogramm.MD', 'WER_WIR_SIND.MD'];
        const existingFiles = [];
        
        for (const file of potentialFiles) {
            if (await checkFileExists(file)) {
                existingFiles.push(file);
            }
        }
        
        // Fallback: Versuche es mit den tatsächlichen Dateinamen
        if (existingFiles.length === 0) {
            const actualFiles = ['Wahlprogramm.md', 'Wer_wir_sind.md'];
            return actualFiles;
        }
        
        return existingFiles;
    };

    // Überschreibe loadNavigation für Fallback
    app.loadNavigation = async () => {
        const files = await discoverFiles();
        if (files.length > 0) {
            app.populateNavigation(files);
        } else {
            utils.showError('Keine Markdown-Dateien gefunden. Bitte fügen Sie .md Dateien zum Ordner hinzu.');
        }
    };
}

// App starten wenn DOM geladen ist
document.addEventListener('DOMContentLoaded', app.init);

// Service Worker für Offline-Funktionalität (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            console.log('Service Worker nicht verfügbar');
        });
    });
}