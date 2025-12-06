
class GraphVisualization {
    constructor() {
        this.canvas = d3.select('#graph-canvas');
        this.ctx = this.canvas.node().getContext('2d');
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.canvas.attr('width', this.width).attr('height', this.height);

        this.selectedNode = null;
        this.hoveredNode = null;
        this.groups = [];
        this.nodeGroups = new Map();
        this.selectedColor = '#7f6df2';
        this.defaultFont = 'modern_dense';
        this.currentGroupForSearch = null;
        this.transform = d3.zoomIdentity;
        this.selectedAntragCode = null;
        this.motionUrlMap = {};

        this.settings = {
            showLabels: false,
            showLinks: true,
            nodeType: 'all',
            nodeSize: 1
        };

        this.zoom = d3.zoom()
            .scaleExtent([0.01, 4])
            .on('zoom', (event) => {
                this.transform = event.transform;
                this.render();
            });

        this.canvas.call(this.zoom);

        this.canvas.on('click', (event) => {
            const node = this.findNodeAt(event);
            if (node) {
                this.onNodeClick({ stopPropagation: () => { } }, node);
            } else {
                this.deselectAll();
            }
        });
        this.canvas.on('touchstart', (event) => {
            const node = this.findNodeAt(event);
            if (node) {
                this.onNodeClick({ stopPropagation: () => { } }, node);
            } else {
                this.deselectAll();
            }
        });
        this.canvas.on('mousemove', (event) => {
            const node = this.findNodeAt(event);
            if (node !== this.hoveredNode) {
                this.hoveredNode = node;
                this.updateLabelVisibility();
                this.render();
            }
        });
        this.canvas.on('contextmenu', (event) => {
            event.preventDefault();
            const node = this.findNodeAt(event);
            if (node) this.showNodeContextMenu(event, node);
        });

        this.setupTabs();
        this.setupMobileToggle();
        this.setupColorModal();
        this.setupCollapsePanel();
        this.loadData();
    }

    setupCollapsePanel() {
        const panel = document.getElementById('controls-panel');
        const btn = document.getElementById('collapse-btn');

        btn.addEventListener('click', () => {
            panel.classList.toggle('panel-collapsed');
        });
    }

    setupColorModal() {
        const modal = FlowbiteInstances.getInstance('Modal', 'color-modal');
        const presets = document.querySelectorAll('.color-preset');
        const customInput = document.getElementById('custom-color-input');
        const confirmBtn = document.getElementById('confirm-color');
        const selectBtn = document.getElementById('select-color-btn');

        selectBtn.addEventListener('click', () => {
            const modalEl = document.getElementById('color-modal');
            const modal = new Modal(modalEl);
            modal.show();
        });

        presets.forEach(preset => {
            preset.addEventListener('click', () => {
                presets.forEach(p => p.classList.remove('selected'));
                preset.classList.add('selected');
                this.selectedColor = preset.dataset.color;
                customInput.value = '';
            });
        });

        customInput.addEventListener('input', (e) => {
            const value = e.target.value;
            if (/^#[0-9A-F]{6}$/i.test(value)) {
                this.selectedColor = value;
                presets.forEach(p => p.classList.remove('selected'));
            }
        });

        confirmBtn.addEventListener('click', () => {
            document.getElementById('selected-color-indicator').style.background = this.selectedColor;
            const modalEl = document.getElementById('color-modal');
            const modal = Modal.getInstance(modalEl);
            if (modal) modal.hide();
        });
    }

    setupTabs() {
        const tabs = ['info', 'view', 'search', 'groups'];
        tabs.forEach(tab => {
            document.getElementById(`${tab}-tab`).addEventListener('click', () => {
                tabs.forEach(t => {
                    document.getElementById(`${t}-tab`).classList.remove('font-bold', 'text-[hsl(var(--text-000))]', 'border-b-2', 'border-[hsl(var(--text-100))]', 'hover:text-[hsl(var(--text-200))]');
                    document.getElementById(`${t}-tab`).classList.add('font-medium', 'text-[hsl(var(--text-500))]', 'border-b-2', 'border-[hsl(var(--text-100)/0)]', 'hover:text-[hsl(var(--text-200))]');
                    document.getElementById(`${t}-content`).classList.add('hidden');
                });
                document.getElementById(`${tab}-tab`).classList.remove('font-medium', 'text-[hsl(var(--text-500))]', 'border-b-2', 'border-[hsl(var(--text-100)/0)]', 'hover:text-[hsl(var(--text-200))]');
                document.getElementById(`${tab}-tab`).classList.add('font-bold', 'text-[hsl(var(--text-000))]', 'border-b-2', 'border-[hsl(var(--text-100))]', 'hover:text-[hsl(var(--text-200))]');
                document.getElementById(`${tab}-content`).classList.remove('hidden');
            });
        });
        document.getElementById('info-tab').click();
    }

