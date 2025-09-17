// App-Konfiguration
const CONFIG = {
    defaultPageId: null,
    pages: [],
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