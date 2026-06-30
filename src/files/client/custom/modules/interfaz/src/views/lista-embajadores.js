define("interfaz:views/lista-embajadores", ["view"], function (Dep) {
    return Dep.extend({
        template: "interfaz:lista-embajadores",

        setup: function () {
            this.paginaActual = this.options.paginaInicial || 1;
            this.embajadores = [];
            this.filtros = {
                cla: null,
                oficina: null,
                asesor: null,
                status: null
            };
            this.paginacion = {
                pagina: this.paginaActual,
                porPagina: 25,
                total: 0,
                totalPaginas: 0
            };
            this.cargando = false;
            this.permisos = {
                esAdmin: false,
                esCasaNacional: false,
                esGerente: false,
                esDirector: false,
                esCoordinador: false,
                esAsesor: false,
                claUsuario: null,
                oficinaUsuario: null,
                userId: null
            };
        },

        afterRender: function () {
            this.setupEventListeners();
            this.cargarPermisos();
        },

        setupEventListeners: function () {
            const self = this;

            this.$el.find('[data-action="aplicar-filtros"]').on('click', function () {
                self.paginacion.pagina = 1;
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

            this.$el.find('#btn-crear-embajador').on('click', function () {
                self.crearEmbajador();
            });
        },

        crearEmbajador: function () {
            const self = this;
            const btn = this.$el.find('#btn-crear-embajador');
            btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Creando...');

            Espo.Ajax.postRequest('Embajadores/action/crear', {})
                .then(function (response) {
                    if (response.success) {
                        self.getRouter().navigate('#ListaEmbajadores/view/' + response.id, { trigger: true });
                    } else {
                        Espo.Ui.error(response.error || 'Error al crear embajador');
                        btn.prop('disabled', false).html('<i class="fas fa-plus"></i> Nuevo Embajador');
                    }
                })
                .catch(function () {
                    Espo.Ui.error('Error de conexión');
                    btn.prop('disabled', false).html('<i class="fas fa-plus"></i> Nuevo Embajador');
                });
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
                            esAsesor:       response.data.esAsesor || false,
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
            const self = this;
            const p = this.permisos;
            const esCN = p.esAdmin || p.esCasaNacional;
            const esGestion = p.esGerente || p.esDirector || p.esCoordinador;

            // Mostrar/ocultar fila CLA+Oficina
            if (!esCN) {
                this.$el.find('#fila-cla-oficina').hide();
            }

            // Mostrar/ocultar fila Asesor
            if (!esCN && !esGestion) {
                this.$el.find('#fila-asesor').hide();
            }

            // Si es CN cargar CLAs
            if (esCN) {
                this.cargarCLAs();
            } else if (esGestion && p.oficinaUsuario) {
                // Cargar asesores de su oficina
                this.cargarAsesoresPorOficina(p.oficinaUsuario);
                this.cargarEmbajadores();
            } else {
                this.cargarEmbajadores();
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
                    self.cargarEmbajadores();
                })
                .catch(function () {
                    self.cargarEmbajadores();
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
                this.cargarEmbajadores();
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
                    self.cargarEmbajadores();
                })
                .catch(function () {
                    self.cargarEmbajadores();
                });
        },

        onOficinaChange: function (oficinaId) {
            const self = this;
            this.filtros.oficina = oficinaId || null;
            this.filtros.asesor  = null;

            const asesorSelect = this.$el.find('#filtro-asesor');

            if (!oficinaId) {
                asesorSelect.html('<option value="">Todos los asesores</option>').prop('disabled', true);
                this.cargarEmbajadores();
                return;
            }

            this.cargarAsesoresPorOficina(oficinaId);
        },

        cargarAsesoresPorOficina: function (oficinaId) {
            const self = this;
            const asesorSelect = this.$el.find('#filtro-asesor');
            asesorSelect.html('<option value="">Cargando...</option>').prop('disabled', true);

            Espo.Ajax.getRequest("Usuarios/action/getAsesoresPorOficina", { oficinaId: oficinaId })
                .then(function (response) {
                    if (response.success && response.data) {
                        asesorSelect.empty().append('<option value="">Todos los asesores</option>');
                        response.data.forEach(function (a) {
                            asesorSelect.append('<option value="' + a.id + '">' + a.name + '</option>');
                        });
                        asesorSelect.prop('disabled', false);
                    }
                    self.cargarEmbajadores();
                })
                .catch(function () {
                    asesorSelect.html('<option value="">Error al cargar</option>').prop('disabled', false);
                    self.cargarEmbajadores();
                });
        },

        aplicarFiltros: function () {
            this.filtros = {
                cla:     this.$el.find('#filtro-cla').val()    || null,
                oficina: this.$el.find('#filtro-oficina').val() || null,
                asesor:  this.$el.find('#filtro-asesor').val()  || null,
                status:  this.$el.find('#filtro-status').val()  || null
            };
            this.paginacion.pagina = 1;
            this.cargarEmbajadores();
        },

        limpiarFiltros: function () {
            this.$el.find('#filtro-cla').val('');
            this.$el.find('#filtro-oficina')
                .html('<option value="">Seleccione un CLA primero</option>')
                .prop('disabled', true);
            this.$el.find('#filtro-asesor')
                .html('<option value="">Todos los asesores</option>')
                .prop('disabled', true);
            this.$el.find('#filtro-status').val('');

            this.filtros = { cla: null, oficina: null, asesor: null, status: null };
            this.paginacion.pagina = 1;
            this.cargarEmbajadores();
        },

        cargarEmbajadores: function () {
            if (this.cargando) return;
            this.cargando = true;
            this.mostrarLoading();

            const params = {
                pagina:    this.paginacion.pagina,
                porPagina: this.paginacion.porPagina
            };

            if (this.filtros.cla)     params.claId     = this.filtros.cla;
            if (this.filtros.oficina) params.oficinaId = this.filtros.oficina;
            if (this.filtros.asesor)  params.asesorId  = this.filtros.asesor;
            if (this.filtros.status)  params.status    = this.filtros.status;

            const self = this;
            Espo.Ajax.getRequest("Embajadores/action/getLista", params)
                .then(function (response) {
                    self.cargando = false;
                    if (response.success) {
                        self.embajadores       = response.data;
                        self.paginacion.total  = response.total;
                        self.paginacion.totalPaginas = response.totalPaginas;
                        self.renderizarLista();
                    } else {
                        self.mostrarError(response.error || 'Error al cargar embajadores');
                    }
                })
                .catch(function () {
                    self.cargando = false;
                    self.mostrarError('Error de conexión');
                });
        },

        mostrarLoading: function () {
            this.$el.find('#lista-container').html(`
                <div class="int-loading">
                    <div class="int-spinner"></div>
                    <p>Cargando embajadores...</p>
                </div>`);
        },

        mostrarError: function (msg) {
            this.$el.find('#lista-container').html(`
                <div class="int-alert int-alert-danger">
                    <i class="fas fa-exclamation-circle"></i> ${msg}
                </div>`);
        },

        renderizarLista: function () {
            const self     = this;
            const container = this.$el.find('#lista-container');

            if (!this.embajadores.length) {
                container.html(`
                    <div class="int-no-data">
                        <i class="fas fa-address-card"></i>
                        <h3>No hay embajadores</h3>
                        <p>No se encontraron embajadores con los filtros seleccionados</p>
                    </div>`);
                return;
            }

            const inicio = (this.paginacion.pagina - 1) * this.paginacion.porPagina + 1;
            const fin    = Math.min(this.paginacion.pagina * this.paginacion.porPagina, this.paginacion.total);

            let html = `<div class="int-contador">
                Mostrando ${inicio}–${fin} de <strong>${this.paginacion.total}</strong> embajadores
            </div><div>`;

            this.embajadores.forEach(function (emb) {
                const nombre = [emb.firstName, emb.lastName].filter(Boolean).join(' ') || '—';
                const iniciales = nombre.substring(0, 2).toUpperCase();

                const avatarHtml = emb.photoUrl
                    ? `<img src="${emb.photoUrl}" class="int-usuario-avatar-img" alt="${self.escapeHtml(nombre)}"
                           onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                       <div class="int-usuario-avatar" style="display:none;">${iniciales}</div>`
                    : `<div class="int-usuario-avatar">${iniciales}</div>`;

                const statusMap = {
                    '0': { label: 'Pendiente',  color: '#3498db' },
                    '1': { label: 'En proceso', color: '#f39c12' },
                    '2': { label: 'Activo',     color: '#27ae60' },
                    '3': { label: 'Inactivo',   color: '#e74c3c' }
                };
                const st = statusMap[emb.status] || { label: emb.status || '—', color: '#666' };

                html += `
                <div class="int-usuario-card" data-id="${emb.id}">
                    <div class="row align-items-center">
                        <div class="col-md-2 col-sm-3 text-center">
                            <div style="position:relative;display:inline-block;">
                                ${avatarHtml}
                            </div>
                        </div>
                        <div class="col-md-10 col-sm-9">
                            <div class="int-usuario-nombre">
                                ${self.escapeHtml(nombre)}
                                <span class="int-badge ms-2"
                                    style="background:${st.color};color:white;">
                                    ${self.escapeHtml(st.label)}
                                </span>
                            </div>
                            <div class="int-usuario-detalle">
                                <div class="int-usuario-detalle-item">
                                    <i class="fas fa-envelope"></i>
                                    <span>${self.escapeHtml(emb.emailAddress || '—')}</span>
                                </div>
                                <div class="int-usuario-detalle-item">
                                    <i class="fas fa-building"></i>
                                    <span>${self.escapeHtml(emb.teamName || '—')}</span>
                                </div>
                                <div class="int-usuario-detalle-item">
                                    <i class="fas fa-user-tie"></i>
                                    <span>${self.escapeHtml(emb.assignedUserName || '—')}</span>
                                </div>
                                <div class="int-usuario-detalle-item">
                                    <i class="fas fa-calendar-alt"></i>
                                    <span>${emb.createdAt
                                        ? new Date(emb.createdAt).toLocaleDateString('es-ES',
                                            {day:'2-digit',month:'2-digit',year:'numeric'})
                                        : '—'}</span>
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
                    self.getRouter().navigate('#ListaEmbajadores/view/' + id, { trigger: true });
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
            this.cargarEmbajadores();
        },

        escapeHtml: function (text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = String(text);
            return div.innerHTML;
        }
    });
});