    setupMobileToggle() {
        const toggle = document.getElementById('mobile-toggle');
        const content = document.getElementById('controls-content');
        const icon = document.getElementById('mobile-toggle-icon');

        if (toggle) {
            toggle.addEventListener('click', () => {
                content.classList.toggle('hidden');
                icon.classList.toggle('rotate-180');
            });
        }
    }

    getFontClass(fontName) {
        const fontMap = {
            'dyslexic': 'font-dyslexic',
            'modern_dense': 'font-modern-dense',
            'modern_wide': 'font-modern-wide',
            'serif': 'font-serif'
        };
        return fontMap[fontName] || fontMap[this.defaultFont];
    }

    deselectAll() {
        this.selectedNode = null;
        document.getElementById('selected-node').textContent = '-';
        if (this.nodeElements) {
            this.nodeElements.classed('selected', false).classed('dimmed', false);
            this.linkGroup.selectAll('.link').classed('dimmed', false);
            this.labelElements.classed('dimmed', false);
        }
        this.updateLabelVisibility();
    }

    async loadData() {
        try {
            document.getElementById('loading-text').textContent = 'Lade la_data.json...';
            const response = await fetch('data_gathering/la_data.json');
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            const data = await response.json();
            document.getElementById('loading-text').textContent = 'Verarbeite Daten...';
            this.data = data;
            this.metadata = data.metadata || {};

            await this.loadAmendmentUrls();
            await this.loadSupportersIndex();
            this.processData();
            this.setupEventListeners();
            this.simulatePhysics();

        } catch (error) {
            console.error('Fehler beim Laden der Daten:', error);
            document.getElementById('loading').innerHTML = `
                      <div class="max-w-md mx-auto bg-red-900/20 border border-red-500 rounded-lg p-6">
                          <h2 class="text-2xl font-bold text-red-500 mb-4">❌ Fehler beim Laden</h2>
                          <p class="text-red-300 mb-4"><strong>${error.message}</strong></p>
                          <p class="text-gray-400 mb-2">Bitte stelle sicher, dass:</p>
                          <ul class="list-disc list-inside text-gray-400 space-y-1">
                              <li>Das Python-Skript ausgeführt wurde</li>
                              <li>Die Datei data_gathering/la_data.json existiert</li>
                              <li>Ein lokaler Webserver läuft</li>
                          </ul>
                      </div>
                  `;
        }
    }

