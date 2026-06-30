define("interfaz:views/lista-leads", ["view"], function (Dep) {
    return Dep.extend({
        template: "interfaz:lista-leads",

        stageOptions: [
            { value: "Prospecting",                       label: "Por Contactar" },
            { value: "Proposed",                           label: "Recopilacion de informacion" },
            { value: "Presented",                          label: "Creacion de Perfil de compra" },
            { value: "Recopilacion de opciones",           label: "Recopilacion de opciones" },
            { value: "Muesta de Opciones",                 label: "Muesta de Opciones" },
            { value: "Visita de propiedad",                label: "Visita de propiedad" },
            { value: "Propuesta por parte del comprador",  label: "Propuesta por parte del comprador" },
            { value: "Aceptacion de propuesta",             label: "Aceptacion de propuesta" },
            { value: "Por cobrar",                          label: "Por cobrar" },
            { value: "Closed Won",                          label: "Cerrado Ganado" },
            { value: "Closed Lost",                         label: "Cerrado Perdido" }
        ],

        setup: function () {
            this.modoVista = 'lista'; // 'lista' | 'kanban'
            this.paginaActual = this.options.paginaInicial || 1;
            this.leads = [];
            this.filtros = {
                cla: null,
                oficina: null,
                asesor: null,
                interes: null,
                stage: null
            };
            this.paginacion = {
                pagina: this.paginaActual,
                porPagina: 25,
                total: 0,
                totalPaginas: 0
            };
            this.cargando = false;
            this.permisos = {};

            // Páginas independientes por columna en modo kanban
            this.kanbanPaginas = {};
        },

        afterRender: function () {
            this.poblarSelectStage();
            this.setupEventListeners();
            this.cargarPermisos();
        },

        poblarSelectStage: function () {
            const select = this.$el.find('#filtro-stage');
            this.stageOptions.forEach(function (opt) {
                select.append('<option value="' + opt.value + '">' + opt.label + '</option>');
            });
        },

        setupEventListeners: function () {
            const self = this;

            this.$el.find('[data-action="aplicar-filtros"]').on('click', function () {
                self.paginacion.pagina = 1;
                self.kanbanPaginas = {};
                self.aplicarFiltros();
            });

            this.$el.find('[data-action="limpiar-filtros"]').on('click', function () {
                self.limpiarFiltros();
            });

            this.$el.find('#filtro-cla').on('change', function () {
                self.onCLAChange($(this).val());
            });

            this.$el.find('#filtro-oficina').on('change', function () {
                self.onOficinaChange($(this).val());
            });

            this.$el.find('#btn-toggle-vista').on('click', function () {
                self.toggleVista();
            });
        },

        toggleVista: function () {
            const btn = this.$el.find('#btn-toggle-vista');

            if (this.modoVista === 'lista') {
                this.modoVista = 'kanban';
                btn.html('<i class="fas fa-list"></i> Ver como Lista');
                this.$el.find('#vista-lista-container').hide();
                this.$el.find('#vista-kanban-container').show();
                this.kanbanPaginas = {};
                this.cargarKanban();
            } else {
                this.modoVista = 'lista';
                btn.html('<i class="fas fa-columns"></i> Ver por Estados');
                this.$el.find('#vista-kanban-container').hide();
                this.$el.find('#vista-lista-container').show();
                this.cargarLeads();
            }
        },

        cargarPermisos: function () {
            const self = this;
            Espo.Ajax.getRequest("Usuarios/action/getUserInfo")
                .then(function (response) {
                    if (response.success && response.data) {
                        self.permisos = {
                            esAdmin:        response.data.esAdmin,
                            esCasaNacional: response.data.esCasaNacional,
                            esGerente:      response.data.esGerente || false,
                            esDirector:     response.data.esDirector || false,
                            esCoordinador:  response.data.esCoordinador || false,
                            claUsuario:     response.data.claUsuario,
                            oficinaUsuario: response.data.oficinaUsuario,
                            userId:         response.data.userId
                        };
                    }
                    self.configurarFiltros();
                })
                .catch(function () {
                    self.configurarFiltros();
                });
        },

        configurarFiltros: function () {
            const p = this.permisos;
            const esCN = p.esAdmin || p.esCasaNacional;
            const esGestion = p.esGerente || p.esDirector || p.esCoordinador;

            if (!esCN) {
                this.$el.find('#fila-cla-oficina').hide();
            }
            if (!esCN && !esGestion) {
                this.$el.find('#fila-asesor').hide();
            }

            if (esCN) {
                this.cargarCLAs();
            } else if (esGestion && p.oficinaUsuario) {
                this.cargarAsesoresPorOficina(p.oficinaUsuario);
                this.cargarLeads();
            } else {
                this.cargarLeads();
            }
        },

        cargarCLAs: function () {
            const self = this;
            Espo.Ajax.getRequest("Usuarios/action/getCLAs")
                .then(function (response) {
                    if (response.success && response.data) {
                        const select = self.$el.find('#filtro-cla');
                        select.empty().append('<option value="">Todos los CLAs</option>');
                        response.data.forEach(function (cla) {
                            select.append('<option value="' + cla.id + '">' + cla.name + '</option>');
                        });
                        select.prop('disabled', false);
                    }
                    self.cargarLeads();
                })
                .catch(function () {
                    self.cargarLeads();
                });
        },

        onCLAChange: function (claId) {
            const self = this;
            const oficinaSelect = this.$el.find('#filtro-oficina');
            const asesorSelect  = this.$el.find('#filtro-asesor');

            this.filtros.cla     = claId || null;
            this.filtros.oficina = null;
            this.filtros.asesor  = null;
            asesorSelect.html('<option value="">Todos los asesores</option>').prop('disabled', true);

            if (!claId) {
                oficinaSelect.html('<option value="">Seleccione un CLA primero</option>').prop('disabled', true);
                return;
            }

            oficinaSelect.html('<option value="">Cargando...</option>').prop('disabled', true);

            Espo.Ajax.getRequest("Usuarios/action/getOficinasByCLA", { claId: claId })
                .then(function (response) {
                    if (response.success && response.data) {
                        oficinaSelect.empty().append('<option value="">Todas las oficinas</option>');
                        response.data.forEach(function (o) {
                            oficinaSelect.append('<option value="' + o.id + '">' + o.name + '</option>');
                        });
                        oficinaSelect.prop('disabled', false);
                    }
                })
                .catch(function () {});
        },

        onOficinaChange: function (oficinaId) {
            this.filtros.oficina = oficinaId || null;
            this.filtros.asesor  = null;

            const asesorSelect = this.$el.find('#filtro-asesor');

            if (!oficinaId) {
                asesorSelect.html('<option value="">Todos los asesores</option>').prop('disabled', true);
                return;
            }

            this.cargarAsesoresPorOficina(oficinaId);
        },

        cargarAsesoresPorOficina: function (oficinaId) {
            const self = this;
            const asesorSelect = this.$el.find('#filtro-asesor');
            asesorSelect.html('<option value="">Cargando...</option>').prop('disabled', true);

            Espo.Ajax.getRequest("Leads/action/getAsesoresPorOficina", { oficinaId: oficinaId })
                .then(function (response) {
                    if (response.success && response.data) {
                        asesorSelect.empty().append('<option value="">Todos los asesores</option>');
                        response.data.forEach(function (a) {
                            asesorSelect.append('<option value="' + a.id + '">' + a.name + '</option>');
                        });
                        asesorSelect.prop('disabled', false);
                    }
                })
                .catch(function () {
                    asesorSelect.html('<option value="">Error al cargar</option>').prop('disabled', false);
                });
        },

        aplicarFiltros: function () {
            this.filtros = {
                cla:     this.$el.find('#filtro-cla').val()     || null,
                oficina: this.$el.find('#filtro-oficina').val() || null,
                asesor:  this.$el.find('#filtro-asesor').val()  || null,
                interes: this.$el.find('#filtro-interes').val() || null,
                stage:   this.$el.find('#filtro-stage').val()   || null
            };

            if (this.modoVista === 'lista') {
                this.cargarLeads();
            } else {
                this.cargarKanban();
            }
        },

        limpiarFiltros: function () {
            this.$el.find('#filtro-cla').val('');
            this.$el.find('#filtro-oficina')
                .html('<option value="">Seleccione un CLA primero</option>')
                .prop('disabled', true);
            this.$el.find('#filtro-asesor')
                .html('<option value="">Todos los asesores</option>')
                .prop('disabled', true);
            this.$el.find('#filtro-interes').val('');
            this.$el.find('#filtro-stage').val('');

            this.filtros = { cla: null, oficina: null, asesor: null, interes: null, stage: null };
            this.paginacion.pagina = 1;
            this.kanbanPaginas = {};

            if (this.modoVista === 'lista') {
                this.cargarLeads();
            } else {
                this.cargarKanban();
            }
        },

        // ============ MODO LISTA ============

        cargarLeads: function () {
            if (this.cargando) return;
            this.cargando = true;
            this.mostrarLoadingLista();

            const params = {
                pagina:    this.paginacion.pagina,
                porPagina: this.paginacion.porPagina
            };

            if (this.filtros.cla)     params.claId     = this.filtros.cla;
            if (this.filtros.oficina) params.oficinaId = this.filtros.oficina;
            if (this.filtros.asesor)  params.asesorId  = this.filtros.asesor;
            if (this.filtros.interes) params.interes   = this.filtros.interes;
            if (this.filtros.stage)   params.stage     = this.filtros.stage;

            const self = this;
            Espo.Ajax.getRequest("Leads/action/getLista", params)
                .then(function (response) {
                    self.cargando = false;
                    if (response.success) {
                        self.leads = response.data;
                        self.paginacion.total = response.total;
                        self.paginacion.totalPaginas = response.totalPaginas;
                        self.renderizarLista();
                    } else {
                        self.mostrarErrorLista(response.error || 'Error al cargar leads');
                    }
                })
                .catch(function () {
                    self.cargando = false;
                    self.mostrarErrorLista('Error de conexión');
                });
        },

        mostrarLoadingLista: function () {
            this.$el.find('#vista-lista-container').html(`
                <div class="int-loading">
                    <div class="int-spinner"></div>
                    <p>Cargando leads...</p>
                </div>`);
        },

        mostrarErrorLista: function (msg) {
            this.$el.find('#vista-lista-container').html(`
                <div class="int-alert int-alert-danger">
                    <i class="fas fa-exclamation-circle"></i> ${msg}
                </div>`);
        },

        renderizarLista: function () {
            const self = this;
            const container = this.$el.find('#vista-lista-container');

            if (!this.leads.length) {
                container.html(`
                    <div class="int-no-data">
                        <i class="fas fa-bullseye"></i>
                        <h3>No hay leads</h3>
                        <p>No se encontraron leads con los filtros seleccionados</p>
                    </div>`);
                return;
            }

            const inicio = (this.paginacion.pagina - 1) * this.paginacion.porPagina + 1;
            const fin    = Math.min(this.paginacion.pagina * this.paginacion.porPagina, this.paginacion.total);

            let html = `<div class="int-contador">
                Mostrando ${inicio}–${fin} de <strong>${this.paginacion.total}</strong> leads
            </div><div>`;

            this.leads.forEach(function (lead) {
                html += `
                <div class="int-usuario-card" data-id="${lead.id}">
                    <div class="row align-items-center">
                        <div class="col-md-12">
                            <div class="int-usuario-nombre">
                                ${self.escapeHtml(lead.name || '—')}
                                <span class="int-badge int-badge-rol ms-2">
                                    ${self.escapeHtml(lead.stageLabel || '—')}
                                </span>
                            </div>
                            <div class="int-usuario-detalle">
                                <div class="int-usuario-detalle-item" style="flex-basis:100%;">
                                    <i class="fas fa-align-left"></i>
                                    <span>${self.escapeHtml(lead.description || 'Sin descripción')}</span>
                                </div>
                                <div class="int-usuario-detalle-item">
                                    <i class="fas fa-user-tie"></i>
                                    <span>${self.escapeHtml(lead.assignedUserName || '—')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            });

            html += '</div>';
            html += this.renderPaginacion();
            container.html(html);

            container.find('.int-usuario-card').on('click', function () {
                const id = $(this).data('id');
                if (id) {
                    self.getRouter().navigate('#ListaLeads/view/' + id, { trigger: true });
                }
            });

            container.find('.int-pag-btn').on('click', function () {
                const p = parseInt($(this).data('pagina'), 10);
                if (!isNaN(p)) self.irAPagina(p);
            });
        },

        renderPaginacion: function () {
            const pag = this.paginacion;
            if (pag.totalPaginas <= 1) return '';

            const actual = pag.pagina;
            const total  = pag.totalPaginas;
            const pages  = [];
            const rango  = 2;
            let ini = Math.max(2, actual - rango);
            let fin = Math.min(total - 1, actual + rango);

            pages.push(1);
            if (ini > 2) pages.push('...');
            for (let i = ini; i <= fin; i++) pages.push(i);
            if (fin < total - 1) pages.push('...');
            if (total > 1) pages.push(total);

            let html = '<div class="int-paginacion">';
            html += '<div class="int-pag-info">Página ' + actual + ' de ' + total + '</div>';
            html += '<div class="int-pag-controles">';
            html += '<button class="int-pag-btn int-pag-nav' + (actual <= 1 ? ' disabled' : '') + '" data-pagina="' + (actual - 1) + '"><i class="fas fa-chevron-left"></i></button>';

            pages.forEach(function (p) {
                if (p === '...') {
                    html += '<span class="int-pag-ellipsis">…</span>';
                } else {
                    html += '<button class="int-pag-btn' + (p === actual ? ' active' : '') + '" data-pagina="' + p + '">' + p + '</button>';
                }
            });

            html += '<button class="int-pag-btn int-pag-nav' + (actual >= total ? ' disabled' : '') + '" data-pagina="' + (actual + 1) + '"><i class="fas fa-chevron-right"></i></button>';
            html += '</div></div>';
            return html;
        },

        irAPagina: function (pagina) {
            if (pagina < 1 || pagina > this.paginacion.totalPaginas || this.cargando) return;
            this.paginacion.pagina = pagina;
            this.cargarLeads();
        },

        // ============ MODO KANBAN ============

        cargarKanban: function () {
            if (this.cargando) return;
            this.cargando = true;
            this.mostrarLoadingKanban();

            const params = {
                porColumna: 25,
                paginas: JSON.stringify(this.kanbanPaginas)
            };

            if (this.filtros.cla)     params.claId     = this.filtros.cla;
            if (this.filtros.oficina) params.oficinaId = this.filtros.oficina;
            if (this.filtros.asesor)  params.asesorId  = this.filtros.asesor;
            if (this.filtros.interes) params.interes   = this.filtros.interes;
            if (this.filtros.stage)   params.stage     = this.filtros.stage;

            const self = this;
            Espo.Ajax.getRequest("Leads/action/getKanban", params)
                .then(function (response) {
                    self.cargando = false;
                    if (response.success) {
                        self.renderizarKanban(response.data);
                    } else {
                        self.mostrarErrorKanban(response.error || 'Error al cargar leads');
                    }
                })
                .catch(function () {
                    self.cargando = false;
                    self.mostrarErrorKanban('Error de conexión');
                });
        },

        mostrarLoadingKanban: function () {
            this.$el.find('#vista-kanban-container').html(`
                <div class="int-loading">
                    <div class="int-spinner"></div>
                    <p>Cargando leads...</p>
                </div>`);
        },

        mostrarErrorKanban: function (msg) {
            this.$el.find('#vista-kanban-container').html(`
                <div class="int-alert int-alert-danger">
                    <i class="fas fa-exclamation-circle"></i> ${msg}
                </div>`);
        },

        renderizarKanban: function (columnas) {
            const self = this;
            const container = this.$el.find('#vista-kanban-container');

            if (!columnas.length) {
                container.html(`
                    <div class="int-no-data">
                        <i class="fas fa-columns"></i>
                        <h3>No hay leads</h3>
                        <p>No se encontraron leads con los filtros seleccionados</p>
                    </div>`);
                return;
            }

            let html = '<div class="int-kanban-board">';

            columnas.forEach(function (col) {
                html += `
                <div class="int-kanban-col" data-stage="${self.escapeHtml(col.stage)}">
                    <div class="int-kanban-col-header">
                        <span class="int-kanban-col-title">${self.escapeHtml(col.stageLabel)}</span>
                        <span class="int-kanban-col-count">${col.total}</span>
                    </div>
                    <div class="int-kanban-col-body">`;

                if (!col.items.length) {
                    html += `<div class="int-kanban-empty">Sin leads</div>`;
                } else {
                    col.items.forEach(function (lead) {
                        html += `
                        <div class="int-kanban-card" data-id="${lead.id}">
                            <div class="int-kanban-card-nombre">${self.escapeHtml(lead.name || '—')}</div>
                            <div class="int-kanban-card-interes">
                                <i class="fas fa-tag"></i> ${self.escapeHtml(lead.cInteres || '—')}
                            </div>
                            <div class="int-kanban-card-footer">
                                <span class="int-badge int-badge-rol">${self.escapeHtml(col.stageLabel)}</span>
                            </div>
                        </div>`;
                    });
                }

                html += `</div>`;

                if (col.totalPaginas > 1) {
                    html += self.renderPaginacionKanban(col);
                }

                html += `</div>`;
            });

            html += '</div>';
            container.html(html);

            container.find('.int-kanban-card').on('click', function () {
                const id = $(this).data('id');
                if (id) {
                    self.getRouter().navigate('#ListaLeads/view/' + id, { trigger: true });
                }
            });

            container.find('.int-kanban-pag-btn').on('click', function () {
                const stage = $(this).closest('.int-kanban-col').data('stage');
                const p = parseInt($(this).data('pagina'), 10);
                if (!isNaN(p)) {
                    self.kanbanPaginas[stage] = p;
                    self.cargarKanban();
                }
            });
        },

        renderPaginacionKanban: function (col) {
            const actual = col.pagina;
            const total  = col.totalPaginas;

            let html = '<div class="int-kanban-col-pag">';
            html += `<button class="int-kanban-pag-btn${actual <= 1 ? ' disabled' : ''}" data-pagina="${actual - 1}">
                <i class="fas fa-chevron-left"></i></button>`;
            html += `<span class="int-kanban-pag-info">${actual}/${total}</span>`;
            html += `<button class="int-kanban-pag-btn${actual >= total ? ' disabled' : ''}" data-pagina="${actual + 1}">
                <i class="fas fa-chevron-right"></i></button>`;
            html += '</div>';
            return html;
        },

        escapeHtml: function (text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = String(text);
            return div.innerHTML;
        }
    });
});