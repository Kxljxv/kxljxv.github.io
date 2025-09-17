// App-Konfiguration
const CONFIG = {
    defaultPageId: null,
    pages: [],
    pageIndex: {
        byId: {},
        byFilePath: {},
        byFileBase: {},
        byTitle: {}
    },
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

    // Erstelle Navigation-Item (nach Page-ID)
    createNavItem: (page) => {
        const link = document.createElement('a');
        link.href = `#/` + page.id;
        link.textContent = page.title;
        link.dataset.pageId = page.id;
        link.className = 'nav-link';
        link.addEventListener('click', (e) => {
            e.preventDefault();
            app.loadPageById(page.id);
            app.setActiveNavItem(link);
            if (window.innerWidth <= 768) {
                CONFIG.navList.classList.remove('active');
            }
        });
        return link;
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
        
        // Custom Link-Renderer (interne .md und Wiki-Links abfangen)
        renderer.link = (href, title, text) => {
            try {
                const isExternal = /^https?:\/\//i.test(href);
                if (!isExternal) {
                    // Markdown-Links auf .md-Dateien inkl. optionalem Anchor
                    // Beispiele: 'content/Wahlprogramm.md#abschnitt', 'Wahlprogramm.md'
                    const mdMatch = href.match(/^(.+?\.md)(?:#([\w\-\s%äöüÄÖÜß.]+))?$/i);
                    if (mdMatch) {
                        const filePath = mdMatch[1].toLowerCase();
                        const anchor = mdMatch[2] || '';
                        const pageId = CONFIG.pageIndex.byFilePath[filePath] || CONFIG.pageIndex.byFileBase[filePath.replace(/^.*\//, '').replace(/\.md$/i, '')];
                        if (pageId) {
                            const anchorAttr = anchor ? ` data-anchor="${anchor}"` : '';
                            return `<a href="#/${pageId}" class="internal-link" data-page-id="${pageId}"${anchorAttr} title="${title || text}">${text}</a>`;
                        }
                    }
                }
                const target = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
                return `<a href="${href}" ${target} title="${title || text}">${text}</a>`;
            } catch {
                return `<a href="${href}" title="${title || text}">${text}</a>`;
            }
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
            const preprocessed = markdownParser.preprocessWikiLinks(markdown);
            return marked.parse(preprocessed);
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return `<pre style="color: red;">Fehler beim Parsen des Markdown: ${error.message}</pre>`;
        }
    }
};

// Zusätzliche Parser-Helfer
markdownParser.preprocessWikiLinks = (markdown) => {
    // Obsidian-Wiki-Links: [[Ziel|Text]] oder [[Ziel#Überschrift|Text]]
    // Ersetze durch HTML-Links, die unsere Router-Logik verstehen
    return markdown.replace(/\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (m, rawTarget, rawAnchor, alias) => {
        const target = String(rawTarget || '').trim();
        const anchor = String(rawAnchor || '').trim();
        const text = (alias || target).trim();
        if (!target) return text;
        const norm = target.toLowerCase().replace(/\s+/g, '_');
        const pageId = CONFIG.pageIndex.byId[target] || CONFIG.pageIndex.byTitle[target.toLowerCase()] || CONFIG.pageIndex.byFileBase[target.toLowerCase()] || CONFIG.pageIndex.byFileBase[norm];
        if (pageId) {
            const anchorAttr = anchor ? ` data-anchor="${anchor}"` : '';
            return `<a href="#/${pageId}" class="internal-link" data-page-id="${pageId}"${anchorAttr}>${text}</a>`;
        }
        return text;
    });
};

// Haupt-App
const app = {
    // Initialisierung
    init: async () => {
        console.log('🚀 Initialisiere Wahlkampf Blog...');
        
        markdownParser.init();
        await app.loadConfig();
        app.buildNavigation();
        app.setupMobileMenu();
        app.handleRouting();
        
        console.log('✅ App initialisiert');
    },
    // Lade Seitenkonfiguration
    loadConfig: async () => {
        try {
            const res = await fetch('pages.json');
            if (!res.ok) throw new Error('pages.json nicht gefunden');
            const pages = await res.json();
            CONFIG.pages = pages;
            const defaultPage = pages.find(p => p.default) || pages.find(p => p.id) || null;
            CONFIG.defaultPageId = defaultPage ? defaultPage.id : null;
            // Indizes aufbauen für Link-Auflösung
            CONFIG.pageIndex = { byId: {}, byFilePath: {}, byFileBase: {}, byTitle: {} };
            pages.forEach(p => {
                CONFIG.pageIndex.byId[p.id] = p.id;
                const filePath = (p.file || '').toLowerCase();
                if (filePath) {
                    CONFIG.pageIndex.byFilePath[filePath] = p.id;
                    const base = filePath.replace(/^.*\//, '').replace(/\.md$/i, '');
                    CONFIG.pageIndex.byFileBase[base] = p.id;
                }
                if (p.title) {
                    CONFIG.pageIndex.byTitle[String(p.title).toLowerCase()] = p.id;
                }
            });
        } catch (e) {
            console.error(e);
            utils.showError('Konfigurationsdatei konnte nicht geladen werden.');
        }
    },

    // Navigation aufbauen (nur top-Nav)
    buildNavigation: () => {
        CONFIG.navList.innerHTML = '';
        const topPages = CONFIG.pages.filter(p => p.nav === 'top');
        topPages.forEach(page => {
            const link = utils.createNavItem(page);
            CONFIG.navList.appendChild(link);
        });

        // Footer Impressum-Handler
        const impressumLink = document.getElementById('impressum-link');
        if (impressumLink) {
            impressumLink.addEventListener('click', (e) => {
                e.preventDefault();
                app.loadPageById('impressum');
            });
        }

        // Footer Datenschutz-Handler
        const datenschutzLink = document.getElementById('datenschutz-link');
        if (datenschutzLink) {
            datenschutzLink.addEventListener('click', (e) => {
                e.preventDefault();
                app.loadPageById('datenschutz');
            });
        }
    },

    // Seite per ID laden
    loadPageById: async (pageId) => {
        const page = CONFIG.pages.find(p => p.id === pageId) || CONFIG.pages.find(p => p.id === CONFIG.defaultPageId);
        if (!page) {
            utils.showError('Seite nicht gefunden.');
            return;
        }
        utils.showLoading();
        try {
            const response = await fetch(page.file);
            if (!response.ok) throw new Error('Datei nicht gefunden');
            const markdown = await response.text();
            const html = markdownParser.parse(markdown);
            CONFIG.contentElement.innerHTML = html;
            window.location.hash = `#/${page.id}`;
            const active = CONFIG.navList.querySelector(`[data-page-id="${page.id}"]`);
            if (active) app.setActiveNavItem(active);
            console.log(`✅ Geladen: ${page.file}`);
            // Falls ein Anker angefordert wurde (bei internen Links)
            const pendingAnchor = app._pendingAnchor;
            if (pendingAnchor) {
                app._pendingAnchor = null;
                const slug = app.slugifyHeading(pendingAnchor);
                const el = document.getElementById(slug);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (error) {
            console.error('Fehler beim Laden:', error);
            utils.showError(`Die Seite "${page.title}" konnte nicht geladen werden.`);
        }
    },

    // Setze aktiven Navigationspunkt
    setActiveNavItem: (activeLink) => {
        const links = CONFIG.navList.querySelectorAll('a');
        links.forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
    },


    // Setup für Mobile-Navigation
    setupMobileMenu: () => {
        CONFIG.navToggle.addEventListener('click', () => {
            CONFIG.navList.classList.toggle('active');
        });

        // Schließe Menu bei Klick außerhalb
        document.addEventListener('click', (e) => {
            const isClickInside = CONFIG.navList.contains(e.target) || CONFIG.navToggle.contains(e.target);
            if (!isClickInside) {
                CONFIG.navList.classList.remove('active');
            }
        });

        // Delegierter Click-Handler für interne Links innerhalb des Inhalts
        CONFIG.contentElement.addEventListener('click', (e) => {
            const a = e.target.closest('a');
            if (!a) return;
            // Interne Navigationslinks
            const pageId = a.getAttribute('data-page-id');
            if (a.classList.contains('internal-link') && pageId) {
                e.preventDefault();
                const anchor = a.getAttribute('data-anchor');
                app._pendingAnchor = anchor || null;
                app.loadPageById(pageId);
            }
        });
    },

    // Routing basierend auf URL-Hash
    handleRouting: () => {
        const parseHash = () => {
            const raw = window.location.hash || '';
            const match = raw.match(/^#\/(.+)$/);
            return match ? match[1] : CONFIG.defaultPageId;
        };

        const loadFromHash = () => {
            const pageId = parseHash();
            app.loadPageById(pageId);
        };

        // Beim Laden
        loadFromHash();

        // Bei Hash-Änderung
        window.addEventListener('hashchange', loadFromHash);
    }
};

// Utility: Heading-Slug ähnlich marked
app.slugifyHeading = (text) => {
    return String(text || '')
        .toLowerCase()
        .trim()
        .replace(/[ä]/g, 'ae')
        .replace(/[ö]/g, 'oe')
        .replace(/[ü]/g, 'ue')
        .replace(/[ß]/g, 'ss')
        .replace(/[^a-z0-9\s\-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/\-+/g, '-');
};

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