    processData() {
        const nodeMap = new Map();
        const links = [];

        const antragColor = getComputedStyle(document.documentElement).getPropertyValue('--node-antrag').trim();
        const supporterColor = getComputedStyle(document.documentElement).getPropertyValue('--node-supporter').trim();

        if (this.data && typeof this.data === 'object' && !Array.isArray(this.data) && !this.data.motions) {
            Object.entries(this.data).forEach(([key, val]) => {
                const aeaId = (val && (val.application_id || val.id)) || key;
                const aeaLabel = (val && Array.isArray(val.heading) && val.heading[0]) || aeaId;
                if (!nodeMap.has(aeaId)) {
                    nodeMap.set(aeaId, { id: aeaId, label: aeaLabel, type: 'antrag', color: antragColor, linkCount: 0, font: this.defaultFont });
                }
                if (val && val.url) this.motionUrlMap[aeaId] = val.url;

                const applicantName = val && val.applicant;
                if (applicantName && typeof applicantName === 'string' && applicantName.trim().length > 0) {
                    const supporterId = applicantName.trim();
                    if (!nodeMap.has(supporterId)) {
                        nodeMap.set(supporterId, { id: supporterId, label: supporterId, type: 'supporter', color: supporterColor, linkCount: 0, font: this.defaultFont });
                    }
                    links.push({ source: aeaId, target: supporterId, weight: 5 });
                    nodeMap.get(aeaId).linkCount += 5;
                    nodeMap.get(supporterId).linkCount += 5;
                }

                const supporters = (val && Array.isArray(val.supporters)) ? val.supporters : [];
                supporters.forEach(name => {
                    if (typeof name !== 'string' || name.trim().length === 0) return;
                    const supporterId = name.trim();
                    if (!nodeMap.has(supporterId)) {
                        nodeMap.set(supporterId, { id: supporterId, label: supporterId, type: 'supporter', color: supporterColor, linkCount: 0, font: this.defaultFont });
                    }
                    links.push({ source: aeaId, target: supporterId, weight: 1 });
                    nodeMap.get(aeaId).linkCount += 1;
                    nodeMap.get(supporterId).linkCount += 1;
                });
            });
        } else if (this.data.motions && Array.isArray(this.data.motions)) {
            this.data.motions.forEach(m => {
                const aea = m.code || m.title || m.antrag || m.id;
                if (!aea) return;
                if (!nodeMap.has(aea)) {
                    nodeMap.set(aea, { id: aea, label: aea, type: 'antrag', color: antragColor, linkCount: 0, font: this.defaultFont });
                }
                if (m.url) this.motionUrlMap[aea] = m.url;
                const app = m.applicant;
                if (app && Array.isArray(app) && app.length >= 1) {
                    const supporterId = `${app[0]} | ${app[1] || ''}`;
                    if (!nodeMap.has(supporterId)) {
                        nodeMap.set(supporterId, { id: supporterId, label: app[0], sublabel: app[1] || '', type: 'supporter', color: supporterColor, linkCount: 0, font: this.defaultFont });
                    }
                    links.push({ source: aea, target: supporterId, weight: 5 });
                    nodeMap.get(aea).linkCount += 5;
                    nodeMap.get(supporterId).linkCount += 5;
                }
                (m.supporters || []).forEach(s => {
                    const supporterId = `${s[0]} | ${s[1] || ''}`;
                    if (!nodeMap.has(supporterId)) {
                        nodeMap.set(supporterId, { id: supporterId, label: s[0], sublabel: s[1] || '', type: 'supporter', color: supporterColor, linkCount: 0, font: this.defaultFont });
                    }
                    links.push({ source: aea, target: supporterId, weight: 1 });
                    nodeMap.get(aea).linkCount += 1;
                    nodeMap.get(supporterId).linkCount += 1;
                });
            });
        } else if (this.data.support_map) {
            Object.entries(this.data.support_map).forEach(([aea, val]) => {
                if (!nodeMap.has(aea)) {
                    nodeMap.set(aea, { id: aea, label: aea, type: 'antrag', color: antragColor, linkCount: 0, font: this.defaultFont });
                }
                if (Array.isArray(val)) {
                    val.forEach(s => {
                        const supporterId = `${s[0]} | ${s[1] || ''}`;
                        if (!nodeMap.has(supporterId)) nodeMap.set(supporterId, { id: supporterId, label: s[0], sublabel: s[1] || '', type: 'supporter', color: supporterColor, linkCount: 0, font: this.defaultFont });
                        links.push({ source: aea, target: supporterId, weight: 1 });
                        nodeMap.get(aea).linkCount += 1;
                        nodeMap.get(supporterId).linkCount += 1;
                    });
                } else if (val && typeof val === 'object') {
                    const app = val.initiator;
                    if (Array.isArray(app)) {
                        const supporterId = `${app[0]} | ${app[1] || ''}`;
                        if (!nodeMap.has(supporterId)) nodeMap.set(supporterId, { id: supporterId, label: app[0], sublabel: app[1] || '', type: 'supporter', color: supporterColor, linkCount: 0, font: this.defaultFont });
                        links.push({ source: aea, target: supporterId, weight: 5 });
                        nodeMap.get(aea).linkCount += 100;
                        nodeMap.get(supporterId).linkCount += 100;
                    }
                    (val.supporters || []).forEach(s => {
                        const supporterId = `${s[0]} | ${s[1] || ''}`;
                        if (!nodeMap.has(supporterId)) nodeMap.set(supporterId, { id: supporterId, label: s[0], sublabel: s[1] || '', type: 'supporter', color: supporterColor, linkCount: 0, font: this.defaultFont });
                        links.push({ source: aea, target: supporterId, weight: 1 });
                        nodeMap.get(aea).linkCount += 1;
                        nodeMap.get(supporterId).linkCount += 1;
                    });
                }
            });
        }

        this.nodes = Array.from(nodeMap.values());
        // Attach node refs to links
        this.links = links.map(l => ({ ...l }));

        this.allNodes = [...this.nodes];
        this.allLinks = [...this.links];

        this.adj = new Map();
        this.nodes.forEach(n => this.adj.set(n.id, new Set()));
        this.links.forEach(l => {
            const a = l.source.id || l.source;
            const b = l.target.id || l.target;
            if (this.adj.has(a)) this.adj.get(a).add(b);
            if (this.adj.has(b)) this.adj.get(b).add(a);
        });

        document.getElementById('node-count').textContent = this.nodes.length;
        document.getElementById('link-count').textContent = this.links.length;
    }

    simulatePhysics() {
        document.getElementById('loading-text').textContent = 'Simulation läuft...';

        const linkForce = d3.forceLink(this.links)
            .id(d => d.id)
            .strength(l => {
                const w = l.weight || 1;
                return 0.1 * w;
            })
            .distance(l => {
                const w = l.weight || 1;
                return 160 / Math.sqrt(w);
            });

        const simulation = d3.forceSimulation(this.nodes)
            .force('link', linkForce)
            .force('charge', d3.forceManyBody().strength(-200))
            .force('collision', d3.forceCollide().radius(15).strength(10))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2).strength(0.001))

        let iterations = 0;
        const maxIterations = 500;

        simulation.on("tick", () => {
            iterations++;
            const progress = Math.min(100, (iterations / maxIterations) * 100);
            document.getElementById('loading-text').textContent = `Simulation läuft... ${Math.round(progress)}%`;
            this.render();
            this.centerGraph();
            this.resetZoom();
        });

        simulation.on('end', () => {
            document.getElementById('loading').style.display = 'none';
            this.render();
            this.centerGraph();
        });
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.onResize());
        document.getElementById('search').addEventListener('input', (e) => this.onSearch(e));
        document.getElementById('node-type').addEventListener('change', (e) => this.onFilterChange(e));
        document.getElementById('show-labels').addEventListener('change', (e) => {
            this.settings.showLabels = e.target.checked;
            this.updateLabelVisibility();
            this.render();
        });
        document.getElementById('show-links').addEventListener('change', (e) => {
            this.settings.showLinks = e.target.checked;
            this.render();
        });
        document.getElementById('node-size').addEventListener('input', (e) => {
            this.settings.nodeSize = parseFloat(e.target.value);
            this.render();
        });

        document.getElementById('reset-view').addEventListener('click', () => this.resetView());


        document.getElementById('create-group').addEventListener('click', () => this.createGroup());
        document.getElementById('create-kv-group').addEventListener('click', () => this.createKVGroup());
        document.getElementById('export-groups').addEventListener('click', () => this.exportGroups());
        document.getElementById('import-groups').addEventListener('change', (e) => this.importGroups(e));

        document.getElementById('group-node-search').addEventListener('input', (e) => this.onGroupSearch(e));

        const openBtn = document.getElementById('open-amendment-btn');
        const selectEl = document.getElementById('amendment-select');
        if (selectEl && openBtn) {
            selectEl.addEventListener('change', () => {
                openBtn.style.display = selectEl.value ? 'block' : 'none';
            });
            openBtn.addEventListener('click', () => {
                const code = selectEl.value;
                const url = (this.motionUrlMap && this.motionUrlMap[code]) || (this.amendmentUrls && this.amendmentUrls[code]);
                if (code && url) window.open(url, '_blank');
            });
        }

        const openSelectedBtn = document.getElementById('open-selected-antrag-btn');
        if (openSelectedBtn) {
            openSelectedBtn.addEventListener('click', () => {
                if (!this.selectedAntragCode) return;
                const url = (this.motionUrlMap && this.motionUrlMap[this.selectedAntragCode]) || (this.amendmentUrls && this.amendmentUrls[this.selectedAntragCode]);
                if (url) window.open(url, '_blank');
            });
        }
    }

    updateAllFonts() { }

    render() {
        const ctx = this.ctx;
        ctx.save();
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.translate(this.transform.x, this.transform.y);
        ctx.scale(this.transform.k, this.transform.k);

        const linkColor = getComputedStyle(document.documentElement).getPropertyValue('--link-color').trim() || 'rgba(153,153,153,0.3)';

        const isDimmed = (node) => {
            if (!this.selectedNode) return false;
            if (node.id === this.selectedNode.id) return false;
            const neighbors = this.adj && this.adj.get(this.selectedNode.id);
            if (!neighbors) return true;
            return !neighbors.has(node.id);
        };

        if (this.settings.showLinks) {
            ctx.strokeStyle = linkColor;
            this.links.forEach(l => {
                ctx.save();
                const dim = this.selectedNode && l.source.id !== this.selectedNode.id && l.target.id !== this.selectedNode.id;
                ctx.globalAlpha = dim ? 0.15 : 1.0;
                ctx.lineWidth = (l.weight || 1) * 1;
                ctx.beginPath();
                ctx.moveTo(l.source.x, l.source.y);
                ctx.lineTo(l.target.x, l.target.y);
                ctx.stroke();
                ctx.restore();
            });
        }

        this.nodes.forEach(n => {
            const radius = (Math.sqrt(n.linkCount) * 1.5 + 0.25) * this.settings.nodeSize;
            ctx.save();
            ctx.globalAlpha = isDimmed(n) ? 0.2 : 1.0;
            ctx.fillStyle = this.getNodeColor(n);
            ctx.beginPath();
            ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            const showLabel = this.settings.showLabels || n === this.selectedNode || n === this.hoveredNode || (this.selectedNode && this.adj && this.adj.get(this.selectedNode.id) && this.adj.get(this.selectedNode.id).has(n.id));
            if (showLabel) {
                ctx.save();
                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-000-full').trim() || '#faf9f5';
                ctx.font = '16px ' + (this.getFontClass(n.font).includes('serif') ? 'Serif' : 'ModernDense');
                ctx.textBaseline = 'middle';
                ctx.fillText(n.label, n.x + radius + 5, n.y);
                if (n.sublabel) {
                    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-400-full').trim() || '#9c9a92';
                    ctx.font = '12px ' + (this.getFontClass(n.font).includes('serif') ? 'Serif' : 'ModernDense');
                    ctx.fillText(n.sublabel, n.x + radius + 5, n.y + 12);
                }
                ctx.restore();
            }
        });

        ctx.restore();
    }

    onNodeHover(event, d) {
        this.hoveredNode = d;
        this.updateLabelVisibility();
    }

    onNodeLeave() {
        this.hoveredNode = null;
        this.updateLabelVisibility();
    }

    getNodeColor(node) {
        const groupId = this.nodeGroups.get(node.id);
        if (groupId !== undefined) {
            const group = this.groups.find(g => g.id === groupId);
            if (group) return group.color;
        }
        return node.color;
    }

    onNodeClick(event, d) {
        event.stopPropagation();
        this.selectedNode = d;
        document.getElementById('selected-node').textContent = d.label;
        const btn = document.getElementById('open-selected-antrag-btn');
        if (d.type === 'antrag') {
            this.selectedAntragCode = d.id;
            if (btn) btn.style.display = 'block';
        } else {
            this.selectedAntragCode = null;
            if (btn) btn.style.display = 'none';
        }
        this.render();
    }

    onNodeRightClick(event, d) {
        event.preventDefault();
        this.showNodeContextMenu(event, d);
    }

    showNodeContextMenu(event, node) {
        d3.select('#context-menu').remove();

        const menu = d3.select('body')
            .append('div')
            .attr('id', 'context-menu')
            .style('position', 'absolute')
            .style('left', event.pageX + 'px')
            .style('top', event.pageY + 'px')
            .style('background', 'rgba(30, 30, 30, 0.95)')
            .style('border', '1px solid #3a3a3a')
            .style('border-radius', '8px')
            .style('padding', '8px')
            .style('z-index', '1000')
            .style('min-width', '200px')
            .style('backdrop-filter', 'blur(10px)');

        menu.append('div')
            .style('padding', '8px')
            .style('font-size', '12px')
            .style('color', '#a0a0a0')
            .style('border-bottom', '1px solid #3a3a3a')
            .text(node.label);

        if (this.groups.length > 0) {
            this.groups.forEach(group => {
                menu.append('div')
                    .style('padding', '8px')
                    .style('cursor', 'pointer')
                    .style('color', '#dcddde')
                    .style('font-size', '13px')
                    .style('border-radius', '4px')
                    .html(`<span style="display:inline-block;width:12px;height:12px;background:${group.color};border-radius:2px;margin-right:8px;"></span>${group.name}`)
                    .on('mouseover', function () {
                        d3.select(this).style('background', '#3a3a3a');
                    })
                    .on('mouseout', function () {
                        d3.select(this).style('background', 'transparent');
                    })
                    .on('click', () => {
                        this.addNodeToGroup(node.id, group.id);
                        menu.remove();
                    });
            });
        } else {
            menu.append('div')
                .style('padding', '8px')
                .style('color', '#666')
                .style('font-size', '12px')
                .style('text-align', 'center')
                .text('Keine Gruppen vorhanden');
        }

        if (this.nodeGroups.has(node.id)) {
            menu.append('div')
                .style('padding', '8px')
                .style('cursor', 'pointer')
                .style('color', '#ff6b6b')
                .style('font-size', '13px')
                .style('border-top', '1px solid #3a3a3a')
                .style('margin-top', '4px')
                .style('border-radius', '4px')
                .text('Aus Gruppe entfernen')
                .on('mouseover', function () {
                    d3.select(this).style('background', '#3a3a3a');
                })
                .on('mouseout', function () {
                    d3.select(this).style('background', 'transparent');
                })
                .on('click', () => {
                    this.removeNodeFromGroup(node.id);
                    menu.remove();
                });
        }

        setTimeout(() => {
            d3.select('body').on('click.context-menu', () => {
                menu.remove();
                d3.select('body').on('click.context-menu', null);
            });
        }, 0);
    }

    addNodeToGroup(nodeId, groupId) {
        this.nodeGroups.set(nodeId, groupId);
        this.render();
        this.updateGroupList();
    }

    removeNodeFromGroup(nodeId) {
        this.nodeGroups.delete(nodeId);
        this.render();
        this.updateGroupList();
    }

    createGroup() {
        const name = document.getElementById('group-name').value.trim();
        const color = this.selectedColor;

        if (!name) {
            alert('Bitte einen Gruppennamen eingeben');
            return;
        }

        const group = {
            id: Date.now(),
            name: name,
            color: color,
            nodes: []
        };

        this.groups.push(group);
        this.updateGroupList();

        document.getElementById('group-name').value = '';
    }

    createKVGroup() {
        const kv = document.getElementById('kv-name').value.trim();
        const color = this.selectedColor;
        if (!kv) { alert('Bitte KV eingeben'); return; }
        const group = { id: Date.now(), name: `KV: ${kv}`, color, nodes: [] };
        this.groups.push(group);
        this.nodes.filter(n => n.type === 'supporter' && (n.sublabel || '').toLowerCase() === kv.toLowerCase())
            .forEach(n => this.nodeGroups.set(n.id, group.id));
        this.updateGroupList();
        this.render();
        document.getElementById('kv-name').value = '';
    }

    updateGroupList() {
        const listContainer = document.getElementById('group-list');

        if (this.groups.length === 0) {
            listContainer.innerHTML = '<p class="text-[hsl(var(--text-400))] text-sm text-center py-4">Keine Gruppen vorhanden</p>';
            return;
        }

        listContainer.innerHTML = this.groups.map(group => {
            const nodeCount = Array.from(this.nodeGroups.entries()).filter(([_, gId]) => gId === group.id).length;

            return `
                      <div class="group-item p-3 rounded-lg bright-container">
                          <div class="flex items-center justify-between mb-2">
                              <div class="flex items-center gap-2 flex-1">
                                  <div style="width: 16px; height: 16px; background: ${group.color}; border-radius: 4px;"></div>
                                  <span class="text-[hsl(var(--text-000))] font-medium text-sm">${group.name}</span>
                                  <span class="text-[hsl(var(--text-400))] text-xs">(${nodeCount})</span>
                              </div>
                              <div class="flex gap-2">
                                  <button onclick="graph.showGroupSearchModal(${group.id})" class="text-[hsl(var(--accent-secondary-100-full))] hover:text-[hsl(var(--accent-secondary-000-full))] text-xs fancy-button p-1 rounded" title="Nodes hinzufügen">
                                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                                      </svg>
                                  </button>
                                  <button onclick="graph.deleteGroup(${group.id})" class="text-[hsl(var(--danger-100-full))] hover:text-[hsl(var(--danger-000-full))] text-xs fancy-button p-1 rounded" title="Gruppe löschen">
                                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                      </svg>
                                  </button>
                              </div>
                          </div>
                          <div class="text-xs text-[hsl(var(--text-400))]">Rechtsklick auf Nodes zum Hinzufügen</div>
                      </div>
                  `;
        }).join('');
    }

    showGroupSearchModal(groupId) {
        this.currentGroupForSearch = groupId;
        const modalEl = document.getElementById('group-search-modal');
        const modal = new Modal(modalEl);
        modal.show();

        document.getElementById('group-node-search').value = '';
        document.getElementById('group-search-results').innerHTML = '';
    }

    onGroupSearch(e) {
        const query = e.target.value.toLowerCase();
        const resultsDiv = document.getElementById('group-search-results');

        if (!query) {
            resultsDiv.innerHTML = '';
            return;
        }

        const matches = this.allNodes.filter(node =>
            node.label.toLowerCase().includes(query) ||
            (node.sublabel && node.sublabel.toLowerCase().includes(query))
        ).slice(0, 600);

        if (matches.length === 0) {
            resultsDiv.innerHTML = '<p class="text-[hsl(var(--text-400))] text-sm p-2">Keine Ergebnisse gefunden</p>';
            return;
        }

        resultsDiv.innerHTML = matches.map(node => {
            const inGroup = this.nodeGroups.get(node.id) === this.currentGroupForSearch;
            return `
                      <div class="p-2 rounded cursor-pointer text-sm mb-1 flex justify-between items-center bright-container" onclick="graph.toggleNodeInCurrentGroup('${node.id.replace(/'/g, "\\'")}')">
                          <div>
                              <span class="text-[hsl(var(--text-000))]">${node.label}</span>
                              ${node.sublabel ? `<span class="text-[hsl(var(--text-400))] text-xs ml-2">(${node.sublabel})</span>` : ''}
                          </div>
                          <span class="text-xs ${inGroup ? 'text-[hsl(var(--success-100-full))]' : 'text-[hsl(var(--text-400))]'}">${inGroup ? '✓' : '+'}</span>
                      </div>
                  `;
        }).join('');
    }

    toggleNodeInCurrentGroup(nodeId) {
        if (this.nodeGroups.get(nodeId) === this.currentGroupForSearch) {
            this.removeNodeFromGroup(nodeId);
        } else {
            this.addNodeToGroup(nodeId, this.currentGroupForSearch);
        }

        document.getElementById('group-node-search').dispatchEvent(new Event('input'));
    }

    deleteGroup(groupId) {
        this.groups = this.groups.filter(g => g.id !== groupId);

        const nodesToRemove = [];
        this.nodeGroups.forEach((gId, nodeId) => {
            if (gId === groupId) {
                nodesToRemove.push(nodeId);
            }
        });
        nodesToRemove.forEach(nodeId => this.nodeGroups.delete(nodeId));

        this.render();
        this.updateGroupList();
    }

    exportGroups() {
        const exportData = {
            groups: this.groups,
            nodeGroups: Array.from(this.nodeGroups.entries()).map(([nodeId, groupId]) => ({
                nodeId,
                groupId
            }))
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `graph-groups-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);
    }

    importGroups(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (data.groups && data.nodeGroups) {
                    this.groups = data.groups;
                    this.nodeGroups = new Map(data.nodeGroups.map(item => [item.nodeId, item.groupId]));

                    if (this.nodeElements) {
                        this.nodeElements.attr('fill', d => this.getNodeColor(d));
                    }
                    this.updateGroupList();

                    alert('Gruppen erfolgreich importiert!');
                } else {
                    alert('Ungültiges Dateiformat');
                }
            } catch (error) {
                alert('Fehler beim Importieren: ' + error.message);
            }
        };
        reader.readAsText(file);

        event.target.value = '';
    }

    isConnectedToSelected(node) {
        if (!this.selectedNode) return false;
        return this.links.some(link =>
            (link.source.id === this.selectedNode.id && link.target.id === node.id) ||
            (link.target.id === this.selectedNode.id && link.source.id === node.id)
        );
    }

    updateLabelVisibility() { }

    updateNodeSizes() { }

    onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.attr('width', this.width).attr('height', this.height);
        this.render();
    }

    onSearch(e) {
        const query = e.target.value.toLowerCase();
        const resultsDiv = document.getElementById('search-results');

        if (!query) {
            resultsDiv.innerHTML = '';
            return;
        }

        const matches = this.allNodes.filter(node =>
            node.label.toLowerCase().includes(query) ||
            (node.sublabel && node.sublabel.toLowerCase().includes(query))
        ).slice(0, 10);

        if (matches.length === 0) {
            resultsDiv.innerHTML = '<p class="text-[hsl(var(--text-400))] text-sm p-2">Keine Ergebnisse gefunden</p>';
            return;
        }

        resultsDiv.innerHTML = matches.map(node =>
            `<div class="p-2 rounded cursor-pointer text-sm mb-1 bright-container" onclick="graph.highlightNode('${node.id.replace(/'/g, "\\'")}')">
                      <span class="text-[hsl(var(--text-000))]">${node.label}</span>
                      ${node.sublabel ? `<span class="text-[hsl(var(--text-400))] text-xs ml-2">(${node.sublabel})</span>` : ''}
                  </div>`
        ).join('');
    }

    highlightNode(nodeId) {
        const node = this.allNodes.find(n => n.id === nodeId);
        if (node) {
            this.hoveredNode = node;
            this.centerOnNode(node);
            this.onNodeClick({ stopPropagation: () => { } }, node);
        }
    }

    onFilterChange(e) {
        this.settings.nodeType = e.target.value;

        if (this.settings.nodeType === 'all') {
            this.nodes = [...this.allNodes];
            this.links = [...this.allLinks];
        } else {
            this.nodes = this.allNodes.filter(n => n.type === this.settings.nodeType);
            const nodeIds = new Set(this.nodes.map(n => n.id));
            this.links = this.allLinks.filter(l =>
                nodeIds.has(l.source.id) && nodeIds.has(l.target.id)
            );
        }

        document.getElementById('node-count').textContent = this.nodes.length;
        document.getElementById('link-count').textContent = this.links.length;
        this.render();
    }

    resetView() {
        this.deselectAll();
        this.canvas.transition()
            .duration(750)
            .call(this.zoom.transform, d3.zoomIdentity);
    }

    resetZoom() {
        this.deselectAll();
        this.canvas.transition()
            .duration(0)
            .call(this.zoom.scaleTo, 0.05);
    }

    centerGraph() {
        if (this.nodes.length === 0) return;

        const centerX = this.nodes.reduce((sum, n) => sum + n.x, 0) / this.nodes.length;
        const centerY = this.nodes.reduce((sum, n) => sum + n.y, 0) / this.nodes.length;

        const transform = d3.zoomIdentity
            .translate(this.width / 2, this.height / 2)
            .translate(-centerX, -centerY);

        this.canvas.transition()
            .duration(750)
            .call(this.zoom.transform, transform);
    }

    centerOnNode(node) {
        const transform = d3.zoomIdentity
            .translate(this.width / 2, this.height / 2)
            .translate(-node.x, -node.y);
        this.canvas.transition()
            .duration(750)
            .call(this.zoom.transform, transform);
    }

    findNodeAt(event) {
        const rect = this.canvas.node().getBoundingClientRect();
        const clientX = event.touches && event.touches.length ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches && event.touches.length ? event.touches[0].clientY : event.clientY;
        const px = clientX - rect.left;
        const py = clientY - rect.top;
        const x = (px - this.transform.x) / this.transform.k;
        const y = (py - this.transform.y) / this.transform.k;
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const n = this.nodes[i];
            const r = (5 + Math.sqrt(n.linkCount) * 2) * this.settings.nodeSize;
            const dx = x - n.x;
            const dy = y - n.y;
            if (dx * dx + dy * dy <= r * r) return n;
        }
        return null;
    }

    async loadAmendmentUrls() {
        try {
            const res = await fetch('amendments_url.json');
            if (!res.ok) return;
            const arr = await res.json();
            this.amendmentUrls = {};
            const selectEl = document.getElementById('amendment-select');
            arr.forEach(item => {
                const code = item.title;
                this.amendmentUrls[code] = item.url;
                if (selectEl) {
                    const opt = document.createElement('option');
                    opt.value = code;
                    opt.textContent = code;
                    selectEl.appendChild(opt);
                }
            });
        } catch { }
    }

    async loadSupportersIndex() {
        try {
            const res = await fetch('supporters_index.json');
            if (!res.ok) return;
            const obj = await res.json();
            this.supportersIndex = obj.index || {};
        } catch { }
    }
}

let graph;
document.addEventListener('DOMContentLoaded', () => {
    graph = new GraphVisualization();
});
